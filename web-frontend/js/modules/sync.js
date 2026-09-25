/**
 * PROYECTO: Control Solicitud de Pedidos Materiales
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: Google AI Studio & Antigravity IDE
 * ROL: Motor de Sincronización Bajo Demanda y Cola Offline Resiliente
 */

const SYNC = {
  syncInterval: null,
  isOnline: navigator.onLine,
  syncPending: false,

  /**
   * Inicializa el motor de sincronización y escucha de red.
   * SIN sondeo periódico: solo se sincroniza ante eventos (abrir la app,
   * guardar/registrar datos, agregar a Base_Datos, reconexión y foco).
   */
  init() {
    window.addEventListener('online', () => this._handleOnline());
    window.addEventListener('offline', () => this._handleOffline());

    // Sincronizar al volver el foco a la pestaña (evento, no sondeo)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isOnline) {
        this.forceSync(true);
      }
    });

    // Procesar operaciones pendientes al iniciar
    if (this.isOnline) {
      this._processQueue();
    }
  },

  /**
   * Invalida las cachés de catálogos y solicitudes y fuerza una revalidación
   * en segundo plano. Se invoca tras cada operación de escritura para que
   * la información recién registrada quede sincronizada de inmediato.
   */
  async refreshAfterWrite() {
    await StorageService.removeCache('base_datos');
    await StorageService.removeCache('solicitudes');
    if (this.isOnline && SHEETS_API.isConfigured() && !this.syncPending) {
      this.forceSync(true);
    }
  },

  /**
   * Manejador de reconexión.
   */
  async _handleOnline() {
    this.isOnline = true;
    updateSyncStatus('connected');
    if (typeof showToast === 'function') {
      showToast('📡 Conexión restaurada - Procesando pendientes...', 3000);
    }
    await this._processQueue();
    await this.forceSync();
  },

  /**
   * Manejador de desconexión.
   */
  _handleOffline() {
    this.isOnline = false;
    updateSyncStatus('offline');
    if (typeof showToast === 'function') {
      showToast('📡 Sin conexión a internet. Modo offline activo.', 3500);
    }
  },

  /**
   * Fuerza una sincronización completa con Google Sheets.
   * @param {boolean} isBackground - Si es true, no muestra avisos invasivos
   */
  async forceSync(isBackground = false) {
    if (!this.isOnline || !SHEETS_API.isConfigured() || this.syncPending) return;

    this.syncPending = true;
    if (!isBackground) updateSyncStatus('syncing');

    try {
      // 1. Obtener catálogos y datos del Sheets
      const baseDatos = await SHEETS_API.getBaseDatos((updatedData) => {
        if (typeof populateDropdowns === 'function') populateDropdowns(updatedData);
      });

      // 2. Actualizar UI
      if (typeof populateDropdowns === 'function') {
        populateDropdowns(baseDatos);
      }

      updateSyncStatus('connected');
      updateCacheIndicator('Datos actualizados');
    } catch (e) {
      console.warn('[SYNC] Error en sincronización:', e.message);
      updateSyncStatus(this.isOnline ? 'error' : 'offline');
    } finally {
      this.syncPending = false;
    }
  },

  /**
   * Agrega una operación a la cola persistente (localStorage).
   */
  enqueue(operation) {
    const queue = StorageService.get(STORAGE_KEYS.PENDING_QUEUE, []);
    queue.push({
      ...operation,
      id: 'op_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString()
    });
    StorageService.set(STORAGE_KEYS.PENDING_QUEUE, queue);

    if (typeof showToast === 'function') {
      showToast('💾 Operación guardada en cola offline. Se enviará al reconectar.');
    }
  },

  /**
   * Procesa la cola de operaciones pendientes almacenadas.
   */
  async _processQueue() {
    if (!this.isOnline || !SHEETS_API.isConfigured()) return;

    const queue = StorageService.get(STORAGE_KEYS.PENDING_QUEUE, []);
    if (!queue || queue.length === 0) return;

    const remaining = [];

    for (const item of queue) {
      try {
        if (item.action === 'submitSolicitud') {
          await SHEETS_API.submitSolicitud(item.data);
        } else if (item.action === 'submitMultipleSolicitudes') {
          await SHEETS_API.submitMultipleSolicitudes(item.lines);
        } else if (item.action === 'addToBaseDatos') {
          await SHEETS_API.addToBaseDatos(item.data);
        }
      } catch (err) {
        console.error('[SYNC] Falló reintento de operación en cola:', err);
        remaining.push(item);
      }
    }

    StorageService.set(STORAGE_KEYS.PENDING_QUEUE, remaining);

    if (queue.length > remaining.length && typeof showToast === 'function') {
      showToast(`✅ Se sincronizaron ${queue.length - remaining.length} operaciones pendientes.`);
    }
  }
};

/**
 * Actualiza el indicador visual de estado de sincronización en la UI.
 */
function updateSyncStatus(status) {
  const statusEl = document.getElementById('syncStatus');
  const labelEl = document.getElementById('syncLabel');
  if (!statusEl || !labelEl) return;

  const states = {
    connected: { text: 'Google Sheets: Conectado', color: 'text-emerald-700 dark:text-emerald-400', label: 'Sincronización bidireccional activa' },
    syncing: { text: 'Sincronizando...', color: 'text-amber-700 dark:text-amber-400', label: 'Guardando y validando cambios...' },
    offline: { text: 'Sin conexión - Modo Offline', color: 'text-rose-700 dark:text-rose-400', label: 'Trabajando offline - Se sincronizará al reconectar' },
    error: { text: 'Error de Conexión', color: 'text-rose-700 dark:text-rose-400', label: 'Reintentando conexión automática...' }
  };

  const state = states[status] || states.error;
  statusEl.className = `font-label-sm font-semibold ${state.color}`;
  statusEl.textContent = state.text;
  labelEl.textContent = state.label;
}

/**
 * Actualiza la etiqueta informativa de caché en la UI.
 */
function updateCacheIndicator(message) {
  const label = document.getElementById('cacheLabel');
  if (label) label.textContent = message;
}

window.SYNC = SYNC;
window.updateSyncStatus = updateSyncStatus;
window.updateCacheIndicator = updateCacheIndicator;
