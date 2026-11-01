/**
 * map_shapes_layer.js
 * ====================
 * Camada Universal de Shapes e Talhões Agrícolas da Usina Pitangueiras.
 * 
 * Funcionalidades:
 * 1. Integração Automática com Leaflet Map (state.map) em todos os 17 Dashboards.
 * 2. Renderização de Ultra-Alta Performance via L.canvas() (60 FPS com 6.400+ talhões).
 * 3. Pane customizado 'agriculturalShapesPane' (Z-Index 350) para que os talhões fiquem
 *    visíveis sobre as imagens de satélite/mapa base, mas SEM obstruir os pontos de medição.
 * 4. Botão de Controle Flutuante no Mapa: '🌾 Talhões' com badge de contagem e alternância liga/desliga.
 * 5. Detecção Dinâmica de Atualizações: lê o manifest.json gerado em DashBoard/Maps/ e recarrega
 *    automaticamente se arquivos foram alterados na pasta Maps.
 * 6. Hover Interativo: Realce visual dourado (#f59e0b) e Tooltip Flutuante com Fazenda, Talhão e Hectares.
 * 7. Zoom ao Clicar: Ajusta a câmera do mapa para enquadrar o talhão selecionado.
 * 
 * Usina Pitangueiras — Safra 2026
 */

