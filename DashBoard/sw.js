/**
 * MapFy 2026 - Service Worker Autônomo
 * Usina Pitangueiras • Safra 2026
 */
const CACHE_NAME = 'mapfy-sw-v2026.1';
const CORE_ASSETS = [
    './index.html',
    './manifest.json',
    './assets/logo_pitangueiras.png',
    './assets/pwa-icon-192.png',
    './assets/pwa-icon-512.png',
    './common/css/fullscreen_inspector.css',
    './common/js/fullscreen_inspector.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(CORE_ASSETS).catch((err) => {
                console.warn('[MapFy SW] Falha ao pré-carregar alguns assets:', err);
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Estratégia Network-First com fallback para cache se offline
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith(self.location.origin)) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
