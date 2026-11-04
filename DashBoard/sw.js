/**
 * MapFy 2026 - Service Worker Autônomo de Alta Resiliência
 * Usina Pitangueiras • Safra 2026
 *
 * Versão: 2026.4-live
 * Estratégia: Network-First com bypass absoluto de cache para dados em tempo real
 * e auto-atualização imediata para dispositivos móveis (Android / iOS / PWA).
 */

const CACHE_NAME = 'mapfy-sw-v2026.5-live';

const CORE_ASSETS = [
    './index.html',
    './manifest.json',
    './favicon.ico',
    './assets/logo_pitangueiras.png',
    './assets/apple-touch-icon.png',
    './assets/pwa-icon-192.png',
    './assets/pwa-icon-512.png',
    './common/css/fullscreen_inspector.css',
    './common/js/fullscreen_inspector.js',
    './common/js/api_connector.js',
    './common/js/pwa_installer.js'
];

// 1. Instalação: ativa imediatamente sem aguardar abas antigas fecharem
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(CORE_ASSETS).catch((err) => {
                console.warn('[MapFy SW] Alguns assets não puderam ser pré-cacheados:', err);
            });
        })
    );
});

// 2. Ativação: apaga 100% dos caches anteriores e assume controle de todas as abas
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[MapFy SW] Removendo cache obsoleto do celular:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Comunicação bidirecional com o cliente (para forçar limpeza via botão no celular)
self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'CLEAR_CACHE_AND_RELOAD') {
        caches.keys().then((keys) => {
            return Promise.all(keys.map((k) => caches.delete(k)));
        }).then(() => {
            self.clients.matchAll().then((clients) => {
                clients.forEach((c) => c.postMessage({ action: 'CACHE_CLEARED' }));
            });
        });
    }
});

// 4. Interceptação inteligente de requisições
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);
    const isSameOrigin = (requestUrl.origin === self.location.origin);

    // BYPASS ABSOLUTO DE CACHE PARA DADOS EM TEMPO REAL:
    // Sempre busca da rede sem guardar lixo antigo no celular
    const isDataRequest = isSameOrigin && (
        requestUrl.pathname.endsWith('/data_summary.json') ||
        requestUrl.pathname.includes('/live_data/') ||
        requestUrl.pathname.endsWith('/data.js') ||
        requestUrl.pathname.endsWith('/dados.json') ||
        requestUrl.pathname.endsWith('/dados.csv') ||
        requestUrl.searchParams.has('t') ||
        requestUrl.searchParams.has('v')
    );

    if (isDataRequest) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .catch(() => {
                    // Se falhar a rede (offline total no campo), tenta fallback do cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    // NAVEGAÇÃO E PÁGINAS HTML:
    // Network-First sempre buscando o HTML mais novo do GitHub Pages
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request, { cache: 'no-cache' })
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(event.request).then((cached) => {
                        return cached || caches.match('./index.html');
                    });
                })
        );
        return;
    }

    // DEMAIS RECURSOS (Imagens, Fontes, CSS):
    // Network-First com atualização de cache em background
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && isSameOrigin) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});
