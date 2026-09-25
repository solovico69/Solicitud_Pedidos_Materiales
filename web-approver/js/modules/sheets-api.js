/**
 * PROYECTO: Control Solicitud de Pedidos Materiales
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: OpenCode for Obsidian & Antigravity IDE
 * ROL: Conexión API REST con Google Apps Script para Módulo de Aprobaciones
 */

const SHEETS_API = {
  getApiUrl() {
    return StorageService.getWebAppUrl();
  },

  isConfigured() {
    return StorageService.isConfigured();
  },

  async get(action, params = {}) {
    const baseUrl = this.getApiUrl();
    if (!baseUrl) {
      throw new Error('La URL del Web App de Google Apps Script no está configurada.');
    }

    const url = new URL(baseUrl);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

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

  async post(action, payload = {}) {
    const url = this.getApiUrl();
    if (!url) {
      throw new Error('La URL del Web App de Google Apps Script no está configurada.');
    }

    const requestBody = JSON.stringify({ action, ...payload });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

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

      return await response.json();
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        throw new Error('Tiempo de espera agotado al enviar datos.');
      }
      throw new Error(`Error en envío POST: ${e.message}`);
    }
  },

  async checkConnection() {
    return await this.get('checkConnection');
  },

  async getSolicitudes() {
    return await this.get('getSolicitudes');
  },

  async getSolicitudesPendientes() {
    return await this.get('getSolicitudesPendientes');
  },

  async updateAprobaciones(items) {
    return await this.post('updateAprobaciones', { items });
  }
};
