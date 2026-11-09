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
 * dashboard.js
 * ============
 * Controlador Executivo da Interface para Qualidade da Muda no Plantio
 * Usina Pitangueiras • Safra 2026
 */

(function () {
    'use strict';

    const state = {
        allRecords: [],
        filteredRecords: [],
        activePeriod: 'all', // 'all', 'latest'
        latestDateStr: '',
        evolutionMode: 'volume',
        evolutionRange: 'ALL', // 'volume', 'percentual'
        filters: {
            startDate: '',
            endDate: '',
            specificDate: '',
            frente: 'TODOS',
            os: 'TODOS',
            local: 'TODOS',
            qualidade: 'TODOS',
            brocaFilter: 'TODOS',
            responsavel: 'TODOS',
            status: 'TODOS',
            onlyDivergencias: false,
            searchObs: ''
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
            brocas: null
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
        const saved = localStorage.getItem('mapfy_theme') || 'dark';
        if (saved === 'light') {
            document.documentElement.classList.remove('dark');
            const icon = document.getElementById('themeIcon');
            if (icon) icon.innerText = '☀️';
        } else {
            document.documentElement.classList.add('dark');
            const icon = document.getElementById('themeIcon');
            if (icon) icon.innerText = '🌙';
        }

        const themeBtn = document.getElementById('themeToggleBtn') || document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('mapfy_theme', isDark ? 'dark' : 'light');
                const icon = document.getElementById('themeIcon');
                if (icon) icon.innerText = isDark ? '🌙' : '☀️';
                recreateCharts();
                updateMapTiles();
            });
        }
    }

    // 2. Inicialização dos Dados
    function initData() {
        const raw = window.QUALIDADE_MUDA_DATA || [];
        state.allRecords = (window.QualidadeMudaEngine && typeof window.QualidadeMudaEngine.normalizeRecord === 'function')
            ? raw.map(window.QualidadeMudaEngine.normalizeRecord)
            : raw;
        if (state.allRecords.length > 0) {
            state.latestDateStr = state.allRecords[0].data_dia || '';
            const lbl = document.getElementById('lblLatestDate');
            if (lbl) lbl.innerText = state.latestDateStr;
        }

        const initialMetrics = window.QualidadeMudaEngine.calculateMetrics(state.allRecords);
        const lblAudit = document.getElementById('lblAuditCount');
        if (lblAudit) lblAudit.innerText = initialMetrics.divergenciasScore.toString();
    }

    // 3. Inicialização dos Dropdowns Dinâmicos
    function initDropdowns() {
        const frentes = new Set();
        const osList = new Set();
        const locais = new Set();

        for (let i = 0; i < state.allRecords.length; i++) {
            const r = state.allRecords[i];
            if (r.frente) frentes.add(r.frente);
            if (r.os) osList.add(r.os);
            if (r.local) locais.add(r.local);
        }

        populateSelect('filterFrente', Array.from(frentes).sort());
        populateSelect('filterOS', Array.from(osList).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
        populateSelect('filterLocal', Array.from(locais).sort());
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
            'filterLocal', 'filterQualidade', 'filterBroca', 'filterSearchObs'
        ];

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    readFiltersFromUI();
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
        state.filters.qualidade = document.getElementById('filterQualidade')?.value || 'TODOS';
        state.filters.brocaFilter = document.getElementById('filterBroca')?.value || 'TODOS';
        state.filters.searchObs = document.getElementById('filterSearchObs')?.value || '';
    }

    window.clearAllFilters = function () {
        if (document.getElementById('filterStartDate')) document.getElementById('filterStartDate').value = '';
        if (document.getElementById('filterEndDate')) document.getElementById('filterEndDate').value = '';
        if (document.getElementById('filterFrente')) document.getElementById('filterFrente').value = 'TODOS';
        if (document.getElementById('filterOS')) document.getElementById('filterOS').value = 'TODOS';
        if (document.getElementById('filterLocal')) document.getElementById('filterLocal').value = 'TODOS';
        if (document.getElementById('filterQualidade')) document.getElementById('filterQualidade').value = 'TODOS';
        if (document.getElementById('filterBroca')) document.getElementById('filterBroca').value = 'TODOS';
        if (document.getElementById('filterSearchObs')) document.getElementById('filterSearchObs').value = '';

        state.filters = {
            startDate: '',
            endDate: '',
            specificDate: '',
            frente: 'TODOS',
            os: 'TODOS',
            local: 'TODOS',
            qualidade: 'TODOS',
            brocaFilter: 'TODOS',
            responsavel: 'TODOS',
            status: 'TODOS',
            onlyDivergencias: false,
            searchObs: ''
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

    window.toggleAuditFilter = function () {
        state.filters.onlyDivergencias = !state.filters.onlyDivergencias;
        const btn = document.getElementById('btnAuditOnly');
        if (btn) {
            if (state.filters.onlyDivergencias) {
                btn.className = "px-3 py-1.5 rounded-lg transition-all text-white bg-purple-600 font-bold shadow-sm flex items-center gap-1";
            } else {
                btn.className = "px-3 py-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-purple-500 flex items-center gap-1";
            }
        }
        state.pagination.currentPage = 1;
        initEvolutionFilter();
        applyFiltersAndRender();
    };

    window.filterByBrocas = function () {
        const sel = document.getElementById('filterBroca');
        if (sel) {
            sel.value = 'COM_BROCA';
            readFiltersFromUI();
            state.pagination.currentPage = 1;
            initEvolutionFilter();
        applyFiltersAndRender();
        }
    };

    function updatePeriodButtonsUI() {
        const btnAll = document.getElementById('btnAllDates');
        const btnLatest = document.getElementById('btnLatestDate');

        if (state.activePeriod === 'all') {
            if (btnAll) btnAll.className = "px-3 py-1.5 rounded-lg transition-all text-white bg-emerald-600 shadow-sm";
            if (btnLatest) btnLatest.className = "px-3 py-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-emerald-500";
        } else if (state.activePeriod === 'latest') {
            if (btnAll) btnAll.className = "px-3 py-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-emerald-500";
            if (btnLatest) btnLatest.className = "px-3 py-1.5 rounded-lg transition-all text-white bg-emerald-600 shadow-sm";
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

    // 5. Aplicação de Filtros e Renderização Coordenada
    function applyFiltersAndRender() {
        state.filteredRecords = window.QualidadeMudaEngine.filterRecords(state.allRecords, state.filters);
        const m = window.QualidadeMudaEngine.calculateMetrics(state.filteredRecords);

        renderKPICards(m);
        renderDonutChart(m);
        updateEvolutionChart();
        updateFrentesChart();
        updateBrocasChart();
        renderCoherenceMatrix();
        renderMapMarkers();
        renderTable();
    }

    // 6. Renderização dos 10 Cards KPIs
    function renderKPICards(m) {
        setElText('kpiTotal', m.total.toLocaleString('pt-BR'));
        setElText('kpiBomCount', m.bomCount.toLocaleString('pt-BR'));
        setElText('kpiBomPerc', `${m.percBom.toFixed(1)}% na meta`);
        setElText('kpiRuimCount', m.ruimCount.toLocaleString('pt-BR'));
        setElText('kpiRuimPerc', `${m.percRuim.toFixed(1)}% não conf.`);
        setElText('kpiScoreMedio', `${m.scoreMedioPerc.toFixed(1)}%`);
        setElText('kpiScore100', `${m.score100Count.toLocaleString('pt-BR')} com 100%`);
        setElText('kpiBrocaCount', m.brocaTotal.toLocaleString('pt-BR'));
        setElText('kpiBrocaSub', `${m.percBroca.toFixed(1)}% das inspeções`);
        setElText('kpiFrentes', m.frentesCount.toString());
        setElText('kpiOS', m.osCount.toString());
        setElText('kpiLocais', m.locaisCount.toString());
        setElText('kpiGeorefPerc', `${m.percGeoref.toFixed(0)}%`);
        setElText('kpiGeorefCount', `${m.georefCount.toLocaleString('pt-BR')} de ${m.total.toLocaleString('pt-BR')}`);
        setElText('kpiDivergencias', m.divergenciasScore.toString());
        setElText('kpiDivergenciasSub', `${m.divergenciasScore} c/ Score 0%`);
        setElText('lblFrentesCount', `${m.frentesCount} frentes operando`);
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

        // A. Donut: Distribuição de Conformidade
        const ctxDonut = document.getElementById('chartDonut');
        if (ctxDonut) {
            state.charts.donut = new Chart(ctxDonut, {
                type: 'doughnut',
                data: {
                    labels: ['Conforme (BOM)', 'Não Conforme (RUIM)', 'Divergência (BOM c/ 0%)'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#10b981', '#f43f5e', '#a855f7'],
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
                                    return ` ${ctx.label}: ${val} (${perc}%)`;
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

        // C. Qualidade por Frente
        const ctxFrentes = document.getElementById('chartFrentes');
        if (ctxFrentes) {
            state.charts.frentes = new Chart(ctxFrentes, {
                type: 'bar',
                data: { labels: [], datasets: [] },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
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

        // D. Distribuição de Brocas
        const ctxBrocas = document.getElementById('chartBrocas');
        if (ctxBrocas) {
            state.charts.brocas = new Chart(ctxBrocas, {
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
                            ticks: { color: textColor, font: { size: 10, family: 'JetBrains Mono' }, stepSize: 1 }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
    }

    function recreateCharts() {
        if (state.charts.donut) state.charts.donut.destroy();
        if (state.charts.evolution) state.charts.evolution.destroy();
        if (state.charts.frentes) state.charts.frentes.destroy();
        if (state.charts.brocas) state.charts.brocas.destroy();
        initCharts();
        initEvolutionFilter();
        applyFiltersAndRender();
    }

    // 8. Atualização do Donut de Conformidade (REGRA ESTRITA)
    function renderDonutChart(m) {
        if (!state.charts.donut) return;

        // O dataset recebe: BOM (excluindo divergência para não somar duas vezes), RUIM, Divergências
        const bomPuro = Math.max(0, m.bomCount - m.divergenciasScore);
        state.charts.donut.data.datasets[0].data = [bomPuro, m.ruimCount, m.divergenciasScore];
        state.charts.donut.update();

        // CENTRO DO DONUT: SEMPRE EXIBE O QUE ESTÁ NA META!
        setElText('donutCenterPerc', `${m.percBom.toFixed(1)}%`);
        setElText('donutCenterCount', `${m.bomCount.toLocaleString('pt-BR')} de ${m.total.toLocaleString('pt-BR')}`);

        // DISCRIMINAÇÃO DOS VALORES E BARRAS ABAIXO DO DONUT
        setElText('donutValBom', `${m.bomCount.toLocaleString('pt-BR')} (${m.percBom.toFixed(1)}%)`);
        const barBom = document.getElementById('donutBarBom');
        if (barBom) barBom.style.width = `${m.percBom}%`;

        setElText('donutValRuim', `${m.ruimCount.toLocaleString('pt-BR')} (${m.percRuim.toFixed(1)}%)`);
        const barRuim = document.getElementById('donutBarRuim');
        if (barRuim) barRuim.style.width = `${Math.min(100, m.percRuim * 5)}%`; // Escala visual caso muito pequeno

        const percDiv = m.total > 0 ? (m.divergenciasScore / m.total) * 100 : 0;
        setElText('donutValDivergente', `${m.divergenciasScore} (${percDiv.toFixed(1)}%)`);
        const barDiv = document.getElementById('donutBarDivergente');
        if (barDiv) barDiv.style.width = `${Math.min(100, percDiv * 5)}%`;
    }

    // 9. Atualização da Evolução Temporal
    function updateEvolutionChart() {
        if (!state.charts.evolution) return;

        let evo = window.QualidadeMudaEngine.calculateTemporalEvolution(state.filteredRecords);
        if (state.evolutionRange === '7D' && evo.dates.length > 7) {
            evo = {
                dates: evo.dates.slice(-7),
                bom: evo.bom.slice(-7),
                ruim: evo.ruim.slice(-7),
                percBom: evo.percBom.slice(-7),
                total: evo.total.slice(-7)
            };
        } else if (state.evolutionRange === '15D' && evo.dates.length > 15) {
            evo = {
                dates: evo.dates.slice(-15),
                bom: evo.bom.slice(-15),
                ruim: evo.ruim.slice(-15),
                percBom: evo.percBom.slice(-15),
                total: evo.total.slice(-15)
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
                        label: 'Mudas BOM',
                        data: evo.bom,
                        backgroundColor: '#10b981',
                        borderRadius: 3
                    },
                    {
                        label: 'Mudas RUIM',
                        data: evo.ruim,
                        backgroundColor: '#f43f5e',
                        borderRadius: 3
                    },
                    {
                        label: 'Menções de Broca',
                        data: evo.brocas,
                        backgroundColor: '#f59e0b',
                        borderRadius: 3
                    }
                ]
            };
            state.charts.evolution.options.scales.y.stacked = true;
            state.charts.evolution.options.scales.x.stacked = true;
            state.charts.evolution.options.scales.y.ticks.callback = val => val;
        } else {
            state.charts.evolution.config.type = 'line';
            state.charts.evolution.data = {
                labels: evo.dates,
                datasets: [
                    {
                        label: '% Mudas BOM (Meta)',
                        data: evo.percBom,
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

    // 10. Atualização de Frentes
    function updateFrentesChart() {
        if (!state.charts.frentes) return;

        const frentes = window.QualidadeMudaEngine.calculateFrenteBreakdown(state.filteredRecords).slice(0, 8);
        state.charts.frentes.data = {
            labels: frentes.map(f => f.frente.length > 20 ? f.frente.substring(0, 18) + '...' : f.frente),
            datasets: [{
                label: '% Conformidade (BOM)',
                data: frentes.map(f => f.percBom),
                backgroundColor: '#10b981',
                borderRadius: 4
            }]
        };
        state.charts.frentes.update();
    }

    // 11. Atualização de Brocas
    function updateBrocasChart() {
        if (!state.charts.brocas) return;

        const dist = window.QualidadeMudaEngine.calculateBrocaDistribution(state.filteredRecords);
        state.charts.brocas.data = {
            labels: dist.labels,
            datasets: [{
                label: 'Inspeções',
                data: dist.counts,
                backgroundColor: '#f59e0b',
                borderRadius: 4
            }]
        };
        state.charts.brocas.update();
    }

    // 12. Matriz de Coerência
    function renderCoherenceMatrix() {
        const mat = window.QualidadeMudaEngine.calculateScoreMatrix(state.filteredRecords);
        setElText('matBom100', mat.bom_score100.toLocaleString('pt-BR'));
        setElText('matRuim0', mat.ruim_score0.toLocaleString('pt-BR'));
        setElText('matBom0', mat.bom_score0.toLocaleString('pt-BR'));
        setElText('matRuim100', mat.ruim_score100.toLocaleString('pt-BR'));
    }

    // 13. Mapa Leaflet
    function initMap() {
        const container = document.getElementById('mapContainer');
        if (!container) return;

        // Centralizado nas coordenadas médias de Pitangueiras
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

    function updateMapTiles() {
        // Tile layer permanente e sem marcas d'água via OpenStreetMap
    }

    function renderMapMarkers() {
        if (!state.map || !state.markersLayer) return;
        state.markersLayer.clearLayers();

        const bounds = [];
        const records = state.filteredRecords;
        const maxPoints = Math.min(records.length, 1200); // Amostragem fluida para performance

        for (let i = 0; i < maxPoints; i++) {
            const r = records[i];
            if (!r.lat || !r.lon || r.lat === 0 || r.lon === 0) continue;

            bounds.push([r.lat, r.lon]);

            let pinClass = 'custom-pin-bom';
            let pinLabel = '✓';
            if (r.qualidade_muda === 'RUIM') {
                pinClass = 'custom-pin-ruim';
                pinLabel = '✕';
            } else if (r.has_broca) {
                pinClass = 'custom-pin-broca';
                pinLabel = '🐛';
            }

            const icon = L.divIcon({
                className: 'custom-leaflet-pin',
                html: `<div class="custom-pin ${pinClass}">${pinLabel}</div>`,
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });

            const popupContent = `
                <div class="text-xs p-1 space-y-1">
                    <div class="font-bold text-sm ${r.qualidade_muda === 'BOM' ? 'text-emerald-500' : 'text-rose-500'}">
                        Inspeção #${r.id} • ${r.qualidade_muda}
                    </div>
                    <div><strong>Data:</strong> ${r.data}</div>
                    <div><strong>Frente:</strong> ${r.frente}</div>
                    <div><strong>OS:</strong> ${r.os}</div>
                    <div><strong>Local:</strong> ${r.local}</div>
                    <div><strong>Resp:</strong> ${r.responsavel}</div>
                    <div><strong>Score:</strong> ${r.score_perc}% (${r.score_desc})</div>
                    ${r.has_broca ? `<div class="text-amber-500 font-bold">🐛 Ocorrência: ${r.observacoes}</div>` : ''}
                    ${r.observacoes && !r.has_broca ? `<div><strong>Obs:</strong> ${r.observacoes}</div>` : ''}
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

    // 14. Tabela Analítica e Paginação
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
                    <td colspan="10" class="p-8 text-center text-xs text-[var(--text-secondary)]">
                        Nenhum registro encontrado para os filtros selecionados.
                    </td>
                </tr>
            `;
        } else {
            pageRecords.forEach(r => {
                const tr = document.createElement('tr');
                tr.className = "table-row-hover transition-colors";
                
                const qualBadge = r.qualidade_muda === 'BOM'
                    ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold badge-bom">BOM</span>'
                    : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold badge-ruim">RUIM</span>';

                let obsBadge = '';
                if (r.has_broca) {
                    obsBadge = `<span class="px-1.5 py-0.5 rounded font-bold text-[10px] badge-broca mr-1">🐛 Broca</span>`;
                }
                if (r.is_divergente_score) {
                    obsBadge += `<span class="px-1.5 py-0.5 rounded font-bold text-[10px] badge-divergente mr-1">Score 0</span>`;
                }

                tr.innerHTML = `
                    <td class="p-3 font-mono font-bold">${r.id}</td>
                    <td class="p-3 font-mono text-[11px] whitespace-nowrap">${r.data}</td>
                    <td class="p-3">${qualBadge}</td>
                    <td class="p-3 font-mono ${r.score_perc >= 100 ? 'text-emerald-500 font-bold' : 'text-purple-500 font-bold'}">${r.score_perc}%</td>
                    <td class="p-3 truncate max-w-[150px]" title="${r.frente}">${r.frente}</td>
                    <td class="p-3 font-mono">${r.os || '--'}</td>
                    <td class="p-3 font-mono truncate max-w-[120px]" title="${r.local}">${r.local || '--'}</td>
                    <td class="p-3 truncate max-w-[130px]" title="${r.responsavel}">${r.responsavel || '--'}</td>
                    <td class="p-3">
                        ${obsBadge}
                        <span class="text-[11px] text-[var(--text-secondary)] truncate inline-block max-w-[180px]" title="${r.observacoes || ''}">
                            ${r.observacoes || '<span class="opacity-40">Sem observação</span>'}
                        </span>
                    </td>
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

        // Informações de Paginação
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

    // 15. Modal de Detalhes
    window.openRecordModal = function (id) {
        const r = state.allRecords.find(item => item.id === id);
        if (!r) return;

        setElText('modalRecordTitle', `Inspeção #${r.id}`);
        setElText('modalRecordDate', `${r.data} • Status: ${r.status}`);
        setElText('modalFrente', r.frente || '--');
        setElText('modalOS', r.os || '--');
        setElText('modalLocal', r.local || '--');
        setElText('modalResp', r.responsavel || '--');
        setElText('modalScore', `${r.score_perc}% (${r.score_desc})`);
        setElText('modalDuracao', `${r.duracao_min} min`);
        setElText('modalObsText', r.observacoes || 'Nenhuma observação registrada pelo inspetor.');
        setElText('modalCoords', `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`);

        const qBadge = document.getElementById('modalQualityBadge');
        if (qBadge) {
            qBadge.innerText = r.qualidade_muda;
            qBadge.className = r.qualidade_muda === 'BOM'
                ? "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider badge-bom"
                : "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider badge-ruim";
        }

        const bBadge = document.getElementById('modalBrocaBadge');
        if (bBadge) {
            if (r.has_broca) {
                bBadge.classList.remove('hidden');
                bBadge.innerText = r.broca_tipo ? `🐛 ${r.broca_tipo}` : '🐛 Broca Identificada';
            } else {
                bBadge.classList.add('hidden');
            }
        }

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

    // 16. Exportação para Excel (SheetJS)
    window.exportToExcel = function () {
        if (!window.XLSX) {
            alert('Biblioteca SheetJS carregando... Tente novamente em instantes.');
            return;
        }

        const dataToExport = state.filteredRecords.map(r => ({
            'ID': r.id,
            'Data': r.data,
            'Qualidade': r.qualidade_muda,
            'Score (%)': r.score_perc,
            'Score Desc': r.score_desc,
            'Frente': r.frente,
            'OS': r.os,
            'Local': r.local,
            'Responsável': r.responsavel,
            'Tem Broca?': r.has_broca ? 'SIM' : 'NÃO',
            'Qtd Brocas': r.broca_qtd !== null ? r.broca_qtd : '',
            'Tipo Broca': r.broca_tipo,
            'Observações': r.observacoes,
            'Latitude': r.lat,
            'Longitude': r.lon,
            'Duração (min)': r.duracao_min,
            'Divergência Score': r.is_divergente_score ? 'SIM' : 'NÃO',
            'Status': r.status,
            'Usuário': r.usuario
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Qualidade_Muda');
        XLSX.writeFile(wb, `Qualidade_Muda_Pitangueiras_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
