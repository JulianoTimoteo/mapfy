/**
 * MapFy 2026 - Service Worker Autônomo de Alta Resiliência
 * Usina Pitangueiras • Safra 2026
 *
 * Versão: 2026.4-live-swfix
 * Estratégia: Network-First com bypass absoluto de cache para dados em tempo real
 * e auto-atualização imediata para dispositivos móveis (Android / iOS / PWA).
 *
 * Correções aplicadas:
 * - Instalação de ativos em lote (cache.addAll) substituída por processamento
 *   individual: um ativo secundário indisponível não impede a instalação do SW.
 * - URLs com query string de versionamento (?v=, ?t=) são tratadas como ativos
 *   estáticos (cacheáveis) e NÃO como chamadas de API.
 * - Respostas 404 não são mascaradas como sucesso; o código HTTP original é
 *   preservado e o fallback de cache é aplicado somente quando apropriado.
 * - MIME types e cabeçalhos originais são preservados (não devolve HTML como JS).
 * - Respostas de API nunca são armazenadas como arquivos estáticos.
 */

const CACHE_NAME = 'mapfy-sw-v2026.5-live-swfix';

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

// Extensões consideradas ativos estáticos (cacheáveis)
const STATIC_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.jpeg', '.ico', '.json', '.woff', '.woff2', '.ttf', '.svg'];

// Query strings que indicam requisição de dados/API em tempo real (NÃO cachear)
const API_QUERY_PARAMS = ['t', 'v'];

function isApiRequest(url) {
    // Só considera API se for mesma origem E tiver parâmetro de requisição de dados
    const isSameOrigin = (url.origin === self.location.origin);
    if (!isSameOrigin) return false;
    return API_QUERY_PARAMS.some(param => url.searchParams.has(param));
}

function isStaticAsset(url) {
    const pathname = url.pathname.toLowerCase();
    return STATIC_EXTENSIONS.some(ext => pathname.endsWith(ext));
}

function stripQuery(url) {
    // Remove query string para correspondência de cache de ativos estáticos
    return url.origin + url.pathname;
}

// --- 1. INSTALAÇÃO: pré-cache individual de ativos essenciais ---
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            const results = { cached: [], failed: [] };

            for (const asset of CORE_ASSETS) {
                try {
                    const response = await fetch(asset, { cache: 'no-store' });
                    if (response.ok) {
                        await cache.put(asset, response.clone());
                        results.cached.push(asset);
                    } else {
                        console.warn('[MapFy SW] Ativo não pré-cacheado (status ' + response.status + '):', asset);
                        results.failed.push({ asset: asset, status: response.status });
                    }
                } catch (err) {
                    console.warn('[MapFy SW] Falha ao pré-cachear ativo:', asset, err);
                    results.failed.push({ asset: asset, error: err.message });
                }
            }

            console.log('[MapFy SW] Instalação concluída. Ativos cacheados:', results.cached.length, '| Falhas:', results.failed.length);
            if (results.failed.length > 0) {
                console.warn('[MapFy SW] Ativos com falha:', results.failed);
            }
        })()
    );
});

// --- 2. ATIVAÇÃO: apaga caches obsoletos e assume controle ---
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[MapFy SW] Removendo cache obsoleto:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// --- 3. COMUNICAÇÃO BIDIRECIONAL COM O CLIENTE ---
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

// --- 4. INTERCEPTAÇÃO INTELIGENTE DE REQUISIÇÕES ---
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);
    const isSameOrigin = (requestUrl.origin === self.location.origin);
    const isApi = isApiRequest(requestUrl);
    const isStatic = isStaticAsset(requestUrl);

    // BYPASS ABSOLUTO DE CACHE PARA DADOS EM TEMPO REAL:
    // Requisições de API com parâmetros ?t ou ?v são sempre buscadas na rede.
    // Nunca são armazenadas como ativos estáticos.
    if (isApi) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .catch(() => {
                    // Offline: tenta fallback de cache apenas para ativos estáticos,
                    // nunca para dados de API.
                    if (isStatic) {
                        return caches.match(stripQuery(requestUrl));
                    }
                    // Para APIs, propaga o erro (não mascara 404 como sucesso).
                    throw new Error('[MapFy SW] Falha de rede na requisição de API: ' + event.request.url);
                })
        );
        return;
    }

    // NAVEGAÇÃO E PÁGINAS HTML:
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

    // DEMAIS RECURSOS ESTÁTICOS (Imagens, Fontes, CSS, JS sem query de API):
    // Network-first com atualização de cache em background.
    // Ativos com query string de versionamento (?v=, ?t=) são cacheados
    // usando a URL sem query string, para evitar duplicação de cache.
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && isSameOrigin) {
                    // Só armazena respostas bem-sucedidas de ativos estáticos.
                    // Não armazena respostas de erro (404, 500, etc.) como sucesso.
                    const responseClone = networkResponse.clone();
                    const cacheKey = isStatic ? stripQuery(requestUrl) : event.request.url;
                    caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, responseClone));
                }
                return networkResponse;
            })
            .catch(() => {
                // Falha na rede: tenta fallback de cache.
                const cacheKey = isStatic ? stripQuery(requestUrl) : event.request.url;
                return caches.match(cacheKey);
            })
    );
});
