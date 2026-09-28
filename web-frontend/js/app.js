/**
 * PROYECTO: Control Solicitud de Pedidos Materiales
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: Google AI Studio & Antigravity IDE
 * ROL: Controlador Principal de Interfaz de Usuario y Lógica PWA
 */

const MAX_LINES = 30;

// Listas base de fallback (se sobreescriben dinámicamente con Base_Datos de Google Sheets)
let SECTORES = [
  "Cimentación / Fundaciones",
  "Estructura Hormigón",
  "Mampostería / Muros",
  "Instalaciones Eléctricas",
  "Instalaciones Sanitarias",
  "Terminaciones / Acabados",
  "Cubiertas y Techos"
];

let MATERIALES = [
  "Cemento Gris Portland",
  "Cemento Blanco",
  "Arena Lavada",
  "Arena Amarilla",
  "Grava / Piedra Picada 3/4\"",
  "Cabilla / Acero Corrugado 3/8\"",
  "Cabilla / Acero Corrugado 1/2\"",
  "Tubo PVC Presión 2\"",
  "Alambre Recocido #16",
  "Bloque de Concreto 15x20x40"
];

let UNIDADES = [
  "Unidad (und)",
  "Bolsas / Sacos",
  "Metro lineal (m)",
  "Metro cuadrado (m²)",
  "Metro cúbico (m³)",
  "Kilogramo (kg)",
  "Tonelada (t)"
];

// Mapa relacional de Material -> Métrica automática (precargado y sincronizado dinámicamente)
let MATERIAL_METRICAS = {
  "Cemento Gris Portland": "Saco / Bolsa",
  "Cemento Blanco": "Saco / Bolsa",
  "Arena Lavada": "Metro cúbico (m³)",
  "Arena Amarilla": "Metro cúbico (m³)",
  "Grava / Piedra Picada 3/4\"": "Metro cúbico (m³)",
  "Cabilla / Acero Corrugado 3/8\"": "Varilla / Barra",
  "Cabilla / Acero Corrugado 1/2\"": "Varilla / Barra",
  "Cabilla / Acero Corrugado 5/8\"": "Varilla / Barra",
  "Malla Electrosoldada": "Rollo",
  "Alambre Dulce / Recocido Cal. 18": "Kilogramo (kg)",
  "Bloque de Arcilla 10x20x30 cm": "Pieza (pza)",
  "Bloque de Arcilla 15x20x30 cm": "Pieza (pza)",
  "Bloque de Concreto 15x20x40 cm": "Pieza (pza)",
  "Ladrillo Macizo": "Pieza (pza)",
  "Yeso de Construcción": "Saco / Bolsa",
  "Pego / Mortero Adhesivo": "Saco / Bolsa",
  "Cal Hidratada": "Saco / Bolsa",
  "Tubo PVC Aguas Negras 4\"": "Tramo / Tubo",
  "Tubo PVC Aguas Negras 2\"": "Tramo / Tubo",
  "Tubo PVC Aguas Blancas 1/2\"": "Tramo / Tubo",
  "Tubo PVC Aguas Blancas 3/4\"": "Tramo / Tubo",
  "Pegamento para PVC": "Litro (L)",
  "Cable Eléctrico THW #12 AWG": "Metro lineal (m)",
  "Cable Eléctrico THW #10 AWG": "Metro lineal (m)",
  "Cable Eléctrico THW #14 AWG": "Metro lineal (m)",
  "Tubería EMT / Conduflex 1/2\"": "Tramo / Tubo",
  "Tablas de Madera para Encofrado": "Pieza (pza)",
  "Cuartones / Tirantes de Madera": "Pieza (pza)",
  "Clavos de Madera con Cabeza (2\"-4\")": "Kilogramo (kg)",
  "Clavos de Acero para Concreto": "Kilogramo (kg)",
  "Pintura de Caucho para Interior": "Cuñete (5 gal)",
  "Pintura de Esmalte Sintético": "Galón (gal)",
  "Fondo Anticorrosivo": "Galón (gal)",
  "Lámina de Drywall 1/2\"": "Plancha / Lámina",
  "Perfil Perimetral / Montante Drywall": "Pieza (pza)",
  "Tornillos Drywall Autoperforantes": "Caja",
  "Cinta para Juntas Drywall": "Rollo",
  "Pasta Profesional para Drywall": "Cuñete (5 gal)",
  "Impermeabilizante Asfáltico": "Cuñete (5 gal)",
  "Manto Asfáltico 3 mm": "Rollo",
  "Disco de Corte para Concreto 4-1/2\"": "Pieza (pza)",
  "Cinta de Peligro / Señalización": "Rollo",
  "Repuestos para Aires Acondicionados": "Unidad (und)"
};

const INITIAL_ROWS = [
  { sector: "", material: "", unidad: "", cantidad: "", fotos: [] },
  { sector: "", material: "", unidad: "", cantidad: "", fotos: [] }
];

let currentRows = [];
let baseDatosCache = null;

/**
 * Comprime una imagen en el cliente utilizando HTML5 Canvas.
 * Limita la dimensión máxima a 1280px y aplica compresión JPEG (calidad 0.75).
 * Genera un payload ligero de ~150-250 KB en Base64 DataURL.
 * @param {File} file
 * @param {number} maxDimension
 * @param {number} quality
 * @return {Promise<string>}
 */
async function compressImage(file, maxDimension = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return reject(new Error('El archivo seleccionado no es una imagen válida.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo fotográfico.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Error al decodificar la imagen seleccionada.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('No se pudo inicializar el lienzo Canvas de compresión.'));
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ============================================
// INICIALIZACIÓN
// ============================================

async function initApp() {
  loadTheme();
  setDefaultDate();
  updateClock();
  setInterval(updateClock, 30000);

  // Inicializar filas por defecto (2 líneas limpias)
  currentRows = JSON.parse(JSON.stringify(INITIAL_ROWS));
  renderRows();

  // Inicializar motor de sincronización de red
  SYNC.init();

  // Verificar configuración
  if (SHEETS_API.isConfigured()) {
    await loadAppData();
  } else {
    showSetupScreen();
  }

  setupEventListeners();
}

function setupEventListeners() {
  const themeToggle = document.getElementById('themeToggleBtn');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // Tecla Escape para cerrar modales flotantes
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (typeof closeSetupModal === 'function') closeSetupModal();
      if (typeof closeEngineerModal === 'function') closeEngineerModal();
      if (typeof closeModal === 'function') closeModal();
    }
  });
}

/**
 * Carga los datos de la app usando Stale-While-Revalidate
 */
async function loadAppData() {
  try {
    showCacheStatus('⚡ Cargando datos...');
    
    // Obtener catálogos con revalidación en segundo plano
    const baseDatos = await SHEETS_API.getBaseDatos((freshData) => {
      baseDatosCache = freshData;
      populateDropdowns(freshData);
      showCacheStatus('✅ Datos actualizados');
    });

    if (baseDatos) {
      baseDatosCache = baseDatos;
      populateDropdowns(baseDatos);
      showCacheStatus('⚡ Datos cargados (Instantáneo)');
    }

    // Precargar datos en background para inicializar contadores e insignias desde el arranque
    SHEETS_API.getEntradasObra().then(data => {
      if (Array.isArray(data)) {
        entradasObraData = data;
        updateEntradasBadges();
      }
    }).catch(() => {});

    SHEETS_API.getUsosObra().then(data => {
      if (Array.isArray(data)) {
        usosObraData = data;
        updateUsosBadges();
      }
    }).catch(() => {});

    SHEETS_API.getSolicitudes().then(data => {
      if (Array.isArray(data)) {
        historialSolicitudesData = data;
        renderHistorialSolicitudes();
      }
    }).catch(() => {});
  } catch (e) {
    console.warn('[App] Error al cargar datos remotos, usando caché/local:', e.message);
    showCacheStatus('⚠️ Modo offline - Datos locales');
  }
}

// ============================================
// DROPDOWNS DINÁMICOS DESDE BASE_DATOS
// ============================================

function populateDropdowns(baseDatos) {
  if (!baseDatos) return;

  // 1. Ingenieros / Solicitantes
  const profesionalList = document.getElementById('profesionalesList');
  if (profesionalList && Array.isArray(baseDatos.ingenieros)) {
    profesionalList.innerHTML = baseDatos.ingenieros
      .filter(v => v && String(v).trim())
      .map(name => `<option value="${name}">${name}</option>`)
      .join('');
  }

  // 2. Obras
  const obraSelect = document.getElementById('obraSelect');
  const masterObraSelect = document.getElementById('masterObraSelect');
  const newEngineerProject = document.getElementById('newEngineerProject');

  if (Array.isArray(baseDatos.obras)) {
    const validObras = baseDatos.obras.filter(v => v && String(v).trim());

    if (obraSelect) {
      const currentObra = obraSelect.value;
      const obrasOptions = '<option disabled selected value="">Seleccione la obra activa...</option>' +
        validObras.map(name => `<option value="${name}">${name}</option>`).join('') +
        '<option value="__new_obra__">➕ Nueva obra…</option>';
      obraSelect.innerHTML = obrasOptions;
      if (currentObra) obraSelect.value = currentObra;
    }

    if (masterObraSelect) {
      const currentMaster = masterObraSelect.value;
      const masterOptions = '<option value="">Todas las obras...</option>' +
        validObras.map(name => `<option value="${name}">${name}</option>`).join('');
      masterObraSelect.innerHTML = masterOptions;
      if (currentMaster) masterObraSelect.value = currentMaster;
    }

    if (newEngineerProject) {
      newEngineerProject.innerHTML = '<option value="">Asignar a obra...</option>' +
        validObras.map(name => `<option value="${name}">${name}</option>`).join('');
    }
  }

  // 3. Catálogos para las líneas de materiales
  if (Array.isArray(baseDatos.sectores) && baseDatos.sectores.length > 0) {
    SECTORES = baseDatos.sectores.filter(v => v && String(v).trim());
  }
  if (Array.isArray(baseDatos.materiales) && baseDatos.materiales.length > 0) {
    MATERIALES = baseDatos.materiales.filter(v => v && String(v).trim());
  }
  if (Array.isArray(baseDatos.metricas) && baseDatos.metricas.length > 0) {
    UNIDADES = baseDatos.metricas.filter(v => v && String(v).trim());
  }
  if (baseDatos.materialMetricas && typeof baseDatos.materialMetricas === 'object') {
    MATERIAL_METRICAS = { ...MATERIAL_METRICAS, ...baseDatos.materialMetricas };
  }

  // Sincronizar automáticamente la métrica en cada fila según su material
  currentRows.forEach(r => {
    if (r.material && (!r.unidad || MATERIAL_METRICAS[r.material])) {
      r.unidad = MATERIAL_METRICAS[r.material] || r.unidad || '';
    }
  });

  // Refrescar líneas con las nuevas opciones de catálogo
  renderRows();
}

