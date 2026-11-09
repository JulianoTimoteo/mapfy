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
 * dashboard.js - Qualidade da Cana
 * =================================
 * Controlador Executivo da Interface de Qualidade da Cana no Plantio
 * Usina Pitangueiras • Safra 2026
 */

(function () {
    'use strict';

    const state = {
        allRecords: [],
        filteredRecords: [],
        activePeriod: 'latest', // Inicializa na data mais recente por especificação do Prompt Mestre
        latestDateStr: '',
        breakdownMode: 'frente', // 'frente', 'os', 'local'
        sortColumn: 'data_iso',
        sortDirection: 'desc',
        evolutionRange: 'ALL',
        filters: {
            startDate: '',
            endDate: '',
            specificDate: '',
            frente: 'TODOS',
            os: 'TODOS',
            local: 'TODOS',
            responsavel: 'TODOS',
            classificacaoFilter: 'TODOS',
            obsFilter: 'TODOS',
            scoreDivergenteFilter: 'TODOS',
            coordsFilter: 'TODOS',
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
            breakdown: null,
            hourly: null,
            obs: null
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
        initEvolutionFilter();
        initMap();
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
        const raw = window.QUALIDADE_CANA_DATA || [];
        state.allRecords = (window.QualidadeCanaEngine && typeof window.QualidadeCanaEngine.normalizeRecord === 'function')
            ? raw.map(window.QualidadeCanaEngine.normalizeRecord)
            : raw;

        if (state.allRecords.length > 0) {
            state.latestDateStr = state.allRecords[0].data_dia || '28/10/2026';
            const lbl = document.getElementById('lblLatestDate');
            if (lbl) lbl.innerText = state.latestDateStr;

            const bannerDate = document.getElementById('bannerDateStr');
            if (bannerDate) bannerDate.innerText = state.latestDateStr;

            // Filtro padrão inicial na data mais recente
            state.filters.specificDate = state.latestDateStr;
            const recordsLatest = state.allRecords.filter(r => r.data_dia === state.latestDateStr);
            const bannerCount = document.getElementById('bannerCountStr');
            if (bannerCount) bannerCount.innerText = `${recordsLatest.length} inspeções`;
        }

        // Contadores estáticos do cabeçalho
        const divergentes = state.allRecords.filter(r => r.score_divergente).length;
        const lblDiv = document.getElementById('lblScoreDivergenteCount');
        if (lblDiv) lblDiv.innerText = divergentes.toString();

        const obsRelevantes = state.allRecords.filter(r => r.has_obs_relevante).length;
        const lblObs = document.getElementById('lblObsRelevantesCount');
        if (lblObs) lblObs.innerText = obsRelevantes.toString();
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
            'filterLocal', 'filterResponsavel', 'filterClassificacao',
            'filterObs', 'filterScoreDivergente', 'filterSearch'
        ];

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    readFiltersFromUI();
                    state.activePeriod = 'custom';
                    updatePeriodButtonsUI();
                    state.pagination.currentPage = 1;
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
        state.filters.classificacaoFilter = document.getElementById('filterClassificacao')?.value || 'TODOS';
        state.filters.obsFilter = document.getElementById('filterObs')?.value || 'TODOS';
        state.filters.scoreDivergenteFilter = document.getElementById('filterScoreDivergente')?.value || 'TODOS';
        state.filters.search = document.getElementById('filterSearch')?.value || '';
    }

    window.clearAllFilters = function () {
        if (document.getElementById('filterStartDate')) document.getElementById('filterStartDate').value = '';
        if (document.getElementById('filterEndDate')) document.getElementById('filterEndDate').value = '';
        if (document.getElementById('filterFrente')) document.getElementById('filterFrente').value = 'TODOS';
        if (document.getElementById('filterOS')) document.getElementById('filterOS').value = 'TODOS';
        if (document.getElementById('filterLocal')) document.getElementById('filterLocal').value = 'TODOS';
        if (document.getElementById('filterResponsavel')) document.getElementById('filterResponsavel').value = 'TODOS';
        if (document.getElementById('filterClassificacao')) document.getElementById('filterClassificacao').value = 'TODOS';
        if (document.getElementById('filterObs')) document.getElementById('filterObs').value = 'TODOS';
        if (document.getElementById('filterScoreDivergente')) document.getElementById('filterScoreDivergente').value = 'TODOS';
        if (document.getElementById('filterSearch')) document.getElementById('filterSearch').value = '';

        state.filters = {
            startDate: '',
            endDate: '',
            specificDate: '',
            frente: 'TODOS',
            os: 'TODOS',
            local: 'TODOS',
            responsavel: 'TODOS',
            classificacaoFilter: 'TODOS',
            obsFilter: 'TODOS',
            scoreDivergenteFilter: 'TODOS',
            coordsFilter: 'TODOS',
            search: ''
        };
        state.activePeriod = 'all';
        updatePeriodButtonsUI();
        state.pagination.currentPage = 1;
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
        applyFiltersAndRender();
    };

    window.toggleScoreDivergenteFilter = function () {
        if (state.filters.scoreDivergenteFilter === 'DIVERGENTE') {
            state.filters.scoreDivergenteFilter = 'TODOS';
        } else {
            state.filters.scoreDivergenteFilter = 'DIVERGENTE';
        }
        const sel = document.getElementById('filterScoreDivergente');
        if (sel) sel.value = state.filters.scoreDivergenteFilter;

        const btn = document.getElementById('btnDivergentes');
        if (btn) {
            if (state.filters.scoreDivergenteFilter === 'DIVERGENTE') {
                btn.className = "px-3 py-1.5 rounded-lg transition-all text-white bg-amber-600 font-bold shadow-sm flex items-center gap-1";
            } else {
                btn.className = "px-3 py-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-amber-500 flex items-center gap-1";
            }
        }
        state.pagination.currentPage = 1;
        applyFiltersAndRender();
    };

    window.toggleObsRelevantesFilter = function () {
        if (state.filters.obsFilter === 'DESCRITIVO') {
            state.filters.obsFilter = 'TODOS';
        } else {
            state.filters.obsFilter = 'DESCRITIVO';
        }
        const sel = document.getElementById('filterObs');
        if (sel) sel.value = state.filters.obsFilter;

        const btn = document.getElementById('btnObsRelevantes');
        if (btn) {
            if (state.filters.obsFilter === 'DESCRITIVO') {
                btn.className = "px-3 py-1.5 rounded-lg transition-all text-white bg-sky-600 font-bold shadow-sm flex items-center gap-1";
            } else {
                btn.className = "px-3 py-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-sky-500 flex items-center gap-1";
            }
        }
        state.pagination.currentPage = 1;
        applyFiltersAndRender();
    };

    window.setObsFilterDirect = function (type) {
        state.filters.obsFilter = type;
        const sel = document.getElementById('filterObs');
        if (sel) sel.value = type;
        state.pagination.currentPage = 1;
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

        updateBreakdownChart();
    };

    // 5. Aplicação de Filtros e Renderização Integrada
    function applyFiltersAndRender() {
        state.filteredRecords = window.QualidadeCanaEngine.filterRecords(state.allRecords, state.filters);

        // Ordenação
        sortRecords(state.filteredRecords);

        const m = window.QualidadeCanaEngine.calculateMetrics(state.filteredRecords);
        const qa = window.QualidadeCanaEngine.calculateQualitySummary(state.filteredRecords);

        renderKPICards(m, qa);
        renderDonutChart(m);
        updateEvolutionChart();
        updateBreakdownChart();
        updateHourlyChart();
        updateObsChart();
        renderObsCards();
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
        applyFiltersAndRender();
    };

    // 6. Renderização dos KPIs
    function renderKPICards(m, qa) {
        setElText('kpiTotal', m.totalAvaliacoes.toLocaleString('pt-BR'));
        setElText('kpiBom', m.avaliacoesBom.toLocaleString('pt-BR'));
        setElText('kpiPercBom', `${m.percAvaliacoesBom.toFixed(1)}%`);
        setElText('kpiOutros', m.avaliacoesOutros.toString());
        setElText('kpiPercOutros', `${m.percAvaliacoesOutros.toFixed(1)}%`);
        setElText('kpiSemClass', m.avaliacoesSemClassificacao.toString());

        setElText('kpiObsRelevantes', m.avaliacoesComObsRelevantes.toString());
        setElText('kpiScoreDivergente', m.avaliacoesScoreDivergente.toString());
        setElText('kpiPercScoreDivergente', m.totalAvaliacoes > 0 ? `${((m.avaliacoesScoreDivergente / m.totalAvaliacoes) * 100).toFixed(1)}% da amostra` : '0.0%');

        setElText('kpiTalhoes', m.talhoesAvaliados.toString());
        setElText('kpiGeorefPerc', `${m.percGeoref.toFixed(0)}%`);
        setElText('kpiGeorefCount', `${m.georefCount.toLocaleString('pt-BR')} de ${m.totalAvaliacoes.toLocaleString('pt-BR')}`);
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

        // A. Donut: Distribuição das Classificações
        const ctxDonut = document.getElementById('chartDonut');
        if (ctxDonut) {
            state.charts.donut = new Chart(ctxDonut, {
                type: 'doughnut',
                data: {
                    labels: ['Classificação BOM', 'Score Divergente', 'Outras Respostas'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#10b981', '#f59e0b', '#64748b'],
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
                                label: ctx => ` ${ctx.label}: ${ctx.raw.toLocaleString('pt-BR')} avaliações`
                            }
                        }
                    }
                }
            });
        }

        // B. Evolução Diária
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
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 10, family: 'JetBrains Mono' } }
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

        // C. Comparativo Operacional (Frentes / OS / Talhões)
        const ctxBreakdown = document.getElementById('chartBreakdown');
        if (ctxBreakdown) {
            state.charts.breakdown = new Chart(ctxBreakdown, {
                type: 'bar',
                data: { labels: [], datasets: [] },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: (evt, elements) => {
                        if (elements.length > 0) {
                            const idx = elements[0].index;
                            const label = state.charts.breakdown.data.labels[idx];
                            if (state.breakdownMode === 'frente') {
                                const sel = document.getElementById('filterFrente');
                                if (sel) {
                                    for (let i = 0; i < sel.options.length; i++) {
                                        if (sel.options[i].value.startsWith(label) || label.startsWith(sel.options[i].value)) {
                                            sel.selectedIndex = i;
                                            readFiltersFromUI();
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
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 10, family: 'JetBrains Mono' } }
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
                                label: ctx => ` ${ctx.dataset.label}: ${ctx.raw} avaliações`
                            }
                        }
                    }
                }
            });
        }

        // D. Distribuição por Horário
        const ctxHourly = document.getElementById('chartHourly');
        if (ctxHourly) {
            state.charts.hourly = new Chart(ctxHourly, {
                type: 'bar',
                data: { labels: [], datasets: [] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 9, family: 'JetBrains Mono' } }
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

        // E. Análise de Observações
        const ctxObs = document.getElementById('chartObs');
        if (ctxObs) {
            state.charts.obs = new Chart(ctxObs, {
                type: 'doughnut',
                data: { labels: [], datasets: [] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: { color: textColor, font: { size: 9 }, boxWidth: 10 }
                        }
                    }
                }
            });
        }
    }

    function recreateCharts() {
        if (state.charts.donut) state.charts.donut.destroy();
        if (state.charts.evolution) state.charts.evolution.destroy();
        if (state.charts.breakdown) state.charts.breakdown.destroy();
        if (state.charts.hourly) state.charts.hourly.destroy();
        if (state.charts.obs) state.charts.obs.destroy();
        initCharts();
        initEvolutionFilter();
        applyFiltersAndRender();
    }

    // 8. Atualização do Donut de Conformidade
    function renderDonutChart(m) {
        if (!state.charts.donut) return;

        state.charts.donut.data.datasets[0].data = [
            m.avaliacoesBom - m.avaliacoesScoreDivergente,
            m.avaliacoesScoreDivergente,
            m.avaliacoesOutros
        ];
        state.charts.donut.update();

        // CENTRO DO DONUT: SEMPRE EXIBE O QUE ESTÁ NA META!
        setElText('donutCenterPerc', `${m.percAvaliacoesBom.toFixed(0)}%`);
        setElText('donutCenterCount', `${m.avaliacoesBom.toLocaleString('pt-BR')} de ${m.totalAvaliacoes.toLocaleString('pt-BR')} avaliações`);

        // DISCRIMINAÇÃO DOS VALORES
        setElText('donutValBom', `${m.avaliacoesBom.toLocaleString('pt-BR')} (${m.percAvaliacoesBom.toFixed(1)}%)`);
        const barBom = document.getElementById('donutBarBom');
        if (barBom) barBom.style.width = `${m.percAvaliacoesBom}%`;

        setElText('donutValDivergente', `${m.avaliacoesScoreDivergente} reg.`);
        const barDiv = document.getElementById('donutBarDivergente');
        if (barDiv) barDiv.style.width = `${Math.min(100, (m.avaliacoesScoreDivergente / (m.totalAvaliacoes || 1)) * 100 * 10)}%`;

        setElText('donutValOutros', `${m.avaliacoesOutros} reg.`);
        const barOut = document.getElementById('donutBarOutros');
        if (barOut) barOut.style.width = '0%';
    }

    // 9. Atualização da Evolução Temporal
    function updateEvolutionChart() {
        if (!state.charts.evolution) return;

        let evo = window.QualidadeCanaEngine.calculateTemporalEvolution(state.filteredRecords);
        if (state.evolutionRange === '7D' && evo.dates.length > 7) {
            evo = {
                dates: evo.dates.slice(-7),
                total: evo.total.slice(-7)
            };
        } else if (state.evolutionRange === '15D' && evo.dates.length > 15) {
            evo = {
                dates: evo.dates.slice(-15),
                total: evo.total.slice(-15)
            };
        }
        state.charts.evolution.data = {
            labels: evo.dates,
            datasets: [{
                label: 'Avaliações Realizadas',
                data: evo.total,
                backgroundColor: '#10b981',
                borderRadius: 3
            }]
        };
        state.charts.evolution.update();
    }

    // 10. Atualização do Comparativo Operacional
    function updateBreakdownChart() {
        if (!state.charts.breakdown) return;

        let items = [];
        let labelProp = '';

        if (state.breakdownMode === 'frente') {
            items = window.QualidadeCanaEngine.calculateFrenteBreakdown(state.filteredRecords).slice(0, 8);
            labelProp = 'frente';
        } else if (state.breakdownMode === 'os') {
            items = window.QualidadeCanaEngine.calculateOSBreakdown(state.filteredRecords).slice(0, 8);
            labelProp = 'os';
        } else {
            items = window.QualidadeCanaEngine.calculateLocalBreakdown(state.filteredRecords).slice(0, 8);
            labelProp = 'local';
        }

        state.charts.breakdown.data = {
            labels: items.map(it => {
                const txt = it[labelProp] || '';
                return txt.length > 22 ? txt.substring(0, 20) + '...' : txt;
            }),
            datasets: [{
                label: 'Avaliações',
                data: items.map(it => it.total),
                backgroundColor: '#10b981',
                borderRadius: 4
            }]
        };
        state.charts.breakdown.update();
    }

    // 11. Atualização do Horário
    function updateHourlyChart() {
        if (!state.charts.hourly) return;

        const dist = window.QualidadeCanaEngine.calculateHourlyDistribution(state.filteredRecords);
        state.charts.hourly.data = {
            labels: dist.labels,
            datasets: [{
                label: 'Avaliações',
                data: dist.counts,
                backgroundColor: '#0284c7',
                borderRadius: 3
            }]
        };
        state.charts.hourly.update();
    }

    // 12. Atualização das Observações
    function updateObsChart() {
        if (!state.charts.obs) return;

        const cat = window.QualidadeCanaEngine.calculateObservationCategories(state.filteredRecords);
        const isDark = document.documentElement.classList.contains('dark');

        state.charts.obs.data = {
            labels: cat.labels,
            datasets: [{
                data: cat.counts,
                backgroundColor: ['#64748b', '#10b981', '#f43f5e', '#0284c7'],
                borderWidth: 2,
                borderColor: isDark ? '#1c1e22' : '#ffffff'
            }]
        };
        state.charts.obs.update();
    }

    // 13. Central de Observações (Cards Dinâmicos)
    function renderObsCards(searchFilter = '') {
        const container = document.getElementById('obsCardsContainer');
        if (!container) return;

        const obsRecords = state.filteredRecords.filter(r => r.observacoes_tipo !== 'VAZIO');
        let displayed = obsRecords;

        if (searchFilter && searchFilter.trim() !== '') {
            const q = searchFilter.toLowerCase().trim();
            displayed = obsRecords.filter(r => r.observacoes_raw.toLowerCase().includes(q));
        }

        container.innerHTML = '';
        if (displayed.length === 0) {
            container.innerHTML = `
                <div class="col-span-full p-4 rounded-xl border bg-[var(--bg-kpi)] border-[var(--border-color)] text-center text-xs text-[var(--text-secondary)]">
                    Nenhuma anotação textual encontrada com o critério pesquisado.
                </div>
            `;
            return;
        }

        displayed.slice(0, 9).forEach(r => {
            const card = document.createElement('div');
            card.className = "p-3 rounded-xl border bg-[var(--bg-kpi)] border-[var(--border-color)] flex flex-col justify-between hover:border-emerald-500 transition-colors cursor-pointer text-xs";
            card.onclick = () => openRecordModal(r.id);

            let typeBadge = '';
            if (r.observacoes_tipo === 'DESCRITIVO') {
                typeBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">Descritiva</span>';
            } else if (r.observacoes_tipo === 'PONTO') {
                typeBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">Ponto "."</span>';
            } else {
                typeBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">Padrão</span>';
            }

            card.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <span class="font-mono font-bold text-emerald-500">#${r.id}</span>
                    ${typeBadge}
                </div>
                <p class="font-medium text-[var(--text-primary)] my-1 italic line-clamp-2">
                    "${r.observacoes_raw}"
                </p>
                <div class="text-[10px] text-[var(--text-secondary)] mt-2 pt-2 border-t border-[var(--border-color)] flex items-center justify-between">
                    <span>${r.data}</span>
                    <span class="truncate max-w-[120px]" title="${r.frente}">${r.frente}</span>
                </div>
            `;
            container.appendChild(card);
        });
    }

    window.filterObservations = function (val) {
        renderObsCards(val);
    };

    // 14. Painel de Qualidade e Confiabilidade dos Dados
    function renderQualityPanel(qa) {
        setElText('qaTotal', qa.totalRecords.toLocaleString('pt-BR'));
        setElText('qaDuplicados', qa.duplicateIds.toString());
        setElText('qaSemClass', qa.semClassificacao.toString());
        setElText('qaCoordsInvalidas', qa.invalidCoords.toString());
        setElText('qaDatasInvalidas', qa.invalidDates.toString());
        setElText('qaScoreDivergente', qa.scoreDivergente.toString());
        setElText('qaObsPonto', qa.obsPonto.toString());
        setElText('qaObsDesc', qa.obsDescritiva.toString());
    }

    // 15. Mapa Leaflet (OpenStreetMap Livre de API Key e Marcas d'água)
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

            let pinClass = 'custom-pin-bom';
            let pinLabel = '✓';

            if (r.score_divergente) {
                pinClass = 'custom-pin-divergente';
                pinLabel = '⚠️';
            } else if (r.has_obs_relevante) {
                pinClass = 'custom-pin-obs';
                pinLabel = '📝';
            } else if (!r.is_bom) {
                pinClass = 'custom-pin-outros';
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
                        Avaliação #${r.id} • ${r.quantidade_cana_norm}
                    </div>
                    <div><strong>Data:</strong> ${r.data}</div>
                    <div><strong>Frente:</strong> ${r.frente}</div>
                    <div><strong>OS:</strong> ${r.os}</div>
                    <div><strong>Local:</strong> ${r.local}</div>
                    <div><strong>Responsável:</strong> ${r.responsavel}</div>
                    ${r.observacoes_raw ? `<div class="italic text-sky-500"><strong>Obs:</strong> "${r.observacoes_raw}"</div>` : ''}
                    ${r.score_divergente ? '<div class="text-amber-500 font-bold">⚠️ Score Divergente: 0,00 (Baixo)</div>' : '<div class="text-emerald-500 font-semibold">✓ Score 1,00 (Bom)</div>'}
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

    // 16. Tabela Analítica e Paginação
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
                    <td colspan="11" class="p-8 text-center text-xs text-[var(--text-secondary)]">
                        Nenhum registro encontrado para os filtros selecionados.
                    </td>
                </tr>
            `;
        } else {
            pageRecords.forEach(r => {
                const tr = document.createElement('tr');
                tr.className = "table-row-hover transition-colors";

                const classBadge = r.is_bom
                    ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold badge-bom">BOM</span>'
                    : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold badge-revisar">${r.quantidade_cana_norm}</span>`;

                let obsBadge = '<span class="opacity-40 font-mono text-[10px]">--</span>';
                if (r.observacoes_tipo === 'DESCRITIVO') {
                    obsBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 truncate max-w-[150px] inline-block" title="${r.observacoes_raw}">${r.observacoes_raw}</span>`;
                } else if (r.observacoes_tipo === 'PONTO') {
                    obsBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">Ponto "."</span>';
                } else if (r.observacoes_tipo === 'PADRAO') {
                    obsBadge = `<span class="text-[11px] opacity-75">${r.observacoes_raw}</span>`;
                }

                const scoreBadge = r.score_divergente
                    ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold badge-divergente">0,00 (Baixo)</span>'
                    : '<span class="font-mono text-[11px] text-emerald-500 font-bold">1,00 (100%)</span>';

                tr.innerHTML = `
                    <td class="p-3 font-mono font-bold">${r.id}</td>
                    <td class="p-3 font-mono text-[11px] whitespace-nowrap">${r.data}</td>
                    <td class="p-3">${classBadge}</td>
                    <td class="p-3">${obsBadge}</td>
                    <td class="p-3">${scoreBadge}</td>
                    <td class="p-3 truncate max-w-[150px]" title="${r.frente}">${r.frente}</td>
                    <td class="p-3 font-mono">${r.os || '--'}</td>
                    <td class="p-3 font-mono truncate max-w-[120px]" title="${r.local}">${r.local || '--'}</td>
                    <td class="p-3 truncate max-w-[130px]" title="${r.responsavel}">${r.responsavel || '--'}</td>
                    <td class="p-3 font-mono text-[11px]">${r.status}</td>
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

    // 17. Modal de Detalhes
    window.openRecordModal = function (id) {
        const r = state.allRecords.find(item => item.id === id);
        if (!r) return;

        setElText('modalRecordTitle', `Avaliação #${r.id}`);
        setElText('modalRecordDate', `${r.data} • Status: ${r.status}`);
        setElText('modalQtdCana', r.quantidade_cana_norm);
        setElText('modalScoreVal', `${r.score.toFixed(2)} (${r.score_perc}% - ${r.score_desc})`);
        setElText('modalScoreAuditDesc', r.score_divergente ? '⚠️ Divergência: Score registrado como Baixo (0,00) em 19/05' : '✓ Score coerente com a classificação BOM');
        setElText('modalObservacoes', r.observacoes_raw || 'Nenhuma observação informada neste registro.');
        setElText('modalFrente', r.frente || '--');
        setElText('modalOS', r.os || '--');
        setElText('modalLocal', r.local || '--');
        setElText('modalResp', r.responsavel || '--');
        setElText('modalDuracao', `${r.duracao_min} min`);
        setElText('modalUser', r.usuario || '--');
        setElText('modalCoords', `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`);

        const cBadge = document.getElementById('modalClassBadge');
        if (cBadge) {
            cBadge.innerText = `Classificação: ${r.quantidade_cana_norm}`;
            cBadge.className = r.is_bom
                ? "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider badge-bom"
                : "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider badge-revisar";
        }

        const sBadge = document.getElementById('modalScoreBadge');
        if (sBadge) {
            sBadge.innerText = `Score ${r.score_perc}%`;
            sBadge.className = r.score_divergente
                ? "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider badge-divergente"
                : "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider badge-bom";
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

    // 18. Exportações (Excel e CSV)
    window.exportToExcel = function () {
        if (!window.XLSX) {
            alert('Biblioteca SheetJS indisponível.');
            return;
        }

        const dataToExport = state.filteredRecords.map(r => ({
            'ID': r.id,
            'Data': r.data,
            'Classificação': r.quantidade_cana_norm,
            'Observações': r.observacoes_raw,
            'Tipo Observação': r.observacoes_tipo,
            'Score': r.score,
            'Score Perc': r.score_perc,
            'Score Desc': r.score_desc,
            'Frente': r.frente,
            'OS': r.os,
            'Local': r.local,
            'Responsável': r.responsavel,
            'Latitude': r.lat,
            'Longitude': r.lon,
            'Duração (min)': r.duracao_min,
            'Status': r.status,
            'Usuário': r.usuario
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Qualidade_Cana');
        XLSX.writeFile(wb, `Qualidade_Cana_Pitangueiras_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    window.exportToCSV = function () {
        const headers = ['ID', 'Data', 'Classificacao', 'Observacoes', 'Score', 'Score_Perc', 'Score_Desc', 'Frente', 'OS', 'Local', 'Responsavel', 'Lat', 'Lon', 'Status'];
        const rows = state.filteredRecords.map(r => [
            r.id,
            `"${r.data}"`,
            `"${r.quantidade_cana_norm}"`,
            `"${r.observacoes_raw.replace(/"/g, '""')}"`,
            r.score,
            r.score_perc,
            `"${r.score_desc}"`,
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
        link.setAttribute("download", `Qualidade_Cana_Pitangueiras_${new Date().toISOString().slice(0, 10)}.csv`);
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
                if (typeof applyFilters === 'function') applyFilters();
            });
        });
    }

})();
