/**
 * pitangueiras_map_core.js
 * =======================
 * Motor Central Unificado de Mapas e Shapes Agronômicos da Usina Pitangueiras.
 * 
 * Arquitetura Plug & Play de Alto Desempenho (Safra 2026):
 * 1. Instanciação única e padronizada do Leaflet com satélites Google Híbrido HD, Esri e OpenStreetMap.
 * 2. Carregamento e cache único de shapes e polígonos de talhões na memória compartilhada (zero reload).
 * 3. Gestão 100% autônoma dos controles de filtro (Trava Filtro Global 🔒 / Modo Autônomo 🔓 7D, 15D, Todos).
 * 4. Clusterização inteligente com Leaflet.markerCluster e popups corporativos translúcidos em dark glass.
 * 5. Reatividade e semáforo dinâmico de talhões (Bom / Médio / Ruim / Sem Coleta).
 */

(function (window, document) {
    'use strict';

    if (window.PitangueirasMapCore) {
        return; // Evita dupla instanciação
    }

    // Configurações e Estado Global Compartilhado do Mapa
    const CoreState = {
        map: null,
        markerCluster: null,
        baseMaps: {},
        currentContainerId: 'mapContainer',
        syncWithGlobal: true,
        mapRange: '7D',
        cachedRawRecords: [],
        activeRecords: [],
        currentAdapter: null,
        onFilterChangeCallback: null
    };

    /**
     * Extrai a data no formato DD/MM/YYYY de qualquer formato comum nos dados da Usina
     */
    function extractRecordDate(r) {
        if (!r) return '';
        if (r.dataBR) return String(r.dataBR).trim();
        if (r.data_dia) return String(r.data_dia).trim();
        if (r.dataStr) return String(r.dataStr).split(' ')[0].trim();
        if (r.dataHoraBR) return String(r.dataHoraBR).split(' ')[0].trim();
        if (r.Data) {
            const m = String(r.Data).match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
            if (m) return m[1];
        }
        if (r.data) {
            const m = String(r.data).match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
            if (m) return m[1];
        }
        return '';
    }

    /**
     * Filtra registros por dias operacionais distintos em modo autônomo (7D, 15D, ALL)
     */
    function filterRecordsByRange(records, range) {
        if (!records || !records.length || !range || range === 'ALL') {
            return records || [];
        }

        const daysSet = new Set();
        records.forEach(r => {
            const d = extractRecordDate(r);
            if (d) daysSet.add(d);
        });

        if (daysSet.size === 0) return records;

        const sortedDays = Array.from(daysSet).sort((a, b) => {
            const pA = a.split('/');
            const pB = b.split('/');
            if (pA.length === 3 && pB.length === 3) {
                return new Date(pA[2], pA[1] - 1, pA[0]) - new Date(pB[2], pB[1] - 1, pB[0]);
            }
            return a.localeCompare(b);
        });

        const count = range === '7D' ? 7 : (range === '15D' ? 15 : sortedDays.length);
        const targetDays = new Set(sortedDays.slice(-count));

        return records.filter(r => {
            const d = extractRecordDate(r);
            return targetDays.has(d);
        });
    }

    /**
     * Inicializa a instância do mapa no container especificado
     */
    function init(options) {
        options = options || {};
        const containerId = options.containerId || 'mapContainer';
        const mapContainer = document.getElementById(containerId);

        if (!mapContainer || typeof L === 'undefined') {
            console.warn('[PitangueirasMapCore] Container não encontrado ou Leaflet indisponível:', containerId);
            return null;
        }

        // Se o mapa já existir no mesmo container, reutiliza
        if (CoreState.map && CoreState.currentContainerId === containerId) {
            setupUIControls(options);
            return CoreState.map;
        }

        // Se existia em outro container, remove com segurança
        if (CoreState.map) {
            try {
                CoreState.map.remove();
            } catch (e) {}
            CoreState.map = null;
        }

        CoreState.currentContainerId = containerId;

        // 1. Camadas de Satélite de Alta Resolução e Vetoriais
        const sateliteGoogle = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            attribution: '© Google Satellite HD',
            maxZoom: 20
        });

        const sateliteEsri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles © Esri',
            maxZoom: 19
        });

        const mapaRuas = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        });

        CoreState.baseMaps = {
            "🛰️ Satélite Google": sateliteGoogle,
            "🌍 Satélite Esri": sateliteEsri,
            "🗺️ Mapa Vetorial": mapaRuas
        };

        // 2. Instanciação do Mapa Leaflet
        const defaultCenter = options.center || [-21.05, -48.33];
        const defaultZoom = options.zoom || 11;

        CoreState.map = L.map(containerId, {
            center: defaultCenter,
            zoom: defaultZoom,
            layers: [sateliteGoogle],
            zoomControl: true,
            attributionControl: true
        });

        L.control.layers(CoreState.baseMaps, null, { position: 'topleft' }).addTo(CoreState.map);

        // 3. Cluster de Marcadores de Alta Performance
        if (typeof L.markerClusterGroup === 'function') {
            CoreState.markerCluster = L.markerClusterGroup({
                chunkedLoading: true,
                maxClusterRadius: 45,
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true
            });
        } else {
            CoreState.markerCluster = L.layerGroup();
        }
        CoreState.map.addLayer(CoreState.markerCluster);

        // 4. Configuração de Controles de Filtro na UI
        setupUIControls(options);

        // 5. Acoplamento transparente com a camada de Shapes da Usina (se disponível)
        if (window.PitangueirasMapShapes && typeof window.PitangueirasMapShapes.init === 'function') {
            window.PitangueirasMapShapes.init(CoreState.map);
        }

        // 6. Sobrescreve com segurança a legenda global para manter sincronia garantida
        window.updateMapTalhoesLegend = function () {
            updateLegendCounters(CoreState.activeRecords, CoreState.currentAdapter);
        };

        console.log('[PitangueirasMapCore] Motor Central de Mapa Inicializado.');
        return CoreState.map;
    }

    /**
     * Atualiza visualmente os botões da interface (Trava e Períodos)
     */
    function updateControlsUI(options) {
        options = options || {};
        const btnMapSync = document.getElementById(options.btnSyncId || 'btnToggleMapSyncFilter');
        const mapSyncIcon = document.getElementById(options.syncIconId || 'mapSyncIcon');
        const mapSyncText = document.getElementById(options.syncTextId || 'mapSyncText');
        const mapButtons = document.querySelectorAll(options.periodButtonsSelector || '.btn-map-filter');

        if (btnMapSync) {
            if (CoreState.syncWithGlobal) {
                btnMapSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm";
                if (mapSyncIcon) mapSyncIcon.innerText = "🔒";
                if (mapSyncText) mapSyncText.innerText = "Filtro Global Ativo";
                btnMapSync.title = "O mapa obedece ao Filtro Principal do topo. Clique para destravar o modo autônomo do mapa.";
            } else {
                btnMapSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-slate-800 text-amber-400 border-amber-500/60 shadow-sm";
                if (mapSyncIcon) mapSyncIcon.innerText = "🔓";
                if (mapSyncText) mapSyncText.innerText = "Filtro Autônomo";
                btnMapSync.title = `Modo autônomo do mapa ativo (${CoreState.mapRange}). Clique para travar novamente com o Filtro Global.`;
            }
        }

        mapButtons.forEach(btn => {
            const range = btn.getAttribute('data-map-range') || '7D';
            if (CoreState.syncWithGlobal) {
                btn.disabled = true;
                btn.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                btn.classList.remove('cursor-pointer');
            } else {
                btn.disabled = false;
                btn.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                btn.classList.add('cursor-pointer');
                if (range === CoreState.mapRange) {
                    btn.className = 'btn-map-filter active px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-white bg-emerald-600 shadow-xs cursor-pointer';
                } else {
                    btn.className = 'btn-map-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-slate-700 dark:text-white hover:text-emerald-500 cursor-pointer';
                }
            }
        });
    }

    /**
     * Vincula listeners dos botões de controle de filtro se presentes no DOM
     */
    function setupUIControls(options) {
        options = options || {};
        const btnMapSync = document.getElementById(options.btnSyncId || 'btnToggleMapSyncFilter');
        const mapButtons = document.querySelectorAll(options.periodButtonsSelector || '.btn-map-filter');

        if (btnMapSync && !btnMapSync._coreBound) {
            btnMapSync._coreBound = true;
            btnMapSync.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                CoreState.syncWithGlobal = !CoreState.syncWithGlobal;
                console.log('[PitangueirasMapCore] Modo de sincronização:', CoreState.syncWithGlobal ? 'GLOBAL (🔒)' : 'AUTÔNOMO (🔓)');
                updateControlsUI(options);
                renderCachedData();
                if (typeof CoreState.onFilterChangeCallback === 'function') {
                    CoreState.onFilterChangeCallback(CoreState.syncWithGlobal, CoreState.mapRange);
                }
            });
        }

        mapButtons.forEach(btn => {
            if (!btn._coreBound) {
                btn._coreBound = true;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (CoreState.syncWithGlobal) return;
                    const selectedRange = btn.getAttribute('data-map-range') || '7D';
                    CoreState.mapRange = selectedRange;
                    console.log('[PitangueirasMapCore] Período autônomo selecionado:', selectedRange);
                    updateControlsUI(options);
                    renderCachedData();
                    if (typeof CoreState.onFilterChangeCallback === 'function') {
                        CoreState.onFilterChangeCallback(CoreState.syncWithGlobal, CoreState.mapRange);
                    }
                });
            }
        });

        updateControlsUI(options);
    }

    /**
     * Renderiza dados armazenados no cache interno quando os controles mudam
     */
    function renderCachedData() {
        if (!CoreState.currentAdapter || !CoreState.cachedRawRecords) return;
        render(CoreState.cachedRawRecords, CoreState.currentAdapter);
    }

    /**
     * Função Principal de Injeção de Dados (Renderização Plug & Play)
     */
    function render(records, adapter) {
        if (!CoreState.map || !CoreState.markerCluster) {
            console.warn('[PitangueirasMapCore] Mapa não está inicializado para renderização.');
            return;
        }

        CoreState.cachedRawRecords = records || [];
        CoreState.currentAdapter = adapter || CoreState.currentAdapter;

        // Limpa marcadores anteriores
        CoreState.markerCluster.clearLayers();

        // 1. Aplica filtro de período (Global vs Autônomo)
        const activeRecords = CoreState.syncWithGlobal
            ? (records || [])
            : filterRecordsByRange(records || [], CoreState.mapRange);

        CoreState.activeRecords = activeRecords;
        console.log(`[PitangueirasMapCore] Renderizando ${activeRecords.length} registros (Modo: ${CoreState.syncWithGlobal ? 'GLOBAL' : 'AUTÔNOMO ' + CoreState.mapRange})`);

        // 2. Filtra pontos com coordenadas GPS válidas
        const validCoords = activeRecords.filter(r => {
            const lat = Number(r.lat !== undefined ? r.lat : r.latitude);
            const lng = Number(r.lng !== undefined ? r.lng : r.longitude);
            return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
        });

        const bounds = [];

        // 3. Plota os marcadores de acordo com o adapter de cada relatório
        validCoords.forEach(r => {
            const pointData = (typeof adapter.mapPoint === 'function')
                ? adapter.mapPoint(r)
                : defaultPointAdapter(r);

            if (!pointData) return;

            const lat = pointData.lat;
            const lng = pointData.lng;
            const markerColor = pointData.color || '#10b981';

            const marker = L.circleMarker([lat, lng], {
                radius: pointData.radius || 7,
                fillColor: markerColor,
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.85
            });

            // Popup padronizado de alta resolução executiva (Regra: Branco no Escuro, Preto no Claro, ZERO cinza)
            const popupHtml = `
                <div class="p-1 font-sans text-xs">
                    <div class="font-bold text-sm text-black dark:text-white">${pointData.title || ''}</div>
                    <div class="text-black dark:text-white mt-0.5">${pointData.subtitle || ''}</div>
                    ${pointData.local ? `<div class="text-black dark:text-white">Local: <strong>${pointData.local}</strong></div>` : ''}
                    ${pointData.responsavel ? `<div class="text-black dark:text-white">Responsável: ${pointData.responsavel}</div>` : ''}
                    ${pointData.metricHtml ? pointData.metricHtml : (pointData.metricText ? `
                        <div class="mt-1 pt-1 border-t text-sm font-bold font-mono" style="color: ${markerColor}; border-color: rgba(255,255,255,0.25);">
                            ${pointData.metricText}
                        </div>
                    ` : '')}
                    ${pointData.actionButtonHtml ? pointData.actionButtonHtml : (pointData.detailsId ? `
                        <button onclick="${pointData.onDetailsClick || `window.openReportDetailsModal('${pointData.detailsId}')`}"
                                class="mt-2 w-full py-1 bg-slate-900 dark:bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px] transition-colors shadow-sm">
                            Ver Raio-X Completo
                        </button>
                    ` : '')}
                </div>
            `;

            marker.bindPopup(popupHtml);
            CoreState.markerCluster.addLayer(marker);
            bounds.push([lat, lng]);
        });

        // 4. Ajuste automático dos limites do mapa (FitBounds)
        if (bounds.length > 0) {
            CoreState.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
        }

        // 5. Notifica camada universal de shapes e cruzamento de talhões
        if (window.PitangueirasMapShapes && typeof window.PitangueirasMapShapes.filterByRecords === 'function') {
            window.PitangueirasMapShapes.filterByRecords(CoreState.map, activeRecords);
        } else if (window.MapShapes && typeof window.MapShapes.syncWithDashboard === 'function') {
            window.MapShapes.syncWithDashboard(CoreState.map);
        }

        // 6. Atualiza semáforo da legenda de talhões
        updateLegendCounters(activeRecords, adapter);
    }

    /**
     * Adapter padrão fallback para registros caso o relatório não passe um customizado
     */
    function defaultPointAdapter(r) {
        const lat = Number(r.lat !== undefined ? r.lat : r.latitude);
        const lng = Number(r.lng !== undefined ? r.lng : r.longitude);
        return {
            lat: lat,
            lng: lng,
            color: '#10b981',
            title: `${r.frente || ''} • OS ${r.os || ''}`,
            subtitle: `ID: ${r.id || ''} • ${r.dataHoraBR || r.data || ''}`,
            local: r.local || r['Local (Fazenda - Talhão)'] || '',
            responsavel: r.responsavel || r['Responsável'] || '',
            metricText: `Medição registrada`,
            detailsId: r.id
        };
    }

    /**
     * Atualiza contadores de semáforo da legenda do mapa com os registros ativos
     */
    function updateLegendCounters(records, adapter) {
        const countBomEl = document.getElementById('mapCountBom');
        const countMedioEl = document.getElementById('mapCountMedio');
        const countRuimEl = document.getElementById('mapCountRuim');

        if (!countBomEl && !countMedioEl && !countRuimEl) return;

        let bom = 0, medio = 0, ruim = 0;

        let matchedMap = null;
        if (window.MapShapes && typeof window.MapShapes.matchRecordsToShapes === 'function') {
            matchedMap = window.MapShapes.matchRecordsToShapes(records);
        } else if (window.PitangueirasMapShapes && typeof window.PitangueirasMapShapes.matchRecordsToShapes === 'function') {
            matchedMap = window.PitangueirasMapShapes.matchRecordsToShapes(records);
        }

        if (matchedMap) {
            matchedMap.forEach(info => {
                if (info.status === 'verde' || info.status === 'bom') bom++;
                else if (info.status === 'amarelo' || info.status === 'medio') medio++;
                else if (info.status === 'vermelho' || info.status === 'ruim') ruim++;
            });
        } else if (adapter && typeof adapter.classifyStatus === 'function') {
            records.forEach(r => {
                const s = adapter.classifyStatus(r);
                if (s === 'verde' || s === 'bom') bom++;
                else if (s === 'amarelo' || s === 'medio') medio++;
                else if (s === 'vermelho' || s === 'ruim') ruim++;
            });
        }

        if (countBomEl) countBomEl.innerText = bom;
        if (countMedioEl) countMedioEl.innerText = medio;
        if (countRuimEl) countRuimEl.innerText = ruim;
    }

    // API Pública do Motor Central
    window.PitangueirasMapCore = {
        init: init,
        render: render,
        getMap: function () { return CoreState.map; },
        getCluster: function () { return CoreState.markerCluster; },
        getActiveRecords: function () { return CoreState.activeRecords; },
        setFilterChangeCallback: function (fn) { CoreState.onFilterChangeCallback = fn; },
        updateUI: function () { updateControlsUI(); },
        getState: function () {
            return {
                syncWithGlobal: CoreState.syncWithGlobal,
                mapRange: CoreState.mapRange,
                containerId: CoreState.currentContainerId,
                totalActive: CoreState.activeRecords.length
            };
        }
    };

})(window, document);