// ============================================
// GESTIÓN DE LÍNEAS DE MATERIALES
// ============================================

/**
 * Construye el bloque inline "Agregar Nuevo..." dentro de un campo.
 * Aparece oculto y se muestra cuando el usuario elige la opción ➕ del select.
 */
function buildNewFieldWrap(wrapId, inputId, placeholder, saveFn, cancelFn) {
  return `
      <div id="${wrapId}" class="hidden mt-2 space-y-2 rounded-xl bg-surface-container-low dark:bg-[#0f172a] border border-emerald-600/40 p-3 fade-in">
        <label class="font-label-sm text-on-surface-variant dark:text-slate-300">Nuevo ${placeholder}</label>
        <div class="flex gap-2">
          <input type="text" id="${inputId}" class="w-full h-10 px-3 rounded-lg bg-surface-container-lowest dark:bg-slate-800 text-on-surface dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-body-md focus:ring-2 focus:ring-emerald-600 focus:outline-none" placeholder="Escribe el nuevo ${placeholder}">
          <button type="button" onclick="${saveFn}" class="px-4 h-10 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white font-label-sm font-bold shrink-0 shadow-sm">Guardar</button>
          <button type="button" onclick="${cancelFn}" class="px-3 h-10 rounded-lg bg-surface-container dark:bg-slate-800 text-on-surface dark:text-slate-300 font-label-sm shrink-0">Cancelar</button>
        </div>
      </div>`;
}

function buildNewMaterialWrap(index) {
  const unidadOpts = Array.from(new Set(UNIDADES)).filter(Boolean);
  const optionsHtml = unidadOpts.map(u => `<option value="${u}">`).join('');
  return `
    <div id="newMaterialWrap-${index}" class="hidden mt-2 space-y-2.5 rounded-xl bg-surface-container-low dark:bg-[#0f172a] border border-emerald-600/40 p-3.5 fade-in">
      <label class="font-label-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[16px]">add_circle</span> Registrar Nuevo Material en Catálogo
      </label>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] text-on-surface-variant dark:text-slate-400 font-medium mb-1 block">Nombre del Material</label>
          <input type="text" id="newMaterialInput-${index}" class="w-full h-10 px-3 rounded-lg bg-surface-container-lowest dark:bg-slate-800 text-on-surface dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-body-md focus:ring-2 focus:ring-emerald-600 focus:outline-none text-sm" placeholder="Ej: Pego Gris Especial">
        </div>
        <div>
          <label class="text-[11px] text-on-surface-variant dark:text-slate-400 font-medium mb-1 block">Métrica / Unidad Asociada</label>
          <input type="text" id="newMaterialMetricInput-${index}" list="metricList-${index}" class="w-full h-10 px-3 rounded-lg bg-surface-container-lowest dark:bg-slate-800 text-on-surface dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-body-md focus:ring-2 focus:ring-emerald-600 focus:outline-none text-sm" placeholder="Ej: Saco / Bolsa">
          <datalist id="metricList-${index}">
            ${optionsHtml}
          </datalist>
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-1">
        <button type="button" onclick="cancelNewMaterial(${index})" class="px-3 h-9 rounded-lg bg-surface-container dark:bg-slate-800 text-on-surface dark:text-slate-300 font-label-sm text-xs">Cancelar</button>
        <button type="button" onclick="saveNewMaterial(${index})" class="px-4 h-9 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white font-label-sm font-bold text-xs shadow-sm flex items-center gap-1">
          <span class="material-symbols-outlined text-[15px]">save</span> Guardar Material
        </button>
      </div>
    </div>`;
}

