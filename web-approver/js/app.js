/**
 * PROYECTO: Control Solicitud de Pedidos Materiales
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: OpenCode for Obsidian & Antigravity IDE
 * ROL: Controlador Principal de la App del Aprobador (Gestión de Pedidos & Estado)
 */

let allRows = [];
let groupedOrders = [];
let pendingChanges = new Map(); // rowNum -> { row, aprobado, observacion }
let currentTab = 'pendiente';
let currentObra = '';
let currentSearch = '';

// ============================================
// INICIALIZACIÓN
// ============================================

async function initApp() {
  loadTheme();

  // Si no está configurada la URL de GAS, solicitarla
  if (!SHEETS_API.isConfigured()) {
    showSetupModal();
    renderEmptyState('Configuración requerida', 'Por favor ingresa la URL de tu Web App de Google Apps Script para comenzar.');
    return;
  }

  await loadData();
}

/**
 * Carga las solicitudes desde Google Sheets
 */
async function loadData() {
  const loading = document.getElementById('loadingState');
  if (loading) loading.classList.remove('hidden');

  const refreshIcon = document.getElementById('refreshIcon');
  if (refreshIcon) refreshIcon.classList.add('animate-spin');

  try {
    const res = await SHEETS_API.getSolicitudes();
    if (res && res.data) {
      // Filtrar únicamente filas válidas que posean contenido real de solicitud (material o solicitante)
      allRows = res.data.filter(r => {
        const mat = String(r['MATERIAL'] || '').trim();
        const sol = String(r['SOLICITANTE'] || '').trim();
        return mat !== '' || sol !== '';
      });
      populateObraFilter(allRows);
      groupAndRenderOrders();
      updateConnectionStatus(true);
    } else {
      throw new Error(res.error || 'Respuesta inválida del servidor');
    }
  } catch (err) {
    console.error('[Approver] Error cargando datos:', err);
    updateConnectionStatus(false, err.message);
    showToast(`⚠️ Error al cargar datos: ${err.message}`);
    renderEmptyState('Error de conexión', 'No se pudieron cargar las solicitudes. Verifica tu conexión o configuración.');
  } finally {
    if (loading) loading.classList.add('hidden');
    if (refreshIcon) refreshIcon.classList.remove('animate-spin');
  }
}

function updateConnectionStatus(connected, errorMsg = '') {
  const dot = document.getElementById('connDot');
  const label = document.getElementById('connLabel');
  if (connected) {
    if (dot) {
      dot.className = 'relative inline-flex rounded-full h-2 w-2 bg-emerald-500';
    }
    if (label) {
      label.textContent = 'Google Sheets: Conectado';
      label.className = 'font-medium text-emerald-600 dark:text-emerald-400';
    }
  } else {
    if (dot) {
      dot.className = 'relative inline-flex rounded-full h-2 w-2 bg-rose-500';
    }
    if (label) {
      label.textContent = errorMsg ? `Desconectado (${errorMsg.slice(0, 25)})` : 'Desconectado';
      label.className = 'font-medium text-rose-600 dark:text-rose-400';
    }
  }
}

// ============================================
// AGRUPACIÓN POR FOLIO & FILTROS
// ============================================

function populateObraFilter(rows) {
  const select = document.getElementById('obraFilter');
  if (!select) return;

  const current = select.value;
  const obras = Array.from(new Set(rows.map(r => r['OBRA']).filter(Boolean)));

  select.innerHTML = '<option value="">Todas las Obras</option>' +
    obras.map(o => `<option value="${o}" ${o === current ? 'selected' : ''}>${o}</option>`).join('');
}

function groupAndRenderOrders() {
  // Agrupar filas por "N# SOLICITUD"
  const map = new Map();

  allRows.forEach(row => {
    const mat = String(row['MATERIAL'] || '').trim();
    const sol = String(row['SOLICITANTE'] || '').trim();
    if (!mat && !sol) return; // Omitir cualquier fila sin datos reales

    const rawFolio = String(row['N# SOLICITUD'] || '').trim();
    const folio = rawFolio || `REQ-${row._rowIndex}`;
    if (!map.has(folio)) {
      map.set(folio, {
        folio: folio,
        fecha: row['FECHA'] || '',
        solicitante: row['SOLICITANTE'] || '',
        obra: row['OBRA'] || '',
        lines: []
      });
    }
    map.get(folio).lines.push(row);
  });

  groupedOrders = Array.from(map.values());

  // Actualizar badges numéricos
  updateHeaderBadges();

  // Aplicar filtros actuales y renderizar
  renderOrders();
}

