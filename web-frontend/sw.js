/**
 * PROYECTO: Control Solicitud de Pedidos Materiales
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: Google AI Studio & Antigravity IDE
 * ROL: Service Worker PWA (Offline Resilient & Stale-While-Revalidate)
 */

const CACHE_NAME = 'ctrl-materiales-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/modules/storage.js',
  './js/modules/sheets-api.js',
  './js/modules/sync.js'
];

// ============================================
// INSTALL - Cachear assets estáticos con tolerancia
// ============================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        console.log('[SW] Precacheando assets estáticos esenciales...');
        // Cargar tolerante: no abortar toda la instalación si un asset secundario falla
        for (const asset of STATIC_ASSETS) {
          try {
            await cache.add(asset);
          } catch (err) {
            console.warn(`[SW] Advertencia al cachear asset ${asset}:`, err.message);
          }
        }
      })
      .then(() => self.skipWaiting())
  );
});

// ============================================
// ACTIVATE - Limpiar caches antiguas
// ============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Eliminando caché previa obsoleta:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================
// FETCH - Enrutamiento inteligente de red y caché
// ============================================
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo peticiones GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Peticiones a Google Apps Script Web App (API): Network First con fallback offline
  if (url.hostname.includes('script.google.com') || url.pathname.includes('/exec')) {
    event.respondWith(networkFirstForAPI(request));
    return;
  }

  // 2. Fuentes y CDNs externos (Google Fonts, Tailwind, Material Symbols): Stale-While-Revalidate
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com') || url.hostname.includes('cdn.tailwindcss.com')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 3. Assets locales (HTML, CSS, JS, Iconos): Cache First con actualización en segundo plano
  event.respondWith(cacheFirstWithRefresh(request));
});

/**
 * Estrategia Network First para llamadas a la API de Google Apps Script
 */
async function networkFirstForAPI(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({
      success: false,
      error: 'Sin conexión a internet. La aplicación continuará en modo offline con datos locales.',
      offline: true
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  }
}

/**
 * Estrategia Stale-While-Revalidate para recursos estáticos y CDNs
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  return cachedResponse || fetchPromise;
}

/**
 * Estrategia Cache First con actualización en segundo plano para código local
 */
async function cacheFirstWithRefresh(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Revalidar en segundo plano para la próxima visita
    fetch(request).then(async (fresh) => {
      if (fresh && fresh.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, fresh);
      }
    }).catch(() => {});
    return cached;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (e) {
    // Si es una navegación HTML y falló, servir index.html precacheado
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html') || await caches.match('/index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