function renderRows() {
  const container = document.getElementById('materialRowsContainer');
  if (!container) return;
  container.innerHTML = '';

  currentRows.forEach((row, index) => {
    const rowCard = document.createElement('div');
    rowCard.className = "bg-surface-container-low dark:bg-[#0f172a] p-3.5 sm:p-4 rounded-xl space-y-3 transition-all relative border border-transparent dark:border-slate-800 material-card fade-in";
    rowCard.id = `row-${index}`;

    // Opciones con placeholder tenue deshabilitado al inicio
    const sectorOpts = Array.from(new Set([...SECTORES, row.sector])).filter(Boolean);
    const materialOpts = Array.from(new Set([...MATERIALES, row.material])).filter(Boolean);

    // Si tiene material pero no unidad, asignar la unidad automática de una vez
    if (row.material && !row.unidad && MATERIAL_METRICAS[row.material]) {
      row.unidad = MATERIAL_METRICAS[row.material];
    }

    const sectorHtml = `<option disabled ${!row.sector ? 'selected' : ''} value="">Seleccione el sector...</option>` +
      sectorOpts.map(s => `<option value="${s}" ${row.sector === s ? 'selected' : ''}>${s}</option>`).join('') +
      '<option value="__new_sector__">➕ Nuevo sector…</option>';

    const materialHtml = `<option disabled ${!row.material ? 'selected' : ''} value="">Seleccione el material...</option>` +
      materialOpts.map(m => `<option value="${m}" ${row.material === m ? 'selected' : ''}>${m}</option>`).join('') +
      '<option value="__new_material__">➕ Nuevo material…</option>';

    // Bloques inline "Agregar Nuevo" para esta línea
    const sectorWrap = buildNewFieldWrap(`newSectorWrap-${index}`, `newSectorInput-${index}`, 'sector', `saveNewRowSector(${index})`, `cancelNewRowSector(${index})`);
    const materialWrap = buildNewMaterialWrap(index);

    rowCard.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-md bg-primary dark:bg-slate-700 text-on-primary dark:text-amber-400 flex items-center justify-center font-mono font-bold text-[11px]">${index + 1}</span>
          <span class="font-label-md text-label-md font-semibold text-primary dark:text-white">Línea #${index + 1}</span>
        </div>
        <button type="button" onclick="removeMaterialRow(${index})" title="Eliminar línea" class="w-8 h-8 rounded-lg flex items-center justify-center text-error hover:bg-error-container hover:text-on-error-container dark:hover:bg-rose-950/40 dark:text-rose-400 transition-colors">
          <span class="material-symbols-outlined text-[20px]">delete_outline</span>
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div class="space-y-1">
          <label class="font-label-sm text-label-sm text-on-surface-variant dark:text-slate-400 flex items-center gap-1">
            <span class="material-symbols-outlined text-[15px] text-primary dark:text-amber-400">apartment</span> Sector
          </label>
          <div class="relative">
            <select onchange="onRowSelectChanged(${index}, 'sector', this)" class="w-full h-10 pl-3 pr-8 rounded-lg bg-surface-container-lowest dark:bg-[#1e293b] text-on-surface dark:text-slate-100 border border-transparent dark:border-slate-700 font-body-md focus:ring-2 focus:ring-primary dark:focus:ring-amber-500 focus:outline-none appearance-none cursor-pointer text-sm">
              ${sectorHtml}
            </select>
            <span class="material-symbols-outlined text-outline dark:text-slate-400 absolute right-2.5 top-2.5 text-[18px] pointer-events-none">expand_more</span>
          </div>
        </div>
        <div class="space-y-1">
          <label class="font-label-sm text-label-sm text-on-surface-variant dark:text-slate-400 flex items-center gap-1">
            <span class="material-symbols-outlined text-[15px] text-primary dark:text-amber-400">category</span> Material
          </label>
          <div class="relative">
            <select onchange="onRowSelectChanged(${index}, 'material', this)" class="w-full h-10 pl-3 pr-8 rounded-lg bg-surface-container-lowest dark:bg-[#1e293b] text-on-surface dark:text-slate-100 border border-transparent dark:border-slate-700 font-body-md focus:ring-2 focus:ring-primary dark:focus:ring-amber-500 focus:outline-none appearance-none cursor-pointer text-sm">
              ${materialHtml}
            </select>
            <span class="material-symbols-outlined text-outline dark:text-slate-400 absolute right-2.5 top-2.5 text-[18px] pointer-events-none">expand_more</span>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
        <div class="space-y-1">
          <label class="font-label-sm text-label-sm text-on-surface-variant dark:text-slate-400 flex items-center justify-between">
            <span class="flex items-center gap-1">
              <span class="material-symbols-outlined text-[15px] text-primary dark:text-amber-400">straighten</span> Métrica / Unidad
            </span>
            <span class="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-container dark:bg-slate-800 text-outline dark:text-slate-400 font-semibold tracking-wider">Automática</span>
          </label>
          <div class="relative">
            <input type="text" id="metricaDisplay-${index}" readonly disabled
              value="${row.unidad || ''}"
              placeholder="Automático según material..."
              class="w-full h-10 pl-3 pr-9 rounded-lg bg-surface-container/70 dark:bg-[#1e293b]/70 text-on-surface dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 font-body-md text-sm font-medium cursor-not-allowed select-none placeholder:text-outline/50 dark:placeholder:text-slate-500" />
            <span class="material-symbols-outlined text-outline/60 dark:text-slate-500 absolute right-2.5 top-2.5 text-[18px] pointer-events-none">lock</span>
          </div>
        </div>
        <div class="space-y-1">
          <label class="font-label-sm text-label-sm text-on-surface-variant dark:text-slate-400 flex items-center gap-1">
            <span class="material-symbols-outlined text-[15px] text-primary dark:text-amber-400">pin</span> Cantidad
          </label>
          <div class="flex items-center gap-1.5">
            <button type="button" onclick="adjustQuantity(${index}, -5)" class="w-9 h-10 rounded-lg bg-surface-container dark:bg-slate-800 text-on-surface dark:text-slate-200 border border-transparent dark:border-slate-700 font-bold hover:bg-surface-variant dark:hover:bg-slate-700 flex items-center justify-center transition-colors select-none text-sm">-5</button>
            <input type="number" min="1" step="any" value="${row.cantidad}" placeholder="Cantidad" onchange="updateRowField(${index}, 'cantidad', parseFloat(this.value) || '')" class="w-full h-10 px-2 rounded-lg bg-surface-container-lowest dark:bg-[#1e293b] text-on-surface dark:text-slate-100 border border-transparent dark:border-slate-700 text-center font-mono font-bold focus:ring-2 focus:ring-primary dark:focus:ring-amber-500 focus:outline-none text-sm placeholder:text-outline/60 dark:placeholder:text-slate-500" />
            <button type="button" onclick="adjustQuantity(${index}, 5)" class="w-9 h-10 rounded-lg bg-surface-container dark:bg-slate-800 text-on-surface dark:text-slate-200 border border-transparent dark:border-slate-700 font-bold hover:bg-surface-variant dark:hover:bg-slate-700 flex items-center justify-center transition-colors select-none text-sm">+5</button>
          </div>
        </div>
      </div>
      ${sectorWrap}
      ${materialWrap}

      <!-- SECCIÓN DE MUESTRAS FOTOGRÁFICAS (COMPRAS & ALMACÉN) -->
      <div class="pt-2.5 border-t border-slate-200/70 dark:border-slate-800 space-y-2">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-1.5 text-on-surface-variant dark:text-slate-400 font-label-sm">
            <span class="material-symbols-outlined text-[17px] text-primary dark:text-amber-400">add_a_photo</span>
            <span class="font-semibold">Muestras Fotográficas</span>
            <span class="text-xs text-outline/80 dark:text-slate-500">(Opcional • Máx. 3)</span>
          </div>
          <div class="flex items-center gap-2">
            <div id="photo-loading-${index}" class="hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container dark:bg-slate-800 text-primary dark:text-amber-400 font-label-sm text-xs">
              <span class="animate-spin h-3.5 w-3.5 border-2 border-primary dark:border-amber-400 border-t-transparent rounded-full"></span>
              <span>Comprimiendo...</span>
            </div>
            <label for="photo-input-${index}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${(row.fotos && row.fotos.length >= 3) ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-primary/10 dark:bg-amber-500/10 text-primary dark:text-amber-400 hover:bg-primary/20 dark:hover:bg-amber-500/20 cursor-pointer'} transition-colors font-label-sm font-semibold select-none text-xs shadow-xs">
              <span class="material-symbols-outlined text-[16px]">photo_camera</span>
              <span>Adjuntar Foto (${(row.fotos ? row.fotos.length : 0)}/3)</span>
            </label>
            <input type="file" id="photo-input-${index}" accept="image/*" capture="environment" class="hidden" ${(row.fotos && row.fotos.length >= 3) ? 'disabled' : ''} onchange="handlePhotoUpload(${index}, this)" />
          </div>
        </div>

        <!-- CONTENEDOR DE MINIATURAS PREVIAS -->
        ${(Array.isArray(row.fotos) && row.fotos.length > 0) ? `
          <div class="flex items-center gap-2.5 overflow-x-auto py-1.5 px-0.5">
            ${row.fotos.map((b64, pIdx) => `
              <div class="photo-thumb-wrap" title="Muestra #${pIdx + 1}">
                <img src="${b64}" alt="Muestra ${pIdx + 1}" class="photo-thumb-img" />
                <button type="button" onclick="removePhoto(${index}, ${pIdx})" title="Descartar foto" class="photo-thumb-remove">×</button>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
    container.appendChild(rowCard);
  });

  updateCounters();
}

/**
 * Procesa la selección de fotos, comprimiéndolas en cliente antes de agregarlas a la partida.
 * @param {number} rowIndex
 * @param {HTMLInputElement} inputEl
 */
async function handlePhotoUpload(rowIndex, inputEl) {
  const files = Array.from(inputEl.files || []);
  if (!files || files.length === 0) return;

  const row = currentRows[rowIndex];
  if (!row) return;
  if (!Array.isArray(row.fotos)) row.fotos = [];

  const availableSlots = 3 - row.fotos.length;
  if (availableSlots <= 0) {
    showToast('⚠️ Límite de 3 fotos alcanzado para esta partida.');
    inputEl.value = '';
    return;
  }

  const filesToProcess = files.slice(0, availableSlots);
  const loadingEl = document.getElementById(`photo-loading-${rowIndex}`);
  if (loadingEl) loadingEl.classList.remove('hidden');

  try {
    for (const file of filesToProcess) {
      const compressedDataUrl = await compressImage(file, 1280, 0.75);
      row.fotos.push(compressedDataUrl);
    }
    renderRows();
  } catch (err) {
    console.error('[Fotos] Error al procesar imagen:', err);
    showToast(`❌ Error al procesar imagen: ${err.message}`);
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
    inputEl.value = '';
  }
}

/**
 * Elimina una foto específica del arreglo de la partida.
 * @param {number} rowIndex
 * @param {number} photoIdx
 */
function removePhoto(rowIndex, photoIdx) {
  if (currentRows[rowIndex] && Array.isArray(currentRows[rowIndex].fotos)) {
    currentRows[rowIndex].fotos.splice(photoIdx, 1);
    renderRows();
  }
}

function updateRowField(index, field, value) {
  if (currentRows[index]) {
    currentRows[index][field] = value;
  }
}

function adjustQuantity(index, amount) {
  if (currentRows[index]) {
    let val = parseFloat(currentRows[index].cantidad) || 0;
    val = Math.max(1, Math.round((val + amount) * 100) / 100);
    currentRows[index].cantidad = val;
    renderRows();
  }
}

function addMaterialRow() {
  if (currentRows.length >= MAX_LINES) {
    showToast('⚠️ Límite de 30 líneas por solicitud alcanzado');
    return;
  }
  currentRows.push({
    sector: '',
    material: '',
    unidad: '',
    cantidad: '',
    fotos: []
  });
  renderRows();
}

function removeMaterialRow(index) {
  if (currentRows.length <= 1) {
    showToast('⚠️ La solicitud debe incluir al menos 1 línea de material.');
    return;
  }
  currentRows.splice(index, 1);
  renderRows();
}

function updateCounters() {
  const total = currentRows.length;
  const available = MAX_LINES - total;
  const percent = Math.round((total / MAX_LINES) * 100);

  const usedCountEl = document.getElementById('usedLinesCount');
  const availTextEl = document.getElementById('availableLinesText');
  const percentEl = document.getElementById('capacityPercent');
  const progressBar = document.getElementById('progressBar');
  const summaryCount = document.getElementById('summaryRowCount');
  const btnAdd = document.getElementById('btnAddRow');
  const limitAlert = document.getElementById('limitAlert');

  if (usedCountEl) usedCountEl.innerText = total;
  if (availTextEl) availTextEl.innerText = `${available} disponibles en esta solicitud`;
  if (percentEl) percentEl.innerText = `${percent}%`;
  if (progressBar) progressBar.style.width = `${percent}%`;
  if (summaryCount) summaryCount.innerText = total;

  if (total >= MAX_LINES) {
    if (btnAdd) btnAdd.classList.add('opacity-50', 'pointer-events-none');
    if (limitAlert) limitAlert.classList.remove('hidden');
  } else {
    if (btnAdd) btnAdd.classList.remove('opacity-50', 'pointer-events-none');
    if (limitAlert) limitAlert.classList.add('hidden');
  }
}

// ============================================
// ENVÍO DE SOLICITUDES (HEADER-BASED MAPPING)
// ============================================

async function handleSubmit() {
  const fecha = document.getElementById('fechaRegistro').value;
  const profesional = document.getElementById('profesionalInput').value.trim();
  const obra = document.getElementById('obraSelect').value;

  if (!fecha || !profesional || !obra) {
    showToast('⚠️ Completa los campos obligatorios: Fecha, Responsable y Obra.');
    return;
  }

  // Filtrar solo líneas que tengan material y cantidad completados
  const validRows = currentRows.filter(r => r.material && r.cantidad);
  if (validRows.length === 0) {
    showToast('⚠️ Completa al menos una línea con material y cantidad.');
    return;
  }

  // Mapeo estricto por nombres de encabezado con adjuntos fotográficos
  const lines = validRows.map(row => ({
    FECHA: fecha,
    SOLICITANTE: profesional,
    OBRA: obra,
    'SECTOR DE LA OBRA': row.sector,
    MATERIAL: row.material,
    METRICA: row.unidad,
    CANTIDAD: row.cantidad,
    APROBADO: 'Pendiente',
    FOTOS: Array.isArray(row.fotos) ? row.fotos : []
  }));

  const totalPhotos = lines.reduce((acc, l) => acc + (Array.isArray(l.FOTOS) ? l.FOTOS.length : 0), 0);

  // Validación de red si hay fotos (evita saturar almacenamiento local con colas pesadas de Base64)
  if (!navigator.onLine && totalPhotos > 0) {
    showToast('⚠️ Estás sin conexión. Las fotos de muestra requieren internet para enviarse al canal de Compras. Conéctate a una red móvil o Wi-Fi para continuar.', 6000);
    return;
  }

  const btnSubmit = document.getElementById('btnSubmitSync');
  const btnIcon = document.getElementById('btnIcon');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnLabel = document.getElementById('btnLabel');

  btnSubmit.disabled = true;
  btnIcon.classList.add('hidden');
  btnSpinner.classList.remove('hidden');
  btnLabel.innerText = "Sincronizando con Google Sheets...";

  try {
    let result;
    if (lines.length === 1) {
      result = await SHEETS_API.submitSolicitud(lines[0]);
    } else {
      result = await SHEETS_API.submitMultipleSolicitudes(lines);
    }

    if (result && result.success) {
      btnLabel.innerText = "¡Registro Exitoso!";
      btnSpinner.classList.add('hidden');
      btnIcon.classList.remove('hidden');
      btnIcon.textContent = 'check_circle';

      const folio = result.folio || `REQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      document.getElementById('modalFolio').textContent = folio;
      document.getElementById('modalItems').textContent = `${lines.length} líneas`;
      document.getElementById('modalMode').textContent = lines.length === 1 ? 'Individual (1 línea)' : `Múltiple (${lines.length} líneas)`;

      showModal();
      // Sincronización bajo demanda: refresca catálogos y solicitudes en segundo plano
      SYNC.refreshAfterWrite();
    }
  } catch (err) {
    console.error('[App] Error al enviar solicitud:', err);

    if (totalPhotos > 0) {
      showToast('⚠️ Falló la conexión con el servidor. Las fotos no se pudieron enviar. Conéctate a internet para reintentar.', 6000);
      return;
    }

    // Encolar offline para resiliencia (solo partidas sin fotos para no saturar almacenamiento local)
    SYNC.enqueue({
      action: lines.length === 1 ? 'submitSolicitud' : 'submitMultipleSolicitudes',
      lines: lines,
      data: lines[0]
    });

    showToast(`⚠️ Modo sin conexión: Solicitud guardada localmente.`);
    
    // Modal informativo
    const folioOffline = `OFFLINE-${Date.now().toString().slice(-4)}`;
    document.getElementById('modalFolio').textContent = folioOffline;
    document.getElementById('modalItems').textContent = `${lines.length} líneas`;
    document.getElementById('modalMode').textContent = 'En cola para auto-sincronizar';
    showModal();
  } finally {
    btnSubmit.disabled = false;
    btnSpinner.classList.add('hidden');
    btnIcon.classList.remove('hidden');
    btnIcon.textContent = 'cloud_upload';
    btnLabel.innerText = "Guardar Solicitud y Sincronizar en Sheets";
  }
}

// ============================================
// AGREGAR NUEVO REGISTRO INLINE (DENTRO DE CADA CAMPO)
// ============================================

const NEW_OPTION_VALUES = {
  OBRA: '__new_obra__',
  SECTOR: '__new_sector__',
  MATERIAL: '__new_material__',
  METRICA: '__new_metrica__'
};

/**
 * Invalida la caché de Base_Datos, obtiene catálogos frescos y actualiza
 * todos los dropdowns. Retorna los datos frescos (o null si falla).
 */
async function refreshCatalogsAndApply() {
  await StorageService.removeCache('base_datos');
  const fresh = await SHEETS_API.fetchBaseDatos();
  if (fresh && Array.isArray(fresh.ingenieros)) {
    baseDatosCache = fresh;
    populateDropdowns(fresh);
  }
  return fresh;
}

function openNewField(wrapId, inputId) {
  const wrap = document.getElementById(wrapId);
  const input = document.getElementById(inputId);
  if (wrap) wrap.classList.remove('hidden');
  if (input) input.focus();
}

function closeNewField(wrapId, inputId) {
  const wrap = document.getElementById(wrapId);
  const input = document.getElementById(inputId);
  if (wrap) wrap.classList.add('hidden');
  if (input) input.value = '';
}

// --- Selecciones de catálogo general (Obra) ---

function onCatalogSelectChanged(selectId, wrapId, inputId) {
  const select = document.getElementById(selectId);
  if (!select || !select.value) return;
  if (select.value === NEW_OPTION_VALUES.OBRA) {
    select.value = ''; // Restaurar a "Seleccione..."
    openNewField(wrapId, inputId);
  }
}

async function saveNewObra() {
  const input = document.getElementById('newObraInput');
  const value = input ? input.value.trim() : '';
  if (!value) {
    showToast('⚠️ Escribe el nombre de la nueva obra');
    return;
  }
  try {
    showToast('⏳ Guardando nueva obra...');
    await SHEETS_API.addToBaseDatos({ project: value });
    await refreshCatalogsAndApply();
    const select = document.getElementById('obraSelect');
    if (select) select.value = value;
    closeNewField('newObraWrap', 'newObraInput');
    showToast(`✅ Obra "${value}" agregada exitosamente`);
    SYNC.refreshAfterWrite();
  } catch (e) {
    showToast(`❌ Error: ${e.message}`);
  }
}

function cancelNewObra() {
  closeNewField('newObraWrap', 'newObraInput');
}

// --- Selecciones dentro de cada línea (Sector, Material y Métrica) ---

function onRowSelectChanged(index, field, selectEl) {
  const val = selectEl.value;
  const row = currentRows[index];
  if (!row || !val) return;

  if (val === NEW_OPTION_VALUES.SECTOR) {
    selectEl.value = row.sector || '';
    openNewField(`newSectorWrap-${index}`, `newSectorInput-${index}`);
    return;
  }
  if (val === NEW_OPTION_VALUES.MATERIAL) {
    selectEl.value = row.material || '';
    openNewField(`newMaterialWrap-${index}`, `newMaterialInput-${index}`);
    return;
  }

  // Al seleccionar un material existente, autocompletar la métrica en la fila y en la vista
  if (field === 'material') {
    const autoMetrica = MATERIAL_METRICAS[val] || '';
    row.material = val;
    row.unidad = autoMetrica;
    const metricaDisplay = document.getElementById(`metricaDisplay-${index}`);
    if (metricaDisplay) {
      metricaDisplay.value = autoMetrica;
    }
    return;
  }

  updateRowField(index, field, val);
}

async function saveNewRowSector(index) {
  const input = document.getElementById(`newSectorInput-${index}`);
  const value = input ? input.value.trim() : '';
  if (!value) {
    showToast('⚠️ Escribe el nombre del sector');
    return;
  }
  try {
    showToast('⏳ Guardando nuevo sector...');
    await SHEETS_API.addToBaseDatos({ sector: value });
    await refreshCatalogsAndApply();
    if (currentRows[index]) currentRows[index].sector = value;
    closeNewField(`newSectorWrap-${index}`, `newSectorInput-${index}`);
    renderRows();
    showToast(`✅ Sector "${value}" agregado exitosamente`);
    SYNC.refreshAfterWrite();
  } catch (e) {
    showToast(`❌ Error: ${e.message}`);
  }
}

function cancelNewRowSector(index) {
  closeNewField(`newSectorWrap-${index}`, `newSectorInput-${index}`);
}

async function saveNewMaterial(index) {
  const inputMat = document.getElementById(`newMaterialInput-${index}`);
  const inputMet = document.getElementById(`newMaterialMetricInput-${index}`);
  const matValue = inputMat ? inputMat.value.trim() : '';
  const metValue = inputMet ? inputMet.value.trim() : '';

  if (!matValue) {
    showToast('⚠️ Escribe el nombre del material');
    if (inputMat) inputMat.focus();
    return;
  }

  if (!metValue) {
    showToast('⚠️ Escribe o selecciona la métrica / unidad para este material');
    if (inputMet) inputMet.focus();
    return;
  }

  try {
    showToast('⏳ Guardando nuevo material y métrica en Base de Datos...');
    await SHEETS_API.addToBaseDatos({
      material: matValue,
      metric: metValue
    });

    // Guardar en el mapa relacional y catálogos locales para reactividad inmediata
    MATERIAL_METRICAS[matValue] = metValue;
    if (!MATERIALES.includes(matValue)) MATERIALES.push(matValue);
    if (!UNIDADES.includes(metValue)) UNIDADES.push(metValue);

    await refreshCatalogsAndApply();
    if (currentRows[index]) {
      currentRows[index].material = matValue;
      currentRows[index].unidad = metValue;
    }
    closeNewField(`newMaterialWrap-${index}`, `newMaterialInput-${index}`);
    renderRows();
    showToast(`✅ Material "${matValue}" (${metValue}) agregado y seleccionado`);
    SYNC.refreshAfterWrite();
  } catch (e) {
    showToast(`❌ Error: ${e.message}`);
  }
}

function cancelNewMaterial(index) {
  closeNewField(`newMaterialWrap-${index}`, `newMaterialInput-${index}`);
}

// ============================================
// PANTALLA Y FORMULARIO DE CONFIGURACIÓN
// ============================================

function showSetupModal() {
  const modal = document.getElementById('setupModal');
  const content = document.getElementById('setupModalContent');
  if (!modal || !content) return;

  const currentSheetId = StorageService.getSheetId();
  const currentUrl = StorageService.getWebAppUrl();

  const sheetInput = document.getElementById('setupSheetId');
  const urlInput = document.getElementById('setupWebAppUrl');
  if (sheetInput) sheetInput.value = currentSheetId || '';
  if (urlInput) urlInput.value = currentUrl || '';

  modal.classList.remove('opacity-0', 'pointer-events-none');
  modal.classList.add('opacity-100');
  content.classList.remove('translate-y-8');
  content.classList.add('translate-y-0');
}

function closeSetupModal() {
  const modal = document.getElementById('setupModal');
  const content = document.getElementById('setupModalContent');
  if (!modal || !content) return;
  modal.classList.add('opacity-0', 'pointer-events-none');
  modal.classList.remove('opacity-100');
  content.classList.add('translate-y-8');
  content.classList.remove('translate-y-0');
}

function showSetupForm() {
  showSetupModal();
}

function showSetupScreen() {
  showSetupModal();
}

async function doSetup() {
  const sheetInput = document.getElementById('setupSheetId');
  const urlInput = document.getElementById('setupWebAppUrl');
  const sheetId = sheetInput ? sheetInput.value.trim() : '';
  const webAppUrl = urlInput ? urlInput.value.trim() : '';

  if (!webAppUrl) {
    showToast('⚠️ Debes ingresar la URL del Web App de Apps Script.');
    return;
  }

  const btn = document.getElementById('btnSaveSetup');
  if (btn) btn.disabled = true;
  showToast('🔄 Verificando conexión...');
  StorageService.setSheetId(sheetId);
  StorageService.setWebAppUrl(webAppUrl);

  try {
    const conn = await SHEETS_API.checkConnection();
    if (!conn || !conn.connected) {
      const reason = conn && conn.error ? conn.error : 'El servidor Web App no confirmó la conexión';
      showToast(`❌ Error de conexión: ${reason}`);
      if (btn) btn.disabled = false;
      return;
    }
    showToast('✅ Conexión establecida exitosamente');
    closeSetupModal();
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (e) {
    showToast(`❌ Error al conectar: ${e.message}`);
    if (btn) btn.disabled = false;
  }
}

// ============================================
// MODALES Y UTILIDADES
// ============================================

function showModal() {
  const modal = document.getElementById('successModal');
  const content = document.getElementById('modalContent');
  if (!modal || !content) return;
  modal.classList.remove('opacity-0', 'pointer-events-none');
  modal.classList.add('opacity-100');
  content.classList.remove('translate-y-8');
  content.classList.add('translate-y-0');
}

function closeModal() {
  const modal = document.getElementById('successModal');
  const content = document.getElementById('modalContent');
  if (!modal || !content) return;
  modal.classList.add('opacity-0', 'pointer-events-none');
  modal.classList.remove('opacity-100');
  content.classList.add('translate-y-8');
  content.classList.remove('translate-y-0');
}

function showAddEngineerForm() {
  const modal = document.getElementById('engineerModal');
  const content = document.getElementById('engineerModalContent');
  if (!modal || !content) return;
  modal.classList.remove('opacity-0', 'pointer-events-none');
  modal.classList.add('opacity-100');
  content.classList.remove('translate-y-8');
  content.classList.add('translate-y-0');
}

function closeEngineerModal() {
  const modal = document.getElementById('engineerModal');
  const content = document.getElementById('engineerModalContent');
  if (!modal || !content) return;
  modal.classList.add('opacity-0', 'pointer-events-none');
  modal.classList.remove('opacity-100');
  content.classList.add('translate-y-8');
  content.classList.remove('translate-y-0');
}

async function saveEngineer() {
  const name = document.getElementById('newEngineerName').value.trim();
  const project = document.getElementById('newEngineerProject').value;

  if (!name) {
    showToast('⚠️ Ingresa el nombre del profesional');
    return;
  }

  try {
    showToast('⏳ Guardando nuevo profesional...');
    await SHEETS_API.addToBaseDatos({
      engineer: name,
      project: project
    });

    closeEngineerModal();
    await refreshCatalogsAndApply();

    document.getElementById('newEngineerName').value = '';
    document.getElementById('profesionalInput').value = name;
    showToast(`✅ Profesional "${name}" agregado exitosamente`);
  } catch (e) {
    showToast(`❌ Error: ${e.message}`);
  }
}

function setDefaultDate() {
  const input = document.getElementById('fechaRegistro');
  if (input && !input.value) {
    input.value = new Date().toISOString().split('T')[0];
  }
}

function updateClock() {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const el1 = document.getElementById('currentTimestamp');
  const el2 = document.getElementById('currentTimestampFooter');
  if (el1) el1.textContent = timeStr;
  if (el2) el2.textContent = timeStr;
}

function showToast(message, duration = 3500) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMessage');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, duration);
}

function showCacheStatus(message) {
  const label = document.getElementById('cacheLabel');
  if (label) label.textContent = message;
}

function resetFormForNew() {
  closeModal();
  setDefaultDate();
  document.getElementById('profesionalInput').value = '';
  document.getElementById('obraSelect').selectedIndex = 0;
  currentRows = JSON.parse(JSON.stringify(INITIAL_ROWS));
  renderRows();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function downloadPDF() {
  const folio = document.getElementById('modalFolio')?.textContent || 'REQ';
  const fecha = document.getElementById('fechaRegistro')?.value || new Date().toISOString().split('T')[0];
  const obra = document.getElementById('obraSelect')?.value || 'No especificada';
  const solicitante = document.getElementById('profesionalInput')?.value || 'No especificado';

  // Filtrar solo líneas con material y cantidad completados
  const activeRows = currentRows.filter(r => r.material && r.cantidad);
  const rowsToPrint = activeRows.length > 0 ? activeRows : currentRows;

  // Generar PDF directo si jsPDF está disponible
  if (window.jspdf && window.jspdf.jsPDF) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Encabezado
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(30, 41, 59);
      doc.text("CONTROL DE SOLICITUD DE MATERIALES", 20, 22);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Comprobante de Registro de Pedido en Obra", 20, 28);

      // Línea divisoria
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(20, 32, 190, 32);

      // Metadatos de la solicitud
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);

      doc.setFont("helvetica", "bold");
      doc.text("Folio de Control:", 20, 41);
      doc.setFont("helvetica", "normal");
      doc.text(folio, 60, 41);

      doc.setFont("helvetica", "bold");
      doc.text("Fecha:", 20, 48);
      doc.setFont("helvetica", "normal");
      doc.text(fecha, 60, 48);

      doc.setFont("helvetica", "bold");
      doc.text("Responsable:", 20, 55);
      doc.setFont("helvetica", "normal");
      doc.text(solicitante, 60, 55);

      doc.setFont("helvetica", "bold");
      doc.text("Proyecto / Obra:", 20, 62);
      doc.setFont("helvetica", "normal");
      doc.text(obra, 60, 62);

      // Sección de líneas
      doc.setDrawColor(226, 232, 240);
      doc.line(20, 69, 190, 69);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      doc.text("LÍNEAS DE MATERIALES SOLICITADOS", 20, 77);

      // Cabecera de tabla
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("#", 20, 84);
      doc.text("Sector / Material", 30, 84);
      doc.text("Cantidad y Unidad", 190, 84, { align: "right" });

      doc.setDrawColor(203, 213, 225);
      doc.line(20, 86, 190, 86);

      let y = 93;
      rowsToPrint.forEach((r, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 25;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`${idx + 1}`, 20, y);

        doc.setFont("helvetica", "normal");
        const sectorPrefix = r.sector ? `[${r.sector}] ` : '';
        const itemText = `${sectorPrefix}${r.material}`;
        doc.text(itemText, 30, y);

        doc.setFont("helvetica", "bold");
        const qtyText = `${r.cantidad} ${r.unidad}`;
        doc.text(qtyText, 190, y, { align: "right" });

        doc.setDrawColor(241, 245, 249);
        doc.line(20, y + 2.5, 190, y + 2.5);

        y += 8;
      });

      // Pie
      const footerY = Math.max(y + 8, 135);
      doc.setDrawColor(226, 232, 240);
      doc.line(20, footerY, 190, footerY);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Estado: Sincronizado en Google Sheets • Generado: ${new Date().toLocaleString()}`, 20, footerY + 6);

      doc.save(`Comprobante_${folio}.pdf`);
      showToast('📄 Comprobante PDF descargado exitosamente');
      return;
    } catch (err) {
      console.warn('[PDF] Error generando con jsPDF, ejecutando fallback:', err);
    }
  }

  // Respaldo de descarga si no está disponible la librería PDF
  let receiptText = `=========================================\n`;
  receiptText += `CONTROL DE SOLICITUD DE MATERIALES\n`;
  receiptText += `FOLIO: ${folio}\n`;
  receiptText += `FECHA: ${fecha}\n`;
  receiptText += `OBRA: ${obra}\n`;
  receiptText += `SOLICITANTE: ${solicitante}\n`;
  receiptText += `=========================================\n`;
  receiptText += `LÍNEAS SOLICITADAS:\n`;
  rowsToPrint.forEach((r, idx) => {
    receiptText += `${idx + 1}. [${r.sector}] ${r.material} - ${r.cantidad} ${r.unidad}\n`;
  });
  receiptText += `=========================================\n`;
  receiptText += `ESTADO: Sincronizado en Google Sheets\n`;

  const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Comprobante_${folio}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('📄 Comprobante descargado correctamente');
}