function updateHeaderBadges() {
  let pendingCount = 0;
  allRows.forEach(r => {
    const st = getCurrentStatus(r);
    if (st === 'Pendiente') pendingCount++;
  });

  const pendingBadge = document.getElementById('pendingBadge');
  const totalBadge = document.getElementById('totalBadge');

  if (pendingBadge) {
    pendingBadge.textContent = `${pendingCount} líneas pendientes`;
    if (pendingCount > 0) {
      pendingBadge.className = 'px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 font-semibold text-[11px] animate-pulse';
    } else {
      pendingBadge.className = 'px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 font-semibold text-[11px]';
    }
  }

  if (totalBadge) {
    totalBadge.textContent = `${groupedOrders.length} pedidos (${allRows.length} líneas)`;
  }
}

function getCurrentStatus(row) {
  const rowNum = row._rowIndex;
  if (pendingChanges.has(rowNum)) {
    return pendingChanges.get(rowNum).aprobado;
  }
  const val = String(row['APROBADO'] || '').trim();
  return val || 'Pendiente';
}

function getCurrentObservacion(row) {
  const rowNum = row._rowIndex;
  if (pendingChanges.has(rowNum)) {
    return pendingChanges.get(rowNum).observacion;
  }
  return String(row['OBSERVACION POR ITEM'] || '').trim();
}

function getOrderSummaryStatus(order) {
  const statuses = order.lines.map(getCurrentStatus);
  const allAprobados = statuses.every(s => s === 'Aprobado');
  if (allAprobados) return { label: 'Aprobado', color: 'emerald' };

  const allRechazados = statuses.every(s => s === 'Rechazado');
  if (allRechazados) return { label: 'Rechazado', color: 'rose' };

  const hasPendiente = statuses.some(s => s === 'Pendiente');
  if (hasPendiente) {
    const hasAnyDecided = statuses.some(s => s === 'Aprobado' || s === 'Rechazado');
    if (hasAnyDecided) {
      return { label: 'Revisión Parcial', color: 'sky' };
    }
    return { label: 'Pendiente', color: 'amber' };
  }

  return { label: 'Mixto', color: 'blue' };
}

// ============================================
// RENDERIZADO DE TARJETAS
// ============================================

function renderOrders() {
  const container = document.getElementById('ordersContainer');
  if (!container) return;

  const query = currentSearch.toLowerCase().trim();

  // Actualizar números y badges de las pestañas
  updateTabBadges();

  const cardsHtml = [];

  groupedOrders.forEach(order => {
    // 1. Filtro por Obra
    if (currentObra && order.obra !== currentObra) {
      return;
    }

    // 2. Filtro por Búsqueda (Folio o Solicitante)
    if (query) {
      const matchFolio = order.folio.toLowerCase().includes(query);
      const matchResp = order.solicitante.toLowerCase().includes(query);
      const matchMat = order.lines.some(l => String(l['MATERIAL'] || '').toLowerCase().includes(query));
      if (!matchFolio && !matchResp && !matchMat) return;
    }

    // 3. Filtrar qué líneas son visibles para esta pestaña
    let visibleLines = order.lines;
    if (currentTab === 'pendiente') {
      visibleLines = order.lines.filter(l => getCurrentStatus(l) === 'Pendiente');
    } else if (currentTab === 'aprobado') {
      visibleLines = order.lines.filter(l => getCurrentStatus(l) === 'Aprobado');
    } else if (currentTab === 'rechazado') {
      visibleLines = order.lines.filter(l => getCurrentStatus(l) === 'Rechazado');
    }

    // Si para esta pestaña hay al menos una línea que mostrar, renderizamos la tarjeta
    if (visibleLines.length > 0) {
      cardsHtml.push(buildOrderCardHtml(order, visibleLines));
    }
  });

  if (cardsHtml.length === 0) {
    const tabLabels = {
      pendiente: 'solicitudes pendientes',
      todos: 'solicitudes registradas',
      aprobado: 'solicitudes aprobadas',
      rechazado: 'solicitudes rechazadas'
    };
    renderEmptyState(
      `Sin ${tabLabels[currentTab] || 'pedidos'}`,
      'No hay líneas de materiales que coincidan con la pestaña y filtros seleccionados.'
    );
    return;
  }

  container.innerHTML = cardsHtml.join('');
}

