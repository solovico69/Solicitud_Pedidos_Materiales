/**
 * PROYECTO: Control Solicitud de Pedidos Materiales
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: OpenCode for Obsidian & Antigravity IDE
 * ROL: Almacenamiento Local y Gestión de Preferencias del Aprobador
 */

const STORAGE_KEYS = {
  SPREADSHEET_ID: 'ctrl_materiales_ss_id',
  SPREADSHEET_URL: 'ctrl_materiales_ss_url',
  THEME: 'ctrl_aprobaciones_theme',
  FILTER_OBRA: 'ctrl_aprobaciones_filter_obra',
  FILTER_STATUS: 'ctrl_aprobaciones_filter_status'
};

const StorageService = {
  set(key, value) {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[StorageService] Error guardando:', e);
      return false;
    }
  },

  get(key, defaultValue = null) {
    try {
      const val = localStorage.getItem(key);
      if (val === null) return defaultValue;
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    } catch {
      return defaultValue;
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  getSheetId() {
    return this.get(STORAGE_KEYS.SPREADSHEET_ID, '1rGqlf5TU02Ji3tveeyOkSzdYDNJvH5TLkqv4xzSqMRQ');
  },

  setSheetId(id) {
    this.set(STORAGE_KEYS.SPREADSHEET_ID, (id || '').trim());
  },

  getWebAppUrl() {
    return this.get(STORAGE_KEYS.SPREADSHEET_URL, '');
  },

  setWebAppUrl(url) {
    this.set(STORAGE_KEYS.SPREADSHEET_URL, (url || '').trim());
  },

  isConfigured() {
    return Boolean(this.getWebAppUrl());
  }
};