// ============================================
// MODO OSCURO / CLARO CON PERSISTENCIA
// ============================================

function loadTheme() {
  const saved = StorageService.get(STORAGE_KEYS.THEME);
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  StorageService.set(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
  showToast(isDark ? '🌙 Modo Oscuro Activado' : '☀️ Modo Claro Activado', 2000);
}

// ============================================
// GIMO • GESTIÓN DE PESTAÑAS, OBRA ACTIVA Y CONTROL EN SITIO
// ============================================

let currentMainTab = 'solicitudes';
let currentMasterObra = '';
let entradasObraData = [];
let usosObraData = [];
let historialSolicitudesData = [];
let historialSearchQuery = '';

function switchMainTab(tabName) {
  currentMainTab = tabName;
  const tabs = ['solicitudes', 'entradas', 'usos', 'historial'];
  
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn-${t}`);
    const content = document.getElementById(`tabContent-${t}`);
    const isActive = (t === tabName);

    if (btn) {
      if (isActive) {
        btn.className = "flex-1 py-2.5 px-2 sm:px-3 rounded-xl font-label-md font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-all duration-200 bg-primary text-white shadow-sm text-xs sm:text-sm cursor-pointer";
      } else {
        btn.className = "flex-1 py-2.5 px-2 sm:px-3 rounded-xl font-label-md font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-all duration-200 text-on-surface-variant dark:text-slate-400 hover:text-on-surface dark:hover:text-slate-100 hover:bg-surface-container dark:hover:bg-slate-800 text-xs sm:text-sm cursor-pointer";
      }
    }

    if (content) {
      if (isActive) {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    }
  });

  if (tabName === 'entradas') {
    loadEntradasObra();
  } else if (tabName === 'usos') {
    loadUsosObra();
  } else if (tabName === 'historial') {
    loadHistorialSolicitudes();
  }
}

function onMasterObraChanged(obraVal) {
  currentMasterObra = obraVal || '';
  const label = document.getElementById('currentMasterObraLabel');
  if (label) {
    label.textContent = currentMasterObra ? currentMasterObra : 'Todas las Obras';
  }

  // Sincronizar con el selector de obra del formulario de solicitud si coincide
  const obraSelect = document.getElementById('obraSelect');
  if (obraSelect && currentMasterObra && obraSelect.value !== currentMasterObra) {
    obraSelect.value = currentMasterObra;
  }

  // Actualizar indicadores de filtro por obra
  const indEntradas = document.getElementById('entradasObraIndicator');
  if (indEntradas) indEntradas.textContent = `Obra: ${currentMasterObra || 'Todas'}`;

  const indUsos = document.getElementById('usosObraIndicator');
  if (indUsos) indUsos.textContent = `Obra: ${currentMasterObra || 'Todas'}`;

  const indHistorial = document.getElementById('historialObraIndicator');
  if (indHistorial) indHistorial.textContent = `Obra: ${currentMasterObra || 'Todas'}`;

  renderEntradasList();
  renderUsosList();
  renderHistorialSolicitudes();
  updateEntradasBadges();
  updateUsosBadges();
}

// --- PESTAÑA 2: ENTRADA DE MATERIALES EN OBRA (VISTA UNIFICADA) ---

async function loadEntradasObra(forceFresh = false) {
  const container = document.getElementById('entradasListContainer');
  if (!container) return;

  if (forceFresh) {
    container.innerHTML = `
      <div class="text-center py-8 text-on-surface-variant dark:text-slate-400 font-body-sm">
        <span class="animate-spin h-6 w-6 border-2 border-primary dark:border-amber-400 border-t-transparent rounded-full inline-block mb-2"></span>
        <p>Consultando despachos en Google Sheets...</p>
      </div>`;
    showToast('⏳ Actualizando despachos de obra...');
  }

  try {
    let data;
    if (forceFresh) {
      await StorageService.removeCache('entradas_obra');
      data = await SHEETS_API.fetchEntradasObra();
    } else {
      data = await SHEETS_API.getEntradasObra();
    }

    entradasObraData = Array.isArray(data) ? data : [];
    updateEntradasBadges();
    renderEntradasList();
    if (forceFresh) showToast('✅ Despachos actualizados');
  } catch (err) {
    console.error('Error cargando entradas:', err);
    container.innerHTML = `
      <div class="text-center py-6 text-rose-500 font-body-sm">
        <span class="material-symbols-outlined text-[28px] block mb-1">error</span>
        <p>Error al cargar despachos: ${err.message}</p>
        <button type="button" onclick="loadEntradasObra(true)" class="mt-2 px-3 py-1 bg-surface-container rounded-lg font-bold text-xs cursor-pointer">Reintentar</button>
      </div>`;
  }
}

function updateEntradasBadges() {
  const pendingCount = entradasObraData.filter(item => {
    const matchObra = !currentMasterObra || (item.obra && item.obra.toLowerCase() === currentMasterObra.toLowerCase());
    return matchObra && !item.is_received;
  }).length;

  const badge = document.getElementById('badgeEntradasPending');
  if (badge) {
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

function setRecibidoCompleto(rowNum, cantDespachada) {
  const input = document.getElementById(`input-recibida-${rowNum}`);
  if (input && !input.disabled) {
    input.value = cantDespachada;
    input.classList.add('ring-2', 'ring-emerald-500');
    setTimeout(() => input.classList.remove('ring-2', 'ring-emerald-500'), 800);
  }
}

function renderEntradasList() {
  const container = document.getElementById('entradasListContainer');
  if (!container) return;

  let items = [...entradasObraData];

  // Filtro por Obra activa seleccionada en cabecera
  if (currentMasterObra) {
    items = items.filter(it => it.obra && it.obra.toLowerCase() === currentMasterObra.toLowerCase());
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 rounded-xl bg-surface-container-low dark:bg-[#0f172a] border border-dashed border-slate-200 dark:border-slate-800 p-6 space-y-2">
        <span class="material-symbols-outlined text-[36px] text-slate-400">inventory_2</span>
        <h3 class="font-headline-md text-sm text-on-surface dark:text-slate-200 font-bold">No hay despachos para mostrar</h3>
        <p class="font-body-sm text-on-surface-variant dark:text-slate-400 max-w-sm mx-auto">
          ${currentMasterObra ? `No se encontraron registros de despachos dirigidos a "${currentMasterObra}".` : 'No hay despachos registrados o pendientes en las obras.'}
        </p>
      </div>`;
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  container.innerHTML = items.map(item => {
    const rowNum = item.row;
    const isRec = Boolean(item.is_received);
    const defaultCant = (item.cant_recibida !== "" && item.cant_recibida !== null) ? item.cant_recibida : item.cant_despachada;
    const defaultFecha = item.fecha ? item.fecha : todayStr;
    const folioSol = item.e_num_solicitud || '';

    return `
      <div class="bg-surface-container-low dark:bg-[#0f172a] p-4 rounded-xl border ${isRec ? 'border-emerald-600/30 dark:border-emerald-500/20' : 'border-slate-200 dark:border-slate-800'} space-y-3 transition-all fade-in">
        <div class="flex items-start justify-between gap-2 flex-wrap">
          <div class="space-y-0.5">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded-md bg-primary/10 dark:bg-slate-800 text-primary dark:text-amber-400 font-mono font-bold text-xs">#${item.e_num || rowNum}</span>
              ${folioSol ? `<span class="px-2 py-0.5 rounded-md bg-amber-500/15 dark:bg-amber-400/10 text-amber-800 dark:text-amber-300 font-mono font-bold text-xs">Solicitud: ${folioSol}</span>` : ''}
              <span class="px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-on-surface dark:text-slate-200 font-label-sm text-xs font-semibold">${item.obra}</span>
              ${isRec 
                ? `<span class="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-label-sm text-xs font-bold flex items-center gap-1">
                     <span class="material-symbols-outlined text-[13px]">lock</span> Recibido (${item.cant_recibida} ${item.metrica})
                   </span>` 
                : `<span class="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-label-sm text-xs font-bold flex items-center gap-1">
                     <span class="material-symbols-outlined text-[13px]">pending</span> Pendiente de Recepción
                   </span>`}
            </div>
            <h3 class="font-headline-md text-base text-primary dark:text-white font-bold pt-1">${item.material}</h3>
            <span class="font-label-sm text-on-surface-variant dark:text-slate-400">Unidad: <strong class="text-on-surface dark:text-slate-200">${item.metrica}</strong></span>
          </div>

          <div class="text-right sm:text-right">
            <span class="text-xs text-on-surface-variant dark:text-slate-400 block font-medium">Despachado Almacén</span>
            <span class="font-mono font-bold text-base text-primary dark:text-amber-400">${item.cant_despachada} ${item.metrica}</span>
          </div>
        </div>

        <!-- Formulario de confirmación de recepción -->
        <div class="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          <div class="sm:col-span-5 space-y-1">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-on-surface-variant dark:text-slate-300">Cantidad Recibida *</label>
              ${!isRec ? `
                <button type="button" onclick="setRecibidoCompleto(${rowNum}, ${item.cant_despachada})" class="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer">
                  Llegó completo (${item.cant_despachada})
                </button>` : ''}
            </div>
            <input type="number" step="any" min="0" id="input-recibida-${rowNum}" value="${defaultCant}" placeholder="Cant. real recibida" 
              ${isRec ? 'disabled readonly class="w-full h-10 px-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm cursor-not-allowed opacity-85"' : 'class="w-full h-10 px-3 rounded-lg bg-surface-container-lowest dark:bg-[#1e293b] text-on-surface dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"'} />
          </div>

          <div class="sm:col-span-4 space-y-1">
            <label class="text-xs font-semibold text-on-surface-variant dark:text-slate-300 block">Fecha Recepción *</label>
            <input type="date" id="input-fecha-${rowNum}" value="${defaultFecha}" 
              ${isRec ? 'disabled readonly class="w-full h-10 px-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-body-md text-sm cursor-not-allowed opacity-85"' : 'class="w-full h-10 px-3 rounded-lg bg-surface-container-lowest dark:bg-[#1e293b] text-on-surface dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-body-md text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"'} />
          </div>

          <div class="sm:col-span-3">
            ${isRec ? `
              <div class="w-full h-10 px-3 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-label-sm font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-not-allowed" title="Guardado en Google Sheets - No modificable">
                <span class="material-symbols-outlined text-[16px]">lock</span>
                <span>Guardado (Bloqueado)</span>
              </div>` : `
              <button type="button" id="btn-save-entrada-${rowNum}" onclick="confirmEntradaObra(${rowNum})" class="w-full h-10 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-label-sm font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                <span class="material-symbols-outlined text-[16px]">check</span>
                <span>Confirmar Recepción</span>
              </button>`}
          </div>
        </div>
      </div>`;
  }).join('');
}

async function confirmEntradaObra(rowNum) {
  const inputCant = document.getElementById(`input-recibida-${rowNum}`);
  const inputFecha = document.getElementById(`input-fecha-${rowNum}`);
  const btn = document.getElementById(`btn-save-entrada-${rowNum}`);

  const cantVal = inputCant ? parseFloat(inputCant.value) : NaN;
  const fechaVal = inputFecha ? inputFecha.value.trim() : '';

  if (isNaN(cantVal) || cantVal < 0) {
    showToast('⚠️ Ingresa una cantidad recibida válida');
    if (inputCant) inputCant.focus();
    return;
  }
  if (!fechaVal) {
    showToast('⚠️ Selecciona la fecha de recepción');
    if (inputFecha) inputFecha.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full inline-block"></span> Guardando...`;
  }

  try {
    showToast('⏳ Guardando recepción en Entrada_Materiales...');
    await SHEETS_API.saveEntradaObra({
      row: rowNum,
      cant_recibida: cantVal,
      fecha: fechaVal
    });

    // Actualizar estado en memoria local
    const item = entradasObraData.find(it => it.row === rowNum);
    if (item) {
      item.cant_recibida = cantVal;
      item.fecha = fechaVal;
      item.is_received = true;
    }

    updateEntradasBadges();
    renderEntradasList();
    showToast(`✅ Recepción de fila #${rowNum} registrada en Google Sheets y bloqueada`);
    
    await StorageService.removeCache('entradas_obra');
    await StorageService.removeCache('usos_obra');
    SYNC.refreshAfterWrite();
  } catch (err) {
    showToast(`❌ Error al guardar: ${err.message}`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-[16px]">check</span> <span>Reintentar</span>`;
    }
  }
}

// --- PESTAÑA 3: USO DE MATERIALES EN OBRA (SIEMPRE RE-EDITABLE) ---

async function loadUsosObra(forceFresh = false) {
  const container = document.getElementById('usosListContainer');
  if (!container) return;

  if (forceFresh) {
    container.innerHTML = `
      <div class="text-center py-8 text-on-surface-variant dark:text-slate-400 font-body-sm">
        <span class="animate-spin h-6 w-6 border-2 border-amber-600 dark:border-amber-400 border-t-transparent rounded-full inline-block mb-2"></span>
        <p>Consultando inventario de uso en Google Sheets...</p>
      </div>`;
    showToast('⏳ Actualizando consumos de obra...');
  }

  try {
    let data;
    if (forceFresh) {
      await StorageService.removeCache('usos_obra');
      data = await SHEETS_API.fetchUsosObra();
    } else {
      data = await SHEETS_API.getUsosObra();
    }

    usosObraData = Array.isArray(data) ? data : [];
    updateUsosBadges();
    renderUsosList();
    if (forceFresh) showToast('✅ Registros de uso actualizados');
  } catch (err) {
    console.error('Error cargando usos:', err);
    container.innerHTML = `
      <div class="text-center py-6 text-rose-500 font-body-sm">
        <span class="material-symbols-outlined text-[28px] block mb-1">error</span>
        <p>Error al cargar registros: ${err.message}</p>
        <button type="button" onclick="loadUsosObra(true)" class="mt-2 px-3 py-1 bg-surface-container rounded-lg font-bold text-xs cursor-pointer">Reintentar</button>
      </div>`;
  }
}

function updateUsosBadges() {
  const pendingCount = usosObraData.filter(item => {
    const matchObra = !currentMasterObra || (item.obra && item.obra.toLowerCase() === currentMasterObra.toLowerCase());
    return matchObra && !item.is_used;
  }).length;

  const badge = document.getElementById('badgeUsosPending');
  if (badge) {
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

function renderUsosList() {
  const container = document.getElementById('usosListContainer');
  if (!container) return;

  let items = [...usosObraData];

  // Filtro por Obra activa seleccionada en cabecera
  if (currentMasterObra) {
    items = items.filter(it => it.obra && it.obra.toLowerCase() === currentMasterObra.toLowerCase());
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 rounded-xl bg-surface-container-low dark:bg-[#0f172a] border border-dashed border-slate-200 dark:border-slate-800 p-6 space-y-2">
        <span class="material-symbols-outlined text-[36px] text-slate-400">handyman</span>
        <h3 class="font-headline-md text-sm text-on-surface dark:text-slate-200 font-bold">No hay materiales para mostrar</h3>
        <p class="font-body-sm text-on-surface-variant dark:text-slate-400 max-w-sm mx-auto">
          ${currentMasterObra ? `No se encontraron materiales recibidos para registrar consumo en "${currentMasterObra}".` : 'No hay materiales disponibles para registro de uso en obra.'}
        </p>
      </div>`;
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  container.innerHTML = items.map(item => {
    const rowNum = item.row;
    const isUsed = Boolean(item.is_used);
    const defaultCant = item.cant_usada !== "" && item.cant_usada !== null ? item.cant_usada : "";
    const defaultFecha = item.fecha ? item.fecha : todayStr;
    const folioSol = item.u_num_solicitud || '';

    return `
      <div class="bg-surface-container-low dark:bg-[#0f172a] p-4 rounded-xl border ${isUsed ? 'border-amber-600/30 dark:border-amber-500/20' : 'border-slate-200 dark:border-slate-800'} space-y-3 transition-all fade-in">
        <div class="flex items-start justify-between gap-2 flex-wrap">
          <div class="space-y-0.5">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded-md bg-amber-500/10 dark:bg-slate-800 text-amber-700 dark:text-amber-400 font-mono font-bold text-xs">#${item.u_num || rowNum}</span>
              ${folioSol ? `<span class="px-2 py-0.5 rounded-md bg-amber-500/15 dark:bg-amber-400/10 text-amber-800 dark:text-amber-300 font-mono font-bold text-xs">Solicitud: ${folioSol}</span>` : ''}
              <span class="px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-on-surface dark:text-slate-200 font-label-sm text-xs font-semibold">${item.obra}</span>
              ${isUsed 
                ? `<span class="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-label-sm text-xs font-bold flex items-center gap-1">
                     <span class="material-symbols-outlined text-[13px]">construction</span> Consumido: ${item.cant_usada} ${item.metrica}
                   </span>` 
                : `<span class="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-on-surface-variant dark:text-slate-300 font-label-sm text-xs font-semibold flex items-center gap-1">
                     <span class="material-symbols-outlined text-[13px]">hourglass_empty</span> Sin consumo registrado
                   </span>`}
            </div>
            <h3 class="font-headline-md text-base text-primary dark:text-white font-bold pt-1">${item.material}</h3>
            <span class="font-label-sm text-on-surface-variant dark:text-slate-400">Unidad: <strong class="text-on-surface dark:text-slate-200">${item.metrica}</strong></span>
          </div>

          <div class="text-right sm:text-right">
            <span class="text-xs text-on-surface-variant dark:text-slate-400 block font-medium">Recibido en Obra</span>
            <span class="font-mono font-bold text-base text-emerald-700 dark:text-emerald-400">${item.cant_recibida} ${item.metrica}</span>
          </div>
        </div>

        <!-- Formulario de registro de uso (Permite edición continua) -->
        <div class="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          <div class="sm:col-span-5 space-y-1">
            <label class="text-xs font-semibold text-on-surface-variant dark:text-slate-300 block">Cantidad Usada / Consumida *</label>
            <input type="number" step="any" min="0" id="input-usada-${rowNum}" value="${defaultCant}" placeholder="Ej: 5" class="w-full h-10 px-3 rounded-lg bg-surface-container-lowest dark:bg-[#1e293b] text-on-surface dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
          </div>

          <div class="sm:col-span-4 space-y-1">
            <label class="text-xs font-semibold text-on-surface-variant dark:text-slate-300 block">Fecha de Uso *</label>
            <input type="date" id="input-fecha-uso-${rowNum}" value="${defaultFecha}" class="w-full h-10 px-3 rounded-lg bg-surface-container-lowest dark:bg-[#1e293b] text-on-surface dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-body-md text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
          </div>

          <div class="sm:col-span-3">
            <button type="button" id="btn-save-uso-${rowNum}" onclick="confirmUsoObra(${rowNum})" class="w-full h-10 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-label-sm font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">${isUsed ? 'edit' : 'save'}</span>
              <span>${isUsed ? 'Actualizar Uso' : 'Registrar Uso'}</span>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

async function confirmUsoObra(rowNum) {
  const inputCant = document.getElementById(`input-usada-${rowNum}`);
  const inputFecha = document.getElementById(`input-fecha-uso-${rowNum}`);
  const btn = document.getElementById(`btn-save-uso-${rowNum}`);

  const cantVal = inputCant ? parseFloat(inputCant.value) : NaN;
  const fechaVal = inputFecha ? inputFecha.value.trim() : '';

  if (isNaN(cantVal) || cantVal < 0) {
    showToast('⚠️ Ingresa una cantidad de uso válida');
    if (inputCant) inputCant.focus();
    return;
  }
  if (!fechaVal) {
    showToast('⚠️ Selecciona la fecha de uso');
    if (inputFecha) inputFecha.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full inline-block"></span> Guardando...`;
  }

  try {
    showToast('⏳ Guardando consumo en Salida_Materiales...');
    await SHEETS_API.saveUsoObra({
      row: rowNum,
      cant_usada: cantVal,
      fecha: fechaVal
    });

    // Actualizar estado en memoria local
    const item = usosObraData.find(it => it.row === rowNum);
    if (item) {
      item.cant_usada = cantVal;
      item.fecha = fechaVal;
      item.is_used = true;
    }

    updateUsosBadges();
    renderUsosList();
    showToast(`✅ Uso en obra registrado en Google Sheets (fila #${rowNum})`);
    
    await StorageService.removeCache('usos_obra');
    await StorageService.removeCache('solicitudes'); // Salida afecta fórmula ACCION en Solicitudes
    SYNC.refreshAfterWrite();
  } catch (err) {
    showToast(`❌ Error al guardar uso: ${err.message}`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-[16px]">save</span> <span>Reintentar</span>`;
    }
  }
}

// --- PESTAÑA 4: HISTORIAL DE SOLICITUDES (CONDICIONADO POR ACCION) ---

async function loadHistorialSolicitudes(forceFresh = false) {
  const container = document.getElementById('historialListContainer');
  if (!container) return;

  if (forceFresh) {
    container.innerHTML = `
      <div class="text-center py-8 text-on-surface-variant dark:text-slate-400 font-body-sm">
        <span class="animate-spin h-6 w-6 border-2 border-primary dark:border-amber-400 border-t-transparent rounded-full inline-block mb-2"></span>
        <p>Consultando historial de solicitudes en Google Sheets...</p>
      </div>`;
    showToast('⏳ Actualizando historial de solicitudes...');
  }

  try {
    let data;
    if (forceFresh) {
      await StorageService.removeCache('solicitudes');
      data = await SHEETS_API.fetchSolicitudes();
    } else {
      data = await SHEETS_API.getSolicitudes();
    }

    historialSolicitudesData = Array.isArray(data) ? data : [];
    renderHistorialSolicitudes();
    if (forceFresh) showToast('✅ Historial de solicitudes actualizado');
  } catch (err) {
    console.error('Error cargando historial:', err);
    container.innerHTML = `
      <div class="text-center py-6 text-rose-500 font-body-sm">
        <span class="material-symbols-outlined text-[28px] block mb-1">error</span>
        <p>Error al cargar el historial: ${err.message}</p>
        <button type="button" onclick="loadHistorialSolicitudes(true)" class="mt-2 px-3 py-1 bg-surface-container rounded-lg font-bold text-xs cursor-pointer">Reintentar</button>
      </div>`;
  }
}

function filterHistorialSolicitudes(query) {
  historialSearchQuery = String(query || '').trim().toLowerCase();
  renderHistorialSolicitudes();
}

function renderHistorialSolicitudes() {
  const container = document.getElementById('historialListContainer');
  if (!container) return;

  let items = [...historialSolicitudesData];

  // 1. Filtrar por Obra seleccionada en cabecera
  if (currentMasterObra) {
    items = items.filter(it => {
      const obr = String(it['OBRA'] || '').trim().toLowerCase();
      return obr === currentMasterObra.toLowerCase();
    });
  }

  // 2. Condición clave sobre ACCION:
  // "Aca no mostrar lo que ya fue Despachado pero si lo demas, segun la Obra selecionada en la cabecera."
  items = items.filter(it => {
    const accion = String(it['ACCION'] || '').trim().toLowerCase();
    // Excluir si ya fue despachado/ejecutado
    if (accion.includes('despachado') && !accion.includes('pendiente')) {
      return false;
    }
    return true;
  });

  // 3. Filtrar por texto de búsqueda rápida (folio, material, solicitante, sector)
  if (historialSearchQuery) {
    items = items.filter(it => {
      const folio = String(it['N# SOLICITUD'] || it['N#'] || '').toLowerCase();
      const mat = String(it['MATERIAL'] || '').toLowerCase();
      const sol = String(it['SOLICITANTE'] || '').toLowerCase();
      const sec = String(it['SECTOR DE LA OBRA'] || '').toLowerCase();
      return folio.includes(historialSearchQuery) ||
             mat.includes(historialSearchQuery) ||
             sol.includes(historialSearchQuery) ||
             sec.includes(historialSearchQuery);
    });
  }

  // Actualizar indicadores
  const countIndicator = document.getElementById('historialCountIndicator');
  if (countIndicator) {
    countIndicator.textContent = `${items.length} solicitud${items.length === 1 ? '' : 'es'}`;
  }
  const badgeCount = document.getElementById('badgeHistorialCount');
  if (badgeCount) {
    if (items.length > 0) {
      badgeCount.textContent = items.length;
      badgeCount.classList.remove('hidden');
    } else {
      badgeCount.classList.add('hidden');
    }
  }

  const indHistorial = document.getElementById('historialObraIndicator');
  if (indHistorial) {
    indHistorial.textContent = `Obra: ${currentMasterObra || 'Todas'}`;
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 rounded-xl bg-surface-container-low dark:bg-[#0f172a] border border-dashed border-slate-200 dark:border-slate-800 p-6 space-y-2">
        <span class="material-symbols-outlined text-[36px] text-slate-400">filter_list_off</span>
        <h3 class="font-headline-md text-sm text-on-surface dark:text-slate-200 font-bold">No hay solicitudes pendientes</h3>
        <p class="font-body-sm text-on-surface-variant dark:text-slate-400 max-w-sm mx-auto">
          ${currentMasterObra 
            ? `No hay solicitudes activas pendientes de despacho para "${currentMasterObra}".` 
            : 'No se encontraron solicitudes pendientes (o todas las registradas ya fueron despachadas).'}
        </p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(item => {
    const folio = item['N# SOLICITUD'] || `N# ${item['N#'] || item._rowIndex || '--'}`;
    const fecha = item['FECHA'] || '--';
    const solicitante = item['SOLICITANTE'] || '--';
    const obra = item['OBRA'] || '--';
    const sector = item['SECTOR DE LA OBRA'] || '';
    const material = item['MATERIAL'] || '--';
    const metrica = item['METRICA'] || '';
    const cantidad = item['CANTIDAD'] || '0';
    const aprobado = String(item['APROBADO'] || '').trim();
    const observacion = item['OBSERVACION POR ITEM'] || '';
    const tieneFotos = item['TIENE_FOTOS'] === true || String(item['TIENE_FOTOS']).toLowerCase() === 'true';
    const accion = String(item['ACCION'] || '').trim();

    // Badge para Estado de Aprobación
    let aprobadoBadge = '';
    const apLower = aprobado.toLowerCase();
    if (apLower === 'aprobado') {
      aprobadoBadge = `<span class="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-label-sm text-xs font-bold flex items-center gap-1">
        <span class="material-symbols-outlined text-[13px]">check_circle</span> Aprobado
      </span>`;
    } else if (apLower === 'rechazado') {
      aprobadoBadge = `<span class="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-label-sm text-xs font-bold flex items-center gap-1">
        <span class="material-symbols-outlined text-[13px]">cancel</span> Rechazado
      </span>`;
    } else {
      aprobadoBadge = `<span class="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-label-sm text-xs font-bold flex items-center gap-1">
        <span class="material-symbols-outlined text-[13px]">schedule</span> Pendiente
      </span>`;
    }

    // Badge para Columna ACCION
    let accionBadge = '';
    const acLower = accion.toLowerCase();
    if (acLower.includes('pendiente')) {
      accionBadge = `<span class="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-label-sm text-xs font-bold flex items-center gap-1 border border-indigo-200 dark:border-indigo-800">
        <span class="material-symbols-outlined text-[14px]">local_shipping</span> ${accion}
      </span>`;
    } else if (acLower.includes('rechazado')) {
      accionBadge = `<span class="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-label-sm text-xs font-bold flex items-center gap-1 border border-rose-200 dark:border-rose-800">
        <span class="material-symbols-outlined text-[14px]">block</span> ${accion}
      </span>`;
    } else if (accion) {
      accionBadge = `<span class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-label-sm text-xs font-semibold border border-slate-200 dark:border-slate-700">
        ${accion}
      </span>`;
    } else {
      accionBadge = `<span class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-label-sm text-xs">
        En Evaluación
      </span>`;
    }

    return `
      <div class="bg-surface-container-low dark:bg-[#0f172a] p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 transition-all fade-in">
        <div class="flex items-start justify-between gap-2 flex-wrap">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded-md bg-primary/10 dark:bg-amber-400/10 text-primary dark:text-amber-400 font-mono font-bold text-xs">
                ${folio}
              </span>
              <span class="px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-on-surface dark:text-slate-200 font-label-sm text-xs font-semibold">
                ${obra}
              </span>
              ${sector ? `<span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-on-surface-variant dark:text-slate-400 text-xs">${sector}</span>` : ''}
              ${aprobadoBadge}
            </div>
            <h3 class="font-headline-md text-base text-primary dark:text-white font-bold pt-0.5">${material}</h3>
            <div class="flex items-center gap-3 text-xs text-on-surface-variant dark:text-slate-400 flex-wrap">
              <span>Solicitante: <strong class="text-on-surface dark:text-slate-200">${solicitante}</strong></span>
              <span>•</span>
              <span>Fecha: <strong class="text-on-surface dark:text-slate-200 font-mono">${fecha}</strong></span>
              ${tieneFotos ? `<span class="inline-flex items-center gap-0.5 text-primary dark:text-amber-400 font-semibold"><span class="material-symbols-outlined text-[13px]">photo_camera</span> Fotos</span>` : ''}
            </div>
          </div>

          <div class="text-right sm:text-right shrink-0">
            <span class="text-xs text-on-surface-variant dark:text-slate-400 block font-medium">Cantidad Solicitada</span>
            <span class="font-mono font-bold text-lg text-primary dark:text-amber-400">${cantidad} <span class="text-xs font-normal">${metrica}</span></span>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2 text-xs">
            <span class="text-on-surface-variant dark:text-slate-400 font-medium">Acción Almacén / Estado:</span>
            ${accionBadge}
          </div>
          ${observacion ? `<div class="text-xs text-on-surface-variant dark:text-slate-400 italic max-w-md truncate" title="${observacion}">Obs: "${observacion}"</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// Inicializar al cargar el DOM
document.addEventListener('DOMContentLoaded', initApp);

// Exportar funciones globales para interacción HTML
window.addMaterialRow = addMaterialRow;
window.removeMaterialRow = removeMaterialRow;
window.updateRowField = updateRowField;
window.adjustQuantity = adjustQuantity;
window.handleSubmit = handleSubmit;
window.closeModal = closeModal;
window.resetFormForNew = resetFormForNew;
window.showAddEngineerForm = showAddEngineerForm;
window.closeEngineerModal = closeEngineerModal;
window.saveEngineer = saveEngineer;
window.onCatalogSelectChanged = onCatalogSelectChanged;
window.openNewField = openNewField;
window.closeNewField = closeNewField;
window.saveNewObra = saveNewObra;
window.cancelNewObra = cancelNewObra;
window.onRowSelectChanged = onRowSelectChanged;
window.saveNewMaterial = saveNewMaterial;
window.cancelNewMaterial = cancelNewMaterial;
window.saveNewMetric = saveNewMetric;
window.cancelNewMetric = cancelNewMetric;
window.saveNewRowSector = saveNewRowSector;
window.cancelNewRowSector = cancelNewRowSector;
window.downloadPDF = downloadPDF;
window.downloadMockPDF = downloadPDF; // Alias retrocompatible
window.showSetupForm = showSetupForm;
window.showSetupModal = showSetupModal;
window.closeSetupModal = closeSetupModal;
window.doSetup = doSetup;
window.showToast = showToast;
window.toggleTheme = toggleTheme;
window.handlePhotoUpload = handlePhotoUpload;
window.removePhoto = removePhoto;
window.compressImage = compressImage;

// Exportar funciones de GIMO (Pestañas, Control en Obra e Historial)
window.switchMainTab = switchMainTab;
window.onMasterObraChanged = onMasterObraChanged;
window.loadEntradasObra = loadEntradasObra;
window.setRecibidoCompleto = setRecibidoCompleto;
window.confirmEntradaObra = confirmEntradaObra;
window.loadUsosObra = loadUsosObra;
window.confirmUsoObra = confirmUsoObra;
window.loadHistorialSolicitudes = loadHistorialSolicitudes;
window.filterHistorialSolicitudes = filterHistorialSolicitudes;
window.renderHistorialSolicitudes = renderHistorialSolicitudes;