function buildOrderCardHtml(order, visibleLines) {
  const summary = getOrderSummaryStatus(order);
  const colorMap = {
    amber: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800',
    emerald: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800',
    rose: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-400 border-rose-300 dark:border-rose-800',
    sky: 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-400 border-sky-300 dark:border-sky-800',
    blue: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800'
  };

  const badgeClass = colorMap[summary.color] || colorMap.amber;

  // Renderizar ÚNICAMENTE las líneas visibles de la pestaña seleccionada
  const linesHtml = visibleLines.map((line) => {
    const rowNum = line._rowIndex;
    const status = getCurrentStatus(line);
    const obs = getCurrentObservacion(line);
    const isModified = pendingChanges.has(rowNum);

    const isAprobado = status === 'Aprobado';
    const isRechazado = status === 'Rechazado';
    const isPendiente = status === 'Pendiente';

    // Número de ítem original en el pedido
    const originalIndex = order.lines.findIndex(l => l._rowIndex === rowNum) + 1;

    return `
      <div class="p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#1E293B] border ${isModified ? 'border-sky-500/70 shadow-sm ring-1 ring-sky-500/30' : 'border-slate-200/80 dark:border-slate-800'} space-y-2.5 transition-all">
        <!-- Encabezado de la línea -->
        <div class="flex items-start justify-between gap-2">
          <div class="space-y-0.5 flex-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-mono font-bold flex items-center justify-center">#${originalIndex}</span>
              ${line['SECTOR DE LA OBRA'] ? `<span class="px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold">${line['SECTOR DE LA OBRA']}</span>` : ''}
              ${isModified ? '<span class="px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 text-[10px] font-bold">Modificado</span>' : ''}
            </div>
            <h4 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">${line['MATERIAL']}</h4>
          </div>
          <div class="text-right shrink-0">
            <span class="text-xs sm:text-sm font-bold text-sky-700 dark:text-sky-400 font-mono">${line['CANTIDAD']}</span>
            <span class="text-[11px] text-slate-500 dark:text-slate-400 block">${line['METRICA'] || ''}</span>
          </div>
        </div>

        <!-- Botones de Acción Táctil (Aprobar / Rechazar / Pendiente) -->
        <div class="flex items-center gap-1.5 pt-1">
          <button type="button" onclick="setItemStatus(${rowNum}, 'Aprobado')" class="flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${isAprobado ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/50' : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}">
            <span class="material-symbols-outlined text-[16px]">${isAprobado ? 'check_circle' : 'done'}</span>
            <span>Aprobar</span>
          </button>

          <button type="button" onclick="setItemStatus(${rowNum}, 'Rechazado')" class="flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${isRechazado ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/50' : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}">
            <span class="material-symbols-outlined text-[16px]">${isRechazado ? 'cancel' : 'close'}</span>
            <span>Rechazar</span>
          </button>

          <button type="button" onclick="setItemStatus(${rowNum}, 'Pendiente')" title="Restaurar a Pendiente" class="py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all ${isPendiente ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-700 font-bold' : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700'}">
            <span class="material-symbols-outlined text-[16px]">schedule</span>
          </button>
        </div>

        <!-- Campo: OBSERVACION POR ITEM -->
        <div class="pt-0.5">
          <input type="text" value="${escapeHtml(obs)}" id="obs-${rowNum}" onchange="setItemObservation(${rowNum}, this.value)" placeholder="Escribe observación o motivo (opcional)..." class="w-full h-8 px-2.5 rounded-lg text-xs bg-white dark:bg-[#0B1120] border ${isRechazado && !obs ? 'border-rose-400 dark:border-rose-500 ring-2 ring-rose-400/50' : 'border-slate-200 dark:border-slate-700'} text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500">
        </div>
      </div>
    `;
  }).join('');

  // Indicador de líneas mostradas en la tarjeta
  const lineCounterText = currentTab === 'todos'
    ? `${order.lines.length} líneas`
    : `${visibleLines.length} de ${order.lines.length} líneas`;

  return `
    <article class="bg-white dark:bg-[#0F172A] rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 fade-in">
      <!-- Encabezado de la Tarjeta del Pedido -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-mono text-sm sm:text-base font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800">${order.folio}</span>
          <span class="px-2.5 py-1 rounded-lg border text-xs font-bold ${badgeClass}">${summary.label}</span>
          <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold font-mono">${lineCounterText}</span>
          <span class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 ml-auto sm:ml-0">
            <span class="material-symbols-outlined text-[15px]">calendar_today</span> ${order.fecha || '--'}
          </span>
        </div>

        <!-- Accesos rápidos por pedido -->
        <div class="flex items-center gap-1.5 self-end sm:self-auto">
          <button type="button" onclick="setOrderAllStatus('${order.folio}', 'Aprobado')" class="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1 border border-emerald-200 dark:border-emerald-800 transition-colors">
            <span class="material-symbols-outlined text-[15px]">done_all</span> Aprobar Todo
          </button>
          <button type="button" onclick="setOrderAllStatus('${order.folio}', 'Rechazado')" class="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-1 border border-rose-200 dark:border-rose-800 transition-colors">
            <span class="material-symbols-outlined text-[15px]">close</span> Rechazar Todo
          </button>
        </div>
      </div>

      <!-- Metadatos de Obra y Solicitante -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-[#1E293B]/60 p-2.5 rounded-xl text-slate-600 dark:text-slate-300">
        <div class="flex items-center gap-1.5 truncate">
          <span class="material-symbols-outlined text-slate-400 text-[16px]">domain</span>
          <span class="font-medium text-slate-400">Obra:</span>
          <span class="font-bold text-slate-900 dark:text-white truncate">${order.obra || 'No especificada'}</span>
        </div>
        <div class="flex items-center gap-1.5 truncate">
          <span class="material-symbols-outlined text-slate-400 text-[16px]">engineering</span>
          <span class="font-medium text-slate-400">Solicitante:</span>
          <span class="font-bold text-slate-900 dark:text-white truncate">${order.solicitante || 'No especificado'}</span>
        </div>
      </div>

      <!-- Lista de Líneas de Materiales -->
      <div class="space-y-2.5">
        ${linesHtml}
      </div>
    </article>
  `;
}

