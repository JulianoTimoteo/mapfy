/**
 * dashboard.js
 * Controlador da Central de Inteligência de Infestação de Broca por Armadilha
 * Usina Pitangueiras - Safra 2026
 */

(function () {
    'use strict';

    const state = {
        allRecords: (window.BrocaEngine && typeof window.BrocaEngine.normalizeRecord === 'function')
            ? (window.BROCA_ARMADILHA_DATA || []).map(r => window.BrocaEngine.normalizeRecord(r))
            : (window.BROCA_ARMADILHA_DATA || []),
        filteredRecords: [],
        evolutionRange: 'ALL',
        syncWithGlobalFilter: true,
        mapSyncWithGlobal: true,
        mapRange: 'ALL',
        visaoMapa: 'talhao',
        metricaMapa: 'tpa',
        intelData: null,
        activeFilters: {
            dataInicio: '',
            dataFim: '',
            fazenda: 'TODAS',
            talhao: 'TODOS',
            etapa: 'TODAS',
            responsavel: 'TODOS',
            faixaGravidade: 'TODAS',
            somentePositivos: false,
            somenteRecolhimento: false,
            somenteCoords: true,
            buscaTexto: ''
        },
        mapMode: 'all',
        map: null,
        markersLayer: null,
        charts: {},
        timelineMode: 'dia',
        currentPage: 1,
        pageSize: 10
    };
    window.dashboardState = state;
    window.state = state;

    // Plugin fallback para garantir exibição dos números nos gráficos sob qualquer condição
    const fallbackDataLabelsPlugin = {
        id: 'pitangueiras_datalabels_fallback',
        afterDatasetsDraw(chart) {
            if (typeof window.ChartDataLabels !== 'undefined' || (typeof Chart !== 'undefined' && Chart.registry && Chart.registry.plugins.items['datalabels'])) {
                return; // Delega estritamente ao ChartDataLabels oficial
            }
            const ctx = chart.ctx;
            const isDark = document.documentElement.classList.contains('dark');
            const defaultTextColor = isDark ? '#F1F5F9' : '#1E293B';

            chart.data.datasets.forEach((dataset, datasetIdx) => {
                const meta = chart.getDatasetMeta(datasetIdx);
                if (meta.hidden) return;

                meta.data.forEach((element, index) => {
                    const val = dataset.data[index];
                    if (val === undefined || val === null || val === 0 || val === '') return;

                    ctx.save();
                    ctx.font = 'bold 10px Inter, sans-serif';

                    if (chart.config.type === 'pie') { // Em Doughnut, valores ficam no centro e não abaixo na fatia
                        ctx.fillStyle = '#FFFFFF';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const pos = element.tooltipPosition();
                        ctx.fillText(String(val), pos.x, pos.y);
                    } else if (chart.config.type === 'bar' && chart.options.indexAxis === 'y') {
                        ctx.fillStyle = defaultTextColor;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(String(val), element.x + 5, element.y);
                    } else if (chart.config.type === 'bar') {
                        ctx.fillStyle = defaultTextColor;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(String(val), element.x, element.y - 3);
                    }
                    ctx.restore();
                });
            });

            // Totalizador no Centro de Gráficos Doughnut
            const chartType = chart.config.type;
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

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        if (!state.allRecords || state.allRecords.length === 0 || !state.allRecords[0]?.etapa) {
            const raw = window.BROCA_ARMADILHA_DATA || [];
            state.allRecords = (window.BrocaEngine && typeof window.BrocaEngine.normalizeRecord === 'function')
                ? raw.map(r => window.BrocaEngine.normalizeRecord(r))
                : raw;
        }
        state.filteredRecords = [...state.allRecords];
        initTheme();
        initFilters();
        initMap();
        initCharts();
        initEvolutionFilter();
        initMapFilter();
        updateAllViews();
        bindEvents();
    }

    // --- GERENCIAMENTO DE TEMA (CLARO/ESCURO) ---
    function initTheme() {
        const savedTheme = localStorage.getItem('pitangueiras_theme') || 'light';
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.addEventListener('click', () => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('pitangueiras_theme', isDark ? 'dark' : 'light');
                updateChartThemes();
            });
        }
    }

    // --- INICIALIZAÇÃO DE FILTROS ---
    function initFilters() {
        const fazendas = new Set();
        const responsaveis = new Set();

        state.allRecords.forEach(r => {
            if (r.fazenda) fazendas.add(r.fazenda);
            if (r.responsavel_nome) responsaveis.add(r.responsavel_nome);
        });

        populateSelect('filterFazenda', Array.from(fazendas).sort(), 'Todas as Fazendas');
        populateSelect('filterResponsavel', Array.from(responsaveis).sort(), 'Todos os Responsáveis');
    }

    function populateSelect(id, items, defaultLabel) {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = `<option value="TODAS">${defaultLabel}</option>`;
        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            sel.appendChild(opt);
        });
    }

    // --- MAPA LEAFLET COM SATÉLITE GOOGLE / ESRI E MAPA VETORIAL ---
    function initMap() {
        const container = document.getElementById('mapContainer');
        if (!container || typeof L === 'undefined') return;

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

        state.map = L.map('mapContainer', {
            center: [-21.05, -48.35],
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

        state.markersLayer = L.markerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 30
        });
        state.map.addLayer(state.markersLayer);

        setupMapShapesAgronomicHooks();
        initMapIntelligenceControls();
    }

    function setupMapShapesAgronomicHooks() {
        if (!window.PitangueirasMapShapes) {
            setTimeout(setupMapShapesAgronomicHooks, 250);
            return;
        }

        // Styler Customizado: Colore os shapes por Talhão ou por Fazenda
        window.PitangueirasMapShapes.setCustomStyler((feature, index, map, zoom, isAudited) => {
            if (!window.BrocaEngine) return null;
            return window.BrocaEngine.getShapeStyle(feature, state.visaoMapa || 'talhao', state.metricaMapa || 'tpa', state.intelData);
        });

        // Tooltip Customizado
        window.PitangueirasMapShapes.setCustomTooltipFormatter((feature, layer, map, auditInfo, isAudited) => {
            if (!window.BrocaEngine) return null;
            return window.BrocaEngine.getShapeTooltipHtml(feature, state.visaoMapa || 'talhao', state.intelData);
        });

        // Clique Customizado: Abre popup completo com dados territoriais, amostragem e memória de cálculo
        window.PitangueirasMapShapes.setCustomClickHandler((feature, layer, map, e) => {
            if (!window.BrocaEngine) return false;
            const popupHtml = window.BrocaEngine.getShapePopupHtml(feature, state.visaoMapa || 'talhao', state.intelData);
            if (popupHtml) {
                layer.bindPopup(popupHtml, { maxWidth: 360, className: 'pitangueiras-agronomic-popup' }).openPopup(e.latlng);
                return true;
            }
            return false;
        });
    }

    function initMapIntelligenceControls() {
        const btnVisaoTalhao = document.getElementById('btnVisaoTalhao');
        const btnVisaoFazenda = document.getElementById('btnVisaoFazenda');
        const selMetricaMapa = document.getElementById('selMetricaMapa');

        if (btnVisaoTalhao && !btnVisaoTalhao._listenerAttached) {
            btnVisaoTalhao._listenerAttached = true;
            btnVisaoTalhao.addEventListener('click', () => {
                state.visaoMapa = 'talhao';
                btnVisaoTalhao.className = 'btn-visao-modo active px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-emerald-600 text-white shadow-xs cursor-pointer';
                if (btnVisaoFazenda) {
                    btnVisaoFazenda.className = 'btn-visao-modo px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer';
                }
                if (window.PitangueirasMapShapes && state.map) {
                    window.PitangueirasMapShapes.reapplyStyles(state.map);
                }
            });
        }

        if (btnVisaoFazenda && !btnVisaoFazenda._listenerAttached) {
            btnVisaoFazenda._listenerAttached = true;
            btnVisaoFazenda.addEventListener('click', () => {
                state.visaoMapa = 'fazenda';
                btnVisaoFazenda.className = 'btn-visao-modo active px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-emerald-600 text-white shadow-xs cursor-pointer';
                if (btnVisaoTalhao) {
                    btnVisaoTalhao.className = 'btn-visao-modo px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer';
                }
                if (window.PitangueirasMapShapes && state.map) {
                    window.PitangueirasMapShapes.reapplyStyles(state.map);
                }
            });
        }

        if (selMetricaMapa && !selMetricaMapa._listenerAttached) {
            selMetricaMapa._listenerAttached = true;
            selMetricaMapa.addEventListener('change', (e) => {
                state.metricaMapa = e.target.value;
                if (window.BrocaEngine) {
                    window.BrocaEngine.setParams({ metrica_mapa: state.metricaMapa });
                }
                if (window.PitangueirasMapShapes && state.map) {
                    window.PitangueirasMapShapes.reapplyStyles(state.map);
                }
            });
        }
    }

    function updateMapMarkers() {
        const mapRecords = state.mapSyncWithGlobal
            ? state.filteredRecords
            : getRecordsForDateRange(state.filteredRecords, state.mapRange);
        if (!state.map || !state.markersLayer) return;
        state.markersLayer.clearLayers();

        // Atualizar contadores nos botões de modo
        const validCoordsAll = mapRecords.filter(r => r.has_coords && r.lat !== 0 && r.lon !== 0);
        const btnMapAll = document.getElementById('btnMapAll');
        if (btnMapAll) btnMapAll.innerText = `Todas (${validCoordsAll.length})`;
        const btnCriticos = document.getElementById('btnMapCriticos');
        if (btnCriticos) btnCriticos.innerText = `Focos Críticos (>25) [${validCoordsAll.filter(r => r.machos > 25).length}]`;
        const btnPositivos = document.getElementById('btnMapPositivos');
        if (btnPositivos) btnPositivos.innerText = `Positivos (>0) [${validCoordsAll.filter(r => r.machos > 0).length}]`;
        const btnZerados = document.getElementById('btnMapZerados');
        if (btnZerados) btnZerados.innerText = `Zerados / Instalação [${validCoordsAll.filter(r => r.machos <= 0).length}]`;

        const bounds = [];
        const records = mapRecords;

        records.forEach(r => {
            if (!r.has_coords || r.lat === 0 || r.lon === 0) return;

            // Filtro por modo do mapa
            if (state.mapMode === 'criticos' && r.machos <= 25) return;
            if (state.mapMode === 'positivos' && r.machos <= 0) return;
            if (state.mapMode === 'zerados' && r.machos > 0) return;

            bounds.push([r.lat, r.lon]);

            let pinBg = r.cor_marcador || '#10B981';
            let label = r.machos > 0 ? String(r.machos) : (r.is_instalacao ? 'I' : '0');

            const customIcon = L.divIcon({
                className: 'custom-map-icon',
                html: `<div class="custom-pin" style="background-color: ${pinBg};">${label}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
                popupAnchor: [0, -14]
            });

            const marker = L.marker([r.lat, r.lon], { icon: customIcon });

            const popupContent = `
                <div class="p-1 space-y-1 text-xs">
                    <div class="flex items-center justify-between gap-2 border-b pb-1 font-bold text-slate-800 dark:text-white">
                        <span>#${r.id} • ${r.local_display}</span>
                        <span class="badge" style="background-color: ${pinBg}20; color: ${pinBg};">${r.etapa}</span>
                    </div>
                    <div><b>Data:</b> ${r.data} | <b>Duração:</b> ${r.duracao_min} min</div>
                    <div><b>Captura:</b> <span class="font-bold text-amber-600 dark:text-amber-400">${r.machos} Brocas</span> (${r.faixa_captura})</div>
                    <div><b>Responsável:</b> ${r.responsavel_display}</div>
                    <div><b>Status:</b> ${r.status} | <b>Score:</b> ${r.score}</div>
                    <div class="pt-1 text-right">
                        <button type="button" onclick="event.stopPropagation(); window.abrirModalInspecao('${r.id}')" class="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline">Ver ficha completa →</button>
                    </div>
                </div>
            `;
            marker.bindPopup(popupContent);
            state.markersLayer.addLayer(marker);
        });

        if (bounds.length > 0) {
            state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
        }
    }

    // --- GRÁFICOS INTERATIVOS COM EXIBIÇÃO DIRETA DE VALORES ---
    function initCharts() {
        if (typeof Chart === 'undefined') {
            console.warn('[Broca] Chart.js não está disponível no momento.');
            return;
        }
        if (typeof window.ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        } else {
            Chart.register(fallbackDataLabelsPlugin);
        }

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94A3B8' : '#64748B';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

        // 1. Fazendas (Top Fazendas com Maior Captura)
        const ctxFaz = document.getElementById('chartFazendas')?.getContext('2d');
        if (ctxFaz) {
            const exFaz = Chart.getChart(ctxFaz.canvas);
            if (exFaz) exFaz.destroy();
            state.charts.fazendas = new Chart(ctxFaz, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Brocas Capturadas',
                        data: [],
                        backgroundColor: '#F59E0B',
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                            suggestedMax: 125,
                            grid: { color: gridColor },
                            ticks: { color: textColor, precision: 0 }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 10, weight: '500' } }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'end',
                            offset: 4,
                            color: isDark ? '#F1F5F9' : '#1E293B',
                            font: { weight: 'bold', size: 11 },
                            formatter: function (value) {
                                return value > 0 ? value : '';
                            }
                        }
                    }
                }
            });
        }

        // 2. Talhões (Top Talhões com Maior Pressão)
        const ctxTal = document.getElementById('chartTalhoes')?.getContext('2d');
        if (ctxTal) {
            const exTal = Chart.getChart(ctxTal.canvas);
            if (exTal) exTal.destroy();
            state.charts.talhoes = new Chart(ctxTal, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Brocas Capturadas',
                        data: [],
                        backgroundColor: '#EF4444',
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                            suggestedMax: 115,
                            grid: { color: gridColor },
                            ticks: { color: textColor, precision: 0 }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 10, weight: '500' } }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'end',
                            offset: 4,
                            color: isDark ? '#F1F5F9' : '#1E293B',
                            font: { weight: 'bold', size: 11 },
                            formatter: function (value) {
                                return value > 0 ? value : '';
                            }
                        }
                    }
                }
            });
        }

        // 3. Timeline (Evolução Temporal)
        const ctxTime = document.getElementById('chartTimeline')?.getContext('2d');
        if (ctxTime) {
            const exTime = Chart.getChart(ctxTime.canvas);
            if (exTime) exTime.destroy();
            state.charts.timeline = new Chart(ctxTime, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Brocas Capturadas',
                            data: [],
                            backgroundColor: '#F59E0B',
                            borderRadius: 4,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Lançamentos',
                            data: [],
                            backgroundColor: '#3B82F6',
                            borderRadius: 4,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 10 } }
                        },
                        y: {
                            beginAtZero: true,
                            position: 'left',
                            suggestedMax: 130,
                            grid: { color: gridColor },
                            ticks: { color: textColor, precision: 0 }
                        },
                        y1: {
                            beginAtZero: true,
                            position: 'right',
                            suggestedMax: 25,
                            grid: { display: false },
                            ticks: { color: textColor, precision: 0 }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { boxWidth: 10, color: textColor }
                        },
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'top',
                            offset: 2,
                            color: isDark ? '#F1F5F9' : '#1E293B',
                            font: { weight: 'bold', size: 10 },
                            formatter: function (value) {
                                return value > 0 ? value : '';
                            }
                        }
                    }
                }
            });
        }

        // 4. Severity Donut (Distribuição de Severidade)
        const ctxSev = document.getElementById('chartSeverity')?.getContext('2d');
        if (ctxSev) {
            const exSev = Chart.getChart(ctxSev.canvas);
            if (exSev) exSev.destroy();
            state.charts.severity = new Chart(ctxSev, {
                type: 'doughnut',
                data: {
                    labels: ['Instalação (0)', 'Recolh. Zerado (0)', 'Baixo (1-10)', 'Médio (11-25)', 'Crítico (>25)'],
                    datasets: [{
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: ['#10B981', '#06B6D4', '#EAB308', '#F59E0B', '#EF4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { boxWidth: 10, color: textColor, font: { size: 10 } }
                        },
                        datalabels: {
                            display: true,
                            color: '#FFFFFF',
                            font: { weight: 'bold', size: 12 },
                            formatter: function (value) {
                                return value > 0 ? value : '';
                            }
                        }
                    },
                    cutout: '60%'
                }
            });
        }
    }

    function updateChartThemes() {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94A3B8' : '#64748B';
        const labelColor = isDark ? '#F1F5F9' : '#1E293B';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

        Object.values(state.charts).forEach(c => {
            if (!c) return;
            if (c.options.scales) {
                if (c.options.scales.x) {
                    if (c.options.scales.x.ticks) c.options.scales.x.ticks.color = textColor;
                    if (c.options.scales.x.grid) c.options.scales.x.grid.color = gridColor;
                }
                if (c.options.scales.y) {
                    if (c.options.scales.y.ticks) c.options.scales.y.ticks.color = textColor;
                    if (c.options.scales.y.grid) c.options.scales.y.grid.color = gridColor;
                }
            }
            if (c.options.plugins) {
                if (c.options.plugins.legend) {
                    c.options.plugins.legend.labels.color = textColor;
                }
                if (c.options.plugins.datalabels && c.config.type !== 'doughnut') {
                    c.options.plugins.datalabels.color = labelColor;
                }
            }
            c.update();
        });
    }

    // --- ATUALIZAÇÃO COMPLETA DAS VISÕES ---
    function updateAllViews() {
        const records = state.filteredRecords;
        const kpis = BrocaEngine.computeExecutiveKPIs(records);
        const farms = BrocaEngine.computeFarmRanking(records);
        const talhoes = BrocaEngine.computeTalhaoRanking(records);
        const responsaveis = BrocaEngine.computeResponsibleStats(records);
        const severities = BrocaEngine.computeSeverityDistribution(records);

        // Atualiza Inteligência Agronômica (Manual Técnico Pág. 61)
        updateAgronomicView(records);

        // Atualiza KPIs Executivos
        setText('kpiTotalCapturas', kpis.totalCapturas || kpis.totalMachos);
        setText('kpiTotalMachos', kpis.totalCapturas || kpis.totalMachos);
        setText('kpiTotalLancamentos', kpis.totalLancamentos);
        setText('kpiInstalacoes', kpis.instalacoesCount);
        setText('kpiRecolhimentos', kpis.recolhimentosCount);
        setText('kpiMediaGeral', kpis.mediaPorLancamento.toFixed(2));
        setText('kpiMediaRecolhimento', kpis.mediaPorRecolhimento.toFixed(2));
        setText('kpiMediaPositivos', kpis.mediaPositivos.toFixed(2));
        setText('kpiMaiorCaptura', kpis.maiorQuantidade);
        setText('kpiZerados', kpis.zeradosTotal);
        setText('kpiPercZerados', `${kpis.percZerados}% da base`);
        setText('kpiLocaisMonitorados', `${kpis.fazendasCount}/${kpis.talhoesLocaisCount}`);
        setText('kpiHeaderBadge', `${kpis.totalLancamentos} Lançamentos Auditados`);

        // Rankings Tabelas
        renderFarmTable(farms);
        renderTalhaoTable(talhoes);

        // Responsáveis Cards
        renderResponsibleCards(responsaveis);

        // Atualiza Gráficos
        updateChartsData(farms, talhoes, records, severities);

        // Atualiza Mapa
        updateMapMarkers();

        // Atualiza Tabela Analítica
        renderTable();
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    
    // --- INTELIGÊNCIA AGRONÔMICA & MEMÓRIA DE CÁLCULO (MANUAL PÁG. 61) ---
    let currentAgroData = null;
    let currentAuditTab = 'numerador';

    function updateAgronomicView(records) {
        if (!window.BrocaEngine || typeof window.BrocaEngine.computeAgronomicIntelligence !== 'function') return;
        const agro = window.BrocaEngine.computeAgronomicIntelligence(records, window.PITANGUEIRAS_SHAPES_DATA);
        currentAgroData = agro;

        setText('agroPercentual', agro.percentualFormatado);
        setText('agroSubPerc', `${agro.armadilhasNoCriterioCount} de ${agro.recolhimentosValidosCount} no critério`);
        setText('agroNumerador', agro.armadilhasNoCriterioCount);
        setText('agroDenominador', agro.recolhimentosValidosCount);
        setText('agroAreaFoco', agro.areaTalhoesNoCriterioHa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        setText('agroAreaTotal', agro.areaTalhoesMonitoradosHa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        setText('agroCoberturaNominal', agro.coberturaNominalHa.toLocaleString('pt-BR'));
        setText('agroStatusText', agro.statusControle);

        state.intelData = agro;
        if (window.PitangueirasMapShapes && state.map) {
            window.PitangueirasMapShapes.reapplyStyles(state.map);
        }

        const badge = document.getElementById('agroStatusBadge');
        if (badge) {
            if (agro.criterioAtingido) {
                badge.className = 'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-xs';
            } else {
                badge.className = 'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs';
            }
        }
    }

    function renderAuditTableContent() {
        if (!currentAgroData) return;
        const container = document.getElementById('auditTabContent');
        if (!container) return;

        let rowsHtml = '';
        if (currentAuditTab === 'numerador') {
            const list = currentAgroData.listaNumerador;
            rowsHtml = `
                <table class="w-full text-left text-xs">
                    <thead class="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b text-slate-600 dark:text-slate-300">
                        <tr>
                            <th class="p-2">ID</th>
                            <th class="p-2">Fazenda > Talhão</th>
                            <th class="p-2 text-center">Captura (Adultos)</th>
                            <th class="p-2">Data Leitura</th>
                            <th class="p-2">Responsável</th>
                            <th class="p-2 text-center">Status Individual</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                        ${list.map(r => `
                            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td class="p-2 font-mono font-bold text-amber-600">#${r.id}</td>
                                <td class="p-2 font-semibold">${r.local_orig}</td>
                                <td class="p-2 text-center"><span class="px-2 py-0.5 rounded font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">${r.machos}</span></td>
                                <td class="p-2">${r.data}</td>
                                <td class="p-2">${r.responsavel_nome}</td>
                                <td class="p-2 text-center"><span class="badge badge-red text-[10px]">No Critério (≥ 6)</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (currentAuditTab === 'denominador') {
            const list = currentAgroData.listaDenominador;
            rowsHtml = `
                <table class="w-full text-left text-xs">
                    <thead class="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b text-slate-600 dark:text-slate-300">
                        <tr>
                            <th class="p-2">ID</th>
                            <th class="p-2">Fazenda > Talhão</th>
                            <th class="p-2 text-center">Captura</th>
                            <th class="p-2">Data</th>
                            <th class="p-2">Responsável</th>
                            <th class="p-2 text-center">Avaliação do Manual</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                        ${list.map(r => `
                            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td class="p-2 font-mono font-bold text-blue-600">#${r.id}</td>
                                <td class="p-2 font-semibold">${r.local_orig}</td>
                                <td class="p-2 text-center font-bold">${r.machos}</td>
                                <td class="p-2">${r.data}</td>
                                <td class="p-2">${r.responsavel_nome}</td>
                                <td class="p-2 text-center">
                                    ${r.machos >= 6 
                                        ? '<span class="badge badge-red text-[10px]">Positiva (≥ 6)</span>' 
                                        : '<span class="badge badge-emerald text-[10px]">Abaixo Limite (< 6)</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (currentAuditTab === 'excluidos') {
            const list = currentAgroData.listaExcluidos;
            rowsHtml = `
                <table class="w-full text-left text-xs">
                    <thead class="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b text-slate-600 dark:text-slate-300">
                        <tr>
                            <th class="p-2">ID</th>
                            <th class="p-2">Etapa Declarada</th>
                            <th class="p-2">Fazenda > Talhão</th>
                            <th class="p-2">Data</th>
                            <th class="p-2">Motivo Exclusão do Denominador</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                        ${list.map(e => `
                            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td class="p-2 font-mono font-bold text-slate-500">#${e.registro.id}</td>
                                <td class="p-2"><span class="badge badge-slate text-[10px]">${e.registro.etapa}</span></td>
                                <td class="p-2">${e.registro.local_orig}</td>
                                <td class="p-2">${e.registro.data}</td>
                                <td class="p-2 font-semibold text-amber-700 dark:text-amber-400">${e.motivo}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        container.innerHTML = rowsHtml;
    }

    window.switchAuditTab = function(tab) {
        currentAuditTab = tab;
        const bNum = document.getElementById('tabBtnNum');
        const bDen = document.getElementById('tabBtnDen');
        const bExc = document.getElementById('tabBtnExc');

        const activeClass = 'px-3 py-1.5 rounded-lg font-bold text-xs bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 transition';
        const inactiveClass = 'px-3 py-1.5 rounded-lg font-semibold text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition';

        if (bNum) bNum.className = tab === 'numerador' ? activeClass : inactiveClass;
        if (bDen) bDen.className = tab === 'denominador' ? activeClass : inactiveClass;
        if (bExc) bExc.className = tab === 'excluidos' ? activeClass : inactiveClass;

        renderAuditTableContent();
    };

    window.openAuditoriaModal = function() {
        if (!currentAgroData) {
            updateAgronomicView(state.filteredRecords);
        }
        const modal = document.getElementById('modalAuditoria');
        if (!modal || !currentAgroData) return;

        setText('auditNumVal', currentAgroData.armadilhasNoCriterioCount);
        setText('auditDenVal', currentAgroData.recolhimentosValidosCount);
        setText('auditExcVal', currentAgroData.excluidosCount);
        setText('auditPercVal', currentAgroData.percentualFormatado);
        setText('auditoriaExplicacao', currentAgroData.auditoria.explicacao);

        setText('auditTabNumCount', currentAgroData.armadilhasNoCriterioCount);
        setText('auditTabDenCount', currentAgroData.recolhimentosValidosCount);
        setText('auditTabExcCount', currentAgroData.excluidosCount);

        window.switchAuditTab('numerador');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    };

    window.closeAuditoriaModal = function() {
        const modal = document.getElementById('modalAuditoria');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    };

    function renderFarmTable(farms) {
        const tbody = document.getElementById('rankingFazendasBody');
        if (!tbody) return;

        tbody.innerHTML = farms.slice(0, 10).map(f => {
            const percFormatted = (f.participacaoPerc % 1 === 0)
                ? `${f.participacaoPerc}%`
                : `${f.participacaoPerc.toFixed(1)}%`;

            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td class="py-2 font-semibold text-slate-800 dark:text-slate-200">Fazenda ${f.fazenda}</td>
                    <td class="py-2 text-center text-slate-600 dark:text-slate-400">${f.talhoesCount}</td>
                    <td class="py-2 text-center text-slate-600 dark:text-slate-400">${f.totalLancamentos}</td>
                    <td class="py-2 text-center font-bold text-amber-600 dark:text-amber-400">${f.totalMachos}</td>
                    <td class="py-2 text-right font-bold text-slate-700 dark:text-slate-300">${percFormatted}</td>
                </tr>
            `;
        }).join('');
    }

    function renderTalhaoTable(talhoes) {
        const tbody = document.getElementById('rankingTalhoesBody');
        if (!tbody) return;

        tbody.innerHTML = talhoes.slice(0, 10).map(t => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                <td class="py-2 font-semibold text-slate-800 dark:text-slate-200">${t.local}</td>
                <td class="py-2 text-center font-bold text-rose-600 dark:text-rose-400">${t.totalMachos}</td>
                <td class="py-2 text-center text-slate-600 dark:text-slate-400">${t.mediaRecolh}</td>
                <td class="py-2 text-right"><span class="badge ${t.badgeClass} text-[10px]">${t.nivelRisco}</span></td>
            </tr>
        `).join('');
    }

    function renderResponsibleCards(responsaveis) {
        const cont = document.getElementById('containerResponsaveis');
        if (!cont) return;

        cont.innerHTML = responsaveis.map(r => `
            <div class="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-xs text-slate-900 dark:text-white truncate" title="${r.display}">${r.nome}</span>
                    <span class="badge badge-slate text-[10px]">${r.totalLancamentos} Lançamentos</span>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-3 text-[11px] pt-2 border-t border-slate-100 dark:border-slate-700">
                    <div><b>Instalações:</b> ${r.instalacoes}</div>
                    <div><b>Recolhimentos:</b> ${r.recolhimentos}</div>
                    <div><b>Capturas:</b> <span class="font-bold text-amber-600 dark:text-amber-400">${r.totalMachos}</span></div>
                    <div><b>Talhões:</b> ${r.talhoesCount}</div>
                </div>
                <div class="mt-2 text-right">
                    <button onclick="window.filtrarPorResponsavel('${r.nome}')" class="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline">Filtrar Lançamentos →</button>
                </div>
            </div>
        `).join('');
    }

    function updateChartsData(farms, talhoes, records, severities) {
        if (typeof Chart === 'undefined') return;
        // 1. Fazendas (Top 10 com valores explícitos nas barras)
        if (state.charts.fazendas) {
            const topFaz = farms.slice(0, 10);
            const maxVal = Math.max(...topFaz.map(f => f.totalMachos), 10);
            state.charts.fazendas.options.scales.x.suggestedMax = Math.ceil(maxVal * 1.15);
            state.charts.fazendas.data.labels = topFaz.map(f => `Fazenda ${f.fazenda}`);
            state.charts.fazendas.data.datasets[0].data = topFaz.map(f => f.totalMachos);
            state.charts.fazendas.update();
        }

        // 2. Talhões (Top 10 com valores explícitos nas barras)
        if (state.charts.talhoes) {
            const topTal = talhoes.slice(0, 10);
            const maxVal = Math.max(...topTal.map(t => t.totalMachos), 10);
            state.charts.talhoes.options.scales.x.suggestedMax = Math.ceil(maxVal * 1.15);
            state.charts.talhoes.data.labels = topTal.map(t => t.local);
            state.charts.talhoes.data.datasets[0].data = topTal.map(t => t.totalMachos);
            state.charts.talhoes.update();
        }

        // 3. Timeline (Valores explícitos acima das barras com suporte a filtro autônomo)
        if (state.charts.timeline) {
            updateTimelineChart();
        }

        // 4. Severity Donut (Valores explícitos dentro das fatias e na legenda)
        if (state.charts.severity) {
            const dInstal = severities["Instalação (Ciclo Iniciado)"] || 0;
            const dZero = severities["Zero Capturas (Negativo)"] || 0;
            const dBaixa = severities["Baixa Captura (1-10)"] || 0;
            const dMedia = severities["Média Captura (11-25)"] || 0;
            const dCrit = severities["Foco Crítico (> 25)"] || 0;

            state.charts.severity.data.labels = [
                `Instalação (${dInstal})`,
                `Recolh. Zerado (${dZero})`,
                `Baixa 1-10 (${dBaixa})`,
                `Média 11-25 (${dMedia})`,
                `Crítico >25 (${dCrit})`
            ];
            state.charts.severity.data.datasets[0].data = [dInstal, dZero, dBaixa, dMedia, dCrit];
            state.charts.severity.update();
        }
    }

    /**
     * Atualiza o gráfico de Evolução Temporal respeitando modo autônomo (Todos/15D/7D) e agrupamento (Diário/Mensal)
     */
    function updateTimelineChart() {
        if (!state.charts.timeline) return;
        const records = state.filteredRecords || [];
        const timelineRecords = state.syncWithGlobalFilter
            ? records
            : getRecordsForDateRange(records, state.evolutionRange);
        const timelineData = BrocaEngine.computeTemporalAnalytics(timelineRecords, state.timelineMode);
        const maxCapt = Math.max(...timelineData.map(t => t.totalMachos), 10);
        const maxLanc = Math.max(...timelineData.map(t => t.totalLancamentos), 5);
        state.charts.timeline.options.scales.y.suggestedMax = Math.ceil(maxCapt * 1.25);
        state.charts.timeline.options.scales.y1.suggestedMax = Math.ceil(maxLanc * 1.3);
        state.charts.timeline.data.labels = timelineData.map(t => t.label);
        state.charts.timeline.data.datasets[0].data = timelineData.map(t => t.totalMachos);
        state.charts.timeline.data.datasets[1].data = timelineData.map(t => t.totalLancamentos);
        state.charts.timeline.update();
    }

    // --- TABELA ANALÍTICA COM PAGINAÇÃO ---
    function renderTable() {
        const tbody = document.getElementById('tabelaBroca');
        const countLabel = document.getElementById('tableRecordCount');
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (!tbody) return;

        const records = state.filteredRecords;
        const total = records.length;
        const totalPages = Math.ceil(total / state.pageSize) || 1;

        if (state.currentPage > totalPages) state.currentPage = totalPages;
        if (state.currentPage < 1) state.currentPage = 1;

        if (countLabel) countLabel.textContent = `Mostrando ${total} de ${state.allRecords.length} lançamentos`;
        if (pageInfo) pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
        if (prevBtn) prevBtn.disabled = state.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = state.currentPage >= totalPages;

        const startIdx = (state.currentPage - 1) * state.pageSize;
        const pageRecords = records.slice(startIdx, startIdx + state.pageSize);

        if (pageRecords.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="text-center py-6 text-slate-500">Nenhum lançamento encontrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = pageRecords.map(r => {
            let etapaBadge = r.is_instalacao
                ? `<span class="badge badge-emerald">Instalação</span>`
                : `<span class="badge badge-blue">Recolhimento</span>`;

            let gravidadeBadge = `<span class="badge" style="background-color: ${r.cor_marcador}20; color: ${r.cor_marcador};">${r.faixa_captura}</span>`;

            return `
                <tr class="cursor-pointer" onclick="window.abrirModalInspecao('${r.id}')">
                    <td class="font-bold text-amber-600 dark:text-amber-400">#${r.id}</td>
                    <td class="whitespace-nowrap">${r.data}</td>
                    <td>${etapaBadge}</td>
                    <td class="font-semibold">${r.fazenda}</td>
                    <td>${r.talhao}</td>
                    <td>${r.local_orig}</td>
                    <td class="font-bold text-center text-sm ${r.machos > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}">${r.machos}</td>
                    <td>${gravidadeBadge}</td>
                    <td class="max-w-[150px] truncate" title="${r.responsavel_display}">${r.responsavel_nome}</td>
                    <td><span class="badge badge-slate">${r.status}</span></td>
                    <td>
                        <button class="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-slate-700 dark:text-slate-200 transition">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // --- MODAL DE DETALHES ---
    window.abrirModalInspecao = function (id) {
        const strId = String(id).trim();
        let r = (state.allRecords || []).find(x => String(x.id || x.ID || '').trim() === strId);
        if (!r && window.BROCA_ARMADILHA_DATA) {
            r = window.BROCA_ARMADILHA_DATA.find(x => String(x.id || x.ID || '').trim() === strId);
        }
        if (!r) {
            console.warn('[Broca] Armadilha não encontrada:', id);
            return;
        }

        const modal = document.getElementById('detailModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');

        if (!modal || !title || !body) return;

        title.textContent = `Armadilha #${r.id} • ${r.local_display}`;

        body.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                    <span class="font-bold text-slate-700 dark:text-slate-200 block border-b pb-1 mb-2 uppercase text-[11px]">
                        Identificação da Armadilha
                    </span>
                    <div class="space-y-1 text-slate-600 dark:text-slate-300">
                        <div><b>Fazenda:</b> ${r.fazenda}</div>
                        <div><b>Talhão:</b> ${r.talhao}</div>
                        <div><b>Etapa:</b> <span class="badge ${r.is_instalacao ? 'badge-emerald' : 'badge-blue'}">${r.etapa}</span></div>
                        <div><b>Data:</b> ${r.data}</div>
                        <div><b>Duração:</b> ${r.duracao_min} min</div>
                        <div><b>Status:</b> ${r.status} | <b>Score:</b> ${r.score}</div>
                    </div>
                </div>

                <div class="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <span class="font-bold text-amber-800 dark:text-amber-300 block border-b pb-1 mb-2 uppercase text-[11px]">
                        Contagem e Nível Entomológico
                    </span>
                    <div class="space-y-1 text-slate-700 dark:text-slate-200">
                        <div class="text-xl font-black text-amber-600 dark:text-amber-400">${r.machos} Brocas Capturadas</div>
                        <div><b>Classificação:</b> ${r.faixa_captura}</div>
                        <div class="pt-2 text-[11px] text-slate-500">
                            ${r.is_instalacao ? 'Armadilha instalada no campo. Início da atração por feromônio.' : 'Leitura da armadilha após período de exposição.'}
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                <span class="font-bold text-slate-700 dark:text-slate-200 block border-b pb-1 mb-2 uppercase text-[11px]">
                    Equipe e Georreferenciamento
                </span>
                <div class="space-y-1 text-slate-600 dark:text-slate-300">
                    <div><b>Responsável Lançamento:</b> ${r.responsavel_display}</div>
                    <div><b>Usuário MapFy:</b> ${r.usuario}</div>
                    <div><b>Coordenadas GPS:</b> Lat ${r.lat} | Lon ${r.lon}</div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    };

    window.filtrarPorResponsavel = function (nome) {
        const sel = document.getElementById('filterResponsavel');
        if (sel) {
            if (state.activeFilters.responsavel === nome) {
                sel.value = 'ALL';
                state.activeFilters.responsavel = 'ALL';
            } else {
                sel.value = nome;
                state.activeFilters.responsavel = nome;
            }
            aplicarFiltros();
        }
    };

    // --- BIND DE EVENTOS ---
    function bindEvents() {
        ['filterFazenda', 'filterEtapa', 'filterResponsavel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    const keyMap = {
                        filterFazenda: 'fazenda',
                        filterEtapa: 'etapa',
                        filterResponsavel: 'responsavel'
                    };
                    state.activeFilters[keyMap[id]] = el.value;
                    aplicarFiltros();
                });
            }
        });

        const dtIni = document.getElementById('filterDataInicio');
        const dtFim = document.getElementById('filterDataFim');
        if (dtIni) dtIni.addEventListener('change', () => { state.activeFilters.dataInicio = dtIni.value; aplicarFiltros(); });
        if (dtFim) dtFim.addEventListener('change', () => { state.activeFilters.dataFim = dtFim.value; aplicarFiltros(); });

        const chkPos = document.getElementById('chkSomentePositivos');
        const chkRec = document.getElementById('chkSomenteRecolhimento');
        const chkCoords = document.getElementById('chkSomenteCoords');
        if (chkPos) chkPos.addEventListener('change', () => { state.activeFilters.somentePositivos = chkPos.checked; aplicarFiltros(); });
        if (chkRec) chkRec.addEventListener('change', () => { state.activeFilters.somenteRecolhimento = chkRec.checked; aplicarFiltros(); });
        if (chkCoords) chkCoords.addEventListener('change', () => { state.activeFilters.somenteCoords = chkCoords.checked; aplicarFiltros(); });

        const search = document.getElementById('searchInput');
        if (search) {
            search.addEventListener('input', () => {
                state.activeFilters.buscaTexto = search.value.trim();
                aplicarFiltros();
            });
        }

        const resetBtn = document.getElementById('btnResetFilters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                document.querySelectorAll('select').forEach(s => s.value = s.options[0].value);
                if (dtIni) dtIni.value = '';
                if (dtFim) dtFim.value = '';
                if (search) search.value = '';
                if (chkPos) chkPos.checked = false;
                if (chkRec) chkRec.checked = false;
                if (chkCoords) chkCoords.checked = true;

                state.activeFilters = {
                    dataInicio: '', dataFim: '', fazenda: 'TODAS', talhao: 'TODOS',
                    etapa: 'TODAS', responsavel: 'TODOS', faixaGravidade: 'TODAS',
                    somentePositivos: false, somenteRecolhimento: false,
                    somenteCoords: true, buscaTexto: ''
                };
                aplicarFiltros();
            });
        }

        const mapBtns = [
            { id: 'btnMapAll', mode: 'all' },
            { id: 'btnMapCriticos', mode: 'criticos' },
            { id: 'btnMapPositivos', mode: 'positivos' },
            { id: 'btnMapZerados', mode: 'zerados' }
        ];
        mapBtns.forEach(b => {
            const el = document.getElementById(b.id);
            if (el) {
                el.addEventListener('click', () => {
                    state.mapMode = b.mode;
                    mapBtns.forEach(x => {
                        const btnEl = document.getElementById(x.id);
                        if (btnEl) {
                            if (x.mode === b.mode) {
                                btnEl.className = 'px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-slate-700 shadow-xs text-slate-800 dark:text-white transition';
                            } else {
                                btnEl.className = 'px-2.5 py-1 rounded-md font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 transition';
                            }
                        }
                    });
                    updateMapMarkers();
                });
            }
        });

        const btnDia = document.getElementById('btnTimelineDia');
        const btnMes = document.getElementById('btnTimelineMes');
        if (btnDia && btnMes) {
            btnDia.addEventListener('click', () => {
                state.timelineMode = 'dia';
                btnDia.className = 'btn-timeline-toggle active';
                btnMes.className = 'btn-timeline-toggle';
                updateTimelineChart();
            });
            btnMes.addEventListener('click', () => {
                state.timelineMode = 'mes';
                btnMes.className = 'btn-timeline-toggle active';
                btnDia.className = 'btn-timeline-toggle';
                updateTimelineChart();
            });
        }

        
        const btnAuditoria = document.getElementById('btnAbrirAuditoria');
        if (btnAuditoria) btnAuditoria.addEventListener('click', () => window.openAuditoriaModal());

        const btnAuditClose = document.getElementById('modalAuditoriaCloseBtn');
        const btnAuditBottomClose = document.getElementById('modalAuditoriaBottomCloseBtn');
        if (btnAuditClose) btnAuditClose.addEventListener('click', () => window.closeAuditoriaModal());
        if (btnAuditBottomClose) btnAuditBottomClose.addEventListener('click', () => window.closeAuditoriaModal());

        const modalAud = document.getElementById('modalAuditoria');
        if (modalAud) {
            modalAud.addEventListener('click', e => {
                if (e.target === modalAud) window.closeAuditoriaModal();
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                window.closeAuditoriaModal();
            }
        });
    
        const prevPage = document.getElementById('prevPage');
        const nextPage = document.getElementById('nextPage');
        if (prevPage) prevPage.addEventListener('click', () => { state.currentPage--; renderTable(); });
        if (nextPage) nextPage.addEventListener('click', () => { state.currentPage++; renderTable(); });

        const closeBtn = document.getElementById('modalCloseBtn');
        const closeBottomBtn = document.getElementById('modalCloseBottomBtn');
        const modal = document.getElementById('detailModal');
        window.fecharModalInspecao = function () {
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }
        };
        const closeModal = () => window.fecharModalInspecao();
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (closeBottomBtn) closeBottomBtn.addEventListener('click', closeModal);
        if (modal) {
            modal.addEventListener('click', e => {
                if (e.target === modal) closeModal();
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.style.display !== 'none' && !modal.classList.contains('hidden')) {
                window.fecharModalInspecao();
            }
        });

        const btnExcel = document.getElementById('btnExportExcel');
        const btnCsv = document.getElementById('btnExportCSV');
        if (btnExcel) btnExcel.addEventListener('click', exportToExcel);
        if (btnCsv) btnCsv.addEventListener('click', exportToCSV);

        // Redimensionamento Dinâmico (Celulares, Tablets, Notebooks, Desktops e TVs)
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (state.map) {
                    state.map.invalidateSize();
                }
                Object.values(state.charts).forEach(c => {
                    if (c) c.resize();
                });
            }, 100);
        });
    }

    function aplicarFiltros() {
        state.filteredRecords = BrocaEngine.filterRecords(state.allRecords, state.activeFilters);
        state.currentPage = 1;
        updateAllViews();
    }

    // --- EXPORTAÇÃO EXCEL (.XLSX) VIA SHEETJS ---
    function exportToExcel() {
        const rows = state.filteredRecords.map(r => ({
            "ID": r.id,
            "Data": r.data,
            "Etapa": r.etapa,
            "Fazenda": r.fazenda,
            "Talhão": r.talhao,
            "Local Completo": r.local_orig,
            "Quantidade Brocas": r.machos,
            "Classificação Gravidade": r.faixa_captura,
            "Responsável Lançamento": r.responsavel_display,
            "Status": r.status,
            "Score": r.score,
            "Latitude": r.lat,
            "Longitude": r.lon,
            "Duração (min)": r.duracao_min,
            "Usuário": r.usuario
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Armadilhas Broca");
        XLSX.writeFile(wb, "Monitoramento_Broca_Armadilhas_Pitangueiras_2026.xlsx");
    }

    // --- EXPORTAÇÃO CSV UTF-8 COM BOM ---
    function exportToCSV() {
        const headers = ["ID", "Data", "Etapa", "Fazenda", "Talhao", "Local", "Quantidade_Brocas", "Gravidade", "Responsavel", "Status", "Lat", "Lon"];
        let csvContent = "\uFEFF" + headers.join(";") + "\n";

        state.filteredRecords.forEach(r => {
            const row = [
                r.id,
                `"${r.data}"`,
                `"${r.etapa}"`,
                `"${r.fazenda}"`,
                `"${r.talhao}"`,
                `"${r.local_orig}"`,
                r.machos,
                `"${r.faixa_captura}"`,
                `"${r.responsavel_display}"`,
                `"${r.status}"`,
                r.lat,
                r.lon
            ];
            csvContent += row.join(";") + "\n";
        });

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Monitoramento_Broca_Armadilhas_Pitangueiras_2026.csv";
        link.click();
    }


    /**
     * Função Utilitária para Recorte por Dias em Modo Autônomo (Janela Temporal Real)
     */
    function getRecordsForDateRange(records, range) {
        if (!range || range === 'ALL' || !records || records.length === 0) return records;
        
        // Mapear dias únicos e seus timestamps
        const dayMap = new Map();
        records.forEach(r => {
            const dStr = r.data_dia || r.dataBR || (r.dataStr ? r.dataStr.split(' ')[0] : '') || (r.data ? String(r.data).split(' ')[0] : '');
            if (dStr && dStr.includes('/')) {
                const p = dStr.split('/');
                if (p.length === 3) {
                    const ts = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10)).getTime();
                    if (!isNaN(ts)) {
                        dayMap.set(dStr, ts);
                    }
                }
            }
        });

        if (dayMap.size === 0) return records;

        const sortedDays = Array.from(dayMap.entries()).sort((a, b) => a[1] - b[1]);
        const maxTs = sortedDays[sortedDays.length - 1][1];

        let targetDays;
        if (range === '7D') {
            const ts7DaysAgo = maxTs - (7 * 24 * 60 * 60 * 1000);
            const daysInWindow = sortedDays.filter(entry => entry[1] >= ts7DaysAgo).map(e => e[0]);
            targetDays = new Set(daysInWindow.length >= 3 ? daysInWindow : sortedDays.slice(-7).map(e => e[0]));
        } else if (range === '15D') {
            const ts15DaysAgo = maxTs - (15 * 24 * 60 * 60 * 1000);
            const daysInWindow = sortedDays.filter(entry => entry[1] >= ts15DaysAgo).map(e => e[0]);
            targetDays = new Set(daysInWindow.length >= 5 ? daysInWindow : sortedDays.slice(-10).map(e => e[0]));
        } else {
            targetDays = new Set(sortedDays.map(e => e[0]));
        }

        return records.filter(r => {
            const dStr = r.data_dia || r.dataBR || (r.dataStr ? r.dataStr.split(' ')[0] : '') || (r.data ? String(r.data).split(' ')[0] : '');
            return targetDays.has(dStr);
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
                    btnSync.className = "btn-sync-filter sync-locked px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm";
                    if (syncIcon) syncIcon.innerText = "🔒";
                    if (syncText) syncText.innerText = "Filtro Global Ativo";
                    btnSync.title = "Os gráficos analíticos obedecem ao Filtro Principal do topo. Clique para destravar o modo autônomo.";
                } else {
                    btnSync.className = "btn-sync-filter sync-unlocked px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600 shadow-sm";
                    if (syncIcon) syncIcon.innerText = "🔓";
                    if (syncText) syncText.innerText = "Filtro Autônomo";
                    btnSync.title = `Modo autônomo ativo (${state.evolutionRange}). Clique para travar novamente com o Filtro Global.`;
                }
            }

            evoButtons.forEach(btn => {
                const range = btn.getAttribute('data-evo-range') || 'ALL';
                btn.disabled = false;
                btn.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                btn.classList.add('cursor-pointer');
                btn.classList.toggle('active', range === state.evolutionRange);
            });
        }

        if (btnSync && !btnSync._listenerAttached) {
            btnSync._listenerAttached = true;
            btnSync.addEventListener('click', () => {
                state.syncWithGlobalFilter = !state.syncWithGlobalFilter;
                updateEvoControlsUI();
                updateTimelineChart();
            });
        }

        evoButtons.forEach(btn => {
            if (!btn._listenerAttached) {
                btn._listenerAttached = true;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const range = btn.getAttribute('data-evo-range') || 'ALL';
                    state.evolutionRange = range;
                    // Ao clicar em qualquer botão de período, desativa a trava do filtro global para modo autônomo imediato
                    if (state.syncWithGlobalFilter) {
                        state.syncWithGlobalFilter = false;
                    }
                    updateEvoControlsUI();
                    updateTimelineChart();
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
                    btnMapSync.className = "btn-sync-filter sync-locked px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm";
                    if (mapSyncIcon) mapSyncIcon.innerText = "🔒";
                    if (mapSyncText) mapSyncText.innerText = "Filtro Global Ativo";
                    btnMapSync.title = "O mapa obedece ao Filtro Principal do topo. Clique para destravar o modo autônomo do mapa.";
                } else {
                    btnMapSync.className = "btn-sync-filter sync-unlocked px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600 shadow-sm";
                    if (mapSyncIcon) mapSyncIcon.innerText = "🔓";
                    if (mapSyncText) mapSyncText.innerText = "Filtro Autônomo";
                    btnMapSync.title = `Modo autônomo do mapa ativo (${state.mapRange}). Clique para travar novamente com o Filtro Global.`;
                }
            }

            mapButtons.forEach(btn => {
                const range = btn.getAttribute('data-map-range') || '7D';
                btn.disabled = false;
                btn.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                btn.classList.add('cursor-pointer');

                if (range === state.mapRange) {
                    btn.className = 'btn-map-filter active px-2.5 py-1 rounded-md text-[11px] font-bold transition-all bg-emerald-600 text-white shadow-xs cursor-pointer';
                } else {
                    btn.className = 'btn-map-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer';
                }
            });
        }

        if (btnMapSync && !btnMapSync._listenerAttached) {
            btnMapSync._listenerAttached = true;
            btnMapSync.addEventListener('click', () => {
                state.mapSyncWithGlobal = !state.mapSyncWithGlobal;
                updateMapControlsUI();
                updateMapMarkers();
            });
        }

        mapButtons.forEach(btn => {
            if (!btn._listenerAttached) {
                btn._listenerAttached = true;
                btn.addEventListener('click', () => {
                    const range = btn.getAttribute('data-map-range') || '7D';
                    state.mapRange = range;
                    if (state.mapSyncWithGlobal && range !== 'ALL') {
                        state.mapSyncWithGlobal = false;
                    }
                    updateMapControlsUI();
                    updateMapMarkers();
                });
            }
        });

        updateMapControlsUI();
    }

    // --- MÓDULO MASTER: GESTÃO DE ÁREAS E PARÂMETROS AGRONÔMICOS ---
    function initAreaParamsModal() {
        const modal = document.getElementById('modalAreaParams');
        const btnOpen = document.getElementById('btnOpenAreaParamsModal');
        const btnClose = document.getElementById('modalAreaParamsCloseBtn');
        const btnBottomClose = document.getElementById('modalAreaParamsBottomCloseBtn');

        const tabBtnTerritorio = document.getElementById('tabBtnTerritorio');
        const tabBtnParametros = document.getElementById('tabBtnParametros');
        const tabBtnAuditoria = document.getElementById('tabBtnAuditoriaTerritorio');

        const contentTerritorio = document.getElementById('contentTabTerritorio');
        const contentParametros = document.getElementById('contentTabParametros');
        const contentAuditoria = document.getElementById('contentTabAuditoriaTerritorio');

        const inputBusca = document.getElementById('inputBuscaParcelas');
        const btnNova = document.getElementById('btnNovaParcela');
        const formContainer = document.getElementById('formParcelaContainer');
        const formTitle = document.getElementById('formParcelaTitle');
        const btnCancelarForm = document.getElementById('btnCancelarFormParcela');
        const btnSalvar = document.getElementById('btnSalvarParcela');

        const inpFazenda = document.getElementById('inpFormFazenda');
        const inpNomeFaz = document.getElementById('inpFormNomeFaz');
        const inpZona = document.getElementById('inpFormZona');
        const inpTalhao = document.getElementById('inpFormTalhao');
        const inpArea = document.getElementById('inpFormArea');
        const inpParcelaId = document.getElementById('inpFormParcelaId');

        const btnExportarJson = document.getElementById('btnExportarJson');
        const btnExportarCsv = document.getElementById('btnExportarCsv');
        const fileImport = document.getElementById('fileImportTerritorio');
        const btnResetPadrao = document.getElementById('btnResetPadraoTerritorio');

        const selManejo = document.getElementById('selManejoConfig');
        const inpMinAdultos = document.getElementById('inpMinAdultosConfig');
        const chkSimulacao = document.getElementById('chkModoSimulacao');
        const containerSimulacao = document.getElementById('containerSimulacaoInputs');
        const inpLimiteSimulacao = document.getElementById('inpLimiteSimulacao');

        function openModal() {
            if (!modal) return;
            modal.classList.remove('hidden');
            renderAllTerritoryData();
            syncParamsForm();
        }

        function closeModal() {
            if (!modal) return;
            modal.classList.add('hidden');
            if (formContainer) formContainer.classList.add('hidden');
        }

        if (btnOpen) btnOpen.addEventListener('click', openModal);
        if (btnClose) btnClose.addEventListener('click', closeModal);
        if (btnBottomClose) btnBottomClose.addEventListener('click', closeModal);

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }

        // Alternância de Abas
        function switchTab(tab) {
            [tabBtnTerritorio, tabBtnParametros, tabBtnAuditoria].forEach(b => {
                if (b) {
                    b.classList.remove('active', 'border-emerald-600', 'text-emerald-600', 'dark:text-emerald-400');
                    b.classList.add('border-transparent', 'text-slate-600', 'dark:text-slate-400');
                }
            });
            [contentTerritorio, contentParametros, contentAuditoria].forEach(c => {
                if (c) c.classList.add('hidden');
            });

            if (tab === 'territorio') {
                if (tabBtnTerritorio) {
                    tabBtnTerritorio.classList.add('active', 'border-emerald-600', 'text-emerald-600', 'dark:text-emerald-400');
                    tabBtnTerritorio.classList.remove('border-transparent', 'text-slate-600', 'dark:text-slate-400');
                }
                if (contentTerritorio) contentTerritorio.classList.remove('hidden');
                renderAllTerritoryData();
            } else if (tab === 'parametros') {
                if (tabBtnParametros) {
                    tabBtnParametros.classList.add('active', 'border-emerald-600', 'text-emerald-600', 'dark:text-emerald-400');
                    tabBtnParametros.classList.remove('border-transparent', 'text-slate-600', 'dark:text-slate-400');
                }
                if (contentParametros) contentParametros.classList.remove('hidden');
                syncParamsForm();
            } else if (tab === 'auditoria') {
                if (tabBtnAuditoria) {
                    tabBtnAuditoria.classList.add('active', 'border-emerald-600', 'text-emerald-600', 'dark:text-emerald-400');
                    tabBtnAuditoria.classList.remove('border-transparent', 'text-slate-600', 'dark:text-slate-400');
                }
                if (contentAuditoria) contentAuditoria.classList.remove('hidden');
                renderAuditoriaTable();
            }
        }

        if (tabBtnTerritorio) tabBtnTerritorio.addEventListener('click', () => switchTab('territorio'));
        if (tabBtnParametros) tabBtnParametros.addEventListener('click', () => switchTab('parametros'));
        if (tabBtnAuditoria) tabBtnAuditoria.addEventListener('click', () => switchTab('auditoria'));

        // Renderização dos Dados Territoriais
        function renderAllTerritoryData() {
            if (!window.AgronomicTerritory) return;
            const stats = window.AgronomicTerritory.getStats();

            setText('statAreaTotal', `${stats.area_total_ha.toLocaleString('pt-BR')} ha`);
            setText('statTotalFazendas', stats.total_fazendas);
            setText('statTotalTalhoes', stats.total_talhoes);
            setText('statTotalParcelas', stats.total_parcelas);

            const auditBadge = document.getElementById('auditCountBadge');
            if (auditBadge) auditBadge.innerText = (window.AgronomicTerritory.getAuditLog() || []).length;

            renderParcelasTable();
        }

        function renderParcelasTable() {
            const tbody = document.getElementById('tabelaParcelasBody');
            if (!tbody || !window.AgronomicTerritory) return;

            const query = (inputBusca ? inputBusca.value : '').toLowerCase().trim();
            const parcelas = window.AgronomicTerritory.getAllParcelas().filter(p => {
                if (!query) return true;
                return (p.fazenda && p.fazenda.toLowerCase().includes(query)) ||
                       (p.nome_faz && p.nome_faz.toLowerCase().includes(query)) ||
                       (String(p.talhao).toLowerCase().includes(query)) ||
                       (p.id && p.id.toLowerCase().includes(query));
            });

            if (parcelas.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400 font-sans">Nenhuma parcela encontrada para a busca atual.</td></tr>`;
                return;
            }

            tbody.innerHTML = parcelas.map(p => `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                    <td class="p-2.5 font-bold text-emerald-700 dark:text-emerald-400 text-[11px]">${p.id}</td>
                    <td class="p-2.5 font-sans font-bold text-slate-900 dark:text-white">
                        ${p.fazenda} <span class="text-slate-400 font-normal">(${p.nome_faz || '-'})</span>
                    </td>
                    <td class="p-2.5 text-slate-600 dark:text-slate-300">Zona ${p.zona || 1}</td>
                    <td class="p-2.5 font-bold text-slate-800 dark:text-slate-200">Talhão ${p.talhao}</td>
                    <td class="p-2.5 text-right font-black text-slate-900 dark:text-white text-xs">${Number(p.area).toFixed(2)} ha</td>
                    <td class="p-2.5 text-[10px] text-slate-500 font-sans">${p.origem || 'Manual'}</td>
                    <td class="p-2.5 font-sans"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">${p.situacao || 'Auditado'}</span></td>
                    <td class="p-2.5 text-center font-sans">
                        <div class="inline-flex items-center gap-1.5">
                            <button type="button" class="btn-editar-parc p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" data-id="${p.id}" title="Editar área desta parcela">
                                ✏️
                            </button>
                            <button type="button" class="btn-excluir-parc p-1 rounded hover:bg-rose-100 text-rose-600" data-id="${p.id}" title="Remover parcela">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

            // Listeners de Ações da Tabela
            tbody.querySelectorAll('.btn-editar-parc').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const parc = window.AgronomicTerritory.getAllParcelas().find(p => p.id === id);
                    if (parc) {
                        if (inpParcelaId) inpParcelaId.value = parc.id;
                        if (inpFazenda) inpFazenda.value = parc.fazenda;
                        if (inpNomeFaz) inpNomeFaz.value = parc.nome_faz;
                        if (inpZona) inpZona.value = parc.zona;
                        if (inpTalhao) inpTalhao.value = parc.talhao;
                        if (inpArea) inpArea.value = parc.area;
                        if (formTitle) formTitle.innerText = `Editar Parcela: ${parc.id}`;
                        if (formContainer) {
                            formContainer.classList.remove('hidden');
                            formContainer.scrollIntoView({ behavior: 'smooth' });
                        }
                    }
                });
            });

            tbody.querySelectorAll('.btn-excluir-parc').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    if (confirm(`Confirma a exclusão da parcela ${id}?`)) {
                        window.AgronomicTerritory.removeParcela(id, 'Usuário Gestão Agronômica');
                        renderAllTerritoryData();
                        aplicarFiltros();
                    }
                });
            });
        }

        if (inputBusca) {
            inputBusca.addEventListener('input', renderParcelasTable);
        }

        // Formulário de Nova Parcela
        if (btnNova) {
            btnNova.addEventListener('click', () => {
                if (inpParcelaId) inpParcelaId.value = '';
                if (inpFazenda) inpFazenda.value = '';
                if (inpNomeFaz) inpNomeFaz.value = '';
                if (inpZona) inpZona.value = '3';
                if (inpTalhao) inpTalhao.value = '';
                if (inpArea) inpArea.value = '';
                if (formTitle) formTitle.innerText = 'Cadastrar Nova Parcela Agronômica';
                if (formContainer) formContainer.classList.remove('hidden');
            });
        }

        if (btnCancelarForm) {
            btnCancelarForm.addEventListener('click', () => {
                if (formContainer) formContainer.classList.add('hidden');
            });
        }

        if (btnSalvar) {
            btnSalvar.addEventListener('click', () => {
                const fazenda = inpFazenda ? inpFazenda.value.trim() : '';
                const talhao = inpTalhao ? inpTalhao.value.trim() : '';
                const area = inpArea ? parseFloat(inpArea.value.replace(',', '.')) : 0;
                const nomeFaz = inpNomeFaz ? inpNomeFaz.value.trim() : '';
                const zona = inpZona ? parseInt(inpZona.value, 10) : 1;
                const existingId = inpParcelaId ? inpParcelaId.value.trim() : '';

                if (!fazenda || !talhao || isNaN(area) || area <= 0) {
                    alert('Por favor, preencha Fazenda, Talhão e uma Área em hectares válida maior que zero.');
                    return;
                }

                const parcelaObj = {
                    id: existingId || `PARC_${fazenda}_Z${zona}_T${talhao}_${Date.now()}`,
                    fazenda: fazenda,
                    nome_faz: nomeFaz || `FAZENDA ${fazenda}`,
                    zona: zona,
                    talhao: talhao,
                    area: area,
                    origem: 'Manual Gestor',
                    situacao: 'Auditado'
                };

                window.AgronomicTerritory.addOrUpdateParcela(parcelaObj, 'Gestor Agronômico');
                if (formContainer) formContainer.classList.add('hidden');
                renderAllTerritoryData();
                aplicarFiltros();
            });
        }

        // Exportação e Importação
        if (btnExportarJson) {
            btnExportarJson.addEventListener('click', () => {
                const jsonStr = window.AgronomicTerritory.exportToJson();
                downloadFile(jsonStr, 'pitangueiras_areas_cadastrais_2026.json', 'application/json');
            });
        }

        if (btnExportarCsv) {
            btnExportarCsv.addEventListener('click', () => {
                const csvStr = window.AgronomicTerritory.exportToCsv();
                downloadFile(csvStr, 'pitangueiras_areas_cadastrais_2026.csv', 'text/csv;charset=utf-8;');
            });
        }

        if (fileImport) {
            fileImport.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function (evt) {
                    try {
                        const content = evt.target.result;
                        if (file.name.endsWith('.json')) {
                            const res = window.AgronomicTerritory.importFromJson(content, 'Importação Arquivo');
                            alert(`Importação concluída com sucesso! Total: ${res.total} parcelas.`);
                        } else {
                            alert('Importação via CSV suportada; converta para JSON ou use a semente oficial.');
                        }
                        renderAllTerritoryData();
                        aplicarFiltros();
                    } catch (err) {
                        alert('Falha ao processar arquivo: ' + err.message);
                    }
                };
                reader.readAsText(file);
            });
        }

        if (btnResetPadrao) {
            btnResetPadrao.addEventListener('click', () => {
                if (confirm('Deseja realmente restaurar a base territorial para a semente auditada padrão (incluindo o Sítio Benvinda com 30,65 ha)?')) {
                    window.AgronomicTerritory.resetToDefault('Administrador');
                    renderAllTerritoryData();
                    aplicarFiltros();
                }
            });
        }

        // Sincronização dos Parâmetros Técnicos
        function syncParamsForm() {
            if (!window.BrocaEngine) return;
            const p = window.BrocaEngine.getParams();

            if (selManejo) selManejo.value = p.manejo || 'soca';
            if (inpMinAdultos) inpMinAdultos.value = p.manejo === 'plantio' ? p.min_adultos_plantio : p.min_adultos_soca;
            if (chkSimulacao) chkSimulacao.checked = Boolean(p.is_modo_simulacao);
            if (containerSimulacao) {
                if (p.is_modo_simulacao) containerSimulacao.classList.remove('hidden');
                else containerSimulacao.classList.add('hidden');
            }
            if (inpLimiteSimulacao) inpLimiteSimulacao.value = p.limite_simulacao_pct || 30.0;
        }

        if (selManejo) {
            selManejo.addEventListener('change', (e) => {
                const val = e.target.value;
                window.BrocaEngine.setParams({ manejo: val });
                syncParamsForm();
                aplicarFiltros();
            });
        }

        if (inpMinAdultos) {
            inpMinAdultos.addEventListener('change', (e) => {
                const val = parseInt(e.target.value, 10) || 6;
                const p = window.BrocaEngine.getParams();
                if (p.manejo === 'plantio') {
                    window.BrocaEngine.setParams({ min_adultos_plantio: val });
                } else {
                    window.BrocaEngine.setParams({ min_adultos_soca: val });
                }
                aplicarFiltros();
            });
        }

        if (chkSimulacao) {
            chkSimulacao.addEventListener('change', (e) => {
                const checked = e.target.checked;
                window.BrocaEngine.setParams({ is_modo_simulacao: checked });
                if (containerSimulacao) {
                    if (checked) containerSimulacao.classList.remove('hidden');
                    else containerSimulacao.classList.add('hidden');
                }
                aplicarFiltros();
            });
        }

        if (inpLimiteSimulacao) {
            inpLimiteSimulacao.addEventListener('change', (e) => {
                const val = parseFloat(e.target.value) || 30.0;
                window.BrocaEngine.setParams({ limite_simulacao_pct: val });
                aplicarFiltros();
            });
        }

        // Tabela de Auditoria
        function renderAuditoriaTable() {
            const tbody = document.getElementById('tabelaAuditoriaTerritorioBody');
            if (!tbody || !window.AgronomicTerritory) return;
            const logs = window.AgronomicTerritory.getAuditLog();

            if (logs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400">Nenhum evento de auditoria registrado ainda.</td></tr>`;
                return;
            }

            tbody.innerHTML = logs.map(l => `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/60 font-mono text-xs">
                    <td class="p-2.5 text-slate-500">${l.timestamp ? new Date(l.timestamp).toLocaleString('pt-BR') : '-'}</td>
                    <td class="p-2.5 font-bold text-slate-800 dark:text-slate-200">${l.usuario || 'Sistema'}</td>
                    <td class="p-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">${l.acao}</span></td>
                    <td class="p-2.5 font-bold text-emerald-600">${l.fazenda || '-'}</td>
                    <td class="p-2.5 text-slate-600 dark:text-slate-300 font-sans">${l.detalhes}</td>
                </tr>
            `).join('');
        }

        function downloadFile(content, fileName, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    // Inicialização do Modal
    initAreaParamsModal();

    window.applyFilters = aplicarFiltros;
    window.aplicarFiltros = aplicarFiltros;
    window.updateTimelineChart = updateTimelineChart;

})();
