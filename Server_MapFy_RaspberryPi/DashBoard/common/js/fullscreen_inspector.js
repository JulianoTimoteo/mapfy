/**
 * fullscreen_inspector.js & universal_dashboard_enhancer.js
 * ========================================================
 * Controlador Universal de:
 * 1. Visualização em Tela Inteira de Mapas Leaflet (COM DESAGRUPAMENTO TOTAL DOS PONTOS).
 * 2. Abertura do Modal de Raio-X / Detalhes de Medição DIRETAMENTE SOBRE o Mapa em Tela Cheia.
 * 3. Rótulos Numéricos Perfeitamente Centrados nas Fatias de Rosca (Donut) e Total Central Limpo (Sem Sobreposição).
 * 4. Filtros Rápidos (Todos, 30D, 15D, 7D) em Gráficos de Linha do Tempo e Evolução Temporal.
 * 5. Ícone Informativo (i) Circular em Todos os Títulos dos Relatórios (Exceto Miolos de Gráficos e Botões).
 *
 * Usina Pitangueiras • Safra 2026
 */

(function () {
    'use strict';

    // Ícones Vetoriais SVG Autônomos (Zero dependência externa)
    const ICONS = {
        expand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`,
        compress: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>`,
        close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        // Ícone informativo circular exato conforme imagem enviada pelo usuário (círculo com 'i' em serifa itálica)
        info: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" class="info-svg pointer-events-none" style="display:inline-block; vertical-align:middle;"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"></circle><text x="12" y="16.5" font-size="13" font-family="'Times New Roman', Georgia, serif" font-weight="bold" font-style="italic" text-anchor="middle" fill="currentColor">i</text></svg>`
    };

    let activeFullscreenEl = null;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAllControls);
    } else {
        initAllControls();
    }

    function initAllControls() {
        try { init247CircularWidget(); } catch (e) {} try { setupMapFullscreen(); } catch (e) { console.warn('[Pitangueiras] setupMapFullscreen error:', e); }
        try { setupChartsFullscreen(); } catch (e) { console.warn('[Pitangueiras] setupChartsFullscreen error:', e); }
        try { setupRaioXFullscreen(); } catch (e) { console.warn('[Pitangueiras] setupRaioXFullscreen error:', e); }
        try { setupKeyboardShortcuts(); } catch (e) { console.warn('[Pitangueiras] setupKeyboardShortcuts error:', e); }
        try { setupUniversalChartsPlugin(); } catch (e) { console.warn('[Pitangueiras] setupUniversalChartsPlugin error:', e); }
        try { setupTimelineQuickFilters(); } catch (e) { console.warn('[Pitangueiras] setupTimelineQuickFilters error:', e); }
        try { setupUniversalTimelineTooltips(); } catch (e) { console.warn('[Pitangueiras] setupUniversalTimelineTooltips error:', e); }
        try { setupUniversalTableFilterClearButtons(); } catch (e) { console.warn('[Pitangueiras] setupUniversalTableFilterClearButtons error:', e); }
        try { setupUniversalItemInfoSystem(); } catch (e) { console.warn('[Pitangueiras] setupUniversalItemInfoSystem error:', e); }
        try { setupAutoDismissNoticeBanners(); } catch (e) { console.warn('[Pitangueiras] setupAutoDismissNoticeBanners error:', e); }
        try { setupUniversalMobileFilters(); } catch (e) { console.warn('[Pitangueiras] setupUniversalMobileFilters error:', e); }
        try { setupUniversalPWAInstaller(); } catch (e) {}
        try { setupPwaSupport(); } catch (e) {}
        try {
            if (!window.PitangueirasMapShapes && !document.querySelector('script[src*="map_shapes_layer.js"]')) {
                const s = document.createElement('script');
                s.src = '../common/js/map_shapes_layer.js';
                document.head.appendChild(s);
            }
        } catch (e) {}
        try {
            if (!window.MapfyApiConnector && !document.querySelector('script[src*="api_connector.js"]')) {
                const s = document.createElement('script');
                s.src = '../common/js/api_connector.js?v=2026.11.09_v3';
                document.head.appendChild(s);
            }
        } catch (e) {}
        try {
            if (!document.querySelector('script[src*="pwa_installer.js"]')) {
                const sp = document.createElement('script');
                sp.src = '../common/js/pwa_installer.js?v=2026.4';
                document.head.appendChild(sp);
            }
        } catch (e) {}
        try { setupModalZIndexWatcher(); } catch (e) { console.warn('[Pitangueiras] setupModalZIndexWatcher error:', e); }

        // Ciclos de calibragem para cobrir carregamentos assíncronos de dados
        setTimeout(refreshEnhancements, 300);
        setTimeout(refreshEnhancements, 800);
        setTimeout(refreshEnhancements, 1800);
        setTimeout(refreshEnhancements, 3500);

        setupMutationObserver();
    }

    function refreshEnhancements() {
        try { setupUniversalChartsPlugin(); } catch (e) { console.warn(e); }
        try { setupTimelineQuickFilters(); } catch (e) { console.warn(e); }
        try { setupUniversalTimelineTooltips(); } catch (e) { console.warn(e); }
        try { setupUniversalTableFilterClearButtons(); } catch (e) { console.warn(e); }
        try { setupUniversalItemInfoSystem(); } catch (e) { console.warn(e); }
        try { init247CircularWidget(); } catch (e) {} try { setupMapFullscreen(); } catch (e) { console.warn(e); }
        try { setupChartsFullscreen(); } catch (e) { console.warn(e); }
        try { setupRaioXFullscreen(); } catch (e) { console.warn(e); }
        try { triggerChartsUpdate(); } catch (e) { console.warn(e); }
    }

    function setupMutationObserver() {
        if (typeof MutationObserver === 'undefined') return;
        let debounceTimer = null;
        const observer = new MutationObserver((mutations) => {
            let shouldRefresh = false;
            for (const m of mutations) {
                if (m.addedNodes && m.addedNodes.length > 0) {
                    shouldRefresh = true;
                    break;
                }
            }
            if (shouldRefresh) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    setupUniversalItemInfoSystem();
                    setupTimelineQuickFilters();
                    setupChartsFullscreen();
                }, 250);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }


    // =========================================================================
    // 10. INICIALIZAÇÃO UNIVERSAL DO PWA INSTANTÂNEO (MOBILE EM 3 SEGUNDOS)
    // =========================================================================
    function setupUniversalPWAInstaller() {
        if (typeof window === 'undefined') return;
        if (window._pitangueiras_pwa_booted) return;
        window._pitangueiras_pwa_booted = true;

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        const isAlreadyInstalled = localStorage.getItem('mapfy_pwa_installed') === 'true';
        if (isStandalone || isAlreadyInstalled) return;

        let deferredPrompt = null;
        let pwaTimer = null;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            showPwaToast();
        });

        // Fallback para dispositivos móveis
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
        if (isMobile) {
            setTimeout(() => {
                if (!deferredPrompt && !isStandalone && localStorage.getItem('mapfy_pwa_installed') !== 'true') {
                    showPwaToast();
                }
            }, 1500);
        }

        function showPwaToast() {
            if (document.getElementById('mapfy-pwa-install-toast')) return;
            if (localStorage.getItem('mapfy_pwa_installed') === 'true') return;

            const isRelatorio = window.location.pathname.includes('/DashBoard/') && !window.location.pathname.endsWith('/DashBoard/') && !window.location.pathname.endsWith('/index.html');
            const logoPath = isRelatorio ? '../assets/logo_pitangueiras.png' : 'assets/logo_pitangueiras.png';

            const toast = document.createElement('div');
            toast.id = 'mapfy-pwa-install-toast';
            toast.style.cssText = 'position:fixed; bottom:calc(16px + env(safe-area-inset-bottom, 0px)); left:12px; right:12px; max-width:480px; margin:0 auto; z-index:99999999; background:rgba(15,23,42,0.96); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1.5px solid rgba(16,185,129,0.7); border-radius:18px; padding:10px 14px; box-shadow:0 16px 36px rgba(0,0,0,0.5), 0 0 18px rgba(16,185,129,0.3); display:flex; align-items:center; justify-content:space-between; gap:12px; color:#ffffff; font-family:Inter,system-ui,sans-serif; transition:all 0.35s cubic-bezier(0.16,1,0.3,1); transform:translateY(25px); opacity:0;';

            toast.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                    <div style="width:36px; height:36px; border-radius:10px; background:#ffffff; padding:2px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <img src="${logoPath}" alt="Logo" style="width:100%; height:100%; object-fit:contain;">
                    </div>
                    <div style="min-width:0; flex:1;">
                        <div style="font-size:12px; font-weight:800; color:#f8fafc; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            Instalar MapFy 2026
                        </div>
                        <div style="font-size:10px; color:#34d399; font-weight:600; font-family:monospace;">
                            Versão Celular • 1 Clique
                        </div>
                    </div>
                </div>
                <button id="btnPwaActionInstall" type="button" style="background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; font-size:11px; font-weight:800; padding:8px 14px; border-radius:12px; border:none; cursor:pointer; box-shadow:0 4px 12px rgba(16,185,129,0.4); display:flex; align-items:center; gap:5px; flex-shrink:0; touch-action:manipulation;">
                    <span>📲</span>
                    <span>Instalar</span>
                </button>
            `;

            document.body.appendChild(toast);
            requestAnimationFrame(() => {
                toast.style.transform = 'translateY(0)';
                toast.style.opacity = '1';
            });

            // Some após exatamente 3 segundos
            pwaTimer = setTimeout(() => {
                dismissPwa(toast);
            }, 3000);

            const btn = toast.querySelector('#btnPwaActionInstall');
            if (btn) {
                btn.onclick = async (e) => {
                    e.preventDefault();
                    if (pwaTimer) clearTimeout(pwaTimer);
                    localStorage.setItem('mapfy_pwa_installed', 'true');
                    btn.innerHTML = '<span>⏳</span><span>Instalando...</span>';
                    if (deferredPrompt) {
                        try {
                            deferredPrompt.prompt();
                            await deferredPrompt.userChoice;
                            deferredPrompt = null;
                        } catch (err) {}
                    }
                    dismissPwa(toast);
                };
            }
        }

        function dismissPwa(toast) {
            if (!toast) return;
            toast.style.transform = 'translateY(25px)';
            toast.style.opacity = '0';
            setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
        }
    }

    // =========================================================================
    // 1. MODO TELA CHEIA PARA O MAPA LEAFLET (COM DESAGRUPAMENTO COMPLETO DE PONTOS)
    // =========================================================================
    function setupMapFullscreen() {
        // Procura especificamente containers de mapa reais, excluindo cabeçalhos e badges da API
        const mapCandidates = document.querySelectorAll('.leaflet-container, #map, #map-container, #mapa, #mapView, div[id*="map"]');
        let mapEl = null;
        for (const candidate of mapCandidates) {
            if (candidate.closest('header, .header-glass, .site-header')) continue;
            if (candidate.id && (candidate.id.includes('mapfy') || candidate.id.includes('badge') || candidate.id.includes('live'))) continue;
            mapEl = candidate;
            break;
        }
        if (!mapEl) return;

        const mapCard = mapEl.closest('.p-6, .app-card, .bg-\\[var\\(--card-bg\\)\\], .rounded-2xl, section, .map-section') || mapEl.parentElement;
        if (!mapCard) return;

        let headerEl = mapCard.querySelector('div.flex.items-center.justify-between, .card-header, .chart-card-header, h3, h4')?.closest('div.flex');
        
        if (mapCard.querySelector('.btn-map-fullscreen')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-toggle-fullscreen btn-map-fullscreen';
        btn.title = 'Navegar no Mapa em Tela Inteira (Celular ou Computador)';
        btn.innerHTML = `${ICONS.expand} <span>Tela Inteira</span>`;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleMapFullscreen(mapCard, mapEl);
        });

        if (headerEl) {
            headerEl.appendChild(btn);
        } else {
            const wrapper = document.createElement('div');
            wrapper.className = 'flex justify-end mb-2';
            wrapper.appendChild(btn);
            mapEl.parentElement.insertBefore(wrapper, mapEl);
        }

        // Adiciona botão flutuante diretamente sobre o mapa para acesso instantâneo com um toque
        if (!mapEl.querySelector('.btn-map-canvas-fullscreen')) {
            const canvasBtn = document.createElement('button');
            canvasBtn.type = 'button';
            canvasBtn.className = 'btn-map-canvas-fullscreen';
            canvasBtn.title = 'Expandir Mapa em Tela Inteira';
            canvasBtn.innerHTML = `${ICONS.expand} <span>Tela Inteira</span>`;
            canvasBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleMapFullscreen(mapCard, mapEl);
            });
            mapEl.appendChild(canvasBtn);
        }
    }

    function toggleMapFullscreen(card, mapEl) {
        const isFullscreen = card.classList.contains('map-fullscreen-active');

        if (!isFullscreen) {
            card.classList.add('map-fullscreen-active');
            activeFullscreenEl = card;
            document.body.style.overflow = 'hidden';

            // REGRA: Todos os itens do mapa devem aparecer separados (NENHUM agrupado)
            setMapClustering(false);

            let topbar = card.querySelector('.map-fullscreen-topbar');
            if (!topbar) {
                topbar = document.createElement('div');
                topbar.className = 'map-fullscreen-topbar';
                topbar.innerHTML = `
                    <div class="map-fullscreen-badge pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md text-white text-xs font-semibold border border-slate-700/60 shadow-lg">
                        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span class="hidden sm:inline">Mapa Operacional • Pontos Individuais (100% Desagrupados)</span>
                        <span class="sm:hidden">Pontos Desagrupados</span>
                    </div>
                    <button type="button" class="btn-exit-map-fullscreen pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md text-white hover:text-emerald-400 text-xs font-semibold border border-slate-700/60 shadow-lg transition-colors">
                        ${ICONS.compress} <span>Sair da Tela Cheia (Esc)</span>
                    </button>
                `;
                card.appendChild(topbar);

                topbar.querySelector('.btn-exit-map-fullscreen').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleMapFullscreen(card, mapEl);
                });
            }

            const btn = card.querySelector('.btn-map-fullscreen');
            if (btn) btn.innerHTML = `${ICONS.compress} <span>Sair</span>`;

            invalidateLeafletMap(mapEl);
        } else {
            card.classList.remove('map-fullscreen-active');
            activeFullscreenEl = null;
            document.body.style.overflow = '';

            // Restaura clusters ao sair da tela cheia se existiam originalmente
            setMapClustering(true);

            const topbar = card.querySelector('.map-fullscreen-topbar');
            if (topbar) topbar.remove();

            const btn = card.querySelector('.btn-map-fullscreen');
            if (btn) btn.innerHTML = `${ICONS.expand} <span>Tela Inteira</span>`;

            invalidateLeafletMap(mapEl);
        }
    }

    /**
     * Alterna o agrupamento de marcadores do Leaflet.
     * Quando enable === false (tela cheia): desativa qualquer cluster e adiciona todos os marcadores
     * como pontos individuais separados em uma camada simples (L.featureGroup), sem agrupamentos numéricos.
     */
    function setMapClustering(enable) {
        try {
            const map = (window.state && window.state.map) ? window.state.map : null;
            const clusterLayer = (window.state && window.state.markersLayer) ? window.state.markersLayer : null;

            if (!map || !clusterLayer) return;

            // Verifica se a camada é do tipo MarkerClusterGroup
            const isClusterGroup = clusterLayer.options && ('maxClusterRadius' in clusterLayer.options || 'disableClusteringAtZoom' in clusterLayer.options);
            if (!isClusterGroup && typeof clusterLayer.getLayers !== 'function') return;

            if (!enable) {
                // TELA CHEIA: Desagrupar todos os marcadores
                const allMarkers = clusterLayer.getLayers();
                if (allMarkers && allMarkers.length > 0) {
                    if (!window._pitangueiras_markers_backup) {
                        window._pitangueiras_markers_backup = allMarkers;
                    }
                    if (!window._pitangueiras_unclustered_layer) {
                        window._pitangueiras_unclustered_layer = L.featureGroup();
                    }
                    window._pitangueiras_unclustered_layer.clearLayers();
                    allMarkers.forEach(m => {
                        window._pitangueiras_unclustered_layer.addLayer(m);
                    });

                    if (map.hasLayer(clusterLayer)) {
                        map.removeLayer(clusterLayer);
                    }
                    if (!map.hasLayer(window._pitangueiras_unclustered_layer)) {
                        map.addLayer(window._pitangueiras_unclustered_layer);
                    }
                }
            } else {
                // TELA NORMAL: Restaurar visualização com clusters
                if (window._pitangueiras_unclustered_layer && map.hasLayer(window._pitangueiras_unclustered_layer)) {
                    map.removeLayer(window._pitangueiras_unclustered_layer);
                }
                if (!map.hasLayer(clusterLayer)) {
                    map.addLayer(clusterLayer);
                }
            }
        } catch (e) {
            console.warn('Aviso no controle de clustering de mapa:', e);
        }
    }

    function invalidateLeafletMap(mapEl) {
        const doInvalidate = () => {
            try {
                if (window.state && window.state.map && typeof window.state.map.invalidateSize === 'function') {
                    window.state.map.invalidateSize();
                }
                if (window.dashboardState && window.dashboardState.map && typeof window.dashboardState.map.invalidateSize === 'function') {
                    window.dashboardState.map.invalidateSize();
                }
                if (mapEl && mapEl._leaflet_map && typeof mapEl._leaflet_map.invalidateSize === 'function') {
                    mapEl._leaflet_map.invalidateSize();
                }
                window.dispatchEvent(new Event('resize'));
            } catch (err) {}
        };
        setTimeout(doInvalidate, 50);
        setTimeout(doInvalidate, 150);
        setTimeout(doInvalidate, 350);
        setTimeout(doInvalidate, 650);
    }

    // =========================================================================
    // 2. MODAL RAIO-X / DETALHES DE MEDIÇÃO: ABERTURA SOBRE O MAPA EM TELA CHEIA
    // =========================================================================
    function setupModalZIndexWatcher() {
        // Intercepta qualquer clique em links/botões que abrem modais de inspeção nos popups ou tabelas
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button, a, [onclick*="Modal"], [onclick*="openRecord"], [onclick*="openDetail"], [onclick*="openDetails"]');
            if (!btn) return;

            const text = (btn.textContent || '').toLowerCase();
            const onclickAttr = (btn.getAttribute('onclick') || '').toLowerCase();

            if (text.includes('ficha') || text.includes('detalhe') || text.includes('raio-x') || onclickAttr.includes('modal') || onclickAttr.includes('record')) {
                // Força o modal a ficar com z-index 999999 e fixo sobre o mapa
                setTimeout(bringActiveModalToFront, 40);
                setTimeout(bringActiveModalToFront, 150);
            }
        });
    }

    function bringActiveModalToFront() {
        const modals = document.querySelectorAll('#recordModal, #detailModal, #detailsModal, #recordDetailModal, #targetModal, .modal-overlay, div[id$="Modal"]');
        modals.forEach(m => {
            if (!m.classList.contains('hidden') && m.style.display !== 'none') {
                m.style.setProperty('z-index', '999999', 'important');
                m.style.setProperty('position', 'fixed', 'important');
                m.style.setProperty('inset', '0', 'important');
            }
        });
    }

    // =========================================================================
    // 3. MODO TELA CHEIA PARA OS GRÁFICOS
    // =========================================================================
    function setupChartsFullscreen() {
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            const chartCard = canvas.closest('.chart-card, .p-6, .app-card, .bg-\\[var\\(--card-bg\\)\\], .rounded-2xl, .rounded-xl, .bg-white, .dark\\:bg-slate-900') || canvas.parentElement;
            if (!chartCard) return;

            let headerEl = chartCard.querySelector('div.flex.items-center.justify-between, .chart-card-header, .card-header, h3, h4')?.closest('div.flex') || chartCard.querySelector('.chart-card-header');
            if (!headerEl) {
                const title = chartCard.querySelector('h3, h4, h2, .chart-card-title');
                if (title && title.parentElement) headerEl = title.parentElement;
            }
            if (!headerEl || chartCard.querySelector('.btn-chart-fullscreen')) return;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-toggle-fullscreen btn-chart-fullscreen';
            btn.title = 'Visualizar Gráfico em Tela Cheia';
            btn.innerHTML = `${ICONS.expand}`;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleChartFullscreen(chartCard, canvas);
            });

            headerEl.appendChild(btn);
        });
    }

    function toggleChartFullscreen(card, canvas) {
        const isFullscreen = card.classList.contains('chart-fullscreen-active');

        if (!isFullscreen) {
            card.classList.add('chart-fullscreen-active');
            activeFullscreenEl = card;
            document.body.style.overflow = 'hidden';

            const btn = card.querySelector('.btn-chart-fullscreen');
            if (btn) btn.innerHTML = `${ICONS.compress}`;

            resizeChart(canvas);
        } else {
            card.classList.remove('chart-fullscreen-active');
            activeFullscreenEl = null;
            document.body.style.overflow = '';

            const btn = card.querySelector('.btn-chart-fullscreen');
            if (btn) btn.innerHTML = `${ICONS.expand}`;

            resizeChart(canvas);
        }
    }

    function resizeChart(canvas) {
        setTimeout(() => {
            try {
                if (typeof Chart !== 'undefined' && Chart.getChart) {
                    const chart = Chart.getChart(canvas);
                    if (chart) chart.resize();
                }
            } catch (err) {}
        }, 150);
    }

    // =========================================================================
    // 4. MODO TELA CHEIA E ERGONOMIA DO RAIO-X
    // =========================================================================
    function setupRaioXFullscreen() {
        const modal = document.querySelector('#recordModal, #detailModal, #detailsModal, #recordDetailModal');
        if (!modal) return;

        const modalDialog = modal.querySelector('div.bg-white, div.dark\\:bg-slate-900, div.rounded-2xl, div.rounded-xl, .modal-content, .modal-dialog') || modal.firstElementChild;
        if (!modalDialog) return;

        const header = modalDialog.querySelector('.flex.items-center.justify-between, .modal-header, h3')?.closest('div.flex');
        if (!header || modal.querySelector('.btn-raiox-fullscreen')) return;

        const btnExpandRaioX = document.createElement('button');
        btnExpandRaioX.type = 'button';
        btnExpandRaioX.className = 'btn-toggle-fullscreen btn-raiox-fullscreen mr-2 hidden sm:inline-flex';
        btnExpandRaioX.title = 'Alternar Raio-X em Tela Cheia';
        btnExpandRaioX.innerHTML = `${ICONS.expand} <span>Tela Cheia</span>`;

        btnExpandRaioX.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isFull = modalDialog.classList.toggle('raiox-modal-fullscreen');
            btnExpandRaioX.innerHTML = isFull ? `${ICONS.compress} <span>Janela</span>` : `${ICONS.expand} <span>Tela Cheia</span>`;
        });

        const closeBtn = header.querySelector('button');
        if (closeBtn) {
            header.insertBefore(btnExpandRaioX, closeBtn);
        } else {
            header.appendChild(btnExpandRaioX);
        }
    }

    // =========================================================================
    // 5. ATALHOS DE TECLADO (ESC)
    // =========================================================================
    function setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                const popover = document.getElementById('pitangueiras-info-popover');
                if (popover && popover.classList.contains('active')) {
                    popover.classList.remove('active');
                    return;
                }

                // Se houver modal de Raio-X aberto sobre a tela cheia, fecha primeiro o modal
                const openModal = document.querySelector('#recordModal:not(.hidden), #detailModal:not(.hidden), #detailsModal:not(.hidden), #recordDetailModal:not(.hidden)');
                if (openModal) {
                    openModal.classList.add('hidden');
                    return;
                }

                if (activeFullscreenEl) {
                    if (activeFullscreenEl.classList.contains('map-fullscreen-active')) {
                        const mapEl = activeFullscreenEl.querySelector('div[id^="map"], .leaflet-container');
                        toggleMapFullscreen(activeFullscreenEl, mapEl);
                    } else if (activeFullscreenEl.classList.contains('chart-fullscreen-active')) {
                        const canvas = activeFullscreenEl.querySelector('canvas');
                        toggleChartFullscreen(activeFullscreenEl, canvas);
                    }
                }
            }
        });
    }

    // =========================================================================
    // 6. PLUGIN UNIVERSAL DE CHART.JS: RÓTULOS MATEMATICAMENTE CENTRALIZADOS NAS FATIAS E TOTAL LIMPO
    // =========================================================================
    function setupUniversalChartsPlugin() {
        if (typeof Chart === 'undefined') return;
        if (window._pitangueiras_universal_plugin_registered) return;

        const universalChartPlugin = {
            id: 'pitangueiras_universal_datalabels',
            beforeDraw(chart) {
                chart._centerTotalDrawn = false;
            },
            afterDatasetsDraw(chart) {
                const chartType = chart.config.type;
                // REGRA MANDATÓRIA ANTI-DUPLICIDADE:
                // Gráficos de barra NUNCA desenham rótulos manuais aqui, pois cada dashboard
                // já possui seu próprio plugin de datalabels calibrado (ChartDataLabels ou local).
                if (chartType === 'bar' || chartType === 'line') {
                    return;
                }

                if (chartType !== 'doughnut' && chartType !== 'pie') return;

                const ctx = chart.ctx;
                const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark-theme');
                const defaultTextColor = isDark ? '#F1F5F9' : '#1E293B';
                const chartArea = chart.chartArea || { top: 0, bottom: chart.height, left: 0, right: chart.width };

                // 1. Rótulos Numéricos nas Fatias (Apenas se o gráfico NÃO possuir plugin datalabels ativo)
                const hasDatalabels = (chart.options?.plugins?.datalabels && chart.options.plugins.datalabels.display !== false);
                const hasGlobalPlugin = (window.ChartDataLabels && chart.options?.plugins?.datalabels?.display !== false);

                if (chartType === 'pie' && !hasDatalabels && !hasGlobalPlugin) { // Em Doughnut, valores ficam no centro e não abaixo na fatia
                    chart.data.datasets.forEach((dataset, datasetIdx) => {
                        const meta = chart.getDatasetMeta(datasetIdx);
                        if (!meta || meta.hidden) return;

                        meta.data.forEach((element, index) => {
                            const rawVal = dataset.data ? dataset.data[index] : null;
                            if (rawVal === undefined || rawVal === null || rawVal === '' || rawVal === 0 || rawVal === '0') return;
                            const numVal = Number(rawVal);
                            if (isNaN(numVal) || numVal === 0) return;

                            ctx.save();
                            ctx.font = 'bold 11px Inter, sans-serif';

                            const startAngle = element.startAngle;
                            const endAngle = element.endAngle;
                            const angleSpan = endAngle - startAngle;

                            if (angleSpan >= 0.18) {
                                const midAngle = (startAngle + endAngle) / 2;
                                const midRadius = (element.innerRadius + element.outerRadius) / 2;
                                const x = element.x + Math.cos(midAngle) * midRadius;
                                const y = element.y + Math.sin(midAngle) * midRadius;

                                ctx.fillStyle = '#FFFFFF';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
                                ctx.shadowBlur = 4;
                                ctx.fillText(numVal.toLocaleString('pt-BR'), x, y);
                            }
                            ctx.restore();
                        });
                    });
                }

                // 2. Totalizador no Centro de Gráficos Doughnut (Sem poluição nem sobreposição)
                if (chartType === 'doughnut') {
                    // Ignora se o gráfico possui plugin customizado de centro (ex: centerText no Arremate e Acabamento)
                    const hasCustomCenter = chart.config.plugins && chart.config.plugins.some(p => p && (p.id === 'centerText' || p.id === 'donutCenterText' || (typeof p.id === 'string' && p.id.toLowerCase().includes('center'))));
                    if (hasCustomCenter) return;

                    // Ignora se as opções desabilitam o total no centro
                    if (chart.options?.plugins?.centerTotal === false || chart.options?.centerTotal === false) return;

                    // Prevenção contra dupla execução por múltiplos plugins no mesmo ciclo
                    if (chart._centerTotalDrawn) return;

                    let totalSum = 0;
                    chart.data.datasets.forEach(ds => {
                        if (Array.isArray(ds.data)) {
                            ds.data.forEach(v => {
                                const n = typeof v === 'number' ? v : parseFloat(v);
                                if (!isNaN(n) && isFinite(n)) totalSum += n;
                            });
                        }
                    });

                    const parent = chart.canvas ? chart.canvas.parentElement : null;
                    const htmlCenter = parent ? parent.querySelector('#donutCenterOverlay, #donutCenterPerc, [id*="CenterPerc"], [id*="centerPerc"], [id*="donutCenter"]') : null;

                    if (htmlCenter) {
                        const countEl = htmlCenter.querySelector('#donutCenterCount, [id*="CenterCount"], [id*="centerCount"]');
                        if (countEl && totalSum > 0 && !countEl.textContent.includes(' de ')) {
                            countEl.textContent = `${totalSum.toLocaleString('pt-BR')} Total`;
                            countEl.style.fontWeight = '700';
                            countEl.style.marginTop = '2px';
                        }
                        const extraBadge = htmlCenter.querySelector('.donut-center-total-sum');
                        if (extraBadge) extraBadge.remove();
                    } else if (chart.chartArea && totalSum > 0) {
                        chart._centerTotalDrawn = true;
                        const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                        const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
                        const meta = chart.getDatasetMeta(0);
                        let innerRadius = meta && meta.controller ? meta.controller.innerRadius : 45;
                        if (!innerRadius || innerRadius <= 0) innerRadius = 45;

                        ctx.save();
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        const numColor = isDark ? '#F8FAFC' : '#0F172A';
                        const lblColor = isDark ? '#94A3B8' : '#64748B';

                        const fontSizeNum = Math.max(16, Math.min(26, Math.round(innerRadius * 0.46)));
                        const fontSizeLabel = Math.max(9, Math.min(11, Math.round(innerRadius * 0.22)));

                        ctx.font = `800 ${fontSizeNum}px 'JetBrains Mono', 'Plus Jakarta Sans', monospace, sans-serif`;
                        ctx.fillStyle = numColor;
                        ctx.shadowColor = 'transparent';
                        ctx.fillText(totalSum.toLocaleString('pt-BR'), centerX, centerY - (fontSizeLabel * 0.45));

                        ctx.font = `700 ${fontSizeLabel}px Inter, sans-serif`;
                        ctx.fillStyle = lblColor;
                        ctx.fillText('TOTAL', centerX, centerY + (fontSizeNum * 0.52));
                        ctx.restore();
                    }
                }
            }
        };

        try {
            Chart.register(universalChartPlugin);
            window._pitangueiras_universal_plugin_registered = true;
        } catch (e) {
            console.warn('[Pitangueiras] Chart.register error:', e);
        }
    }

    function triggerChartsUpdate() {
        if (typeof Chart === 'undefined' || !Chart.instances) return;
        Object.values(Chart.instances).forEach(c => {
            try { c.update(); } catch (e) {}
        });
    }

    // =========================================================================
    // 7. FILTROS RÁPIDOS DA LINHA DO TEMPO / EVOLUÇÃO TEMPORAL (7D, 15D, 30D, Todos)
    // =========================================================================
    function setupTimelineQuickFilters() {
        const timelineCanvases = document.querySelectorAll(
            'canvas[id*="Evolution"], canvas[id*="Timeline"], canvas[id*="temporal"], canvas[id*="Evolucao"], canvas[id*="Hourly"], canvas[id*="timeline"]'
        );

        timelineCanvases.forEach(canvas => {
            const card = canvas.closest('.chart-card, .p-6, .app-card, section, .rounded-2xl, .rounded-xl, .bg-white, .dark\\:bg-slate-900') || canvas.parentElement;
            if (!card) return;

            if (card.querySelector('.timeline-quick-filter-group') || card.querySelector('.btn-evo-filter') || card.querySelector('#evolutionFilterGroup')) {
                return;
            }

            let headerEl = card.querySelector('div.flex.items-center.justify-between, .chart-card-header, .card-header, h3, h4')?.closest('div.flex') || card.querySelector('.chart-card-header');
            
            const group = document.createElement('div');
            group.className = 'timeline-quick-filter-group ml-auto';
            group.innerHTML = `
                <button type="button" class="btn-quick-timeline-filter active" data-range="ALL">Todos</button>
                <button type="button" class="btn-quick-timeline-filter" data-range="30D">30D</button>
                <button type="button" class="btn-quick-timeline-filter" data-range="15D">15D</button>
                <button type="button" class="btn-quick-timeline-filter" data-range="7D">7D</button>
            `;

            group.querySelectorAll('.btn-quick-timeline-filter').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const range = btn.dataset.range;
                    group.querySelectorAll('.btn-quick-timeline-filter').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    applyTimelineFilter(canvas, range);
                });
            });

            if (headerEl) {
                const fullscreenBtn = headerEl.querySelector('.btn-chart-fullscreen');
                if (fullscreenBtn) {
                    headerEl.insertBefore(group, fullscreenBtn);
                } else {
                    headerEl.appendChild(group);
                }
            } else {
                const wrapper = document.createElement('div');
                wrapper.className = 'flex justify-end mb-2';
                wrapper.appendChild(group);
                canvas.parentElement.insertBefore(wrapper, canvas);
            }
        });
    }

    function applyTimelineFilter(canvas, range) {
        if (typeof Chart === 'undefined') return;
        const chart = Chart.getChart ? Chart.getChart(canvas) : null;
        if (!chart || !chart.data || !chart.data.labels) return;

        if (!chart._pitangueiras_full_data) {
            chart._pitangueiras_full_data = {
                labels: [...chart.data.labels],
                datasets: chart.data.datasets.map(ds => ({
                    ...ds,
                    data: [...ds.data]
                }))
            };
        }

        const full = chart._pitangueiras_full_data;
        let limit = full.labels.length;
        if (range === '7D') limit = 7;
        else if (range === '15D') limit = 15;
        else if (range === '30D') limit = 30;

        if (limit < full.labels.length) {
            chart.data.labels = full.labels.slice(-limit);
            chart.data.datasets.forEach((ds, idx) => {
                if (full.datasets[idx] && Array.isArray(full.datasets[idx].data)) {
                    ds.data = full.datasets[idx].data.slice(-limit);
                }
            });
        } else {
            chart.data.labels = [...full.labels];
            chart.data.datasets.forEach((ds, idx) => {
                if (full.datasets[idx] && Array.isArray(full.datasets[idx].data)) {
                    ds.data = [...full.datasets[idx].data];
                }
            });
        }

        chart.update();
    }

    // =========================================================================
    // 7.1 TOOLTIP ENRIQUECIDO UNIVERSAL PARA EVOLUÇÃO TEMPORAL (OS, FRENTE, TALHÃO)
    // =========================================================================
    function setupUniversalTimelineTooltips() {
        if (typeof Chart === 'undefined') return;
        const timelineCanvases = document.querySelectorAll(
            'canvas[id*="Evolution"], canvas[id*="Timeline"], canvas[id*="temporal"], canvas[id*="Evolucao"], canvas[id*="timeline"]'
        );

        timelineCanvases.forEach(canvas => {
            const chart = Chart.getChart ? Chart.getChart(canvas) : null;
            if (!chart || !chart.options) return;
            if (chart._pitangueiras_tooltip_calibrated) return;
            chart._pitangueiras_tooltip_calibrated = true;

            if (!chart.options.plugins) chart.options.plugins = {};
            if (!chart.options.plugins.tooltip) chart.options.plugins.tooltip = {};
            const tt = chart.options.plugins.tooltip;
            if (!tt.callbacks) tt.callbacks = {};

            const origAfterBody = tt.callbacks.afterBody;

            tt.callbacks.afterBody = function(tooltipItems) {
                let existingLines = [];
                if (typeof origAfterBody === 'function') {
                    try {
                        const res = origAfterBody.call(this, tooltipItems);
                        if (Array.isArray(res)) existingLines = res;
                        else if (typeof res === 'string') existingLines = [res];
                    } catch (e) {}
                }

                // Se o chart já tiver linhas ricas de OS ou Frente, preserva
                const hasOS = existingLines.some(l => typeof l === 'string' && (l.includes('OS') || l.includes('Frente')));
                if (hasOS) return existingLines;

                if (!tooltipItems || tooltipItems.length === 0) return existingLines;
                const item = tooltipItems[0];
                const dateLabel = (item.label || item.name || '').trim();
                if (!dateLabel) return existingLines;

                // Tenta extrair registros da base ativa do dashboard
                const records = (window.state && window.state.filteredRecords) 
                             || (window.state && window.state.allRecords)
                             || (window.dashboardState && window.dashboardState.filteredRecords)
                             || (window.dashboardState && window.dashboardState.allRecords)
                             || window.BROCA_ARMADILHA_DATA
                             || window.rawBrocaData
                             || [];

                if (!Array.isArray(records) || records.length === 0) return existingLines;

                const osSet = new Set();
                const frentesSet = new Set();
                const locaisSet = new Set();
                let count = 0;

                for (let i = 0; i < records.length; i++) {
                    const r = records[i];
                    if (!r) continue;
                    const rDate = (r.dataBR || r.data_formatada || r.data || r.Data || r.dataInstalacao || '').trim();
                    const rIso = (r.isoDate || r.dataIso || '').trim();
                    
                    const matchesDate = rDate === dateLabel || 
                                        rDate.startsWith(dateLabel) || 
                                        dateLabel.startsWith(rDate.substring(0, 5)) ||
                                        (rIso && (rIso === dateLabel || rIso.endsWith(dateLabel)));

                    if (matchesDate) {
                        count++;
                        const os = r.os || r.OS || r.numOS || r.ordemServico || r.ordem_servico;
                        if (os && os !== '-' && os !== 'N/A') osSet.add(String(os));

                        const frente = r.frente || r.Frente || r.frenteOperacional || r.frente_operacional;
                        if (frente && frente !== '-' && frente !== 'N/A') frentesSet.add(String(frente));

                        const local = r.localidadeTalhao || r.local || r.Local || r.talhao || r.Talhao || r.fazenda || r.Fazenda;
                        if (local && local !== '-' && local !== 'N/A') locaisSet.add(String(local));
                    }
                }

                const extraLines = [];
                if (osSet.size > 0) {
                    const arr = Array.from(osSet).sort();
                    extraLines.push(`📋 OS: ${arr.length > 3 ? `${arr.slice(0, 3).join(', ')} (+${arr.length - 3})` : arr.join(', ')}`);
                }
                if (frentesSet.size > 0) {
                    const arr = Array.from(frentesSet).sort();
                    extraLines.push(`🚜 Frente: ${arr.join(', ')}`);
                }
                if (locaisSet.size > 0) {
                    const arr = Array.from(locaisSet).sort();
                    extraLines.push(`📍 Local/Talhão: ${arr.length > 3 ? `${arr.slice(0, 3).join(', ')} (+${arr.length - 3})` : arr.join(', ')}`);
                }
                if (count > 0 && !existingLines.some(l => l.includes('Medições') || l.includes('Lançamentos'))) {
                    extraLines.push(`📊 Apontamentos: ${count}`);
                }

                return [...existingLines, ...extraLines];
            };
        });
    }

    // =========================================================================
    // 7.2 BOTÃO UNIVERSAL DE LIMPAR FILTRO (↺) PARA FRENTE, OS E OUTRAS TABELAS
    // =========================================================================
    function setupUniversalTableFilterClearButtons() {
        const activeFilters = (window.state && window.state.activeFilters) ? window.state.activeFilters : 
                              (window.dashboardState && window.dashboardState.activeFilters) ? window.dashboardState.activeFilters : null;
        if (!activeFilters) return;

        ['frente', 'os', 'responsavel', 'fazenda'].forEach(key => {
            const val = activeFilters[key];
            if (val && val !== 'ALL' && val !== 'all' && val !== '') {
                const tables = document.querySelectorAll('table');
                tables.forEach(table => {
                    const sec = table.closest('section, .app-card, div.rounded-2xl');
                    if (!sec) return;
                    const text = sec.textContent || '';
                    const matchKey = (key === 'frente' && text.includes('Frente')) ||
                                     (key === 'os' && text.includes('OS')) ||
                                     (key === 'responsavel' && text.includes('Responsáv')) ||
                                     (key === 'fazenda' && text.includes('Fazenda'));
                    if (matchKey && !sec.querySelector(`.btn-clear-univ-${key}`)) {
                        const header = sec.querySelector('.flex.items-center.justify-between, .flex.items-start.justify-between, h2, h3, h4')?.closest('div.flex');
                        if (header && !header.querySelector(`.btn-clear-univ-${key}`)) {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.className = `btn-clear-univ-${key} px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 ml-auto`;
                            btn.innerHTML = `<span>↺</span><span>Limpar Filtro (${val})</span>`;
                            btn.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                activeFilters[key] = 'ALL';
                                const sel = document.querySelector(`#filter${key.charAt(0).toUpperCase() + key.slice(1)}, #select${key.charAt(0).toUpperCase() + key.slice(1)}`);
                                if (sel) sel.value = 'ALL';
                                if (typeof window.applyFilters === 'function') window.applyFilters();
                                else if (typeof window.filtrar === 'function') window.filtrar();
                                else if (typeof window.updateAllViews === 'function') window.updateAllViews();
                                btn.remove();
                            });
                            header.appendChild(btn);
                        }
                    }
                });
            } else {
                document.querySelectorAll(`.btn-clear-univ-${key}`).forEach(el => el.remove());
            }
        });
    }

    // =========================================================================
    // 8. DICIONÁRIO COMPLETO DE METADADOS & CONHECIMENTO DOS INDICADORES
    // =========================================================================
    const INFO_KNOWLEDGE_BASE = {
        'conformidade': {
            title: 'Taxa de Conformidade Agronômica',
            whatIs: 'Indica a porcentagem de medições ou inspeções realizadas no campo que atenderam rigorosamente às metas técnicas e faixas agronômicas estabelecidas para a safra.',
            metric: 'Cálculo percentual: (Medições Conformes / Total de Medições Válidas) × 100. Faixa ótima: superior a 90%.',
            contains: 'Amostragens colhidas por georreferenciamento móvel nos talhões em atividade, auditadas contra a meta oficial da Usina Pitangueiras.',
            howToRead: 'Percentuais em verde (≥90%) indicam excelente padrão operacional. Em amarelo (75%-89%) sinalizam alerta preventivo. Em vermelho (<75%) exigem intervenção imediata na regulagem do maquinário.'
        },
        'nao_conformidade': {
            title: 'Índice de Desvios e Não-Conformidade',
            whatIs: 'Quantifica as medições que se situaram fora dos limites de tolerância técnica (abaixo ou acima da meta recomendada).',
            metric: 'Percentual e contagem absoluta de amostras reprovadas na auditoria técnica.',
            contains: 'Pontos com desvios dimensionais, falhas de regulagem ou anomalias operacionais registradas no campo.',
            howToRead: 'Identifica a intensidade e a severidade dos desvios para direcionar treinamentos de operadores e ajustes de máquinas.'
        },
        'media': {
            title: 'Média Operacional das Medições',
            whatIs: 'Representa a tendência central e o valor médio ponderado de todas as medições físicas realizadas no talhão ou operação analisada.',
            metric: 'Soma de todas as grandezas medidas (cm, kg/ha, metros, unidades) dividida pelo número total de amostras colhidas.',
            contains: 'Todos os pontos georreferenciados válidos da safra ou do período filtrado.',
            howToRead: 'Compare a média com a linha de meta técnica. Valores próximos à linha central confirmam precisão da frente de trabalho.'
        },
        'mediana': {
            title: 'Mediana Estatística dos Dados',
            whatIs: 'Valor que divide exatamente ao meio o conjunto de medições ordenadas, mostrando a realidade central do canavial sem a distorção de anomalias pontuais.',
            metric: 'Ponto percentil 50 (P50) da série histórica.',
            contains: 'Distribuição ordenada de todas as amostragens do indicador.',
            howToRead: 'Quando a mediana é muito próxima da média, a operação possui alta uniformidade e estabilidade agronômica.'
        },
        'desvio': {
            title: 'Desvio Padrão e Variabilidade',
            whatIs: 'Mede o grau de dispersão e oscilação das medições ao longo dos talhões e das passadas do maquinário.',
            metric: 'Raiz quadrada da variância amostral em relação à média ou Coeficiente de Variação (CV%).',
            contains: 'Variação individual de cada amostragem no solo ou canavial.',
            howToRead: 'Quanto menor o desvio padrão, mais homogênea e padronizada foi a execução da atividade agrícola.'
        },
        'minimo_maximo': {
            title: 'Valores Mínimos e Máximos',
            whatIs: 'Identifica os limites extremos absolutos (menor e maior valor) registrados pelos técnicos e sensores durante a safra.',
            metric: 'Menor valor amostrado [Mín] e maior valor amostrado [Máx] da série.',
            contains: 'Pontos limites encontrados em campo.',
            howToRead: 'Permite identificar picos de desregulagem, áreas de cabeceira de carreador ou interferências topográficas atípicas.'
        },
        'medicoes': {
            title: 'Total de Medições e Amostragens',
            whatIs: 'Volume consolidado de inspeções e pontos físicos amostrados pela equipe técnica de qualidade.',
            metric: 'Contagem simples de lançamentos válidos e certificados na base MapFy.',
            contains: 'Cada ponto inspecionado com data, hora, fazenda, talhão, frente e operador responsável.',
            howToRead: 'Garante a representatividade estatística. Amostragens robustas conferem total segurança à tomada de decisão.'
        },
        'frentes_e_locais': {
            title: 'Rastreabilidade de Frentes, Talhões e Responsáveis',
            whatIs: 'Estrutura de agrupamento operacional que vincula cada trabalho à respectiva frente, talhão e colaborador encarregado.',
            metric: 'Contagem distinta de frentes ativas, talhões monitorados e operadores identificados.',
            contains: 'Cadastro operacional da Usina Pitangueiras.',
            howToRead: 'Permite localizar exatamente onde e com quem ocorreram as melhores práticas ou os desvios de processo.'
        },
        'status_auditoria': {
            title: 'Status e Auditoria de Registros',
            whatIs: 'Informa a situação do sincronismo dos dados móveis, apontamentos em aberto e integridade dos registros da base MapFy.',
            metric: 'Indicadores de sincronização e validação de consistência dos dados.',
            contains: 'Status oficial do aplicativo e auditoria de preenchimento.',
            howToRead: 'Garante que os dados analisados reflitam o campo com fidelidade, sem duplicidades ou dados corrompidos.'
        },
        'evolucao_temporal': {
            title: 'Evolução Temporal e Linha do Tempo',
            whatIs: 'Acompanha o comportamento diário e a evolução dos índices de qualidade agronômica ao longo dos dias e meses da safra.',
            metric: 'Média diária ou contagem de eventos por data, com botões de filtro rápido para 7 dias, 15 dias, 30 dias ou toda a safra.',
            contains: 'Histórico cronológico de inspeções e cumprimento das faixas técnicas.',
            howToRead: 'Identifica tendências de melhora ou queda de rendimento, permitindo correlacionar oscilações com frentes de trabalho ou condições climáticas.'
        },
        'distribuicao': {
            title: 'Distribuição de Conformidade (Gráfico de Rosca)',
            whatIs: 'Segmenta visualmente as medições em faixas operacionais (Dentro da Meta, Abaixo da Meta ou Acima da Meta).',
            metric: 'Contagem e percentual de cada faixa com exibição do total consolidado no centro do gráfico.',
            contains: 'Totais agrupados por classificação agronômica.',
            howToRead: 'A fatia verde (Dentro da Meta) deve predominar amplamente. As fatias vermelha e azul expõem a direção das desregulagens de campo.'
        },
        'histograma': {
            title: 'Histograma de Distribuição e Frequência',
            whatIs: 'Demonstra como as medições se agrupam em intervalos de valores contínuos, formando a curva de calibração operacional.',
            metric: 'Frequência de ocorrências agrupadas por intervalos de tolerância.',
            contains: 'Histograma de barras verticais com a contagem exata de pontos por classe.',
            howToRead: 'Uma curva afunilada em torno da meta ideal indica excelência operacional. Curvas espalhadas apontam necessidade de retreinamento ou regulagem.'
        },
        'frente': {
            title: 'Desempenho por Frente Operacional',
            whatIs: 'Compara a qualidade técnica e os índices de conformidade entre as diferentes frentes de máquinas e equipes da Usina Pitangueiras.',
            metric: 'Média e taxa de conformidade calculadas individualmente por frente de colheita, plantio ou tratos.',
            contains: 'Conjunto de tratores, implementos e operadores sob a mesma gestão de campo.',
            howToRead: 'Permite identificar frentes modelo para replicação de boas práticas e frentes que necessitam de apoio técnico preventivo.'
        },
        'geolocalizacao': {
            title: 'Geolocalização das Medições no Mapa',
            whatIs: 'Apresentação espacial georreferenciada de todos os pontos de inspeção plotados sobre a cartografia agrícola dos talhões.',
            metric: 'Coordenadas GPS (Latitude e Longitude decimais WGS84) capturadas em campo.',
            contains: 'Marcadores individuais coloridos conforme o status agronômico do ponto, com visualização individualizada em tela inteira.',
            howToRead: 'Pontos verdes representam qualidade aprovada; pontos vermelhos evidenciam manchas ou reboleiras de não-conformidade no talhão.'
        },
        'ordem_servico': {
            title: 'Painel Analítico por Ordem de Serviço (OS)',
            whatIs: 'Rastreia o cumprimento das ordens de serviço agrícolas abertas para cada talhão, trator e operador.',
            metric: 'Total de medições, média técnica e status de conformidade agrupados por número de OS.',
            contains: 'Vinculação direta com os sistemas de planejamento e manutenção.',
            howToRead: 'Facilita o encerramento de ordens de serviço e a auditoria de pagamentos ou bonificações operacionais.'
        },
        'registros': {
            title: 'Tabela de Registros Individuais e Auditoria',
            whatIs: 'Livro de registro analítico e detalhado contendo a íntegra das medições realizadas em campo para consulta e auditoria.',
            metric: 'Listagem paginada com ordenação dinâmica, busca rápida e exportação para Excel (XLSX).',
            contains: 'ID, Data/Hora, Fazenda, Talhão, Frente, Operador, Grandezas medidas e Situação da conformidade.',
            howToRead: 'Clique em qualquer linha da tabela para abrir o Raio-X completo e verificar os detalhes técnicos daquele apontamento.'
        },
        'filtros': {
            title: 'Painel de Filtros Operacionais',
            whatIs: 'Permite refinar instantaneamente as análises por fazenda, frente de trabalho, operador, período de datas e status agronômico.',
            metric: 'Filtragem dinâmica síncrona com recálculo automático de todos os gráficos, mapas e tabelas.',
            contains: 'Seletores inteligentes baseados na base real da safra.',
            howToRead: 'Selecione uma fazenda ou período específico para investigar a fundo o comportamento de uma área de interesse.'
        },
        'planta_soca': {
            title: 'Classificação por Ambiente: Planta, Soca ou Carreador',
            whatIs: 'Diferencia as inspeções conforme a fase agronômica do canavial (Cana Planta recém-instalada, Cana Soca em rebrota ou bordadura/carreador).',
            metric: 'Contagem de lançamentos por tipo de área com valor total somado no centro do gráfico de rosca.',
            contains: 'Fatias divididas por Soca, Planta, Carreador e Não Informado.',
            howToRead: 'As exigências operacionais e dosagens variam entre Cana Planta e Soca. O gráfico valida se a alocação de recursos está condizente com a fase.'
        },
        'criticidade': {
            title: 'Estado de Criticidade da Frota',
            whatIs: 'Classificação de risco e condições operacionais dos veículos e máquinas da frota (Leve/Liberado, Moderado/Condutor Notificado, Crítico/Impedir Operação).',
            metric: 'Contagem por nível de criticidade com exibição total no centro da rosca.',
            contains: 'Inspeções veiculares e checklists diários.',
            howToRead: 'Veículos em nível moderado ou crítico demandam priorização de manutenção corretiva para prevenir paradas não programadas e acidentes.'
        },
        'videotelemetria': {
            title: 'Associação com Videotelemetria',
            whatIs: 'Informa a presença ou registro de câmeras inteligentes e sensores de telemetria embarcados nos veículos inspecionados.',
            metric: 'Proporção de SIM versus NÃO com total consolidado no centro do gráfico.',
            contains: 'Indicador oficial de disponibilidade da tecnologia de videotelemetria.',
            howToRead: 'Permite cruzar registros de avarias com a presença de videotelemetria para investigar causas operacionais e comportamento do condutor.'
        },
        'broca': {
            title: 'Monitoramento Biológico da Broca-da-Cana',
            whatIs: 'Avaliação da densidade populacional da broca (Diatraea saccharalis) via armadilhas de feromônio sintético.',
            metric: 'Número de adultos capturados por armadilha com limiares de controle biológico.',
            contains: 'Capturas, instalações, recolhimentos e severidade nos talhões.',
            howToRead: 'Focos com captura ≥ 3 insetos demandam liberação imediata de vespinhas parasitoides (Cotesia ou Trichogramma).'
        },
        'condicoes_climaticas': {
            title: 'Condições Meteorológicas e Semáforo Delta T',
            whatIs: 'Monitoramento das variáveis de clima durante a pulverização de defensivos para prevenção de deriva e evaporação.',
            metric: 'Delta T (°C psicrométrico), Temperatura (°C), Umidade Relativa (%) e Velocidade do Vento (km/h).',
            contains: 'Registros meteorológicos no momento exato da aplicação.',
            howToRead: 'Faixa segura: Delta T entre 2°C e 8°C, vento de 3 a 10 km/h. Fora disso, a pulverização deve ser interrompida.'
        },
        'tpl_5s': {
            title: 'Gestão Visual e Auditoria 5S',
            whatIs: 'Avaliação dos 5 Sensos (Utilização, Organização, Limpeza, Padronização e Autodisciplina) nas frentes e comboios agrícolas.',
            metric: 'Pontuação de 0 a 100 pontos e taxa de conformidade dos 6 requisitos fundamentais.',
            contains: 'Vistorias em campo, frentes, comboios e oficinas móveis.',
            howToRead: 'Score ≥ 85 indica ambiente seguro e disciplinado. Pontuações baixas exigem plano corretivo imediato.'
        }
    };

    // =========================================================================
    // 9. SISTEMA UNIVERSAL DO ÍCONE INFORMATIVO (i) & POPOVER
    // =========================================================================
    function setupUniversalItemInfoSystem() {
        createPopoverModalDOM();

        // Seletor cirúrgico e abrangente cobrindo TODOS os títulos de blocos, KPIs e gráficos dos 17 relatórios
        const SELECTORS = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            '.kpi-title', '.chart-card-title', '.filters-title', '.card-title', '.audit-item-title',
            '.chart-card-header .chart-card-title',
            '.card-transition > span:first-child',
            '.kpi-card > span:first-child',
            '.kpis-grid > div > span:first-child',
            'section[class*="grid"] > div[class*="card"] > span:first-child',
            'div[class*="card-transition"] > span[class*="uppercase"]',
            'div[class*="card"] > span[class*="uppercase"]',
            'div[class*="rounded"] > span[class*="uppercase"]'
        ];

        const elements = document.querySelectorAll(SELECTORS.join(', '));

        elements.forEach(el => {
            // REGRA ESTRITA: NUNCA injetar dentro de miolos de gráficos donut, canvas, inputs ou modais!
            if (el.closest('#donutCenterOverlay, [id*="donutCenter"], [id*="centerPerc"], [id*="CenterPerc"], .donut-center-total-sum, canvas, .chart-canvas-container, .popover-card, .site-header, .site-footer, .header-glass, button, .btn-toggle-fullscreen, .timeline-quick-filter-group, #noticeBrocaBanner, [id*="notice"], [id*="Notice"], [class*="notice"], [class*="banner"], .badge-index, .node-label, select, input, #recordModal, #detailModal, #detailsModal, #targetModal')) {
                return;
            }

            // Ignora se o elemento (ou seu irmão direto) já possui o botão de informação
            if (el.querySelector('.btn-info-popover') || el.classList.contains('btn-info-popover') || el.parentElement?.querySelector(':scope > .btn-info-popover')) {
                return;
            }

            const rawText = el.textContent.trim();
            // Ignora textos numéricos puros, datas, marcas de sistema, tags de status ou textos muito curtos
            if (rawText.length < 3 || /^[0-9.,%\s\/:-]+$/.test(rawText) || rawText.includes('Pitangueiras') || rawText.includes('SAFRA 2026') || rawText.includes('Carregando')) {
                return;
            }

            // Se o elemento tiver classe truncate, remove para que o texto e o ícone fiquem visíveis sem corte
            if (el.classList.contains('truncate')) {
                el.classList.remove('truncate');
            }

            // Garante alinhamento inline-flex para títulos que forem spans
            if (window.getComputedStyle(el).display === 'inline') {
                el.style.display = 'inline-flex';
                el.style.alignItems = 'center';
            }

            // Cria o botão de informação com alta precisão visual
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-info-popover';
            btn.title = `Saiba o que significa: ${rawText}`;
            btn.setAttribute('aria-label', `Informações sobre: ${rawText}`);
            btn.innerHTML = ICONS.info;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openInfoPopover(rawText, el);
            });

            // Insere ao lado do texto
            el.appendChild(btn);
        });
    }

    function createPopoverModalDOM() {
        if (document.getElementById('pitangueiras-info-popover')) return;

        const overlay = document.createElement('div');
        overlay.id = 'pitangueiras-info-popover';
        overlay.className = 'pitangueiras-popover-overlay';
        overlay.innerHTML = `
            <div class="popover-card" role="dialog" aria-modal="true">
                <div class="popover-header">
                    <div class="flex items-center gap-2.5">
                        <div class="popover-icon-badge">
                            ${ICONS.info}
                        </div>
                        <div class="popover-title-area">
                            <span>Guia Explicativo do Indicador</span>
                            <h3 id="popoverTitle">Título do Item</h3>
                        </div>
                    </div>
                    <button type="button" class="popover-close-btn" id="btnPopoverClose" title="Fechar (Esc)">✕</button>
                </div>

                <div class="popover-body">
                    <div class="popover-section">
                        <span class="popover-section-label">📘 O que é este item?</span>
                        <p class="popover-section-text" id="popoverWhatIs">-</p>
                    </div>

                    <div class="popover-section">
                        <span class="popover-section-label">📏 Métrica & Parâmetro Utilizado:</span>
                        <p class="popover-section-text" id="popoverMetric">-</p>
                    </div>

                    <div class="popover-section">
                        <span class="popover-section-label">📦 O que ele contém?</span>
                        <p class="popover-section-text" id="popoverContains">-</p>
                    </div>

                    <div class="popover-section highlight">
                        <span class="popover-section-label">💡 Como Interpretar na Prática:</span>
                        <p class="popover-section-text" id="popoverHowToRead">-</p>
                    </div>
                </div>

                <div class="popover-footer">
                    <span>Toque ou clique em qualquer lugar para fechar</span>
                    <span class="font-bold text-emerald-600 dark:text-emerald-400">Usina Pitangueiras • Safra 2026</span>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // FECHAMENTO UNIVERSAL: "ao clicar em qualquer lugar o pop up some"
        overlay.addEventListener('click', (e) => {
            overlay.classList.remove('active');
        });

        const closeBtn = overlay.querySelector('#btnPopoverClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
        }

        document.addEventListener('click', (e) => {
            if (overlay.classList.contains('active') && !e.target.closest('.btn-info-popover')) {
                overlay.classList.remove('active');
            }
        });
    }

    function openInfoPopover(titleText, sourceEl) {
        const overlay = document.getElementById('pitangueiras-info-popover');
        if (!overlay) return;

        const info = resolveItemInfo(titleText, sourceEl);

        document.getElementById('popoverTitle').textContent = info.title;
        document.getElementById('popoverWhatIs').textContent = info.whatIs;
        document.getElementById('popoverMetric').textContent = info.metric;
        document.getElementById('popoverContains').textContent = info.contains;
        document.getElementById('popoverHowToRead').textContent = info.howToRead;

        overlay.classList.add('active');
    }

    function resolveItemInfo(titleText, sourceEl) {
        const clean = titleText.toLowerCase().trim();

        if (clean.includes('conformidade') || clean.includes('meta') || clean.includes('conforme') || clean.includes('aprovad') || clean.includes('bom')) {
            return INFO_KNOWLEDGE_BASE['conformidade'];
        }
        if (clean.includes('abaixo') || clean.includes('acima') || clean.includes('desvio') || clean.includes('não conforme') || clean.includes('nao conforme') || clean.includes('alerta') || clean.includes('atípico') || clean.includes('atipico')) {
            return INFO_KNOWLEDGE_BASE['nao_conformidade'];
        }
        if (clean.includes('mediana')) {
            return INFO_KNOWLEDGE_BASE['mediana'];
        }
        if (clean.includes('média') || clean.includes('media')) {
            return INFO_KNOWLEDGE_BASE['media'];
        }
        if (clean.includes('desvio') || clean.includes('cv') || clean.includes('amplitude')) {
            return INFO_KNOWLEDGE_BASE['desvio'];
        }
        if (clean.includes('mín') || clean.includes('máx') || clean.includes('min') || clean.includes('max') || clean.includes('menor') || clean.includes('maior')) {
            return INFO_KNOWLEDGE_BASE['minimo_maximo'];
        }
        if (clean.includes('mediç') || clean.includes('amostra') || clean.includes('total') || clean.includes('volume') || clean.includes('registros')) {
            return INFO_KNOWLEDGE_BASE['medicoes'];
        }
        if (clean.includes('frente') || clean.includes('talh') || clean.includes('fazenda') || clean.includes('responsáv') || clean.includes('operador') || clean.includes('condutor') || clean.includes('gestor')) {
            return INFO_KNOWLEDGE_BASE['frentes_e_locais'];
        }
        if (clean.includes('evolu') || clean.includes('tempo') || clean.includes('timeline') || clean.includes('diária') || clean.includes('linha do tempo') || clean.includes('acumulada')) {
            return INFO_KNOWLEDGE_BASE['evolucao_temporal'];
        }
        if (clean.includes('distribui') || clean.includes('rosca') || clean.includes('donut') || clean.includes('classifica')) {
            return INFO_KNOWLEDGE_BASE['distribuicao'];
        }
        if (clean.includes('histograma') || clean.includes('frequência') || clean.includes('classes') || clean.includes('dispers')) {
            return INFO_KNOWLEDGE_BASE['histograma'];
        }
        if (clean.includes('geolocaliza') || clean.includes('mapa') || clean.includes('espacial') || clean.includes('campo')) {
            return INFO_KNOWLEDGE_BASE['geolocalizacao'];
        }
        if (clean.includes('ordem de serviço') || clean.includes('os') || clean.includes('manutenção')) {
            return INFO_KNOWLEDGE_BASE['ordem_servico'];
        }
        if (clean.includes('tabela') || clean.includes('auditoria') || clean.includes('lançamento') || clean.includes('prontuário')) {
            return INFO_KNOWLEDGE_BASE['registros'];
        }
        if (clean.includes('filtro')) {
            return INFO_KNOWLEDGE_BASE['filtros'];
        }
        if (clean.includes('planta') || clean.includes('soca') || clean.includes('carreador')) {
            return INFO_KNOWLEDGE_BASE['planta_soca'];
        }
        if (clean.includes('criticidade')) {
            return INFO_KNOWLEDGE_BASE['criticidade'];
        }
        if (clean.includes('videotelemetria')) {
            return INFO_KNOWLEDGE_BASE['videotelemetria'];
        }
        if (clean.includes('broca') || clean.includes('armadilha') || clean.includes('captura')) {
            return INFO_KNOWLEDGE_BASE['broca'];
        }
        if (clean.includes('delta') || clean.includes('temperatura') || clean.includes('vento') || clean.includes('umidade') || clean.includes('clima')) {
            return INFO_KNOWLEDGE_BASE['condicoes_climaticas'];
        }
        if (clean.includes('5s') || clean.includes('tpl') || clean.includes('senso') || clean.includes('vistoria')) {
            return INFO_KNOWLEDGE_BASE['tpl_5s'];
        }

        return {
            title: titleText.replace(/[📈📊🚜🗺️📋📑⏰📝🔍🛡️🛰️🎯👤⏱️📅🌾📂📏]/g, '').trim(),
            whatIs: `Módulo e indicador operacional voltado ao monitoramento e controle de qualidade de "${titleText.trim()}" na Safra 2026.`,
            metric: 'Consolidação de parâmetros técnicos auditados no campo segundo os padrões agronômicos da Usina Pitangueiras.',
            contains: 'Dados estatísticos, agrupamentos operacionais por frente/talhão e registros rastreáveis via apontamento MapFy.',
            howToRead: 'Utilize as informações deste bloco para diagnosticar a estabilidade do processo e adotar correções preventivas caso haja desvios.'
        };
    }


    // =========================================================================
    // WIDGET CIRCULAR 24/7 NO CANTINHO ESQUERDO (CICLO DE 1H DE ATUALIZAÇÃO)
    // Preenche gradualmente em 3600s e sinaliza novo ciclo ao completar 100%
    // =========================================================================
    function init247CircularWidget() {
        function updateProgress() {
            const ring = document.getElementById('badge247ProgressRing');
            const badge = document.getElementById('badgeStatus247');
            if (!ring || !badge) return;

            const now = new Date();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();
            const secondsInHour = (minutes * 60) + seconds;
            const progress = Math.min(100, Math.max(0, (secondsInHour / 3600) * 100));

            ring.setAttribute('stroke-dasharray', `${progress.toFixed(2)}, 100`);

            const remainingMinutes = 60 - minutes;
            if (!badge.getAttribute('data-custom-title')) {
                badge.title = `Sincronismo Contínuo 24/7 • Próxima atualização em ~${remainingMinutes} min (ao fechar o círculo)`;
            }

            // Quando fecha o círculo (primeiros 6 segundos da nova hora), pulsa com destaque
            if (secondsInHour < 6) {
                badge.classList.add('badge-247-cycle-complete');
            } else {
                badge.classList.remove('badge-247-cycle-complete');
            }
        }

        updateProgress();
        if (!window._timer247Widget) {
            window._timer247Widget = setInterval(updateProgress, 1000);
        }

        const badge = document.getElementById('badgeStatus247');
        if (badge && !badge._hasSyncClick) {
            badge._hasSyncClick = true;
            badge.style.cursor = 'pointer';
            badge.addEventListener('click', (e) => {
                e.preventDefault();
                badge.style.transform = 'scale(0.92)';
                setTimeout(() => { badge.style.transform = ''; }, 200);

                if (window.MapfyApiConnector && typeof window.MapfyApiConnector.initOnlineSync === 'function') {
                    window.MapfyApiConnector.initOnlineSync();
                }
                if (window.forceMapfyUpdate && typeof window.forceMapfyUpdate === 'function') {
                    // Feedback sutil
                    console.log('[MapFy] Sincronização forçada pelo usuário');
                }
            });
        }
    }


    // =========================================================================
    // 6. AUTO-DISMISS DE NOTAS TÉCNICAS E BANNERS (10 SEGUNDOS COM PROGRESSO)
    // Usina Pitangueiras • Safra 2026
    // =========================================================================
    function setupAutoDismissNoticeBanners() {
        const selector = [
            '.technical-notice-banner',
            '.notice-box',
            '#noticeBrocaBanner',
            '#initialNoticeBanner',
            '[id*="noticeBroca"]',
            '[id*="initialNotice"]',
            '[class*="technical-notice"]',
            '[class*="notice-card"]',
            '.context-banner'
        ].join(', ');

        const banners = document.querySelectorAll(selector);
        banners.forEach(banner => {
            // Se for um container pai já sendo controlado ou filho direto de notice-box já controlado, evita duplicar
            if (banner._dismissTimerInitialized) return;
            if (banner.classList.contains('notice-box') && banner.parentElement && banner.parentElement.classList.contains('technical-notice-banner')) {
                return; // Trata apenas no container pai
            }
            banner._dismissTimerInitialized = true;

            // Garante posição relativa para ancorar a barra de progresso e botão fechar
            banner.style.position = 'relative';
            banner.style.overflow = 'hidden';
            banner.style.boxSizing = 'border-box';

            // Armazena altura natural antes de colapsar
            const naturalHeight = banner.scrollHeight || 180;
            banner.style.maxHeight = (naturalHeight + 60) + 'px';

            // 1. Botão manual de fechar (✕) no canto superior direito
            if (!banner.querySelector('.btn-dismiss-notice')) {
                const closeBtn = document.createElement('button');
                closeBtn.type = 'button';
                closeBtn.className = 'btn-dismiss-notice';
                closeBtn.title = 'Fechar aviso agora (ou aguarde 10 segundos)';
                closeBtn.innerHTML = '✕';
                closeBtn.onclick = (e) => {
                    e.stopPropagation();
                    dismissNoticeBanner(banner, true);
                };
                banner.appendChild(closeBtn);
            }

            // 2. Barra de progresso visual de 10 segundos
            let timerBar = banner.querySelector('.notice-timer-bar');
            if (!timerBar) {
                timerBar = document.createElement('div');
                timerBar.className = 'notice-timer-bar';
                banner.appendChild(timerBar);
            }

            // Inicia animação da barra de progresso (100% -> 0% em 10s)
            requestAnimationFrame(() => {
                timerBar.style.width = '100%';
                setTimeout(() => {
                    timerBar.style.width = '0%';
                }, 50);
            });

            // 3. Controle do Timer de 10 segundos (10000ms) com Pause no Hover/Touch
            const DURATION_MS = 10000;
            let remainingMs = DURATION_MS;
            let timerStartTime = Date.now();
            let timeoutId = null;

            function startTimer(ms) {
                timerStartTime = Date.now();
                timeoutId = setTimeout(() => {
                    dismissNoticeBanner(banner, false);
                }, ms);
            }

            function pauseTimer() {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                    const elapsed = Date.now() - timerStartTime;
                    remainingMs = Math.max(500, remainingMs - elapsed);
                    if (timerBar) {
                        const currentWidth = (remainingMs / DURATION_MS) * 100;
                        timerBar.style.transition = 'none';
                        timerBar.style.width = currentWidth + '%';
                        timerBar.classList.add('paused');
                    }
                }
            }

            function resumeTimer() {
                if (!timeoutId && remainingMs > 0 && !banner.classList.contains('is-dismissed')) {
                    if (timerBar) {
                        timerBar.classList.remove('paused');
                        timerBar.style.transition = `width ${remainingMs}ms linear`;
                        timerBar.style.width = '0%';
                    }
                    startTimer(remainingMs);
                }
            }

            banner.addEventListener('mouseenter', pauseTimer);
            banner.addEventListener('mouseleave', resumeTimer);
            banner.addEventListener('touchstart', pauseTimer, { passive: true });
            banner.addEventListener('touchend', resumeTimer, { passive: true });

            startTimer(DURATION_MS);
        });
    }

    function dismissNoticeBanner(banner, isManual) {
        if (!banner || banner.classList.contains('is-dismissed')) return;
        banner.classList.add('is-dismissed');

        // Cria botão/pílula de reabertura para que o usuário nunca perca o acesso à nota técnica
        createReopenNoticePill(banner);

        setTimeout(() => {
            banner.style.display = 'none';
        }, 700);
    }

    function reopenNoticeBanner(banner, reopenPill) {
        if (!banner) return;
        banner.style.display = '';
        banner.classList.remove('is-dismissed');
        const timerBar = banner.querySelector('.notice-timer-bar');
        if (timerBar) timerBar.style.display = 'none'; // Não auto-destrói quando o usuário reabre manualmente

        const naturalHeight = banner.scrollHeight || 180;
        banner.style.maxHeight = (naturalHeight + 60) + 'px';

        if (reopenPill && reopenPill.parentElement) {
            reopenPill.parentElement.removeChild(reopenPill);
        }
    }

    function createReopenNoticePill(banner) {
        if (document.querySelector('.btn-reopen-technical-notice')) return;

        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'btn-reopen-technical-notice';
        pill.innerHTML = `<span>ℹ️</span> <span>Nota Técnica Operacional</span>`;
        pill.title = 'Reexibir a Nota Técnica Operacional e Metodologia Estatística';
        pill.onclick = () => reopenNoticeBanner(banner, pill);

        // Tenta ancorar no cabeçalho ou logo após a barra de resumo de filtros
        const filterSection = document.getElementById('filterSection') || document.querySelector('.filters-container') || document.querySelector('section');
        const summaryBar = document.getElementById('mobileFilterSummaryBar');
        const header = document.querySelector('header');

        if (summaryBar && summaryBar.parentElement) {
            summaryBar.parentElement.insertBefore(pill, summaryBar.nextSibling);
        } else if (filterSection && filterSection.parentElement) {
            filterSection.parentElement.insertBefore(pill, filterSection);
        } else if (header && header.parentElement) {
            header.parentElement.insertBefore(pill, header.nextSibling);
        } else {
            document.body.insertBefore(pill, document.body.firstChild);
        }
    }

    // =========================================================================
    // 7. SUPORTE PWA AUTOMÁTICO NOS 17 DASHBOARDS
    // =========================================================================
    function setupPwaSupport() {
        if (!document.querySelector('script[src*="pwa_installer.js"]')) {
            const s = document.createElement('script');
            s.src = '../common/js/pwa_installer.js';
            document.head.appendChild(s);
        }
        if (!document.querySelector('link[rel="manifest"]')) {
            const m = document.createElement('link');
            m.rel = 'manifest';
            m.href = '../manifest.json';
            document.head.appendChild(m);
        }
    }


    // =========================================================================
    // 8. GERENCIADOR UNIVERSAL DE FILTROS RETRÁTEIS PARA CELULAR (<= 1024px)
    // Garante que TODOS os 17 dashboards ocultem os filtros no mobile para
    // priorizar mapas e KPIs, com barra de resumo, toggle e botão flutuante.
    // Usina Pitangueiras • Safra 2026
    // =========================================================================
    function setupUniversalMobileFilters() {
        const filterSection = document.getElementById('filterSection') || 
                              document.querySelector('.filters-container') ||
                              document.querySelector('.filters-card') ||
                              document.querySelector('section.p-4.rounded-2xl') ||
                              document.querySelector('main > section:first-of-type') ||
                              document.querySelector('div.bg-white.dark\\:bg-slate-800');

        if (!filterSection) return;

        let collapsibleBody = filterSection.querySelector('.filter-collapsible-body') || 
                              filterSection.querySelector('#filterCollapsibleBody');
        let toggleBtn = filterSection.querySelector('#btnToggleFilterMobile') || 
                        filterSection.querySelector('.btn-toggle-filters-mobile');
        let applyBtn = filterSection.querySelector('#btnMobileApplyAndHide') || 
                       filterSection.querySelector('#btnApplyAndHideFilters') || 
                       filterSection.querySelector('.btn-apply-filters-mobile');
        let summaryBar = filterSection.querySelector('#mobileFilterSummaryBar') || 
                         filterSection.querySelector('.mobile-filter-summary-bar');

        const header = filterSection.querySelector('.filters-header') || 
                       filterSection.querySelector('div.flex.items-center.justify-between') ||
                       filterSection.firstElementChild;

        // 1. Cria ou reutiliza Botão Toggle no cabeçalho se não existir
        if (!toggleBtn && header) {
            toggleBtn = document.createElement('button');
            toggleBtn.id = 'btnToggleFilterMobile';
            toggleBtn.type = 'button';
            toggleBtn.className = 'btn-toggle-filters-mobile';
            toggleBtn.innerHTML = '<i class="fa-solid fa-sliders text-[11px]"></i> <span class="toggle-text" id="toggleFilterMobileText">Ajustar Filtros</span> <i class="fa-solid fa-chevron-down chevron text-[10px]" id="toggleFilterChevron"></i>';
            toggleBtn.title = 'Alternar visibilidade dos filtros';

            const actionsDiv = header.querySelector('.filters-actions') || 
                               header.querySelector('div.flex.items-center:last-child') || 
                               header;
            if (actionsDiv && actionsDiv !== header) {
                actionsDiv.insertBefore(toggleBtn, actionsDiv.firstChild);
            } else {
                header.appendChild(toggleBtn);
            }
        }

        // 2. Cria Barra de Resumo Compacta para Mobile se não existir
        if (!summaryBar && header) {
            summaryBar = document.createElement('div');
            summaryBar.id = 'mobileFilterSummaryBar';
            summaryBar.className = 'mobile-filter-summary-bar';
            summaryBar.innerHTML = `
                <span class="font-bold text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center gap-1 flex-shrink-0">
                    <i class="fa-solid fa-filter text-[10px]"></i> <span id="mobileSummaryScopeText">Safra 2026</span>
                </span>
                <span class="text-slate-400 text-[10px]">•</span>
                <span id="mobileSummaryCountText" class="font-mono text-slate-600 dark:text-slate-300 font-semibold text-[11px] flex-shrink-0">Filtros Ativos</span>
                <span class="text-slate-400 text-[10px]">•</span>
                <span class="text-[10px] font-semibold text-emerald-500 flex-shrink-0">Toque para ajustar</span>
            `;
            header.insertAdjacentElement('afterend', summaryBar);
        }

        // 3. Cria container colapsável se não existir no HTML
        if (!collapsibleBody && header) {
            collapsibleBody = document.createElement('div');
            collapsibleBody.id = 'filterCollapsibleBody';
            collapsibleBody.className = 'filter-collapsible-body is-collapsed';

            const childrenToMove = [];
            let sibling = (summaryBar || header).nextElementSibling;
            while (sibling) {
                if (sibling.id !== 'mobileFloatingFilterBtn' && !sibling.classList.contains('mobile-floating-filter-btn')) {
                    childrenToMove.push(sibling);
                }
                sibling = sibling.nextElementSibling;
            }

            childrenToMove.forEach(child => collapsibleBody.appendChild(child));
            filterSection.appendChild(collapsibleBody);
        }

        // 4. Cria Botão de Aplicar e Ocultar no rodapé da gaveta de filtros se não existir
        if (!applyBtn && collapsibleBody) {
            const applyWrapper = document.createElement('div');
            applyWrapper.className = 'pt-3 border-t flex flex-col gap-2 mt-3';
            applyWrapper.style.borderColor = 'var(--border-color, rgba(255,255,255,0.1))';
            applyWrapper.innerHTML = `
                <button id="btnMobileApplyAndHide" type="button" class="btn-apply-filters-mobile">
                    <span>✓</span>
                    <span>Aplicar e Ocultar Filtros</span>
                </button>
                <p class="text-[10px] text-center text-[var(--text-muted, #94a3b8)] m-0">
                    Toque para recolher os filtros e liberar a tela para os indicadores e mapa.
                </p>
            `;
            collapsibleBody.appendChild(applyWrapper);
            applyBtn = applyWrapper.querySelector('#btnMobileApplyAndHide');
        }

        // 5. Inicialização do estado de acordo com a largura da tela (<= 1024px)
        const isMobileScreen = window.innerWidth <= 1024;
        if (isMobileScreen && collapsibleBody) {
            collapsibleBody.classList.add('is-collapsed');
            collapsibleBody.classList.remove('is-expanded');
            if (toggleBtn) {
                toggleBtn.classList.remove('is-expanded');
                const tText = toggleBtn.querySelector('.toggle-text') || toggleBtn.querySelector('#toggleFilterMobileText');
                if (tText) tText.textContent = 'Ajustar Filtros';
                const chev = toggleBtn.querySelector('.chevron') || toggleBtn.querySelector('#toggleFilterChevron') || toggleBtn.querySelector('.fa-chevron-down');
                if (chev) chev.style.transform = 'rotate(0deg)';
            }
        } else if (collapsibleBody) {
            collapsibleBody.classList.remove('is-collapsed');
            collapsibleBody.classList.add('is-expanded');
        }

        // 6. Vincula todos os eventos
        bindCollapsibleEvents(filterSection, toggleBtn, collapsibleBody, applyBtn, summaryBar);
        setupFloatingFilterButton(filterSection, collapsibleBody);
        setupSummarySync(filterSection);
    }

    function bindCollapsibleEvents(filterSection, toggleBtn, collapsibleBody, applyBtn, summaryBar) {
        if (!collapsibleBody) return;
        if (collapsibleBody._hasBoundEvents) return;
        collapsibleBody._hasBoundEvents = true;

        function setExpanded(expand) {
            if (expand) {
                collapsibleBody.classList.remove('is-collapsed');
                collapsibleBody.classList.add('is-expanded');
                if (toggleBtn) {
                    toggleBtn.classList.add('is-expanded');
                    const tText = toggleBtn.querySelector('.toggle-text') || toggleBtn.querySelector('#toggleFilterMobileText');
                    if (tText) tText.textContent = 'Ocultar Filtros';
                    const chev = toggleBtn.querySelector('.chevron') || toggleBtn.querySelector('#toggleFilterChevron') || toggleBtn.querySelector('.fa-chevron-down');
                    if (chev) chev.style.transform = 'rotate(180deg)';
                }
            } else {
                collapsibleBody.classList.add('is-collapsed');
                collapsibleBody.classList.remove('is-expanded');
                if (toggleBtn) {
                    toggleBtn.classList.remove('is-expanded');
                    const tText = toggleBtn.querySelector('.toggle-text') || toggleBtn.querySelector('#toggleFilterMobileText');
                    if (tText) tText.textContent = 'Ajustar Filtros';
                    const chev = toggleBtn.querySelector('.chevron') || toggleBtn.querySelector('#toggleFilterChevron') || toggleBtn.querySelector('.fa-chevron-down');
                    if (chev) chev.style.transform = 'rotate(0deg)';
                }
            }
        }

        if (toggleBtn) {
            toggleBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isCurrentlyCollapsed = collapsibleBody.classList.contains('is-collapsed');
                setExpanded(isCurrentlyCollapsed);
            };
        }

        if (summaryBar) {
            summaryBar.onclick = (e) => {
                e.preventDefault();
                const isCurrentlyCollapsed = collapsibleBody.classList.contains('is-collapsed');
                setExpanded(isCurrentlyCollapsed);
            };
        }

        if (applyBtn) {
            applyBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded(false);

                // Rolagem suave até a seção de KPIs ou mapas logo abaixo
                setTimeout(() => {
                    const nextSection = filterSection.nextElementSibling;
                    if (nextSection) {
                        nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 80);
            };
        }

        window.addEventListener('resize', () => {
            if (window.innerWidth > 1024) {
                collapsibleBody.classList.remove('is-collapsed');
                collapsibleBody.classList.add('is-expanded');
            } else {
                if (!collapsibleBody.classList.contains('is-expanded')) {
                    collapsibleBody.classList.add('is-collapsed');
                }
            }
        });
    }

    function setupFloatingFilterButton(filterSection, collapsibleBody) {
        let floatingBtn = document.getElementById('mobileFloatingFilterBtn') || 
                          document.querySelector('.mobile-floating-filter-btn');

        if (!floatingBtn) {
            floatingBtn = document.createElement('button');
            floatingBtn.id = 'mobileFloatingFilterBtn';
            floatingBtn.type = 'button';
            floatingBtn.className = 'mobile-floating-filter-btn hidden-floating';
            floatingBtn.innerHTML = '<i class="fa-solid fa-sliders text-sm"></i> <span>Filtros</span>';
            floatingBtn.title = 'Ajustar filtros operacionais';
            document.body.appendChild(floatingBtn);
        }

        if (!floatingBtn._hasClickEvent) {
            floatingBtn._hasClickEvent = true;
            floatingBtn.onclick = () => {
                if (collapsibleBody) {
                    collapsibleBody.classList.remove('is-collapsed');
                    collapsibleBody.classList.add('is-expanded');
                    const toggleBtn = document.getElementById('btnToggleFilterMobile');
                    if (toggleBtn) {
                        toggleBtn.classList.add('is-expanded');
                        const tText = toggleBtn.querySelector('#toggleFilterMobileText') || toggleBtn.querySelector('.toggle-text');
                        if (tText) tText.textContent = 'Ocultar Filtros';
                        const chev = toggleBtn.querySelector('#toggleFilterChevron') || toggleBtn.querySelector('.chevron');
                        if (chev) chev.style.transform = 'rotate(180deg)';
                    }
                }
                filterSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };

            window.addEventListener('scroll', () => {
                if (window.innerWidth > 1024) {
                    floatingBtn.classList.add('hidden-floating');
                    return;
                }
                const filterRect = filterSection.getBoundingClientRect();
                if (filterRect.bottom < 80) {
                    floatingBtn.classList.remove('hidden-floating');
                } else {
                    floatingBtn.classList.add('hidden-floating');
                }
            }, { passive: true });
        }
    }

    function setupSummarySync(filterSection) {
        function updateSummary() {
            const countEl = document.getElementById('lblFilteredCount') || 
                            document.getElementById('lblTotalCount') ||
                            document.getElementById('kpiTotalRegistros') ||
                            document.getElementById('cardTotalMedicoes') ||
                            document.getElementById('filteredCountInfo');
            
            const summaryCount = document.getElementById('mobileSummaryCountText');
            if (countEl && summaryCount) {
                const text = countEl.textContent.trim();
                const num = text.replace(/\D+/g, '');
                if (num) {
                    summaryCount.textContent = `${Number(num).toLocaleString('pt-BR')} registros ativos`;
                }
            }
        }

        setInterval(updateSummary, 2000);
        filterSection.addEventListener('change', () => setTimeout(updateSummary, 200));
        filterSection.addEventListener('input', () => setTimeout(updateSummary, 200));
    }

})();