function renderEmptyState(title, subtitle) {
  const container = document.getElementById('ordersContainer');
  if (!container) return;
  container.innerHTML = `
    <div class="py-16 text-center space-y-3 fade-in">
      <div class="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
        <span class="material-symbols-outlined text-[36px]">inbox</span>
      </div>
      <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">${title}</h3>
      <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">${subtitle}</p>
      <button onclick="refreshData()" class="mt-2 px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold shadow-sm inline-flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[16px]">refresh</span> Actualizar ahora
      </button>
    </div>
  `;
}

// ============================================
// ACCIONES DE APROBACIÓN & CAMBIOS PENDIENTES
// ============================================

function setItemStatus(rowNum, status) {
  const row = allRows.find(r => r._rowIndex === rowNum);
  if (!row) return;

  const currentObs = getCurrentObservacion(row);

  pendingChanges.set(rowNum, {
    row: rowNum,
    aprobado: status,
    observacion: currentObs
  });

  updateSaveBar();
  renderOrders();

  // Si se rechaza y no tiene observación, enfocar el campo
  if (status === 'Rechazado') {
    setTimeout(() => {
      const input = document.getElementById(`obs-${rowNum}`);
      if (input && !input.value) {
        input.focus();
        showToast('⚠️ Indica la observación o motivo del rechazo', 2500);
      }
    }, 100);
  }
}