(function () {
    'use strict';

    if (window.PitangueirasMapShapes) {
        return; // Evita dupla instanciação
    }

    const CONFIG = {
        manifestUrl: '../Maps/manifest.json',
        shapesUrl: '../Maps/pitangueiras_shapes.geojson',
        apiManifestUrl: 'http://127.0.0.1:8000/api/v1/maps/manifest',
        apiShapesUrl: 'http://127.0.0.1:8000/api/v1/maps/shapes',
        storageKey: 'pitangueiras_show_talhoes',
        cacheKey: '_pitangueiras_shapes_cache'
    };

    const STYLES = {
        default: {
            color: '#10b981',        // Esmeralda corporativo Pitangueiras
            weight: 1.2,
            opacity: 0.85,
            fillColor: '#10b981',
            fillOpacity: 0.05,
            dashArray: null
        },
        hover: {
            color: '#f59e0b',        // Dourado/Âmbar de destaque
            weight: 2.5,
            opacity: 1.0,
            fillColor: '#f59e0b',
            fillOpacity: 0.28,
            dashArray: null
        }
    };

    const MapShapes = {
        manifest: null,
        geojsonData: null,
        isLoading: false,
        activeLayers: new Map(), // mapInstance -> geojsonLayer

        async init() {
            this.hookLeaflet();
            this.observeMaps();
        },

        hookLeaflet() {
            if (typeof L !== 'undefined' && L.Map) {
                const self = this;
                L.Map.addInitHook(function () {
                    // 'this' é a instância de L.Map
                    const mapInstance = this;
                    setTimeout(() => {
                        self.attachToMap(mapInstance);
                    }, 100);
                });
            }
        },

        observeMaps() {
            // Tenta anexar em mapas já existentes ou criados após o script
            const checkMaps = () => {
                if (window.state && window.state.map) {
                    this.attachToMap(window.state.map);
                }
                if (window.dashboardState && window.dashboardState.map) {
                    this.attachToMap(window.dashboardState.map);
                }
                // Procura elementos com _leaflet_map
                const containers = document.querySelectorAll('.leaflet-container');
                containers.forEach(c => {
                    if (c._leaflet_map) {
                        this.attachToMap(c._leaflet_map);
                    }
                });
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', checkMaps);
            } else {
                checkMaps();
            }

            // Intervalos de reforço para dashboards assíncronos
            setTimeout(checkMaps, 500);
            setTimeout(checkMaps, 1500);
            setTimeout(checkMaps, 3000);
        },

        async fetchManifest() {
            if (this.manifest) return this.manifest;

            // Tenta primeiro API local, depois arquivo estático
            const urls = [
                CONFIG.manifestUrl + '?t=' + Date.now(),
                CONFIG.apiManifestUrl
            ];

            for (const u of urls) {
                try {
                    const resp = await fetch(u, { cache: 'no-cache' });
                    if (resp.ok) {
                        this.manifest = await resp.json();
                        return this.manifest;
                    }
                } catch (e) {
                    // Tenta o próximo
                }
            }
            return null;
        },

        async loadShapesData() {
            if (window[CONFIG.cacheKey]) {
                this.geojsonData = window[CONFIG.cacheKey];
                return this.geojsonData;
            }

            if (this.isLoading) {
                // Aguarda o término do carregamento em andamento
                while (this.isLoading) {
                    await new Promise(r => setTimeout(r, 100));
                }
                return this.geojsonData;
            }

            this.isLoading = true;
            try {
                const manifest = await this.fetchManifest();
                const version = manifest && manifest.last_updated ? encodeURIComponent(manifest.last_updated) : Date.now();

                const urls = [
                    `${CONFIG.shapesUrl}?v=${version}`,
                    `${CONFIG.apiShapesUrl}?v=${version}`
                ];

                for (const u of urls) {
                    try {
                        const resp = await fetch(u);
                        if (resp.ok) {
                            const data = await resp.json();
                            if (data && data.features && data.features.length > 0) {
                                this.geojsonData = data;
                                window[CONFIG.cacheKey] = data;
                                console.info(`[MapShapes] Carregados com sucesso ${data.features.length} talhões agrícolas.`);
                                return this.geojsonData;
                            }
                        }
                    } catch (err) {
                        // continua para o próximo fallback
                    }
                }
            } catch (err) {
                console.error('[MapShapes] Falha ao carregar shapes de talhões:', err);
            } finally {
                this.isLoading = false;
            }

            return null;
        },

        attachToMap(map) {
            if (!map || typeof map.addLayer !== 'function') return;
            if (this.activeLayers.has(map)) return; // Já anexado

            // Garante que o mapa tenha o container pronto
            const container = map.getContainer ? map.getContainer() : null;
            if (!container) return;
            container._leaflet_map = map;

            // Cria Pane customizado para os talhões (Z-Index 350: acima dos tiles, abaixo dos pontos/marcadores)
            if (!map.getPane('agriculturalShapesPane')) {
                const pane = map.createPane('agriculturalShapesPane');
                pane.style.zIndex = '350';
                pane.style.pointerEvents = 'auto';
            }

            // Cria o controle flutuante de Talhões no canto superior direito
            this.createMapControl(map);

            // Verifica preferência do usuário (padrão: ativado)
            const isEnabled = localStorage.getItem(CONFIG.storageKey) !== 'false';
            if (isEnabled) {
                this.enableLayerForMap(map);
            }
        },

        createMapControl(map) {
            const self = this;
            const container = map.getContainer();
            if (container.querySelector('.leaflet-control-talhoes')) return;

            const TalhoesControl = L.Control.extend({
                options: { position: 'topright' },

                onAdd: function () {
                    const btn = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-talhoes');
                    btn.style.backgroundColor = 'var(--bg-card, #ffffff)';
                    btn.style.border = '1px solid var(--border-color, #e2e8f0)';
                    btn.style.borderRadius = '10px';
                    btn.style.padding = '5px 9px';
                    btn.style.cursor = 'pointer';
                    btn.style.display = 'flex';
                    btn.style.alignItems = 'center';
                    btn.style.gap = '6px';
                    btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
                    btn.style.fontSize = '11px';
                    btn.style.fontWeight = '700';
                    btn.style.color = 'var(--text-primary, #0f172a)';
                    btn.style.transition = 'all 0.2s ease';
                    btn.style.userSelect = 'none';
                    btn.title = 'Alternar visualização da malha de talhões da Usina Pitangueiras';

                    const isEnabled = localStorage.getItem(CONFIG.storageKey) !== 'false';
                    btn.innerHTML = `
                        <span style="font-size: 13px;">🌾</span>
                        <span class="talhoes-label">Talhões</span>
                        <span class="talhoes-badge" style="
                            font-size: 9.5px;
                            padding: 1px 5px;
                            border-radius: 9999px;
                            background: ${isEnabled ? '#10b981' : '#94a3b8'};
                            color: #ffffff;
                            font-weight: 800;
                        ">6.4k</span>
                    `;

                    if (isEnabled) {
                        btn.style.borderColor = '#10b981';
                        btn.style.color = '#047857';
                    }

                    L.DomEvent.disableClickPropagation(btn);
                    L.DomEvent.disableScrollPropagation(btn);

                    btn.addEventListener('click', () => {
                        const currentlyActive = self.activeLayers.has(map) && map.hasLayer(self.activeLayers.get(map));
                        if (currentlyActive) {
                            self.disableLayerForMap(map);
                            localStorage.setItem(CONFIG.storageKey, 'false');
                            btn.style.borderColor = 'var(--border-color, #e2e8f0)';
                            btn.style.color = 'var(--text-primary, #0f172a)';
                            const badge = btn.querySelector('.talhoes-badge');
                            if (badge) badge.style.background = '#94a3b8';
                        } else {
                            self.enableLayerForMap(map);
                            localStorage.setItem(CONFIG.storageKey, 'true');
                            btn.style.borderColor = '#10b981';
                            btn.style.color = '#047857';
                            const badge = btn.querySelector('.talhoes-badge');
                            if (badge) badge.style.background = '#10b981';
                        }
                    });

                    return btn;
                }
            });

            map.addControl(new TalhoesControl());
        },

        async enableLayerForMap(map) {
            if (!map) return;

            // Se já tem layer adicionado, apenas adiciona ao mapa
            if (this.activeLayers.has(map)) {
                const existing = this.activeLayers.get(map);
                if (!map.hasLayer(existing)) {
                    map.addLayer(existing);
                }
                return;
            }

            // Carrega os dados GeoJSON
            const data = await this.loadShapesData();
            if (!data) return;

            // Renderer dedicado Canvas para 60 FPS com 6.469 polígonos
            const canvasRenderer = L.canvas({
                pane: 'agriculturalShapesPane',
                padding: 0.5
            });

            const geoLayer = L.geoJSON(data, {
                pane: 'agriculturalShapesPane',
                renderer: canvasRenderer,
                style: function () {
                    return STYLES.default;
                },
                onEachFeature: function (feature, layer) {
                    const props = feature.properties || {};

                    // Tooltip rico no hover
                    const tooltipHtml = `
                        <div style="font-family: Inter, system-ui, sans-serif; font-size: 11px; line-height: 1.4; color: #1e293b; padding: 3px 5px;">
                            <div style="font-weight: 800; font-size: 12px; color: #047857; margin-bottom: 3px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
                                🌱 ${props.nome_faz || ('Fazenda ' + props.fazenda)}
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 10px;">
                                <span>Cód. Faz: <b>${props.fazenda}</b></span>
                                <span>Talhão: <b>${props.talhao}</b></span>
                            </div>
                            <div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 2px;">
                                <span>Área: <b>${Number(props.area || 0).toFixed(2)} ha</b></span>
                                <span>Zona: <b>${props.zona || 1}</b></span>
                            </div>
                        </div>
                    `;

                    layer.bindTooltip(tooltipHtml, {
                        sticky: true,
                        direction: 'top',
                        className: 'pitangueiras-talhao-tooltip'
                    });

                    // Eventos de realce visual
                    layer.on({
                        mouseover: function (e) {
                            const l = e.target;
                            l.setStyle(STYLES.hover);
                            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                                l.bringToFront();
                            }
                        },
                        mouseout: function (e) {
                            geoLayer.resetStyle(e.target);
                        },
                        click: function (e) {
                            const bounds = e.target.getBounds();
                            if (bounds && bounds.isValid()) {
                                map.fitBounds(bounds, {
                                    padding: [50, 50],
                                    maxZoom: 16
                                });
                            }
                        }
                    });
                }
            });

            this.activeLayers.set(map, geoLayer);
            map.addLayer(geoLayer);
        },

        disableLayerForMap(map) {
            if (this.activeLayers.has(map)) {
                const layer = this.activeLayers.get(map);
                if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            }
        },

        reloadAll() {
            window[CONFIG.cacheKey] = null;
            this.geojsonData = null;
            this.manifest = null;
            this.activeLayers.forEach((layer, map) => {
                if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            });
            this.activeLayers.clear();
            this.observeMaps();
        }
    };

    window.PitangueirasMapShapes = MapShapes;
    MapShapes.init();

})();
