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
 * dashboard.js
 * ============
 * Controlador Executivo da Interface para Viabilidade de Gemas no Plantio
 * Usina Pitangueiras • Safra 2026
 */

(function () {
    'use strict';

    const state = {
        allRecords: [],
        filteredRecords: [],
        targetConfig: null,
        activePeriod: 'latest', // Inicializa na data mais recente por diretriz de negócio
        latestDateStr: '',
        evolutionMode: 'volume',
        evolutionRange: 'ALL', // 'volume', 'percentual'
        breakdownMode: 'frente', // 'frente', 'os', 'local'
        sortColumn: 'data_iso',
        sortDirection: 'desc',
        filters: {
            startDate: '',
            endDate: '',
            specificDate: '',
            frente: 'TODOS',
            os: 'TODOS',
            local: 'TODOS',
            responsavel: 'TODOS',
            consistenciaFilter: 'TODOS',
            inviaveisFilter: 'TODOS',
            faixaTotal: 'TODOS',
            faixaViabilidade: 'TODOS',
            scoreDivergenteFilter: 'TODOS',
            outlierFilter: 'TODOS',
            coordsFilter: 'TODOS',
            onlyInconsistencias: false,
            search: ''
        },
        pagination: {
            currentPage: 1,
            pageSize: 25,
            totalPages: 1
        },
        charts: {
            donut: null,
            evolution: null,
            frentes: null,
            histogram: null,
            scatter: null
        },
        map: null,
        markersLayer: null
    };
    window.dashboardState = state;
    window.state = state;

    function _bootstrapApp() {
        initTheme();
        initData();
        initDropdowns();
        initFilterListeners();
        initCharts();
        initMap();
        initEvolutionFilter();
        applyFiltersAndRender();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _bootstrapApp);
    } else {
        _bootstrapApp();
    }

    // 1. Gerenciamento de Tema
        function initTheme() {
        const saved = localStorage.getItem('mapfy_theme') || localStorage.getItem('pitangueiras_theme') || 'dark';
        if (saved === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            document.documentElement.classList.add('dark');
        }
        updateThemeUI();

        document.querySelectorAll('#themeToggleBtn, #themeToggleBtnToolbar, #themeToggle, .theme-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('mapfy_theme', isDark ? 'dark' : 'light');
                localStorage.setItem('pitangueiras_theme', isDark ? 'dark' : 'light');
                updateThemeUI();
                recreateCharts();
            });
        });
    }

    function updateThemeUI() {
        const isDark = document.documentElement.classList.contains('dark');
        const iconToolbar = document.getElementById('themeIconToolbar');
        const labelToolbar = document.getElementById('themeLabelToolbar');
        if (iconToolbar) iconToolbar.innerText = isDark ? '🌙' : '☀️';
        if (labelToolbar) labelToolbar.innerText = isDark ? 'Escuro' : 'Claro';

        const icon = document.getElementById('themeIcon');
        if (icon) icon.innerText = isDark ? '🌙' : '☀️';
    }

    // 2. Inicialização dos Dados
    function initData() {
        const raw = window.VIABILIDADE_GEMAS_DATA || [];
        state.allRecords = (window.ViabilidadeGemasEngine && typeof window.ViabilidadeGemasEngine.normalizeRecord === 'function')
            ? raw.map(window.ViabilidadeGemasEngine.normalizeRecord)
            : raw;
        state.targetConfig = window.ViabilidadeGemasEngine.getTargetConfig();

        if (state.allRecords.length > 0) {
            state.latestDateStr = state.allRecords[0].data_dia || '28/10/2026';
            const lbl = document.getElementById('lblLatestDate');
            if (lbl) lbl.innerText = state.latestDateStr;

            const bannerDate = document.getElementById('bannerDateStr');
            if (bannerDate) bannerDate.innerText = state.latestDateStr;

            // Filtra inicialmente pela data mais recente por especificação do Prompt Mestre
            state.filters.specificDate = state.latestDateStr;
            const recordsLatest = state.allRecords.filter(r => r.data_dia === state.latestDateStr);
            const bannerCount = document.getElementById('bannerCountStr');
            if (bannerCount) bannerCount.innerText = `${recordsLatest.length} inspeções`;
        }

        const initialMetrics = window.ViabilidadeGemasEngine.calculateMetrics(state.allRecords, state.targetConfig);
        const lblIncons = document.getElementById('lblInconsistenciasCount');
        if (lblIncons) lblIncons.innerText = initialMetrics.inconsistentesCount.toString();

        const inviaveisCount = state.allRecords.filter(r => r.tem_inviaveis).length;
        const lblInv = document.getElementById('lblInviaveisCount');
        if (lblInv) lblInv.innerText = inviaveisCount.toString();
    }

    // 3. Inicialização dos Dropdowns
    function initDropdowns() {
        const frentes = new Set();
        const osList = new Set();
        const locais = new Set();
        const responsaveis = new Set();

        for (let i = 0; i < state.allRecords.length; i++) {
            const r = state.allRecords[i];
            if (r.frente) frentes.add(r.frente);
            if (r.os) osList.add(r.os);
            if (r.local) locais.add(r.local);
            if (r.responsavel) responsaveis.add(r.responsavel);
        }

        populateSelect('filterFrente', Array.from(frentes).sort());
        populateSelect('filterOS', Array.from(osList).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
        populateSelect('filterLocal', Array.from(locais).sort());
        populateSelect('filterResponsavel', Array.from(responsaveis).sort());
    }

    function populateSelect(id, items) {
        const sel = document.getElementById(id);
        if (!sel) return;
        items.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.innerText = val;
            sel.appendChild(opt);
        });
    }

    // 4. Event Listeners dos Filtros
    function initFilterListeners() {
        const inputs = [
            'filterStartDate', 'filterEndDate', 'filterFrente', 'filterOS',
            'filterLocal', 'filterResponsavel', 'filterConsistencia',
            'filterInviaveis', 'filterFaixaTotal', 'filterSearch'
        ];

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    readFiltersFromUI();
                    state.activePeriod = 'custom';
                    updatePeriodButtonsUI();
                    state.pagination.currentPage = 1;
                    initEvolutionFilter();
        applyFiltersAndRender();
                });
            }
        });
    }

    function readFiltersFromUI() {
        state.filters.startDate = document.getElementById('filterStartDate')?.value || '';
        state.filters.endDate = document.getElementById('filterEndDate')?.value || '';
        state.filters.frente = document.getElementById('filterFrente')?.value || 'TODOS';
        state.filters.os = document.getElementById('filterOS')?.value || 'TODOS';
        state.filters.local = document.getElementById('filterLocal')?.value || 'TODOS';
        state.filters.responsavel = document.getElementById('filterResponsavel')?.value || 'TODOS';
        state.filters.consistenciaFilter = document.getElementById('filterConsistencia')?.value || 'TODOS';
        state.filters.inviaveisFilter = document.getElementById('filterInviaveis')?.value || 'TODOS';
        state.filters.faixaTotal = document.getElementById('filterFaixaTotal')?.value || 'TODOS';
        state.filters.search = document.getElementById('filterSearch')?.value || '';
    }

    window.clearAllFilters = function () {
        if (document.getElementById('filterStartDate')) document.getElementById('filterStartDate').value = '';
        if (document.getElementById('filterEndDate')) document.getElementById('filterEndDate').value = '';
        if (document.getElementById('filterFrente')) document.getElementById('filterFrente').value = 'TODOS';
        if (document.getElementById('filterOS')) document.getElementById('filterOS').value = 'TODOS';
        if (document.getElementById('filterLocal')) document.getElementById('filterLocal').value = 'TODOS';
        if (document.getElementById('filterResponsavel')) document.getElementById('filterResponsavel').value = 'TODOS';
        if (document.getElementById('filterConsistencia')) document.getElementById('filterConsistencia').value = 'TODOS';
        if (document.getElementById('filterInviaveis')) document.getElementById('filterInviaveis').value = 'TODOS';
        if (document.getElementById('filterFaixaTotal')) document.getElementById('filterFaixaTotal').value = 'TODOS';
        if (document.getElementById('filterSearch')) document.getElementById('filterSearch').value = '';

        state.filters = {
            startDate: '',
            endDate: '',
            specificDate: '',
            frente: 'TODOS',
            os: 'TODOS',
            local: 'TODOS',
            responsavel: 'TODOS',
            consistenciaFilter: 'TODOS',
            inviaveisFilter: 'TODOS',
            faixaTotal: 'TODOS',
            faixaViabilidade: 'TODOS',
            scoreDivergenteFilter: 'TODOS',
            outlierFilter: 'TODOS',
            coordsFilter: 'TODOS',
            onlyInconsistencias: false,
            search: ''
        };
        state.activePeriod = 'all';
        updatePeriodButtonsUI();
        state.pagination.currentPage = 1;
        initEvolutionFilter();
        applyFiltersAndRender();
    };

    window.setQuickPeriod = function (period) {
        state.activePeriod = period;
        if (period === 'latest') {
            state.filters.specificDate = state.latestDateStr;
        } else {
            state.filters.specificDate = '';
        }
        updatePeriodButtonsUI();
        state.pagination.currentPage = 1;
        initEvolutionFilter();
        applyFiltersAndRender();
    };

    window.toggleInconsistenciasFilter = function () {
        state.filters.onlyInconsistencias = !state.filters.onlyInconsistencias;
        const btn = document.getElementById('btnInconsistencias');
        if (btn) {
            if (state.filters.onlyInconsistencias) {
                btn.className = "px-3 py-1.5 rounded-lg transition-all text-white bg-amber-600 font-bold shadow-sm flex items-center gap-1";
            } else {
                btn.className = "px-3 py-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-amber-500 flex items-center gap-1";
            }
        }
        state.pagination.currentPage = 1;
        initEvolutionFilter();
        applyFiltersAndRender();
    };

    window.toggleInviaveisFilter = function () {
        if (state.filters.inviaveisFilter === 'COM_INVIAVEIS') {
            state.filters.inviaveisFilter = 'TODOS';
        } else {
            state.filters.inviaveisFilter = 'COM_INVIAVEIS';
        }
        const sel = document.getElementById('filterInviaveis');
        if (sel) sel.value = state.filters.inviaveisFilter;

        const btn = document.getElementById('btnInviaveis');
        if (btn) {
            if (state.filters.inviaveisFilter === 'COM_INVIAVEIS') {
                btn.className = "px-3 py-1.5 rounded-lg transition-all text-white bg-rose-600 font-bold shadow-sm flex items-center gap-1";
            } else {
                btn.className = "px-3 py-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-rose-500 flex items-center gap-1";
            }
        }
        state.pagination.currentPage = 1;
        initEvolutionFilter();
        applyFiltersAndRender();
    };

    window.toggleScoreDivergenteFilter = function () {
        state.filters.scoreDivergenteFilter = state.filters.scoreDivergenteFilter === 'DIVERGENTE' ? 'TODOS' : 'DIVERGENTE';
        state.pagination.currentPage = 1;
        initEvolutionFilter();
        applyFiltersAndRender();
    };

    window.toggleOutliersFilter = function () {
        state.filters.outlierFilter = state.filters.outlierFilter === 'OUTLIERS' ? 'TODOS' : 'OUTLIERS';
        state.pagination.currentPage = 1;
        initEvolutionFilter();
        applyFiltersAndRender();
    };

    window.dismissBanner = function () {
        const b = document.getElementById('initialNoticeBanner');
        if (b) b.style.display = 'none';
    };

    function updatePeriodButtonsUI() {
        const btnAll = document.getElementById('btnAllDates');
        const btnLatest = document.getElementById('btnLatestDate');

        if (state.activePeriod === 'all') {
            if (btnAll) btnAll.className = "px-3 py-1.5 rounded-lg transition-all text-white bg-emerald-600 shadow-sm font-bold";
            if (btnLatest) btnLatest.className = "px-3 py-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-emerald-500";
        } else if (state.activePeriod === 'latest') {
            if (btnAll) btnAll.className = "px-3 py-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-emerald-500";
            if (btnLatest) btnLatest.className = "px-3 py-1.5 rounded-lg transition-all text-white bg-emerald-600 shadow-sm font-bold";
        } else {
            if (btnAll) btnAll.className = "px-3 py-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-emerald-500";
            if (btnLatest) btnLatest.className = "px-3 py-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-emerald-500";
        }
    }

    window.setEvolutionMode = function (mode) {
        state.evolutionMode = mode;
        const btnVol = document.getElementById('btnEvolVolume');
        const btnPerc = document.getElementById('btnEvolPerc');

        if (mode === 'volume') {
            if (btnVol) btnVol.className = "px-2.5 py-1 rounded-md text-white bg-emerald-600 font-semibold shadow-sm";
            if (btnPerc) btnPerc.className = "px-2.5 py-1 rounded-md text-[var(--text-secondary)] font-semibold hover:text-emerald-500";
        } else {
            if (btnVol) btnVol.className = "px-2.5 py-1 rounded-md text-[var(--text-secondary)] font-semibold hover:text-emerald-500";
            if (btnPerc) btnPerc.className = "px-2.5 py-1 rounded-md text-white bg-emerald-600 font-semibold shadow-sm";
        }
        updateEvolutionChart();
    };

    window.setBreakdownMode = function (mode) {
        state.breakdownMode = mode;
        const btnF = document.getElementById('btnBreakdownFrente');
        const btnO = document.getElementById('btnBreakdownOS');
        const btnL = document.getElementById('btnBreakdownLocal');

        const activeClass = "px-2 py-0.5 rounded-md text-white bg-emerald-600 font-semibold shadow-sm";
        const inactiveClass = "px-2 py-0.5 rounded-md text-[var(--text-secondary)] font-semibold hover:text-emerald-500";

        if (btnF) btnF.className = mode === 'frente' ? activeClass : inactiveClass;
        if (btnO) btnO.className = mode === 'os' ? activeClass : inactiveClass;
        if (btnL) btnL.className = mode === 'local' ? activeClass : inactiveClass;

        updateFrentesChart();
    };

    // 5. Aplicação de Filtros e Renderização Integrada
    function applyFiltersAndRender() {
        state.filteredRecords = window.ViabilidadeGemasEngine.filterRecords(state.allRecords, state.filters);

        // Ordenação
        sortRecords(state.filteredRecords);

        const m = window.ViabilidadeGemasEngine.calculateMetrics(state.filteredRecords, state.targetConfig);
        const qa = window.ViabilidadeGemasEngine.calculateDataQualitySummary(state.filteredRecords);

        renderKPICards(m, qa);
        renderDonutChart(m);
        updateEvolutionChart();
        updateFrentesChart();
        updateHistogramChart();
        updateScatterChart();
        renderQualityPanel(qa);
        renderMapMarkers();
        renderTable();
    }

    function sortRecords(records) {
        const col = state.sortColumn;
        const dir = state.sortDirection === 'asc' ? 1 : -1;

        records.sort((a, b) => {
            let valA = a[col];
            let valB = b[col];

            if (typeof valA === 'string') {
                return valA.localeCompare(valB) * dir;
            }
            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            return 0;
        });
    }

    window.sortTable = function (col) {
        if (state.sortColumn === col) {
            state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            state.sortColumn = col;
            state.sortDirection = 'desc';
        }
        initEvolutionFilter();
        applyFiltersAndRender();
    };

    // 6. Renderização dos 12 Cards KPIs
    function renderKPICards(m, qa) {
        setElText('kpiTotal', m.totalInspecoes.toLocaleString('pt-BR'));
        setElText('kpiTotalGemas', m.totalGemas.toLocaleString('pt-BR'));
        setElText('kpiGemasViaveis', m.gemasViaveis.toLocaleString('pt-BR'));
        setElText('kpiPercViaveis', `${((m.gemasViaveis / (m.totalGemas || 1)) * 100).toFixed(1)}% do total`);
        setElText('kpiGemasInviaveis', m.gemasInviaveis.toLocaleString('pt-BR'));
        setElText('kpiPercInviaveis', `${((m.gemasInviaveis / (m.totalGemas || 1)) * 100).toFixed(1)}% do total`);
        setElText('kpiViabPonderada', `${m.viabilidadePonderada.toFixed(1)}%`);
        setElText('kpiInviabPonderada', `${m.inviabilidadePonderada.toFixed(1)}%`);
        setElText('diagnosticViabReal', `${m.viabilidadePonderada.toFixed(1)}%`);

        setElText('kpiAmostrasInviaveis', qa.amostrasComInviaveis.toLocaleString('pt-BR'));
        setElText('kpiPercAmostrasInviaveis', `${((qa.amostrasComInviaveis / (m.totalInspecoes || 1)) * 100).toFixed(1)}% das amostras`);

        setElText('kpiInconsistentes', m.inconsistentesCount.toString());
        setElText('kpiPercInconsistentes', `${m.percInconsistentes.toFixed(1)}% das inspeções`);

        setElText('kpiMediaGemas', m.mediaGemasPorInspecao.toFixed(1));
        setElText('kpiMedianaGemas', `mediana: ${m.medianaGemasPorInspecao}`);
        setElText('kpiFrentes', m.frentesCount.toString());
        setElText('kpiOS', m.osCount.toString());
        setElText('kpiGeorefPerc', `${m.percGeoref.toFixed(0)}%`);
        setElText('kpiGeorefCount', `${m.georefCount.toLocaleString('pt-BR')} de ${m.totalInspecoes.toLocaleString('pt-BR')}`);
    }

    function setElText(id, val) {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    }

    // 7. Gráficos Chart.js
    function initCharts() {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? '#2e3238' : '#e2e8f0';

        // A. Donut: Distribuição de Viabilidade Ponderada
        const ctxDonut = document.getElementById('chartDonut');
        if (ctxDonut) {
            state.charts.donut = new Chart(ctxDonut, {
                type: 'doughnut',
                data: {
                    labels: ['Gemas Viáveis', 'Gemas Inviáveis', 'Gemas Inconsistentes'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#10b981', '#f43f5e', '#f59e0b'],
                        borderWidth: 2,
                        borderColor: isDark ? '#1c1e22' : '#ffffff',
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '76%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function (ctx) {
                                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                    const val = ctx.raw;
                                    const perc = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                    return ` ${ctx.label}: ${val.toLocaleString('pt-BR')} (${perc}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // B. Evolução Temporal
        const ctxEvol = document.getElementById('chartEvolution');
        if (ctxEvol) {
            state.charts.evolution = new Chart(ctxEvol, {
                type: 'bar',
                data: { labels: [], datasets: [] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true,
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 10, family: 'JetBrains Mono' } }
                        },
                        y: {
                            stacked: true,
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 10, family: 'JetBrains Mono' } }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: { color: textColor, font: { size: 11, weight: '600' } }
                        }
                    }
                }
            });
        }

        // C. Comparativo Operacional (Frentes / OS / Talhão) com clique interativo
        const ctxFrentes = document.getElementById('chartFrentes');
        if (ctxFrentes) {
            state.charts.frentes = new Chart(ctxFrentes, {
                type: 'bar',
                data: { labels: [], datasets: [] },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: (evt, elements) => {
                        if (elements.length > 0) {
                            const idx = elements[0].index;
                            const label = state.charts.frentes.data.labels[idx];
                            if (state.breakdownMode === 'frente') {
                                const sel = document.getElementById('filterFrente');
                                if (sel) {
                                    // Procura o valor que inicia com ou coincide
                                    for (let i = 0; i < sel.options.length; i++) {
                                        if (sel.options[i].value.startsWith(label) || label.startsWith(sel.options[i].value)) {
                                            sel.selectedIndex = i;
                                            readFiltersFromUI();
                                            initEvolutionFilter();
        applyFiltersAndRender();
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            max: 100,
                            grid: { color: gridColor },
                            ticks: {
                                color: textColor,
                                font: { size: 10, family: 'JetBrains Mono' },
                                callback: val => `${val}%`
                            }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 10 } }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%`
                            }
                        }
                    }
                }
            });
        }

        // D. Histograma de Distribuição das Quantidades Totais
        const ctxHist = document.getElementById('chartHistogram');
        if (ctxHist) {
            state.charts.histogram = new Chart(ctxHist, {
                type: 'bar',
                data: { labels: [], datasets: [] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 10 } }
                        },
                        y: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 10, family: 'JetBrains Mono' } }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }

        // E. Dispersão (Scatter Plot): Total de Gemas vs Viáveis (Seção 9.F)
        const ctxScatter = document.getElementById('chartScatter');
        if (ctxScatter) {
            state.charts.scatter = new Chart(ctxScatter, {
                type: 'scatter',
                data: { datasets: [] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: (evt, elements) => {
                        if (elements.length > 0) {
                            const point = elements[0];
                            const dataset = state.charts.scatter.data.datasets[point.datasetIndex];
                            const raw = dataset.data[point.index];
                            if (raw && raw.id) {
                                openRecordModal(raw.id);
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: 'Total de Gemas', color: textColor, font: { size: 10 } },
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 9, family: 'JetBrains Mono' } }
                        },
                        y: {
                            title: { display: true, text: 'Gemas Viáveis', color: textColor, font: { size: 10 } },
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 9, family: 'JetBrains Mono' } }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => {
                                    const p = ctx.raw;
                                    return ` #${p.id} | Total: ${p.x}, Viáveis: ${p.y} (${p.viab}%) | Dif: ${p.diff}`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    function recreateCharts() {
        if (state.charts.donut) state.charts.donut.destroy();
        if (state.charts.evolution) state.charts.evolution.destroy();
        if (state.charts.frentes) state.charts.frentes.destroy();
        if (state.charts.histogram) state.charts.histogram.destroy();
        if (state.charts.scatter) state.charts.scatter.destroy();
        initCharts();
        initEvolutionFilter();
        applyFiltersAndRender();
    }

    // 8. Atualização do Donut de Conformidade (REGRA ESTRITA)
    function renderDonutChart(m) {
        if (!state.charts.donut) return;

        const totalGemasInconsistentes = Math.max(0, m.totalGemas - m.totalGemasConsistente);
        state.charts.donut.data.datasets[0].data = [
            m.viaveisConsistente,
            m.inviaveisConsistente,
            totalGemasInconsistentes
        ];
        state.charts.donut.update();

        // CENTRO DO DONUT: SEMPRE EXIBE O QUE ESTÁ NA META!
        setElText('donutCenterPerc', `${m.viabilidadePonderada.toFixed(1)}%`);
        setElText('donutCenterCount', `${m.viaveisConsistente.toLocaleString('pt-BR')} de ${m.totalGemasConsistente.toLocaleString('pt-BR')} gemas`);

        // DISCRIMINAÇÃO DOS VALORES E BARRAS ABAIXO DO DONUT
        setElText('donutValViaveis', `${m.viaveisConsistente.toLocaleString('pt-BR')} (${m.viabilidadePonderada.toFixed(1)}%)`);
        const barViaveis = document.getElementById('donutBarViaveis');
        if (barViaveis) barViaveis.style.width = `${m.viabilidadePonderada}%`;

        setElText('donutValInviaveis', `${m.inviaveisConsistente.toLocaleString('pt-BR')} (${m.inviabilidadePonderada.toFixed(1)}%)`);
        const barInviaveis = document.getElementById('donutBarInviaveis');
        if (barInviaveis) barInviaveis.style.width = `${Math.min(100, m.inviabilidadePonderada * 8)}%`;

        setElText('donutValInconsistentes', `${m.inconsistentesCount} reg. (${m.percInconsistentes.toFixed(1)}%)`);
        const barIncons = document.getElementById('donutBarInconsistentes');
        if (barIncons) barIncons.style.width = `${Math.min(100, m.percInconsistentes * 8)}%`;
    }

    // 9. Atualização da Evolução Temporal
    function updateEvolutionChart() {
        if (!state.charts.evolution) return;

        let evo = window.ViabilidadeGemasEngine.calculateTemporalEvolution(state.filteredRecords);
        if (state.evolutionRange === '7D' && evo.dates.length > 7) {
            evo = {
                dates: evo.dates.slice(-7),
                viaveis: evo.viaveis.slice(-7),
                inviaveis: evo.inviaveis.slice(-7),
                percViaveis: evo.percViaveis.slice(-7),
                totalGemas: evo.totalGemas.slice(-7)
            };
        } else if (state.evolutionRange === '15D' && evo.dates.length > 15) {
            evo = {
                dates: evo.dates.slice(-15),
                viaveis: evo.viaveis.slice(-15),
                inviaveis: evo.inviaveis.slice(-15),
                percViaveis: evo.percViaveis.slice(-15),
                totalGemas: evo.totalGemas.slice(-15)
            };
        }
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#475569';

        if (state.evolutionMode === 'volume') {
            state.charts.evolution.config.type = 'bar';
            state.charts.evolution.data = {
                labels: evo.dates,
                datasets: [
                    {
                        label: 'Gemas Viáveis',
                        data: evo.viaveis,
                        backgroundColor: '#10b981',
                        borderRadius: 3
                    },
                    {
                        label: 'Gemas Inviáveis',
                        data: evo.inviaveis,
                        backgroundColor: '#f43f5e',
                        borderRadius: 3
                    }
                ]
            };
            state.charts.evolution.options.scales.y.stacked = true;
            state.charts.evolution.options.scales.x.stacked = true;
            state.charts.evolution.options.scales.y.ticks.callback = val => val;
            state.charts.evolution.options.scales.y.max = undefined;
        } else {
            state.charts.evolution.config.type = 'line';
            state.charts.evolution.data = {
                labels: evo.dates,
                datasets: [
                    {
                        label: 'Viabilidade Ponderada (%)',
                        data: evo.viabilidadePonderada,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 2
                    }
                ]
            };
            state.charts.evolution.options.scales.y.stacked = false;
            state.charts.evolution.options.scales.x.stacked = false;
            state.charts.evolution.options.scales.y.ticks.callback = val => `${val}%`;
            state.charts.evolution.options.scales.y.max = 100;
        }

        state.charts.evolution.update();
    }

    // 10. Atualização do Comparativo Operacional (Frentes / OS / Talhões)
    function updateFrentesChart() {
        if (!state.charts.frentes) return;

        let items = [];
        let labelProp = '';

        if (state.breakdownMode === 'frente') {
            items = window.ViabilidadeGemasEngine.calculateFrenteBreakdown(state.filteredRecords).slice(0, 8);
            labelProp = 'frente';
        } else if (state.breakdownMode === 'os') {
            items = window.ViabilidadeGemasEngine.calculateOSBreakdown(state.filteredRecords).slice(0, 8);
            labelProp = 'os';
        } else {
            items = window.ViabilidadeGemasEngine.calculateLocalBreakdown(state.filteredRecords).slice(0, 8);
            labelProp = 'local';
        }

        state.charts.frentes.data = {
            labels: items.map(it => {
                const txt = it[labelProp] || '';
                return txt.length > 22 ? txt.substring(0, 20) + '...' : txt;
            }),
            datasets: [{
                label: '% Viabilidade Ponderada',
                data: items.map(it => it.viabilidadePonderada),
                backgroundColor: '#10b981',
                borderRadius: 4
            }]
        };
        state.charts.frentes.update();
    }

    // 11. Atualização do Histograma de Quantidades Totais
    function updateHistogramChart() {
        if (!state.charts.histogram) return;

        const hist = window.ViabilidadeGemasEngine.calculateTotalGemasDistribution(state.filteredRecords);
        state.charts.histogram.data = {
            labels: hist.labels,
            datasets: [{
                label: 'Amostras',
                data: hist.counts,
                backgroundColor: '#10b981',
                borderRadius: 4
            }]
        };
        state.charts.histogram.update();

        // Atualiza estatísticas no rodapé do histograma
        if (hist.stats) {
            setElText('lblStatMin', hist.stats.min.toString());
            setElText('lblStatMax', hist.stats.max.toString());
            setElText('lblOutliersCount', `${hist.stats.outliersCount} outliers estatísticos`);
            setElText('lblTukeyFences', `Q1=${hist.stats.q1} • Med=${hist.stats.median} • Q3=${hist.stats.q3}`);
        }
    }

    // 12. Atualização do Scatter Plot (Dispersão Total vs Viáveis)
    function updateScatterChart() {
        if (!state.charts.scatter) return;

        const pts = window.ViabilidadeGemasEngine.calculateScatterData(state.filteredRecords, 400);

        const datasetNormal = {
            label: 'Consistente',
            data: pts.filter(p => p.isConsistente && p.diff === 0 && p.inv === 0),
            backgroundColor: '#10b981',
            pointRadius: 3
        };

        const datasetComInviaveis = {
            label: 'Com Inviáveis',
            data: pts.filter(p => p.inv > 0 && p.isConsistente),
            backgroundColor: '#f43f5e',
            pointRadius: 4
        };

        const datasetInconsistente = {
            label: 'Inconsistência',
            data: pts.filter(p => !p.isConsistente),
            backgroundColor: '#f59e0b',
            pointRadius: 5
        };

        state.charts.scatter.data = {
            datasets: [datasetNormal, datasetComInviaveis, datasetInconsistente]
        };
        state.charts.scatter.update();
    }

    // 13. Painel de Qualidade e Confiabilidade dos Dados
    function renderQualityPanel(qa) {
        setElText('qaTotal', qa.totalRecords.toLocaleString('pt-BR'));
        setElText('qaDuplicados', qa.duplicateIds.toString());
        setElText('qaInconsistentes', qa.inconsistentes.toString());
        setElText('qaAusentes', qa.missingValues.toString());
        setElText('qaCoordsInvalidas', qa.invalidCoords.toString());
        setElText('qaDatasInvalidas', qa.invalidDates.toString());
        setElText('qaScoreDivergente', qa.divergenciaScore.toLocaleString('pt-BR'));
        setElText('qaOutliers', qa.outliers.toString());
    }

    // 14. Mapa Leaflet (OpenStreetMap Livre de API Key e Marcas d'água)
    function initMap() {
        const container = document.getElementById('mapContainer');
        if (!container) return;

        state.map = L.map('mapContainer', {
            center: [-20.88, -48.45],
            zoom: 11,
            zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors | Usina Pitangueiras 2026',
            maxZoom: 19
        }).addTo(state.map);

        state.markersLayer = L.layerGroup().addTo(state.map);
    }

    function renderMapMarkers() {
        if (!state.map || !state.markersLayer) return;
        state.markersLayer.clearLayers();

        const bounds = [];
        const records = state.filteredRecords;
        const maxPoints = Math.min(records.length, 1200);

        for (let i = 0; i < maxPoints; i++) {
            const r = records[i];
            if (!r.lat || !r.lon || r.lat === 0 || r.lon === 0) continue;

            bounds.push([r.lat, r.lon]);

            let pinClass = 'custom-pin-viavel';
            let pinLabel = '✓';

            if (!r.is_consistente) {
                pinClass = 'custom-pin-inconsistente';
                pinLabel = '⚠️';
            } else if (r.gemas_inviaveis > 0 || r.viabilidade_ind < 95.0) {
                pinClass = 'custom-pin-inviavel';
                pinLabel = '✕';
            }

            const icon = L.divIcon({
                className: 'custom-leaflet-pin',
                html: `<div class="custom-pin ${pinClass}">${pinLabel}</div>`,
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });

            const popupContent = `
                <div class="text-xs p-1 space-y-1">
                    <div class="font-bold text-sm text-emerald-500">
                        Inspeção #${r.id} • Viabilidade ${r.viabilidade_ind}%
                    </div>
                    <div><strong>Data:</strong> ${r.data}</div>
                    <div><strong>Frente:</strong> ${r.frente}</div>
                    <div><strong>OS:</strong> ${r.os}</div>
                    <div><strong>Local:</strong> ${r.local}</div>
                    <div><strong>Gemas Total:</strong> ${r.gemas_total} (Viáveis: ${r.gemas_viaveis}, Inviáveis: ${r.gemas_inviaveis})</div>
                    ${!r.is_consistente ? `<div class="text-amber-500 font-bold">⚠️ Inconsistência: Diferença de ${r.diferenca} gemas</div>` : '<div class="text-emerald-500 font-semibold">✓ Contagem Consistente</div>'}
                    <div class="pt-1">
                        <button onclick="openRecordModal(${r.id})" class="px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-bold">
                            Ver Detalhes
                        </button>
                    </div>
                </div>
            `;

            L.marker([r.lat, r.lon], { icon }).bindPopup(popupContent).addTo(state.markersLayer);
        }

        if (bounds.length > 0) {
            state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
        }
    }

    window.resetMapBounds = function () {
        renderMapMarkers();
    };

    // 15. Tabela Analítica e Paginação
    function renderTable() {
        const tbody = document.getElementById('tableRecordsBody');
        if (!tbody) return;

        const total = state.filteredRecords.length;
        state.pagination.totalPages = Math.ceil(total / state.pagination.pageSize) || 1;
        if (state.pagination.currentPage > state.pagination.totalPages) {
            state.pagination.currentPage = 1;
        }

        const startIdx = (state.pagination.currentPage - 1) * state.pagination.pageSize;
        const endIdx = Math.min(startIdx + state.pagination.pageSize, total);
        const pageRecords = state.filteredRecords.slice(startIdx, endIdx);

        tbody.innerHTML = '';
        if (pageRecords.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" class="p-8 text-center text-xs text-[var(--text-secondary)]">
                        Nenhum registro encontrado para os filtros selecionados.
                    </td>
                </tr>
            `;
        } else {
            pageRecords.forEach(r => {
                const tr = document.createElement('tr');
                tr.className = "table-row-hover transition-colors";

                const consistenciaBadge = r.is_consistente
                    ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold badge-consistente">Consistente</span>'
                    : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold badge-inconsistente">Dif: ${r.diferenca}</span>`;

                tr.innerHTML = `
                    <td class="p-3 font-mono font-bold">${r.id}</td>
                    <td class="p-3 font-mono text-[11px] whitespace-nowrap">${r.data}</td>
                    <td class="p-3 font-mono font-bold">${r.gemas_total}</td>
                    <td class="p-3 font-mono text-emerald-500 font-bold">${r.gemas_viaveis}</td>
                    <td class="p-3 font-mono ${r.gemas_inviaveis > 0 ? 'text-rose-500 font-bold' : 'opacity-50'}">${r.gemas_inviaveis}</td>
                    <td class="p-3 font-mono font-bold text-emerald-500">${r.viabilidade_ind.toFixed(1)}%</td>
                    <td class="p-3">${consistenciaBadge}</td>
                    <td class="p-3 truncate max-w-[150px]" title="${r.frente}">${r.frente}</td>
                    <td class="p-3 font-mono">${r.os || '--'}</td>
                    <td class="p-3 font-mono truncate max-w-[120px]" title="${r.local}">${r.local || '--'}</td>
                    <td class="p-3 truncate max-w-[130px]" title="${r.responsavel}">${r.responsavel || '--'}</td>
                    <td class="p-3 text-center">
                        <button onclick="openRecordModal(${r.id})"
                                class="px-2.5 py-1 rounded-lg border text-[11px] font-semibold hover:border-emerald-500 transition-colors"
                                style="background: var(--bg-kpi); border-color: var(--border-color); color: var(--text-primary);">
                            Ver
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        setElText('paginationInfo', `Mostrando ${total > 0 ? startIdx + 1 : 0}-${endIdx} de ${total.toLocaleString('pt-BR')} registros`);
        setElText('pageNumber', state.pagination.currentPage.toString());

        const btnPrev = document.getElementById('btnPrevPage');
        const btnNext = document.getElementById('btnNextPage');
        if (btnPrev) btnPrev.disabled = (state.pagination.currentPage <= 1);
        if (btnNext) btnNext.disabled = (state.pagination.currentPage >= state.pagination.totalPages);
    }

    window.prevPage = function () {
        if (state.pagination.currentPage > 1) {
            state.pagination.currentPage--;
            renderTable();
        }
    };

    window.nextPage = function () {
        if (state.pagination.currentPage < state.pagination.totalPages) {
            state.pagination.currentPage++;
            renderTable();
        }
    };

    window.changePageSize = function (size) {
        state.pagination.pageSize = parseInt(size, 10);
        state.pagination.currentPage = 1;
        renderTable();
    };

    // 16. Modal de Detalhes
    window.openRecordModal = function (id) {
        const r = state.allRecords.find(item => item.id === id);
        if (!r) return;

        setElText('modalRecordTitle', `Inspeção #${r.id}`);
        setElText('modalRecordDate', `${r.data} • Status: ${r.status}`);
        setElText('modalTotalGemas', r.gemas_total.toString());
        setElText('modalViaveis', r.gemas_viaveis.toString());
        setElText('modalInviaveis', r.gemas_inviaveis.toString());
        setElText('modalFrente', r.frente || '--');
        setElText('modalOS', r.os || '--');
        setElText('modalLocal', r.local || '--');
        setElText('modalResp', r.responsavel || '--');
        setElText('modalDuracao', `${r.duracao_min} min`);
        setElText('modalScore', `${r.score_perc}% (${r.score_desc})`);
        setElText('modalCoords', `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`);

        const cBadge = document.getElementById('modalConsistenciaBadge');
        if (cBadge) {
            cBadge.innerText = r.is_consistente ? 'Contagem Consistente' : `Inconsistência (Dif: ${r.diferenca})`;
            cBadge.className = r.is_consistente
                ? "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider badge-consistente"
                : "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider badge-inconsistente";
        }

        const vBadge = document.getElementById('modalViabBadge');
        if (vBadge) {
            vBadge.innerText = `${r.viabilidade_ind.toFixed(1)}% Viabilidade`;
        }

        setElText('modalDiffText', `Diferença: ${r.diferenca}`);
        setElText('modalAuditExplain', r.is_consistente
            ? `Contagem consistente: Total (${r.gemas_total}) = Viáveis (${r.gemas_viaveis}) + Inviáveis (${r.gemas_inviaveis}).`
            : `Contagem divergente: Total digitado (${r.gemas_total}) difere da soma de viáveis (${r.gemas_viaveis}) + inviáveis (${r.gemas_inviaveis}) em ${r.diferenca} gemas.`
        );

        const gmapsLink = document.getElementById('modalGmapsLink');
        if (gmapsLink) {
            gmapsLink.href = `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lon}`;
        }

        const modal = document.getElementById('recordModal');
        if (modal) modal.classList.remove('hidden');
    };

    window.closeRecordModal = function () {
        const modal = document.getElementById('recordModal');
        if (modal) modal.classList.add('hidden');
    };

    // 17. Modal de Meta Agronômica (Simulador)
    window.openTargetModal = function () {
        const modal = document.getElementById('targetModal');
        if (modal) modal.classList.remove('hidden');
    };

    window.closeTargetModal = function () {
        const modal = document.getElementById('targetModal');
        if (modal) modal.classList.add('hidden');
    };

    window.saveTargetSettings = function () {
        const val = parseFloat(document.getElementById('inputTargetMin')?.value || '95');
        const en = document.getElementById('checkEnableTarget')?.checked || false;

        const cfg = {
            metaMinima: val,
            configurada: en,
            descricao: en ? `Meta simulada em ${val}% de viabilidade mínima` : 'Sem meta oficial configurada',
            responsavel: 'Gestão Agronômica'
        };

        window.ViabilidadeGemasEngine.saveTargetConfig(cfg);
        state.targetConfig = cfg;
        closeTargetModal();
        initEvolutionFilter();
        applyFiltersAndRender();
    };

    // 18. Exportação para Excel e CSV
    window.exportToExcel = function () {
        if (!window.XLSX) {
            alert('Biblioteca SheetJS indisponível.');
            return;
        }

        const dataToExport = state.filteredRecords.map(r => ({
            'ID': r.id,
            'Data': r.data,
            'Total Gemas': r.gemas_total,
            'Viáveis': r.gemas_viaveis,
            'Inviáveis': r.gemas_inviaveis,
            'Viabilidade (%)': r.viabilidade_ind,
            'Inviabilidade (%)': r.inviabilidade_ind,
            'Consistência': r.is_consistente ? 'CONSISTENTE' : 'INCONSISTENTE',
            'Diferença': r.diferenca,
            'Frente': r.frente,
            'OS': r.os,
            'Local': r.local,
            'Responsável': r.responsavel,
            'Latitude': r.lat,
            'Longitude': r.lon,
            'Duração (min)': r.duracao_min,
            'Status': r.status,
            'Usuário': r.usuario,
            'Score MapFy': r.score,
            'Score Perc': r.score_perc,
            'Score Desc': r.score_desc
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Viabilidade_Gemas');
        XLSX.writeFile(wb, `Viabilidade_Gemas_Pitangueiras_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    window.exportToCSV = function () {
        const headers = ['ID', 'Data', 'Total_Gemas', 'Viaveis', 'Inviaveis', 'Viabilidade_Perc', 'Consistencia', 'Diferenca', 'Frente', 'OS', 'Local', 'Responsavel', 'Lat', 'Lon', 'Status'];
        const rows = state.filteredRecords.map(r => [
            r.id,
            `"${r.data}"`,
            r.gemas_total,
            r.gemas_viaveis,
            r.gemas_inviaveis,
            r.viabilidade_ind,
            r.is_consistente ? 'CONSISTENTE' : 'INCONSISTENTE',
            r.diferenca,
            `"${r.frente}"`,
            `"${r.os}"`,
            `"${r.local}"`,
            `"${r.responsavel}"`,
            r.lat,
            r.lon,
            `"${r.status}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(';')].concat(rows.map(e => e.join(';'))).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Viabilidade_Gemas_Pitangueiras_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filtros Rápidos da Evolução Temporal (Todos, 15D, 7D)
    function initEvolutionFilter() {
        const buttons = document.querySelectorAll('.btn-evo-filter');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const range = btn.getAttribute('data-evo-range') || 'ALL';
                state.evolutionRange = range;
                buttons.forEach(b => {
                    b.classList.remove('active', 'text-white', 'bg-emerald-600', 'shadow-sm');
                    b.classList.add('text-[var(--text-secondary)]');
                });
                btn.classList.add('active', 'text-white', 'bg-emerald-600', 'shadow-sm');
                btn.classList.remove('text-[var(--text-secondary)]');
                if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
            });
        });
    }

})();