function setItemObservation(rowNum, text) {
  const row = allRows.find(r => r._rowIndex === rowNum);
  if (!row) return;

  const currentSt = getCurrentStatus(row);
  pendingChanges.set(rowNum, {
    row: rowNum,
    aprobado: currentSt,
    observacion: text.trim()
  });

  updateSaveBar();
}

function setOrderAllStatus(folio, status) {
  const order = groupedOrders.find(o => o.folio === folio);
  if (!order) return;

  order.lines.forEach(line => {
    const rowNum = line._rowIndex;
    const currentObs = getCurrentObservacion(line);
    pendingChanges.set(rowNum, {
      row: rowNum,
      aprobado: status,
      observacion: currentObs
    });
  });

  updateSaveBar();
  renderOrders();
  showToast(`✅ Pedido ${folio}: Todas las líneas marcadas como "${status}"`);
}

function updateSaveBar() {
  const bar = document.getElementById('saveBar');
  const counter = document.getElementById('changesCounter');
  const count = pendingChanges.size;

  if (count > 0) {
    if (counter) counter.textContent = count;
    if (bar) bar.classList.remove('hidden');
  } else {
    if (bar) bar.classList.add('hidden');
  }
}

async function saveAllApprovals() {
  if (pendingChanges.size === 0) return;

  const items = Array.from(pendingChanges.values());
  const btn = document.getElementById('btnSaveApprovals');
  const icon = document.getElementById('btnSaveIcon');
  const label = document.getElementById('btnSaveLabel');

  btn.disabled = true;
  icon.classList.add('animate-spin');
  icon.textContent = 'progress_activity';
  label.textContent = 'Guardando en Sheets...';

  try {
    const result = await SHEETS_API.updateAprobaciones(items);
    if (result && result.success) {
      showToast(`🎉 ¡Éxito! ${result.updatedCount} líneas guardadas correctamente.`);

      // Aplicar cambios en local
      items.forEach(it => {
        const row = allRows.find(r => r._rowIndex === it.row);
        if (row) {
          row['APROBADO'] = it.aprobado;
          row['OBSERVACION POR ITEM'] = it.observacion;
          row['FECHA APROBADO'] = result.timestamp || new Date().toISOString().split('T')[0];
        }
      });

      pendingChanges.clear();
      updateSaveBar();
      groupAndRenderOrders();
    } else {
      throw new Error(result.error || 'No se confirmaron los cambios en Sheets');
    }
  } catch (err) {
    console.error('[Approver] Error al guardar aprobaciones:', err);
    showToast(`❌ Error al guardar: ${err.message}`, 4000);
  } finally {
    btn.disabled = false;
    icon.classList.remove('animate-spin');
    icon.textContent = 'cloud_upload';
    label.textContent = 'Guardar en Sheets';
  }
}

// ============================================
// FILTROS Y EVENTOS DE INTERFAZ
// ============================================

const TAB_CONFIG = {
  pendiente: {
    activeClass: 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-2 ring-amber-400/50',
    badgeActiveClass: 'bg-slate-950/20 text-slate-950 font-bold',
    badgeInactiveClass: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-400 font-semibold'
  },
  todos: {
    activeClass: 'bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md shadow-sky-600/30 ring-2 ring-sky-400/50',
    badgeActiveClass: 'bg-white/20 text-white font-bold',
    badgeInactiveClass: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold'
  },
  aprobado: {
    activeClass: 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400/50',
    badgeActiveClass: 'bg-white/20 text-white font-bold',
    badgeInactiveClass: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 font-semibold'
  },
  rechazado: {
    activeClass: 'bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shadow-rose-600/30 ring-2 ring-rose-400/50',
    badgeActiveClass: 'bg-white/20 text-white font-bold',
    badgeInactiveClass: 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-400 font-semibold'
  }
};

const INACTIVE_TAB_CLASS = 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 font-medium';

