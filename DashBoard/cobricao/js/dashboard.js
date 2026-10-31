// ==========================================================================
// Plugin Universal de Rótulos de Dados (Garante valores visíveis em barras e donuts sob qualquer condição)
// Usina Pitangueiras - Safra 2026
// ==========================================================================
(function() {
    function registerPlugin() {
        if (typeof Chart === 'undefined' || !Chart.register) return;
        const universalDataLabelsPlugin = {
            id: 'pitangueiras_universal_datalabels',
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

                        if (chartType === 'doughnut' || chartType === 'pie') {
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
                    const parent = chart.canvas ? chart.canvas.parentElement : null;
                    const hasHtmlCenter = parent && parent.querySelector('#donutCenterPerc, [id*="CenterPerc"], [id*="centerPerc"], [id*="donutCenter"]');
                    if (!hasHtmlCenter && chart.chartArea) {
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
 * dashboard.js - Controlador do Dashboard de Profundidade de Cobrição
 * Usina Pitangueiras - Safra 2026
 */

(function () {
    'use strict';

    // Estado Global da Aplicação
    const state = {
        rawData: [],
        filteredData: [],
        filters: {
            dateExact: '', // Inicializado na data mais recente disponível
            dateStart: '',
            dateEnd: '',
            frente: 'all',
            os: 'all',
            local: 'all',
            responsavel: 'all',
            profundidade: 'all',
            profMin: '',
            profMax: '',
            status: 'all',
            onlyOutliers: false,
            excludeOutliers: false,
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
        timePeriodMode: 'diario', // 'diario', 'semanal', 'mensal'
        timeMetricMode: 'media',  // 'media', 'mediana', 'volume'
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
    function _bootstrapApp() () => {
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
            cobricao: '#b45309',
            tipico: '#10b981',
            atipico: '#dc2626',
            info: '#0284c7',
            purple: '#8b5cf6'
        };
    }

    /**
     * Carregamento dos Dados
     */
    function initData() {
        if (window.COBRICAO_DATA && Array.isArray(window.COBRICAO_DATA)) {
            state.rawData = [...window.COBRICAO_DATA];
        } else {
            state.rawData = [];
            console.warn('Dataset COBRICAO_DATA não encontrado.');
        }

        // Definir filtro inicial padrão na data mais recente disponível (28/10/2026)
        if (state.rawData.length > 0) {
            const latest = state.rawData[0];
            if (latest && latest.data_dia) {
                state.filters.dateExact = latest.data_dia;
                const inputDate = document.getElementById('filterDateExact');
                if (inputDate) {
                    inputDate.value = latest.data_dia;
                }
            }
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
        const mapContainer = document.getElementById('map-container');
        if (!mapContainer) return;

        state.map = L.map('map-container', {
            center: [-20.88, -48.45],
            zoom: 11,
            zoomControl: true
        });

        // OpenStreetMap Oficial Livre (sem marcas d'água)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors | Usina Pitangueiras 2026',
            maxZoom: 19
        }).addTo(state.map);

        state.markersLayer = L.layerGroup().addTo(state.map);
    }

    /**
     * Atualização dos Marcadores no Mapa com Cores por Profundidade
     */
    function updateMap(records) {
        if (!state.map || !state.markersLayer) return;

        state.markersLayer.clearLayers();
        const validPoints = records.filter(r => r.has_coords && r.lat && r.lon);

        if (validPoints.length === 0) return;

        const bounds = [];

        validPoints.forEach(r => {
            const color = r.cor_profundidade || '#10b981';
            const isAtipico = r.is_outlier;

            const marker = L.circleMarker([r.lat, r.lon], {
                radius: isAtipico ? 8 : 5.5,
                fillColor: color,
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.88
            });

            const diffText = r.diff_mediana !== null
                ? (r.diff_mediana >= 0 ? `+${r.diff_mediana}` : `${r.diff_mediana}`)
                : '-';

            const popupContent = `
                <div class="popup-header" style="color: ${color}">
                    <span>${isAtipico ? '⚠️' : '📍'}</span>
                    <span>Medição #${r.id} • Profundidade: ${r.profundidade_orig}</span>
                </div>
                <div class="popup-row"><strong>Data:</strong> ${r.data}</div>
                <div class="popup-row"><strong>Frente:</strong> ${r.frente}</div>
                <div class="popup-row"><strong>OS:</strong> ${r.os} | <strong>Local:</strong> ${r.local}</div>
                <div class="popup-row"><strong>Resp:</strong> ${r.responsavel}</div>
                <div class="popup-row"><strong>Diagnóstico:</strong> <span style="font-weight: 700; color: ${color};">${r.categoria_analitica}</span> (Dif. p/ Mediana: ${diffText})</div>
                <div style="margin-top: 0.5rem; text-align: right;">
                    <a href="javascript:void(0)" onclick="window.viewDetails(${r.id})" style="color: #b45309; font-weight: 600; text-decoration: underline;">Ver Detalhes Completos</a>
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
    function applyFilters() {
        state.filteredData = CobricaoEngine.filterRecords(state.rawData, state.filters);
        state.pagination.currentPage = 1;

        updateKPIs();
        updateCharts();
        updateMap(state.filteredData);
        updateTable();
    }

    /**
     * Atualização dos Cards de KPIs
     */
    function updateKPIs() {
        const metrics = CobricaoEngine.calculateMetrics(
            state.filteredData,
            state.filters.excludeOutliers
        );

        setText('kpiTotalRegistros', metrics.totalRecords.toLocaleString('pt-BR'));
        setText('kpiPeriodoAmostral', state.filters.dateExact ? `Data: ${state.filters.dateExact}` : 'Histórico Selecionado');

        setText('kpiProfMedia', CobricaoEngine.formatNumberBR(metrics.media, 2));
        setText('kpiDesvioPadrao', metrics.desvioPadrao !== null ? `Desvio: ±${metrics.desvioPadrao.toFixed(2)}` : 'Desvio: N/D');
        setText('kpiAmostrasValidas', `${metrics.validProfCount.toLocaleString('pt-BR')} válidos`);

        setText('kpiProfMediana', CobricaoEngine.formatNumberBR(metrics.mediana, 2));
        setText('kpiMenorProf', CobricaoEngine.formatNumberBR(metrics.min, 2));
        setText('kpiMaiorProf', CobricaoEngine.formatNumberBR(metrics.max, 2));
        setText('kpiAmplitude', metrics.amplitude !== null ? metrics.amplitude.toFixed(2) : 'N/D');

        setText('kpiFrentesCount', metrics.uniqueFrentes.toLocaleString('pt-BR'));
        setText('kpiTalhoesOS', `${metrics.uniqueLocais} / ${metrics.uniqueOS}`);
        setText('kpiResponsaveisCount', `${metrics.uniqueResponsaveis} responsáveis`);

        setText('kpiStatusAberto', metrics.pendentesCount.toLocaleString('pt-BR'));

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
    function updateCharts() {
        renderDistributionChart();
        renderCumulativeChart();
        renderTimelineChart();
        renderFrentesChart();
        renderOSChart();
        renderLocaisChart();
        renderResponsaveisChart();
        renderScatterChart();
        renderHourlyChart();
    }

    function updateChartsTheme() {
        updateCharts();
    }

    /**
     * Gráfico A: Distribuição das Profundidades
     */
    function renderDistributionChart() {
        const ctx = document.getElementById('chartDistribution');
        if (!ctx) return;

        const dist = CobricaoEngine.calculateDepthDistribution(state.filteredData);
        const colors = getThemeColors();

        if (state.charts.distribution) state.charts.distribution.destroy();

        state.charts.distribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dist.items.map(i => `Profundidade ${i.depth}`),
                datasets: [{
                    label: 'Quantidade de Medições',
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
     * Gráfico B: Frequência Acumulada
     */
    function renderCumulativeChart() {
        const ctx = document.getElementById('chartCumulative');
        if (!ctx) return;

        const dist = CobricaoEngine.calculateDepthDistribution(state.filteredData);
        const colors = getThemeColors();

        if (state.charts.cumulative) state.charts.cumulative.destroy();

        state.charts.cumulative = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dist.items.map(i => `Prof. ${i.depth}`),
                datasets: [{
                    label: '% Acumulado de Amostras',
                    data: dist.items.map(i => i.cumPerc),
                    borderColor: '#b45309',
                    backgroundColor: 'rgba(180, 83, 9, 0.1)',
                    fill: true,
                    borderWidth: 2.5,
                    pointRadius: 5,
                    pointBackgroundColor: '#b45309',
                    tension: 0.25
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, labels: { color: colors.textPrimary } },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const item = dist.items[context.dataIndex];
                                return `${context.parsed.y}% acumulado (${item.cumulative} medições)`;
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
                        min: 0,
                        max: 100,
                        ticks: {
                            color: colors.textSecondary,
                            callback: v => `${v}%`
                        },
                        grid: { color: colors.gridColor }
                    }
                }
            }
        });
    }

    /**
     * Gráfico C: Evolução Temporal (Diário / Semanal / Mensal)
     */
    function renderTimelineChart() {
        const ctx = document.getElementById('chartTimeline');
        if (!ctx) return;

        const timeline = CobricaoEngine.calculateTemporalEvolution(state.filteredData, state.timePeriodMode);
        const colors = getThemeColors();

        let datasetLabel = 'Profundidade Média';
        let datasetData = timeline.map(t => t.media);
        let lineColor = colors.cobricao;

        if (state.timeMetricMode === 'mediana') {
            datasetLabel = 'Profundidade Mediana';
            datasetData = timeline.map(t => t.mediana);
            lineColor = colors.tipico;
        } else if (state.timeMetricMode === 'volume') {
            datasetLabel = 'Volume de Medições';
            datasetData = timeline.map(t => t.count);
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
                    borderWidth: 2,
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
                        ticks: { color: colors.textSecondary },
                        grid: { color: colors.gridColor }
                    }
                }
            }
        });
    }

    /**
     * Gráfico D: Desempenho por Frente
     */
    function renderFrentesChart() {
        const ctx = document.getElementById('chartFrentes');
        if (!ctx) return;

        const frentes = CobricaoEngine.calculateFrentesBreakdown(state.filteredData);
        const colors = getThemeColors();

        if (state.charts.frentes) state.charts.frentes.destroy();

        state.charts.frentes = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: frentes.map(f => f.frente),
                datasets: [
                    {
                        label: 'Profundidade Média',
                        data: frentes.map(f => f.media),
                        backgroundColor: '#b45309',
                        yAxisID: 'y'
                    },
                    {
                        label: 'Volume de Medições',
                        data: frentes.map(f => f.count),
                        backgroundColor: 'rgba(148, 163, 184, 0.4)',
                        yAxisID: 'y1'
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
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: { color: colors.textSecondary },
                        grid: { color: colors.gridColor }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: colors.textSecondary }
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

        const topOS = CobricaoEngine.calculateOSBreakdown(state.filteredData, 15);
        const colors = getThemeColors();

        if (state.charts.os) state.charts.os.destroy();

        state.charts.os = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topOS.map(o => `OS ${o.os}`),
                datasets: [{
                    label: 'Profundidade Média',
                    data: topOS.map(o => o.media),
                    backgroundColor: '#10b981',
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
                                return `Volume: ${item.count} medições | Frente: ${item.frente}`;
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

        const topLocais = CobricaoEngine.calculateLocaisBreakdown(state.filteredData, 15);
        const colors = getThemeColors();

        if (state.charts.locais) state.charts.locais.destroy();

        state.charts.locais = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topLocais.map(l => l.local),
                datasets: [{
                    label: 'Profundidade Média',
                    data: topLocais.map(l => l.media),
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
                                return `Volume: ${item.count} | Amplitude: ${item.amplitude} | Frente: ${item.frente}`;
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
     * Gráfico G: Análise por Responsável
     */
    function renderResponsaveisChart() {
        const ctx = document.getElementById('chartResponsaveis');
        if (!ctx) return;

        const resps = CobricaoEngine.calculateResponsaveisBreakdown(state.filteredData, 12);
        const colors = getThemeColors();

        if (state.charts.responsaveis) state.charts.responsaveis.destroy();

        state.charts.responsaveis = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: resps.map(r => r.responsavel.length > 25 ? r.responsavel.slice(0, 22) + '...' : r.responsavel),
                datasets: [{
                    label: 'Profundidade Média',
                    data: resps.map(r => r.media),
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
                                return `Medições: ${item.count} | Mediana: ${item.mediana} | Frentes: ${item.frentes}`;
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
     * Gráfico H: Dispersão Individual (Scatter Plot)
     */
    function renderScatterChart() {
        const ctx = document.getElementById('chartScatter');
        if (!ctx) return;

        const scatterData = CobricaoEngine.calculateScatterData(state.filteredData);
        const colors = getThemeColors();

        const typicalPoints = scatterData.filter(d => !d.is_outlier);
        const outlierPoints = scatterData.filter(d => d.is_outlier);

        if (state.charts.scatter) state.charts.scatter.destroy();

        state.charts.scatter = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Distribuição Típica (Profundidades 6 a 10)',
                        data: typicalPoints.map(p => ({ x: p.x, y: p.y })),
                        backgroundColor: '#10b981',
                        pointRadius: 3
                    },
                    {
                        label: 'Atípicos para Investigação (IQR > 12)',
                        data: outlierPoints.map(p => ({ x: p.x, y: p.y })),
                        backgroundColor: '#ef4444',
                        pointRadius: 6,
                        pointHoverRadius: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, labels: { color: colors.textPrimary } },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const datasetIndex = context.datasetIndex;
                                const dataIndex = context.dataIndex;
                                const item = datasetIndex === 0 ? typicalPoints[dataIndex] : outlierPoints[dataIndex];
                                return [
                                    `ID #${item.id} • Profundidade: ${item.y}`,
                                    `Data: ${item.data}`,
                                    `Frente: ${item.frente} | OS: ${item.os}`,
                                    `Local: ${item.local} | Resp: ${item.resp}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Amostras Cronológicas', color: colors.textSecondary },
                        ticks: { color: colors.textSecondary },
                        grid: { color: colors.gridColor }
                    },
                    y: {
                        title: { display: true, text: 'Profundidade Registrada', color: colors.textSecondary },
                        ticks: { color: colors.textSecondary },
                        grid: { color: colors.gridColor }
                    }
                }
            }
        });
    }

    /**
     * Gráfico I: Ritmo Horário (07h às 18h)
     */
    function renderHourlyChart() {
        const ctx = document.getElementById('chartHourly');
        if (!ctx) return;

        const hourly = CobricaoEngine.calculateHourlyDistribution(state.filteredData);
        const colors = getThemeColors();

        if (state.charts.hourly) state.charts.hourly.destroy();

        state.charts.hourly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hourly.map(h => h.hour),
                datasets: [{
                    label: 'Medições Realizadas',
                    data: hourly.map(h => h.count),
                    backgroundColor: '#d97706',
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
            const color = r.cor_profundidade || '#10b981';

            return `
                <tr>
                    <td><strong>#${r.id}</strong></td>
                    <td>${r.data}</td>
                    <td>${r.frente}</td>
                    <td>${r.os}</td>
                    <td>${r.local}</td>
                    <td>${r.responsavel}</td>
                    <td>
                        <span class="depth-pill" style="background: ${color};">
                            ${r.profundidade_orig}
                        </span>
                    </td>
                    <td>
                        <span class="kpi-badge ${r.is_outlier ? 'badge-atipico' : 'badge-tipico'}">
                            ${r.categoria_analitica}
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

        setText('modalTitle', `Medição #${item.id} • Profundidade de Cobrição`);
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
        setText('mProfOrig', item.profundidade_orig);
        setText('mCategoria', item.categoria_analitica);
        setText('mDiffMed', item.diff_mediana !== null ? (item.diff_mediana >= 0 ? `+${item.diff_mediana}` : `${item.diff_mediana}`) : '-');
        setText('mCoords', item.has_coords ? `${item.lat}, ${item.lon}` : 'Não Georreferenciado');
        setText('mScore', item.score);

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
            'Profundidade de Cobrição': r.profundidade_orig,
            'Diagnóstico Estatístico': r.categoria_analitica,
            'Diferença Mediana': r.diff_mediana,
            'Latitude': r.lat,
            'Longitude': r.lon,
            'Status': r.status,
            'Score': r.score
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Profundidade Cobrição');
        XLSX.writeFile(wb, `profundidade_cobricao_pitangueiras_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    function exportToCSV() {
        const dataToExport = state.filteredData;
        if (dataToExport.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }

        const headers = [
            'ID', 'Data', 'Data Lancamento', 'Frente', 'OS', 'Local',
            'Responsavel', 'Usuario', 'Profundidade Cobricao',
            'Diagnostico Estatistico', 'Diff Mediana', 'Latitude', 'Longitude'
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
                `"${r.profundidade_orig}"`,
                `"${r.categoria_analitica}"`,
                `"${r.diff_mediana !== null ? String(r.diff_mediana).replace('.', ',') : ''}"`,
                `"${r.lat || ''}"`,
                `"${r.lon || ''}"`
            ];
            csvContent += row.join(';') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `profundidade_cobricao_pitangueiras_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    /**
     * Listeners de Eventos
     */
    function initEventListeners() {
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

        const selProf = document.getElementById('filterProfundidade');
        if (selProf) {
            selProf.addEventListener('change', (e) => {
                state.filters.profundidade = e.target.value;
                applyFilters();
            });
        }

        const chkOut = document.getElementById('chkOnlyOutliers');
        if (chkOut) {
            chkOut.addEventListener('change', (e) => {
                state.filters.onlyOutliers = e.target.checked;
                applyFilters();
            });
        }

        const chkExc = document.getElementById('chkExcludeOutliers');
        if (chkExc) {
            chkExc.addEventListener('change', (e) => {
                state.filters.excludeOutliers = e.target.checked;
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
                    profundidade: 'all',
                    profMin: '',
                    profMax: '',
                    status: 'all',
                    onlyOutliers: false,
                    excludeOutliers: false,
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

        const btnMedia = document.getElementById('btnMetricMedia');
        const btnMediana = document.getElementById('btnMetricMediana');
        const btnVolume = document.getElementById('btnMetricVolume');

        function setMetricMode(mode, activeBtn) {
            state.timeMetricMode = mode;
            [btnMedia, btnMediana, btnVolume].forEach(b => b?.classList.remove('active'));
            activeBtn?.classList.add('active');
            renderTimelineChart();
        }

        if (btnMedia) btnMedia.addEventListener('click', () => setMetricMode('media', btnMedia));
        if (btnMediana) btnMediana.addEventListener('click', () => setMetricMode('mediana', btnMediana));
        if (btnVolume) btnVolume.addEventListener('click', () => setMetricMode('volume', btnVolume));

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
