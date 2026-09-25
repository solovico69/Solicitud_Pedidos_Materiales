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

const INITIAL_ROWS = [
  { sector: "", material: "", unidad: "", cantidad: "" },
  { sector: "", material: "", unidad: "", cantidad: "" }
];

let currentRows = [];
let baseDatosCache = null;

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
  const newEngineerProject = document.getElementById('newEngineerProject');
  if (obraSelect && Array.isArray(baseDatos.obras)) {
    const currentObra = obraSelect.value;
    const obrasOptions = '<option disabled selected value="">Seleccione la obra activa...</option>' +
      baseDatos.obras
        .filter(v => v && String(v).trim())
        .map(name => `<option value="${name}">${name}</option>`)
        .join('') +
      '<option value="__new_obra__">➕ Nueva obra…</option>';
    obraSelect.innerHTML = obrasOptions;
    if (currentObra) obraSelect.value = currentObra;

    if (newEngineerProject) {
      newEngineerProject.innerHTML = '<option value="">Asignar a obra...</option>' +
        baseDatos.obras
          .filter(v => v && String(v).trim())
          .map(name => `<option value="${name}">${name}</option>`)
          .join('');
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
    const unidadOpts = Array.from(new Set([...UNIDADES, row.unidad])).filter(Boolean);

    const sectorHtml = `<option disabled ${!row.sector ? 'selected' : ''} value="">Seleccione el sector...</option>` +
      sectorOpts.map(s => `<option value="${s}" ${row.sector === s ? 'selected' : ''}>${s}</option>`).join('') +
      '<option value="__new_sector__">➕ Nuevo sector…</option>';

    const materialHtml = `<option disabled ${!row.material ? 'selected' : ''} value="">Seleccione el material...</option>` +
      materialOpts.map(m => `<option value="${m}" ${row.material === m ? 'selected' : ''}>${m}</option>`).join('') +
      '<option value="__new_material__">➕ Nuevo material…</option>';

    const unidadHtml = `<option disabled ${!row.unidad ? 'selected' : ''} value="">Seleccione la métrica...</option>` +
      unidadOpts.map(u => `<option value="${u}" ${row.unidad === u ? 'selected' : ''}>${u}</option>`).join('') +
      '<option value="__new_metrica__">➕ Nueva métrica…</option>';

    // Bloques inline "Agregar Nuevo" para esta línea
    const sectorWrap = buildNewFieldWrap(`newSectorWrap-${index}`, `newSectorInput-${index}`, 'sector', `saveNewRowSector(${index})`, `cancelNewRowSector(${index})`);
    const materialWrap = buildNewFieldWrap(`newMaterialWrap-${index}`, `newMaterialInput-${index}`, 'material', `saveNewMaterial(${index})`, `cancelNewMaterial(${index})`);
    const metricWrap = buildNewFieldWrap(`newMetricWrap-${index}`, `newMetricInput-${index}`, 'métrica / unidad', `saveNewMetric(${index})`, `cancelNewMetric(${index})`);

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
          <label class="font-label-sm text-label-sm text-on-surface-variant dark:text-slate-400 flex items-center gap-1">
            <span class="material-symbols-outlined text-[15px] text-primary dark:text-amber-400">straighten</span> Métrica / Unidad
          </label>
          <div class="relative">
            <select onchange="onRowSelectChanged(${index}, 'unidad', this)" class="w-full h-10 pl-3 pr-8 rounded-lg bg-surface-container-lowest dark:bg-[#1e293b] text-on-surface dark:text-slate-100 border border-transparent dark:border-slate-700 font-body-md focus:ring-2 focus:ring-primary dark:focus:ring-amber-500 focus:outline-none appearance-none cursor-pointer text-sm">
              ${unidadHtml}
            </select>
            <span class="material-symbols-outlined text-outline dark:text-slate-400 absolute right-2.5 top-2.5 text-[18px] pointer-events-none">expand_more</span>
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
      ${metricWrap}
    `;
    container.appendChild(rowCard);
  });

  updateCounters();
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
    cantidad: ''
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

  // Mapeo estricto por nombres de encabezado
  const lines = validRows.map(row => ({
    FECHA: fecha,
    SOLICITANTE: profesional,
    OBRA: obra,
    'SECTOR DE LA OBRA': row.sector,
    MATERIAL: row.material,
    METRICA: row.unidad,
    CANTIDAD: row.cantidad,
    APROBADO: 'Pendiente'
  }));

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

    // Encolar offline para resiliencia
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
  if (val === NEW_OPTION_VALUES.METRICA) {
    selectEl.value = row.unidad || '';
    openNewField(`newMetricWrap-${index}`, `newMetricInput-${index}`);
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
  const input = document.getElementById(`newMaterialInput-${index}`);
  const value = input ? input.value.trim() : '';
  if (!value) {
    showToast('⚠️ Escribe el nombre del material');
    return;
  }
  const row = currentRows[index];
  try {
    showToast('⏳ Guardando nuevo material...');
    await SHEETS_API.addToBaseDatos({
      material: value,
      metric: row && row.unidad ? row.unidad : ''
    });
    await refreshCatalogsAndApply();
    if (currentRows[index]) currentRows[index].material = value;
    closeNewField(`newMaterialWrap-${index}`, `newMaterialInput-${index}`);
    renderRows();
    showToast(`✅ Material "${value}" agregado exitosamente`);
    SYNC.refreshAfterWrite();
  } catch (e) {
    showToast(`❌ Error: ${e.message}`);
  }
}

function cancelNewMaterial(index) {
  closeNewField(`newMaterialWrap-${index}`, `newMaterialInput-${index}`);
}

async function saveNewMetric(index) {
  const input = document.getElementById(`newMetricInput-${index}`);
  const value = input ? input.value.trim() : '';
  if (!value) {
    showToast('⚠️ Escribe el nombre de la métrica / unidad');
    return;
  }
  try {
    showToast('⏳ Guardando nueva métrica...');
    await SHEETS_API.addToBaseDatos({ metric: value });
    await refreshCatalogsAndApply();
    if (currentRows[index]) currentRows[index].unidad = value;
    closeNewField(`newMetricWrap-${index}`, `newMetricInput-${index}`);
    renderRows();
    showToast(`✅ Métrica "${value}" agregada exitosamente`);
    SYNC.refreshAfterWrite();
  } catch (e) {
    showToast(`❌ Error: ${e.message}`);
  }
}

function cancelNewMetric(index) {
  closeNewField(`newMetricWrap-${index}`, `newMetricInput-${index}`);
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