function updateTabBadges() {
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  const totalCount = allRows.length;

  allRows.forEach(r => {
    const st = getCurrentStatus(r);
    if (st === 'Pendiente') pendingCount++;
    else if (st === 'Aprobado') approvedCount++;
    else if (st === 'Rechazado') rejectedCount++;
  });

  const tabData = [
    { id: 'tab-pendiente', key: 'pendiente', label: '⏳ Pendientes', count: pendingCount },
    { id: 'tab-todos', key: 'todos', label: '📋 Todos', count: totalCount },
    { id: 'tab-aprobado', key: 'aprobado', label: '✅ Aprobados', count: approvedCount },
    { id: 'tab-rechazado', key: 'rechazado', label: '❌ Rechazados', count: rejectedCount }
  ];

  tabData.forEach(tab => {
    const btn = document.getElementById(tab.id);
    if (!btn) return;

    const isActive = currentTab === tab.key;
    const config = TAB_CONFIG[tab.key];

    btn.className = `flex-1 py-2 px-3 rounded-xl text-xs text-center transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
      isActive ? config.activeClass : INACTIVE_TAB_CLASS
    }`;

    const badgeClass = isActive ? config.badgeActiveClass : config.badgeInactiveClass;
    btn.innerHTML = `<span>${tab.label}</span><span class="px-2 py-0.5 rounded-full text-[10px] font-mono ${badgeClass}">${tab.count}</span>`;
  });
}

function setStatusTab(tab) {
  currentTab = tab;
  updateTabBadges();
  renderOrders();
}

function applyFilters() {
  const searchInput = document.getElementById('searchInput');
  const obraFilter = document.getElementById('obraFilter');

  currentSearch = searchInput ? searchInput.value : '';
  currentObra = obraFilter ? obraFilter.value : '';

  renderOrders();
}

async function refreshData() {
  showToast('🔄 Actualizando solicitudes...');
  await loadData();
}

// ============================================
// CONFIGURACIÓN Y MODO OSCURO
// ============================================

function showSetupModal() {
  const modal = document.getElementById('setupModal');
  const sheetInput = document.getElementById('setupSheetId');
  const urlInput = document.getElementById('setupWebAppUrl');

  if (sheetInput) sheetInput.value = StorageService.getSheetId();
  if (urlInput) urlInput.value = StorageService.getWebAppUrl();

  if (modal) {
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.classList.add('opacity-100');
  }
}

function closeSetupModal() {
  const modal = document.getElementById('setupModal');
  if (modal) {
    modal.classList.add('opacity-0', 'pointer-events-none');
    modal.classList.remove('opacity-100');
  }
}

async function saveSetup() {
  const sheetId = document.getElementById('setupSheetId').value.trim();
  const webAppUrl = document.getElementById('setupWebAppUrl').value.trim();

  if (!webAppUrl) {
    showToast('⚠️ Ingresa la URL del Web App');
    return;
  }

  StorageService.setSheetId(sheetId);
  StorageService.setWebAppUrl(webAppUrl);
  closeSetupModal();

  showToast('⏳ Verificando conexión...');
  await loadData();
}

function loadTheme() {
  const saved = StorageService.get(STORAGE_KEYS.THEME);
  const icon = document.getElementById('themeIcon');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    if (icon) icon.textContent = 'light_mode';
  } else {
    document.documentElement.classList.remove('dark');
    if (icon) icon.textContent = 'dark_mode';
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  StorageService.set(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
  const icon = document.getElementById('themeIcon');
  if (icon) icon.textContent = isDark ? 'light_mode' : 'dark_mode';
  showToast(isDark ? '🌙 Modo Oscuro Activado' : '☀️ Modo Claro Activado', 1500);
}

function showToast(message, duration = 3000) {
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Inicializar al cargar el DOM
document.addEventListener('DOMContentLoaded', initApp);

// Exportar funciones globales
window.refreshData = refreshData;
window.toggleTheme = toggleTheme;
window.showSetupModal = showSetupModal;
window.closeSetupModal = closeSetupModal;
window.saveSetup = saveSetup;
window.setStatusTab = setStatusTab;
window.applyFilters = applyFilters;
window.setItemStatus = setItemStatus;
window.setItemObservation = setItemObservation;
window.setOrderAllStatus = setOrderAllStatus;
window.saveAllApprovals = saveAllApprovals;
