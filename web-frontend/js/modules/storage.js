/**
 * PROYECTO: Control Solicitud de Pedidos Materiales
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: Google AI Studio & Antigravity IDE
 * ROL: Módulo de Almacenamiento y Caché (localStorage + IndexedDB Stale-While-Revalidate)
 */

const STORAGE_KEYS = {
  SPREADSHEET_ID: 'ctrl_materiales_ss_id',
  SPREADSHEET_URL: 'ctrl_materiales_ss_url',
  THEME: 'ctrl_materiales_theme',
  CACHE_TTL: 5 * 60 * 1000, // 5 minutos de vigencia óptima
  PENDING_QUEUE: 'ctrl_materiales_pending_queue'
};

const StorageService = {
  /**
   * Guarda un valor en localStorage.
   */
  set(key, value) {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[StorageService] Error en localStorage.set:', e);
      return false;
    }
  },

  /**
   * Obtiene un valor de localStorage.
   */
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

  /**
   * Elimina una clave de localStorage.
   */
  remove(key) {
    localStorage.removeItem(key);
  },

  // Getters y setters de configuración
  getSheetId() {
    return this.get(STORAGE_KEYS.SPREADSHEET_ID, '1rGqlf5TU02Ji3tveeyOkSzdYDNJvH5TLkqv4xzSqMRQ');
  },

  setSheetId(id) {
    this.set(STORAGE_KEYS.SPREADSHEET_ID, (id || '').trim());
  },

  DEFAULT_WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbzRZBXQP_jMxHE61DNv1kxtsVuLebB22Vr9mzrNv23Hj8-u8S6uea-2snoxgwAWdcMGjA/exec',

  getWebAppUrl() {
    const val = this.get(STORAGE_KEYS.SPREADSHEET_URL, null);
    if (!val || !val.includes('AKfycbzRZBXQP_jMxHE61DNv1kxtsVuLebB22Vr9mzrNv23Hj8-u8S6uea-2snoxgwAWdcMGjA')) {
      return this.DEFAULT_WEB_APP_URL;
    }
    return val;
  },

  setWebAppUrl(url) {
    this.set(STORAGE_KEYS.SPREADSHEET_URL, (url || '').trim());
  },

  isConfigured() {
    return Boolean(this.getWebAppUrl());
  },

  // ============================================
  // INDEXEDDB TRANSACCIONAL RESILIENTE
  // ============================================

  /**
   * Conecta con la base de datos IndexedDB.
   */
  async getDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MaterialesDB', 2);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },

  /**
   * Guarda un registro en caché IndexedDB con control de eventos de transacción.
   */
  async setCache(key, data) {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('cache', 'readwrite');
        const store = tx.objectStore('cache');
        store.put({ key, data, timestamp: Date.now() });

        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = (err) => {
          db.close();
          reject(err.target.error);
        };
      });
    } catch (e) {
      console.error('[StorageService] Error en setCache:', e);
      return false;
    }
  },

  /**
   * Obtiene datos del caché IndexedDB.
   * @param {string} key
   * @param {boolean} allowExpired - Si es true, retorna los datos aunque hayan pasado los 5 min (útil para stale-while-revalidate)
   */
  async getCache(key, allowExpired = true) {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('cache', 'readonly');
        const store = tx.objectStore('cache');
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          db.close();
          if (!result) {
            resolve(null);
            return;
          }
          const age = Date.now() - result.timestamp;
          const isExpired = age > STORAGE_KEYS.CACHE_TTL;

          if (!allowExpired && isExpired) {
            resolve(null);
          } else {
            resolve({ data: result.data, isStale: isExpired, timestamp: result.timestamp });
          }
        };

        request.onerror = () => {
          db.close();
          resolve(null);
        };
      });
    } catch (e) {
      console.error('[StorageService] Error en getCache:', e);
      return null;
    }
  },

  /**
   * Elimina un registro de la caché IndexedDB (invalida TTL de forma forzada).
   * Se usa tras operaciones de escritura para garantizar datos frescos.
   */
  async removeCache(key) {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('cache', 'readwrite');
        const store = tx.objectStore('cache');
        store.delete(key);
        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => {
          db.close();
          resolve(false);
        };
      });
    } catch (e) {
      console.error('[StorageService] Error en removeCache:', e);
      return false;
    }
  },

  /**
   * Patrón Stale-While-Revalidate:
   * 1. Retorna de inmediato la caché si existe (aunque sea stale), sin bloquear la interfaz.
   * 2. Revalida en segundo plano llamando a fetchFn y actualizando el caché.
   * 3. Si no existe ninguna copia en caché, espera a fetchFn.
   */
  async getStaleWhileRevalidate(key, fetchFn, onRevalidated = null) {
    const cachedEntry = await this.getCache(key, true);

    if (cachedEntry && cachedEntry.data) {
      // Revalidación asíncrona no bloqueante
      this._revalidateInBackground(key, fetchFn, onRevalidated);
      return cachedEntry.data;
    }

    // No hay datos previos, se espera la respuesta de red
    const freshData = await fetchFn();
    if (freshData) {
      await this.setCache(key, freshData);
    }
    return freshData;
  },

  async _revalidateInBackground(key, fetchFn, onRevalidated) {
    try {
      const freshData = await fetchFn();
      if (freshData) {
        await this.setCache(key, freshData);
        if (typeof onRevalidated === 'function') {
          onRevalidated(freshData);
        }
      }
    } catch (err) {
      console.warn(`[StorageService] Revalidación en segundo plano falló para "${key}":`, err.message);
    }
  }
};

window.StorageService = StorageService;
