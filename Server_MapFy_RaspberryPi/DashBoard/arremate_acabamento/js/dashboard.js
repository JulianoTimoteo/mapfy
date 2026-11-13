// ==========================================================================
// Plugin Universal de Rótulos de Dados (Garante valores visíveis em barras e donuts sob qualquer condição)
// Usina Pitangueiras - Safra 2026
// ==========================================================================
(function() {
    function registerPlugin() {
        if (typeof Chart === 'undefined' || !Chart.register) return;
        const universalDataLabelsPlugin = {
            id: 'pitangueiras_universal_datalabels',
            beforeDraw(chart) {
                chart._centerTotalDrawn = false;
            },
            afterDatasetsDraw(chart) {
                const chartType = chart.config.type;
                if (chartType !== 'bar' && chartType !== 'doughnut' && chartType !== 'pie') return;

                const ctx = chart.ctx;
                const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark-theme');
                const defaultTextColor = isDark ? '#F1F5F9' : '#1E293B';
                const chartArea = chart.chartArea || { top: 0, bottom: chart.height, left: 0, right: chart.width };

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

                        if (chartType === 'pie') { // Em Doughnut, valores ficam no centro e não abaixo na fatia
                            const pos = element.tooltipPosition ? element.tooltipPosition() : null;
                            if (pos) {
                                ctx.fillStyle = '#FFFFFF';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                                ctx.shadowBlur = 4;
                                ctx.fillText(String(rawVal), pos.x, pos.y);
                            }
                        } else if (chartType === 'bar' && chart.options && chart.options.indexAxis === 'y') {
                            const fitsOutside = (element.x + 28 <= chartArea.right);
                            if (fitsOutside) {
                                ctx.fillStyle = defaultTextColor;
                                ctx.textAlign = 'left';
                                ctx.textBaseline = 'middle';
                                ctx.fillText(String(rawVal), element.x + 6, element.y);
                            } else {
                                ctx.fillStyle = '#FFFFFF';
                                ctx.textAlign = 'right';
                                ctx.textBaseline = 'middle';
                                ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                                ctx.shadowBlur = 3;
                                ctx.fillText(String(rawVal), element.x - 6, element.y);
                            }
                        } else if (chartType === 'bar') {
                            const fitsOutside = (element.y - 14 >= chartArea.top);
                            if (fitsOutside) {
                                ctx.fillStyle = defaultTextColor;
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'bottom';
                                ctx.fillText(String(rawVal), element.x, element.y - 3);
                            } else {
                                ctx.fillStyle = '#FFFFFF';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'top';
                                ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                                ctx.shadowBlur = 3;
                                ctx.fillText(String(rawVal), element.x, element.y + 4);
                            }
                        }
                        ctx.restore();
                    });
                });

                // Totalizador no Centro de Gráficos Doughnut
                if (chartType === 'doughnut') {
                    const pluginsList = chart.config?.plugins || [];
                    const hasCustomCenter = pluginsList.some(p => p && (p.id === 'centerText' || p.id === 'donutCenterText' || (typeof p.id === 'string' && p.id.toLowerCase().includes('center'))));
                    if (hasCustomCenter || chart.options?.plugins?.centerTotal === false || chart.options?.centerTotal === false) return;
                    if (chart._centerTotalDrawn) return;

                    const parent = chart.canvas ? chart.canvas.parentElement : null;
                    const hasHtmlCenter = parent && parent.querySelector('#donutCenterPerc, [id*="CenterPerc"], [id*="centerPerc"], [id*="donutCenter"]');
                    if (!hasHtmlCenter && chart.chartArea) {
                        chart._centerTotalDrawn = true;
                        let totalSum = 0;
                        chart.data.datasets.forEach(ds => {
                            if (Array.isArray(ds.data)) {
                                ds.data.forEach(v => {
                                    const n = typeof v === 'number' ? v : parseFloat(v);
                                    if (!isNaN(n) && isFinite(n)) totalSum += n;
                                });
                            }
                        });

                        if (totalSum > 0) {
                            const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                            const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

                            const meta = chart.getDatasetMeta(0);
                            let innerRadius = meta && meta.controller ? meta.controller.innerRadius : 40;
                            if (!innerRadius || innerRadius <= 0) innerRadius = 45;

                            ctx.save();
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';

                            const fontSizeNum = Math.max(16, Math.round(innerRadius * 0.44));
                            const fontSizeLabel = Math.max(9, Math.round(innerRadius * 0.20));

                            // Valor Somado
                            ctx.font = `bold ${fontSizeNum}px 'JetBrains Mono', 'Plus Jakarta Sans', sans-serif`;
                            ctx.fillStyle = defaultTextColor;
                            ctx.shadowColor = 'transparent';
                            ctx.fillText(Number.isInteger(totalSum) ? totalSum.toLocaleString('pt-BR') : totalSum.toFixed(1), centerX, centerY - (fontSizeLabel * 0.55));

                            // Rótulo "TOTAL"
                            ctx.font = `600 ${fontSizeLabel}px 'Plus Jakarta Sans', sans-serif`;
                            ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
                            ctx.fillText('TOTAL', centerX, centerY + (fontSizeNum * 0.55));

                            ctx.restore();
                        }
                    }
                }

            }
        };
        try {
            Chart.register(universalDataLabelsPlugin);
        } catch(e) {}
    }
    if (typeof Chart !== 'undefined' && Chart.register) {
        registerPlugin();
    } else {
        document.addEventListener('DOMContentLoaded', registerPlugin);
    }
})();

