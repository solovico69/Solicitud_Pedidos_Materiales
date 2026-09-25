/**
 * PROYECTO: Control Solicitud de Pedidos Materiales
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: Google AI Studio & Antigravity IDE
 * ROL: Cliente API REST para Google Apps Script (Comunicación Frontend-Backend Optimizada)
 */

const SHEETS_API = {
  /**
   * Obtiene la URL configurada del Web App de GAS.
   */
  getApiUrl() {
    return StorageService.getWebAppUrl();
  },

  /**
   * Verifica si la conexión está configurada.
   */
  isConfigured() {
    return StorageService.isConfigured();
  },

  /**
   * Inicializa la configuración de conexión.
   */
  async init(spreadsheetId, webAppUrl) {
    StorageService.setSheetId(spreadsheetId);
    StorageService.setWebAppUrl(webAppUrl);
    return true;
  },

  /**
   * Realiza peticiones GET a Google Apps Script.
   * @param {string} action
   * @param {Object} params
   * @return {Promise<Object>}
   */
  async get(action, params = {}) {
    const baseUrl = this.getApiUrl();
    if (!baseUrl) {
      throw new Error('La URL del Web App de Google Apps Script no está configurada.');
    }

    const url = new URL(baseUrl);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        throw new Error('Tiempo de espera agotado al conectar con Google Sheets.');
      }
      throw new Error(`Error de conexión GET: ${e.message}`);
    }
  },

  /**
   * Realiza peticiones POST a Google Apps Script evitando bloqueos CORS.
   * NOTA TÉCNICA CRÍTICA: Se usa Content-Type 'text/plain;charset=utf-8' para
   * enviar JSON sin disparar preflight OPTIONS en navegadores cruzando dominios.
   * @param {string} action
   * @param {Object} payload
   * @return {Promise<Object>}
   */
  async post(action, payload = {}) {
    const url = this.getApiUrl();
    if (!url) {
      throw new Error('La URL del Web App de Google Apps Script no está configurada.');
    }

    const requestBody = JSON.stringify({ action, ...payload });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: requestBody,
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || 'La operación no tuvo éxito en el servidor.');
      }
      return json;
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        throw new Error('Tiempo de espera agotado al enviar datos a Google Sheets.');
      }
      throw new Error(`Error en envío POST: ${e.message}`);
    }
  },

  /**
   * Obtiene la estructura inicial y metadatos con caché Stale-While-Revalidate.
   */
  async getInitData(onUpdate = null) {
    return StorageService.getStaleWhileRevalidate('init_data', async () => {
      return await this.get('init');
    }, onUpdate);
  },

  /**
   * Obtiene los catálogos de Base_Datos SIN caché (datos siempre frescos).
   * Se usa após agregar registros para actualizar los dropdowns al instante.
   */
  async fetchBaseDatos() {
    const res = await this.get('getBaseDatos');
    return res.data;
  },

  /**
   * Obtiene los catálogos de Base_Datos (Ingenieros, Obras, Sectores, Materiales, Métricas).
   */
  async getBaseDatos(onUpdate = null) {
    return StorageService.getStaleWhileRevalidate('base_datos', async () => {
      return await this.fetchBaseDatos();
    }, onUpdate);
  },

  /**
   * Obtiene el historial reciente de solicitudes SIN caché.
   */
  async fetchSolicitudes() {
    const res = await this.get('getSolicitudes');
    return res.data;
  },

  /**
   * Obtiene el historial reciente de solicitudes.
   */
  async getSolicitudes(onUpdate = null) {
    return StorageService.getStaleWhileRevalidate('solicitudes', async () => {
      return await this.fetchSolicitudes();
    }, onUpdate);
  },

  /**
   * Registra una sola partida de solicitud en Google Sheets.
   */
  async submitSolicitud(formData) {
    return this.post('submitSolicitud', { data: formData });
  },

  /**
   * Registra múltiples partidas en una única solicitud.
   */
  async submitMultipleSolicitudes(lines) {
    return this.post('submitMultipleSolicitudes', { lines: lines });
  },

  /**
   * Agrega un nuevo ítem al catálogo de Base_Datos.
   * @param {Object} entry - { material, metric, engineer, project, sector }
   */
  async addToBaseDatos(entry) {
    return this.post('addToBaseDatos', { data: entry });
  },

  /**
   * Comprueba el estado de la conexión con el Google Sheets backend.
   */
  async checkConnection() {
    try {
      const result = await this.get('checkConnection');
      return { connected: Boolean(result && result.success), details: result };
    } catch (e) {
      return { connected: false, error: e.message };
    }
  }
};

/**
 * Mapeador de datos basado en nombres de encabezado (sin referencias a números de columna)
 */
function mapByHeaders(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => {
    const clean = {};
    Object.entries(row).forEach(([k, v]) => {
      clean[k.trim()] = v;
    });
    return clean;
  });
}

window.SHEETS_API = SHEETS_API;
window.mapByHeaders = mapByHeaders;