/**
 * dashboard.js - Controlador do Dashboard de Arremate e Acabamento
 * Usina Pitangueiras - Safra 2026
 */

(function () {
    'use strict';

    // Estado Global da Aplicação
    const state = {
        evolutionRange: '7D',
        syncWithGlobalFilter: true,
        mapSyncWithGlobal: true,
        mapRange: '7D',
        filters: {
            dateExact: '', // Inicializado na data mais recente disponível
            dateStart: '',
            dateEnd: '',
            frente: 'all',
            os: 'all',
            local: 'all',
            responsavel: 'all',
            faseScore: 'all',
            status: 'all',
            onlyCoords: false,
            searchQuery: ''
        },
        pagination: {
            currentPage: 1,
            pageSize: 15
        },
        sort: {
            column: 'data',
            direction: 'desc'
        },
        timePeriodMode: 'diario',       // 'diario', 'semanal', 'mensal'
        timeMetricMode: 'conformidade', // 'conformidade', 'volume', 'score'
        charts: {},
        map: null,
        markersLayer: null,
        theme: 'light'
    };
    window.dashboardState = state;
    window.state = state;

    /**
     * Inicialização do Sistema
     */
    function _bootstrapApp() {
        initTheme();
        initData();
        initMap();
        initFilterDropdowns();
        initEventListeners();
        applyFilters();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _bootstrapApp);
    } else {
        _bootstrapApp();
    }

    /**
     * Gerenciamento de Tema (Claro / Escuro)
     */
    function initTheme() {
        const savedTheme = localStorage.getItem('pitangueiras_theme') || 'light';
        setTheme(savedTheme);

        const toggleBtn = document.getElementById('themeToggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const nextTheme = state.theme === 'light' ? 'dark' : 'light';
                setTheme(nextTheme);
                updateChartsTheme();
            });
        }
    }

    function setTheme(theme) {
        state.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('pitangueiras_theme', theme);
        const toggleBtn = document.getElementById('themeToggleBtn');
        if (toggleBtn) {
            toggleBtn.textContent = theme === 'light' ? '🌙' : '☀️';
        }
    }

    function getThemeColors() {
        const isDark = state.theme === 'dark';
        return {
            textPrimary: isDark ? '#f8fafc' : '#0f172a',
            textSecondary: isDark ? '#cbd5e1' : '#475569',
            gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            primary: '#0d9488',
            bom: '#10b981',
            divergente: '#d97706',
            info: '#0284c7'
        };
    }

    /**
     * Carregamento dos Dados
     */
    function initData() {
        if (window.ARREMATE_DATA && Array.isArray(window.ARREMATE_DATA)) {
            state.rawData = window.ARREMATE_DATA.map(r => {
                return (window.ArremateEngine && typeof window.ArremateEngine.normalizeRecord === 'function')
                    ? window.ArremateEngine.normalizeRecord(r)
                    : r;
            });
        } else {
            state.rawData = [];
            console.warn('Dataset ARREMATE_DATA não encontrado.');
        }
    }

    /**
     * Inicialização dos Dropdowns de Filtro
     */
    function initFilterDropdowns() {
        const frentes = new Set();
        const oss = new Set();
        const locais = new Set();
        const resps = new Set();

        state.rawData.forEach(r => {
            if (r.frente) frentes.add(r.frente);
            if (r.os) oss.add(String(r.os));
            if (r.local) locais.add(r.local);
            if (r.responsavel) resps.add(r.responsavel);
        });

        populateSelect('filterFrente', Array.from(frentes).sort());
        populateSelect('filterOS', Array.from(oss).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
        populateSelect('filterLocal', Array.from(locais).sort());
        populateSelect('filterResponsavel', Array.from(resps).sort());
    }

    function populateSelect(elemId, items) {
        const select = document.getElementById(elemId);
        if (!select) return;
        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            select.appendChild(opt);
        });
    }

    /**
     * Inicialização do Mapa Geográfico (100% OpenStreetMap)
     */
    function initMap() {
        const mapContainer = document.getElementById('mapContainer') || document.getElementById('map-container');
        if (!mapContainer || typeof L === 'undefined') return;

        const sateliteGoogle = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            attribution: '© Google Satellite',
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

        state.map = L.map(mapContainer, {
            center: [-20.88, -48.45],
            zoom: 11,
            zoomControl: true,
            layers: [sateliteGoogle]
        });

        const baseMaps = {
            "🛰️ Satélite Google": sateliteGoogle,
            "🌍 Satélite Esri": sateliteEsri,
            "🗺️ Mapa Vetorial": mapaRuas
        };
        L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(state.map);

        state.markersLayer = L.layerGroup().addTo(state.map);
    }

    /**
     * Atualização dos Marcadores no Mapa
     */
    function updateMap(records) {
        if (!state.map || !state.markersLayer) return;

        state.markersLayer.clearLayers();
        const validPoints = records.filter(r => r.has_coords && r.lat && r.lon);

        if (validPoints.length === 0) return;

        const bounds = [];

        validPoints.forEach(r => {
            const color = r.score_num >= 10.0 ? '#10b981' : '#059669';

            const marker = L.circleMarker([r.lat, r.lon], {
                radius: 6,
                fillColor: color,
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.88
            });

            const popupContent = `
                <div class="popup-header" style="color: ${color}">
                    <span>✅</span>
                    <span>Avaliação #${r.id} • ${r.arremate_orig}</span>
                </div>
                <div class="popup-row"><strong>Data:</strong> ${r.data}</div>
                <div class="popup-row"><strong>Frente:</strong> ${r.frente}</div>
                <div class="popup-row"><strong>OS:</strong> ${r.os} | <strong>Local:</strong> ${r.local}</div>
                <div class="popup-row"><strong>Resp:</strong> ${r.responsavel}</div>
                <div class="popup-row"><strong>Score MapFy:</strong> <span style="font-weight: 700; color: ${color};">${r.score} (${r.score_desc})</span> • <em>${r.fase_score}</em></div>
                <div style="margin-top: 0.5rem; text-align: right;">
                    <a href="javascript:void(0)" onclick="window.viewDetails(${r.id})" style="color: #0d9488; font-weight: 600; text-decoration: underline;">Ver Detalhes Completos</a>
                </div>
            `;

            marker.bindPopup(popupContent);
            marker.addTo(state.markersLayer);
            bounds.push([r.lat, r.lon]);
        });

        if (bounds.length > 0) {
            state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
        }
    }

    /**
     * Aplicação dos Filtros Reativos
     */
    
    /**
     * Função Utilitária para Recorte por Dias Distintos em Modo Autônomo
     */
    function getRecordsForDateRange(records, range) {
        if (!range || range === 'ALL' || !records || records.length === 0) return records;
        const daysSet = new Set();
        records.forEach(r => {
            const d = r.dataBR || r.data_dia || (r.dataStr ? r.dataStr.split(' ')[0] : '') || (r.data ? String(r.data).split(' ')[0] : '');
            if (d && d.includes('/')) daysSet.add(d);
        });

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
            const d = r.dataBR || r.data_dia || (r.dataStr ? r.dataStr.split(' ')[0] : '') || (r.data ? String(r.data).split(' ')[0] : '');
            return targetDays.has(d);
        });
    }

    function initEvolutionFilter() {
        const btnSync = document.getElementById('btnSyncGlobalFilter');
        const syncIcon = document.getElementById('syncIcon');
        const syncText = document.getElementById('syncText');
        const evoButtons = document.querySelectorAll('.btn-evo-filter');

        function updateEvoControlsUI() {
            if (btnSync) {
                if (state.syncWithGlobalFilter) {
                    btnSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm";
                    if (syncIcon) syncIcon.innerText = "🔒";
                    if (syncText) syncText.innerText = "Filtro Global Ativo";
                    btnSync.title = "Os gráficos analíticos obedecem ao Filtro Principal do topo. Clique para destravar o modo autônomo.";
                } else {
                    btnSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white border-slate-300 dark:border-slate-700 hover:border-emerald-500";
                    if (syncIcon) syncIcon.innerText = "🔓";
                    if (syncText) syncText.innerText = "Filtro Autônomo";
                    btnSync.title = `Modo autônomo ativo (${state.evolutionRange}). Clique para travar novamente com o Filtro Global.`;
                }
            }

            evoButtons.forEach(btn => {
                const range = btn.getAttribute('data-evo-range') || '7D';
                if (state.syncWithGlobalFilter) {
                    btn.disabled = true;
                    btn.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                    btn.classList.remove('cursor-pointer');
                } else {
                    btn.disabled = false;
                    btn.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                    btn.classList.add('cursor-pointer');
                    if (range === state.evolutionRange) {
                        btn.classList.add('active', 'bg-emerald-600', 'shadow-xs', 'text-white');
                        btn.classList.remove('text-slate-700', 'hover:text-emerald-500', 'text-[var(--text-secondary)]');
                    } else {
                        btn.classList.remove('active', 'bg-emerald-600', 'shadow-xs', 'text-white');
                        btn.classList.add('text-slate-700', 'dark:text-white', 'hover:text-emerald-500');
                    }
                }
            });
        }

        if (btnSync && !btnSync._listenerAttached) {
            btnSync._listenerAttached = true;
            btnSync.addEventListener('click', () => {
                state.syncWithGlobalFilter = !state.syncWithGlobalFilter;
                updateEvoControlsUI();
                if (typeof applyFilters === 'function') applyFilters();
            });
        }

        evoButtons.forEach(btn => {
            if (!btn._listenerAttached) {
                btn._listenerAttached = true;
                btn.addEventListener('click', () => {
                    if (state.syncWithGlobalFilter) return;
                    state.evolutionRange = btn.getAttribute('data-evo-range') || '7D';
                    updateEvoControlsUI();
                    if (typeof applyFilters === 'function') applyFilters();
                });
            }
        });

        updateEvoControlsUI();
    }

    function initMapFilter() {
        const btnMapSync = document.getElementById('btnToggleMapSyncFilter');
        const mapSyncIcon = document.getElementById('mapSyncIcon');
        const mapSyncText = document.getElementById('mapSyncText');
        const mapButtons = document.querySelectorAll('.btn-map-filter');

        function updateMapControlsUI() {
            if (btnMapSync) {
                if (state.mapSyncWithGlobal) {
                    btnMapSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm";
                    if (mapSyncIcon) mapSyncIcon.innerText = "🔒";
                    if (mapSyncText) mapSyncText.innerText = "Filtro Global Ativo";
                    btnMapSync.title = "O mapa obedece ao Filtro Principal do topo. Clique para destravar o modo autônomo do mapa.";
                } else {
                    btnMapSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white border-slate-300 dark:border-slate-700 hover:border-emerald-500";
                    if (mapSyncIcon) mapSyncIcon.innerText = "🔓";
                    if (mapSyncText) mapSyncText.innerText = "Filtro Autônomo";
                    btnMapSync.title = `Modo autônomo do mapa ativo (${state.mapRange}). Clique para travar novamente com o Filtro Global.`;
                }
            }

            mapButtons.forEach(btn => {
                const range = btn.getAttribute('data-map-range') || '7D';
                if (state.mapSyncWithGlobal) {
                    btn.disabled = true;
                    btn.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                    btn.classList.remove('cursor-pointer');
                } else {
                    btn.disabled = false;
                    btn.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                    btn.classList.add('cursor-pointer');
                    if (range === state.mapRange) {
                        btn.classList.add('active', 'bg-emerald-600', 'shadow-xs', 'text-white');
                        btn.classList.remove('text-slate-700', 'hover:text-emerald-500', 'text-[var(--text-secondary)]');
                    } else {
                        btn.classList.remove('active', 'bg-emerald-600', 'shadow-xs', 'text-white');
                        btn.classList.add('text-slate-700', 'dark:text-white', 'hover:text-emerald-500');
                    }
                }
            });
        }

        if (btnMapSync && !btnMapSync._listenerAttached) {
            btnMapSync._listenerAttached = true;
            btnMapSync.addEventListener('click', () => {
                state.mapSyncWithGlobal = !state.mapSyncWithGlobal;
                updateMapControlsUI();
                (() => { const mapRecords = state.mapSyncWithGlobal ? state.filteredData : getRecordsForDateRange(state.filteredData, state.mapRange); updateMap(mapRecords); })();
            });
        }

        mapButtons.forEach(btn => {
            if (!btn._listenerAttached) {
                btn._listenerAttached = true;
                btn.addEventListener('click', () => {
                    if (state.mapSyncWithGlobal) return;
                    state.mapRange = btn.getAttribute('data-map-range') || '7D';
                    updateMapControlsUI();
                    (() => { const mapRecords = state.mapSyncWithGlobal ? state.filteredData : getRecordsForDateRange(state.filteredData, state.mapRange); updateMap(mapRecords); })();
                });
            }
        });

        updateMapControlsUI();
    }

    function applyFilters() {
        state.filteredData = ArremateEngine.filterRecords(state.rawData, state.filters);
        state.pagination.currentPage = 1;

        updateKPIs();
        updateCharts();
        const mapRecords = state.mapSyncWithGlobal
            ? state.filteredData
            : getRecordsForDateRange(state.filteredData, state.mapRange);
        updateMap(mapRecords);
        updateTable();
    }

    /**
     * Atualização dos Cards de KPIs
     */
    function updateKPIs() {
        const metrics = ArremateEngine.calculateMetrics(state.filteredData);

        setText('kpiTotalRegistros', metrics.totalRecords.toLocaleString('pt-BR'));
        setText('kpiPeriodoAmostral', state.filters.dateExact ? `Data: ${state.filters.dateExact}` : 'Histórico Selecionado');

        setText('kpiBomCount', metrics.bomCount.toLocaleString('pt-BR'));
        setText('kpiConformidadePerc', `${metrics.conformidadePerc}%`);
        setText('kpiOutrasCount', metrics.outrasCount.toLocaleString('pt-BR'));

        setText('kpiScoreMedia', ArremateEngine.formatNumberBR(metrics.scoreMedia, 2));
        setText('kpiScorePercMedia', `${ArremateEngine.formatNumberBR(metrics.scorePercMedia, 1)}%`);

        setText('kpiFrentesCount', metrics.uniqueFrentes.toLocaleString('pt-BR'));
        setText('kpiTalhoesOS', `${metrics.uniqueLocais} / ${metrics.uniqueOS}`);
        setText('kpiResponsaveisCount', `${metrics.uniqueResponsaveis} responsáveis`);

        setText('kpiScoreDivergente', `${metrics.scoreDivergenteCount.toLocaleString('pt-BR')} reg.`);

        setText('kpiGeorrefPerc', `${metrics.georefPerc.toFixed(1)}%`);
        setText('kpiGeorrefCount', `${metrics.georefCount} / ${metrics.totalRecords} pontos`);
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    /**
     * Renderização e Atualização dos Gráficos
     */
    function updateCharts(customRecords) {
        const recordsToUse = customRecords || (state.syncWithGlobalFilter
            ? state.filteredData
            : getRecordsForDateRange(state.filteredData, state.evolutionRange));
        renderConformidadeDonut();
        renderClassificacaoBars();
        renderTimelineChart();
        renderFrentesChart();
        renderOSChart();
        renderLocaisChart();
        renderResponsaveisChart();
        renderHourlyChart();
        renderScorePhaseChart();
    }

    function updateChartsTheme() {
        updateCharts();
    }

    /**
     * Gráfico A: Rosca de Conformidade (Donut)
     */
    function renderConformidadeDonut() {
        const ctx = document.getElementById('chartConformidadeDonut');
        if (!ctx) return;

        const metrics = ArremateEngine.calculateMetrics(state.filteredData);
        const colors = getThemeColors();

        if (state.charts.donut) state.charts.donut.destroy();

        const labels = ['BOM', 'Outras Classificações'];
        const data = [metrics.bomCount, metrics.outrasCount];
        const bgColors = ['#10b981', '#3b82f6'];

        state.charts.donut = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: bgColors,
                    borderWidth: 2,
                    borderColor: state.theme === 'dark' ? '#131b2e' : '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                    centerTotal: false,
                    legend: {
                        position: 'bottom',
                        labels: { color: colors.textPrimary, font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const total = metrics.totalRecords;
                                const perc = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                return ` ${context.label}: ${context.parsed} avaliações (${perc}%)`;
                            }
                        }
                    }
                }
            },
            plugins: [{
                id: 'centerText',
                beforeDraw: function (chart) {
                    const width = chart.width;
                    const height = chart.height;
                    const ctx = chart.ctx;
                    ctx.restore();
                    ctx.font = 'bold 1.7rem Inter, sans-serif';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = colors.textPrimary;
                    const text = `${metrics.conformidadePerc}%`;
                    const textX = Math.round((width - ctx.measureText(text).width) / 2);
                    const textY = height / 2 - 10;
                    ctx.fillText(text, textX, textY);

                    ctx.font = '500 0.75rem Inter, sans-serif';
                    ctx.fillStyle = colors.textSecondary;
                    const subText = 'CONFORME (BOM)';
                    const subX = Math.round((width - ctx.measureText(subText).width) / 2);
                    ctx.fillText(subText, subX, textY + 24);
                    ctx.save();
                }
            }]
        });
    }

    /**
     * Gráfico B: Barras de Avaliações por Classificação
     */
    function renderClassificacaoBars() {
        const ctx = document.getElementById('chartClassificacaoBars');
        if (!ctx) return;

        const dist = ArremateEngine.calculateClassificacaoDistribution(state.filteredData);
        const colors = getThemeColors();

        if (state.charts.bars) state.charts.bars.destroy();

        state.charts.bars = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dist.items.map(i => i.categoria),
                datasets: [{
                    label: 'Quantidade de Avaliações',
                    data: dist.items.map(i => i.count),
                    backgroundColor: dist.items.map(i => i.color),
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            afterLabel: function (context) {
                                const item = dist.items[context.dataIndex];
                                return `Participação: ${item.perc}% do total`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: colors.textSecondary },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { color: colors.textSecondary },
                        grid: { color: colors.gridColor }
                    }
                }
            }
        });
    }

    /**
     * Gráfico C: Evolução Temporal da Qualidade Operacional
     */
    function renderTimelineChart() {
        const ctx = document.getElementById('chartTimeline');
        if (!ctx) return;

        const timeline = ArremateEngine.calculateTemporalEvolution(state.filteredData, state.timePeriodMode);
        const colors = getThemeColors();

        let datasetLabel = '% Conformidade (BOM)';
        let datasetData = timeline.map(t => t.conformidadePerc);
        let lineColor = colors.bom;

        if (state.timeMetricMode === 'volume') {
            datasetLabel = 'Volume de Avaliações';
            datasetData = timeline.map(t => t.count);
            lineColor = colors.primary;
        } else if (state.timeMetricMode === 'score') {
            datasetLabel = 'Score Médio MapFy';
            datasetData = timeline.map(t => t.scoreMedia);
            lineColor = colors.info;
        }

        if (state.charts.timeline) state.charts.timeline.destroy();

        state.charts.timeline = new Chart(ctx, {
            type: state.timeMetricMode === 'volume' ? 'bar' : 'line',
            data: {
                labels: timeline.map(t => t.label),
                datasets: [{
                    label: datasetLabel,
                    data: datasetData,
                    borderColor: lineColor,
                    backgroundColor: state.timeMetricMode === 'volume' ? lineColor : 'transparent',
                    borderWidth: 2.5,
                    pointRadius: timeline.length > 30 ? 2 : 4,
                    pointHoverRadius: 6,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, labels: { color: colors.textPrimary } }
                },
                scales: {
                    x: {
                        ticks: { color: colors.textSecondary, maxTicksLimit: 14 },
                        grid: { display: false }
                    },
                    y: {
                        ticks: {
                            color: colors.textSecondary,
                            callback: function (val) {
                                if (state.timeMetricMode === 'conformidade') return `${val}%`;
                                return val;
                            }
                        },
                        grid: { color: colors.gridColor }
                    }
                }
            }
        });
    }

    /**
     * Gráfico D: Qualidade por Frente
     */
    function renderFrentesChart() {
        const ctx = document.getElementById('chartFrentes');
        if (!ctx) return;

        const frentes = ArremateEngine.calculateFrentesBreakdown(state.filteredData);
        const colors = getThemeColors();

        if (state.charts.frentes) state.charts.frentes.destroy();

        state.charts.frentes = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: frentes.map(f => f.frente),
                datasets: [
                    {
                        label: 'Avaliações BOM',
                        data: frentes.map(f => f.bomCount),
                        backgroundColor: '#10b981',
                        yAxisID: 'y'
                    },
                    {
                        label: 'Total de Avaliações',
                        data: frentes.map(f => f.count),
                        backgroundColor: 'rgba(148, 163, 184, 0.4)',
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: {
                            color: colors.textSecondary,
                            maxRotation: 45,
                            minRotation: 20,
                            font: { size: 10 }
                        },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { color: colors.textSecondary },
                        grid: { color: colors.gridColor }
                    }
                }
            }
        });
    }

    /**
     * Gráfico E: Top 15 OSs
     */
    function renderOSChart() {
        const ctx = document.getElementById('chartOS');
        if (!ctx) return;

        const topOS = ArremateEngine.calculateOSBreakdown(state.filteredData, 15);
        const colors = getThemeColors();

        if (state.charts.os) state.charts.os.destroy();

        state.charts.os = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topOS.map(o => `OS ${o.os}`),
                datasets: [{
                    label: 'Avaliações BOM',
                    data: topOS.map(o => o.bomCount),
                    backgroundColor: '#0d9488',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            afterLabel: function (context) {
                                const item = topOS[context.dataIndex];
                                return `Frente: ${item.frente} | Total: ${item.count}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: colors.textSecondary },
                        grid: { color: colors.gridColor }
                    },
                    y: {
                        ticks: { color: colors.textSecondary, font: { size: 10 } },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    /**
     * Gráfico F: Top 15 Locais / Talhões
     */
    function renderLocaisChart() {
        const ctx = document.getElementById('chartLocais');
        if (!ctx) return;

        const topLocais = ArremateEngine.calculateLocaisBreakdown(state.filteredData, 15);
        const colors = getThemeColors();

        if (state.charts.locais) state.charts.locais.destroy();

        state.charts.locais = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topLocais.map(l => l.local),
                datasets: [{
                    label: 'Avaliações Realizadas',
                    data: topLocais.map(l => l.count),
                    backgroundColor: '#0284c7',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            afterLabel: function (context) {
                                const item = topLocais[context.dataIndex];
                                return `Última Avaliação: ${item.latestDate} | Frente: ${item.frente}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: colors.textSecondary },
                        grid: { color: colors.gridColor }
                    },
                    y: {
                        ticks: { color: colors.textSecondary, font: { size: 10 } },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    /**
     * Gráfico G: Acompanhamento de Responsáveis
     */
    function renderResponsaveisChart() {
        const ctx = document.getElementById('chartResponsaveis');
        if (!ctx) return;

        const resps = ArremateEngine.calculateResponsaveisBreakdown(state.filteredData, 12);
        const colors = getThemeColors();

        if (state.charts.responsaveis) state.charts.responsaveis.destroy();

        state.charts.responsaveis = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: resps.map(r => r.responsavel.length > 25 ? r.responsavel.slice(0, 22) + '...' : r.responsavel),
                datasets: [{
                    label: 'Avaliações Realizadas',
                    data: resps.map(r => r.count),
                    backgroundColor: '#8b5cf6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            afterLabel: function (context) {
                                const item = resps[context.dataIndex];
                                return `Conformidade: ${item.conformidadePerc}% | Frentes: ${item.frentes}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: colors.textSecondary,
                            maxRotation: 45,
                            minRotation: 25,
                            font: { size: 9 }
                        },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { color: colors.textSecondary },
                        grid: { color: colors.gridColor }
                    }
                }
            }
        });
    }

    /**
     * Gráfico H: Ritmo Horário
     */
    function renderHourlyChart() {
        const ctx = document.getElementById('chartHourly');
        if (!ctx) return;

        const hourly = ArremateEngine.calculateHourlyDistribution(state.filteredData);
        const colors = getThemeColors();

        if (state.charts.hourly) state.charts.hourly.destroy();

        state.charts.hourly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hourly.map(h => h.hour),
                datasets: [{
                    label: 'Avaliações Realizadas',
                    data: hourly.map(h => h.count),
                    backgroundColor: '#0d9488',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        ticks: { color: colors.textSecondary },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { color: colors.textSecondary },
                        grid: { color: colors.gridColor }
                    }
                }
            }
        });
    }

    /**
     * Gráfico I: Inteligência do Score MapFy
     */
    function renderScorePhaseChart() {
        const ctx = document.getElementById('chartScorePhase');
        if (!ctx) return;

        const phase = ArremateEngine.calculateScorePhaseDistribution(state.filteredData);
        const colors = getThemeColors();

        if (state.charts.scorePhase) state.charts.scorePhase.destroy();

        state.charts.scorePhase = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [
                    `Score Ativo: 10,00 (Ago-Out)`,
                    `Score Pré-Ativação: 0,00 (Jan-Mai)`
                ],
                datasets: [{
                    data: [phase.ativoCount, phase.preCount],
                    backgroundColor: ['#10b981', '#f59e0b'],
                    borderWidth: 2,
                    borderColor: state.theme === 'dark' ? '#131b2e' : '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: colors.textPrimary, font: { size: 10 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const total = phase.ativoCount + phase.preCount;
                                const perc = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                return ` ${context.label}: ${context.parsed} reg. (${perc}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Tabela Analítica e Paginação
     */
    function updateTable() {
        const tbody = document.getElementById('tableBody');
        const info = document.getElementById('tableInfo');
        const pagination = document.getElementById('paginationControls');
        if (!tbody) return;

        // Ordenação
        const sorted = [...state.filteredData].sort((a, b) => {
            const col = state.sort.column;
            let valA = a[col];
            let valB = b[col];

            if (valA === null || valA === undefined) valA = '';
            if (valB === null || valB === undefined) valB = '';

            if (typeof valA === 'number' && typeof valB === 'number') {
                return state.sort.direction === 'asc' ? valA - valB : valB - valA;
            }

            return state.sort.direction === 'asc'
                ? String(valA).localeCompare(String(valB))
                : String(valB).localeCompare(String(valA));
        });

        const total = sorted.length;
        const totalPages = Math.ceil(total / state.pagination.pageSize) || 1;
        if (state.pagination.currentPage > totalPages) state.pagination.currentPage = totalPages;

        const startIdx = (state.pagination.currentPage - 1) * state.pagination.pageSize;
        const endIdx = Math.min(startIdx + state.pagination.pageSize, total);
        const pageItems = sorted.slice(startIdx, endIdx);

        if (total === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        Nenhum registro encontrado para os filtros selecionados.
                    </td>
                </tr>
            `;
            if (info) info.textContent = 'Exibindo 0 de 0 registros';
            if (pagination) pagination.innerHTML = '';
            return;
        }

        tbody.innerHTML = pageItems.map(r => {
            const scoreBadgeClass = r.score_num >= 10.0 ? 'kpi-badge badge-bom' : 'kpi-badge badge-divergente';

            return `
                <tr>
                    <td><strong>#${r.id}</strong></td>
                    <td>${r.data}</td>
                    <td>${r.frente}</td>
                    <td>${r.os}</td>
                    <td>${r.local}</td>
                    <td>${r.responsavel}</td>
                    <td>
                        <span class="kpi-badge badge-bom">
                            ${r.arremate_orig}
                        </span>
                    </td>
                    <td><strong>${r.score}</strong></td>
                    <td>
                        <span class="${scoreBadgeClass}">
                            ${r.score_desc} (${r.fase_score})
                        </span>
                    </td>
                    <td>
                        <button class="btn-filter-action" onclick="window.viewDetails(${r.id})">
                            🔍 Detalhes
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (info) {
            info.textContent = `Exibindo ${startIdx + 1}–${endIdx} de ${total.toLocaleString('pt-BR')} registros`;
        }

        renderPaginationControls(totalPages);
    }

    function renderPaginationControls(totalPages) {
        const container = document.getElementById('paginationControls');
        if (!container) return;

        let html = '';
        html += `<button class="btn-page" ${state.pagination.currentPage === 1 ? 'disabled' : ''} onclick="window.changePage(1)">«</button>`;
        html += `<button class="btn-page" ${state.pagination.currentPage === 1 ? 'disabled' : ''} onclick="window.changePage(${state.pagination.currentPage - 1})">‹</button>`;

        const startPage = Math.max(1, state.pagination.currentPage - 2);
        const endPage = Math.min(totalPages, state.pagination.currentPage + 2);

        for (let p = startPage; p <= endPage; p++) {
            html += `<button class="btn-page ${p === state.pagination.currentPage ? 'active' : ''}" onclick="window.changePage(${p})">${p}</button>`;
        }

        html += `<button class="btn-page" ${state.pagination.currentPage === totalPages ? 'disabled' : ''} onclick="window.changePage(${state.pagination.currentPage + 1})">›</button>`;
        html += `<button class="btn-page" ${state.pagination.currentPage === totalPages ? 'disabled' : ''} onclick="window.changePage(${totalPages})">»</button>`;

        container.innerHTML = html;
    }

    window.changePage = function (p) {
        state.pagination.currentPage = p;
        updateTable();
    };

    /**
     * Modal de Detalhes
     */
    window.viewDetails = function (id) {
        const item = state.rawData.find(r => r.id === id);
        if (!item) return;

        setText('modalTitle', `Avaliação #${item.id} • Arremate e Acabamento`);
        setText('mId', item.id);
        setText('mData', item.data);
        setText('mDataLanc', item.data_lancamento || '-');
        setText('mDuracao', item.duracao_min !== null ? `${item.duracao_min} min` : '-');
        setText('mFrente', item.frente);
        setText('mOS', item.os);
        setText('mLocal', item.local);
        setText('mResp', item.responsavel);
        setText('mUser', item.usuario);
        setText('mStatus', item.status);
        setText('mArremate', item.arremate_orig);
        setText('mFaseScore', item.fase_score);
        setText('mScore', `${item.score} (${item.score_desc})`);
        setText('mScorePerc', `${item.score_perc}%`);
        setText('mCoords', item.has_coords ? `${item.lat}, ${item.lon}` : 'Não Georreferenciado');

        const modal = document.getElementById('detailsModal');
        if (modal) modal.classList.add('active');
    };

    function closeModal() {
        const modal = document.getElementById('detailsModal');
        if (modal) modal.classList.remove('active');
    }

    /**
     * Exportações (Excel & CSV)
     */
    function exportToExcel() {
        if (!window.XLSX) {
            alert('Biblioteca SheetJS não carregada.');
            return;
        }

        const dataToExport = state.filteredData.map(r => ({
            'ID': r.id,
            'Data': r.data,
            'Data Lançamento': r.data_lancamento,
            'Frente': r.frente,
            'OS': r.os,
            'Local (Fazenda - Talhão)': r.local,
            'Responsável': r.responsavel,
            'Usuário': r.usuario,
            'Arremate e Acabamento': r.arremate_orig,
            'Score': r.score,
            'Score Perc': r.score_perc,
            'Score Desc': r.score_desc,
            'Fase Score': r.fase_score,
            'Latitude': r.lat,
            'Longitude': r.lon,
            'Status': r.status
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Arremate e Acabamento');
        XLSX.writeFile(wb, `arremate_acabamento_pitangueiras_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    function exportToCSV() {
        const dataToExport = state.filteredData;
        if (dataToExport.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }

        const headers = [
            'ID', 'Data', 'Data Lancamento', 'Frente', 'OS', 'Local',
            'Responsavel', 'Usuario', 'Arremate e Acabamento',
            'Score', 'Score Perc', 'Score Desc', 'Fase Score', 'Latitude', 'Longitude'
        ];

        let csvContent = '\uFEFF' + headers.join(';') + '\n';

        dataToExport.forEach(r => {
            const row = [
                r.id,
                `"${r.data}"`,
                `"${r.data_lancamento || ''}"`,
                `"${r.frente}"`,
                `"${r.os}"`,
                `"${r.local}"`,
                `"${r.responsavel}"`,
                `"${r.usuario}"`,
                `"${r.arremate_orig}"`,
                `"${r.score}"`,
                `"${r.score_perc}"`,
                `"${r.score_desc}"`,
                `"${r.fase_score}"`,
                `"${r.lat || ''}"`,
                `"${r.lon || ''}"`
            ];
            csvContent += row.join(';') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `arremate_acabamento_pitangueiras_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    /**
     * Listeners de Eventos
     */
    
    /* old initEvolutionFilter removed */

    /* old initMapFilter removed */

    function initEventListeners() {
        initEvolutionFilter();
        initMapFilter();
        const inputDate = document.getElementById('filterDateExact');
        if (inputDate) {
            inputDate.addEventListener('input', (e) => {
                state.filters.dateExact = e.target.value.trim();
                applyFilters();
            });
        }

        const selFrente = document.getElementById('filterFrente');
        if (selFrente) {
            selFrente.addEventListener('change', (e) => {
                state.filters.frente = e.target.value;
                applyFilters();
            });
        }

        const selOS = document.getElementById('filterOS');
        if (selOS) {
            selOS.addEventListener('change', (e) => {
                state.filters.os = e.target.value;
                applyFilters();
            });
        }

        const selLocal = document.getElementById('filterLocal');
        if (selLocal) {
            selLocal.addEventListener('change', (e) => {
                state.filters.local = e.target.value;
                applyFilters();
            });
        }

        const selResp = document.getElementById('filterResponsavel');
        if (selResp) {
            selResp.addEventListener('change', (e) => {
                state.filters.responsavel = e.target.value;
                applyFilters();
            });
        }

        const selFase = document.getElementById('filterFaseScore');
        if (selFase) {
            selFase.addEventListener('change', (e) => {
                state.filters.faseScore = e.target.value;
                applyFilters();
            });
        }

        const chkCoords = document.getElementById('chkOnlyCoords');
        if (chkCoords) {
            chkCoords.addEventListener('change', (e) => {
                state.filters.onlyCoords = e.target.checked;
                applyFilters();
            });
        }

        const searchInput = document.getElementById('tableSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state.filters.searchQuery = e.target.value;
                applyFilters();
            });
        }

        const btnHist = document.getElementById('btnVerTodoHistorico');
        if (btnHist) {
            btnHist.addEventListener('click', () => {
                state.filters.dateExact = '';
                const inputDateExact = document.getElementById('filterDateExact');
                if (inputDateExact) inputDateExact.value = '';
                applyFilters();
            });
        }

        const btnReset = document.getElementById('btnResetFilters');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                state.filters = {
                    dateExact: '',
                    dateStart: '',
                    dateEnd: '',
                    frente: 'all',
                    os: 'all',
                    local: 'all',
                    responsavel: 'all',
                    faseScore: 'all',
                    status: 'all',
                    onlyCoords: false,
                    searchQuery: ''
                };
                document.querySelectorAll('.filter-select').forEach(s => s.value = 'all');
                document.querySelectorAll('.filter-input').forEach(i => i.value = '');
                document.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
                applyFilters();
            });
        }

        // Toggles da Timeline
        const btnDia = document.getElementById('btnPeriodDiario');
        const btnSem = document.getElementById('btnPeriodSemanal');
        const btnMes = document.getElementById('btnPeriodMensal');

        function setPeriodMode(mode, activeBtn) {
            state.timePeriodMode = mode;
            [btnDia, btnSem, btnMes].forEach(b => b?.classList.remove('active'));
            activeBtn?.classList.add('active');
            renderTimelineChart();
        }

        if (btnDia) btnDia.addEventListener('click', () => setPeriodMode('diario', btnDia));
        if (btnSem) btnSem.addEventListener('click', () => setPeriodMode('semanal', btnSem));
        if (btnMes) btnMes.addEventListener('click', () => setPeriodMode('mensal', btnMes));

        const btnConf = document.getElementById('btnMetricConformidade');
        const btnVol = document.getElementById('btnMetricVolume');
        const btnScore = document.getElementById('btnMetricScore');

        function setMetricMode(mode, activeBtn) {
            state.timeMetricMode = mode;
            [btnConf, btnVol, btnScore].forEach(b => b?.classList.remove('active'));
            activeBtn?.classList.add('active');
            renderTimelineChart();
        }

        if (btnConf) btnConf.addEventListener('click', () => setMetricMode('conformidade', btnConf));
        if (btnVol) btnVol.addEventListener('click', () => setMetricMode('volume', btnVol));
        if (btnScore) btnScore.addEventListener('click', () => setMetricMode('score', btnScore));

        // Exportações
        const btnExcel = document.getElementById('btnExportExcel');
        if (btnExcel) btnExcel.addEventListener('click', exportToExcel);

        const btnCSV = document.getElementById('btnExportCSV');
        if (btnCSV) btnCSV.addEventListener('click', exportToCSV);

        // Modal
        const modalClose = document.getElementById('modalCloseBtn');
        if (modalClose) modalClose.addEventListener('click', closeModal);

        const modalOverlay = document.getElementById('detailsModal');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) closeModal();
            });
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });

        // Ordenação da Tabela
        document.querySelectorAll('.analytical-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-sort');
                if (state.sort.column === col) {
                    state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sort.column = col;
                    state.sort.direction = 'asc';
                }
                updateTable();
            });
        });
    }

})();
