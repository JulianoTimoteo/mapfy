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
 * Controlador Executivo da Interface para Dosagem
 * Usina Pitangueiras • Safra 2026
 */

(function () {
    'use strict';

    // Estado Global da Aplicação
    const state = {
        rawRecords: [],
        normalizedRecords: [],
        filteredRecords: [],
        targetConfig: null,
        activePeriod: 'all',
        evolutionRange: '7D',
        syncWithGlobalFilter: true,
        mapSyncWithGlobal: true,
        mapRange: '7D', // 'all', 'latest', 'today'
        latestDateStr: '',
        todayDateStr: '',
        filters: {
            frente: 'ALL',
            os: 'ALL',
            responsavel: 'ALL',
            statusTecnico: 'ALL',
            gps: 'ALL',
            search: ''
        },
        pagination: {
            currentPage: 1,
            pageSize: 15,
            totalPages: 1
        },
        sortOS: 'volume',
        charts: {
            donut: null,
            evolution: null,
            histogram: null,
            frentes: null
        },
        map: null,
        markersLayer: null
    };
    window.dashboardState = state;
    window.state = state;

    /**
     * Função Utilitária para Recorte por Dias Distintos em Modo Autônomo
     */
    function getRecordsForDateRange(records, range) {
        if (!range || range === 'ALL' || !records || records.length === 0) return records;
        const daysSet = new Set();
        records.forEach(r => {
            const d = r.dataBR || (r.dataStr ? r.dataStr.split(' ')[0] : '') || (r.data_dia || '');
            if (d) daysSet.add(d);
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
            const d = r.dataBR || (r.dataStr ? r.dataStr.split(' ')[0] : '') || (r.data_dia || '');
            return targetDays.has(d);
        });
    }

    // Inicialização do Sistema
    function _bootstrapApp() {
        initTheme();
        initData();
        initFilters();
        initPeriodSelector();
        initTargetModal();
        initCharts();
        initEvolutionFilter();
        initMap();
        initMapFilter();
        initTableListeners();
        applyFiltersAndRender();
        initPowerUserShortcuts();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _bootstrapApp);
    } else {
        _bootstrapApp();
    }

    // 1. Gerenciamento de Tema
    function initTheme() {
        const savedTheme = localStorage.getItem('pitangueiras_theme') || localStorage.getItem('mapfy_theme') || 'dark';
        if (savedTheme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            document.documentElement.classList.add('dark');
        }
        updateThemeUI();

        document.querySelectorAll('#themeToggleBtn, #themeToggleBtnToolbar, #themeToggle, .theme-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('pitangueiras_theme', isDark ? 'dark' : 'light');
                localStorage.setItem('mapfy_theme', isDark ? 'dark' : 'light');
                updateThemeUI();
                if (state.charts.evolution) {
                    state.charts.evolution.destroy();
                    state.charts.donut.destroy();
                    state.charts.histogram.destroy();
                    state.charts.frentes.destroy();
                    initCharts();
                    initEvolutionFilter();
                    updateChartsAndVisuals();
                }
            });
        });
    }

    function updateThemeUI() {
        const isDark = document.documentElement.classList.contains('dark');
        const iconToolbar = document.getElementById('themeIconToolbar');
        const labelToolbar = document.getElementById('themeLabelToolbar');
        if (iconToolbar) iconToolbar.innerText = isDark ? '🌙' : '☀️';
        if (labelToolbar) labelToolbar.innerText = isDark ? 'Escuro' : 'Claro';
        const legacyIcon = document.getElementById('themeIcon');
        if (legacyIcon) legacyIcon.innerText = isDark ? '🌙' : '☀️';
    }

    // 2. Inicialização dos Dados
    function initData() {
        const raw = window.DOSAGEM_RAW_DATA || [];
        state.rawRecords = raw;
        state.targetConfig = window.DosagemEngine.getTargetConfig();

        // Normaliza registros
        state.normalizedRecords = raw.map(r => window.DosagemEngine.normalizeRecord(r));

        // Descobre maior data e data de hoje
        const validDates = state.normalizedRecords
            .filter(r => r.dataParsed)
            .map(r => ({ date: r.dataParsed, str: r.dataBR }))
            .sort((a, b) => b.date.getTime() - a.date.getTime());

        if (validDates.length > 0) {
            state.latestDateStr = validDates[0].str;
            const badgeLatest = document.getElementById('badgeLatest');
            /* badgeLatest removido conforme diretriz */
        }

        const now = new Date();
        const todayStr = window.DosagemEngine.formatDateBR(now);
        state.todayDateStr = todayStr;

        const countToday = state.normalizedRecords.filter(r => r.dataBR === todayStr).length;
        const badgeToday = document.getElementById('badgeToday');
        if (badgeToday) badgeToday.innerText = countToday;

        const badgeAll = document.getElementById('badgeAll');
        if (badgeAll) badgeAll.innerText = state.normalizedRecords.length;

        // Atualiza textos do banner
        updateTargetBanner();
    }

    function updateTargetBanner() {
        const b = document.getElementById('bannerTargetRange');
        if (b && state.targetConfig) {
            b.innerText = `${state.targetConfig.min} ${state.targetConfig.unidade} a ${state.targetConfig.max} ${state.targetConfig.unidade}`;
        }
    }

    // 3. Inicialização dos Filtros
    function initFilters() {
        const frentes = new Set();
        const osList = new Set();
        const resps = new Set();

        state.normalizedRecords.forEach(r => {
            if (r.frente && r.frente !== 'Não Informado') frentes.add(r.frente);
            if (r.os && r.os !== 'Sem OS') osList.add(r.os);
            if (r.responsavel && r.responsavel !== 'Não Informado') resps.add(r.responsavel);
        });

        populateSelect('filterFrente', Array.from(frentes).sort());
        populateSelect('filterOS', Array.from(osList).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
        populateSelect('filterResponsavel', Array.from(resps).sort());

        // Event Listeners
        ['filterFrente', 'filterOS', 'filterResponsavel', 'filterStatusTecnico', 'filterGPS'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    const key = id.replace('filter', '');
                    const stateKey = key.charAt(0).toLowerCase() + key.slice(1);
                    state.filters[stateKey] = el.value;
                    state.pagination.currentPage = 1;
                    applyFiltersAndRender();
                });
            }
        });

        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            let timeout = null;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    state.filters.search = e.target.value.trim().toLowerCase();
                    state.pagination.currentPage = 1;
                    applyFiltersAndRender();
                }, 250);
            });
        }

        const btnClear = document.getElementById('btnClearFilters');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                document.getElementById('filterFrente').value = 'ALL';
                document.getElementById('filterOS').value = 'ALL';
                document.getElementById('filterResponsavel').value = 'ALL';
                document.getElementById('filterStatusTecnico').value = 'ALL';
                document.getElementById('filterGPS').value = 'ALL';
                if (searchInput) searchInput.value = '';

                state.filters = {
                    frente: 'ALL',
                    os: 'ALL',
                    responsavel: 'ALL',
                    statusTecnico: 'ALL',
                    gps: 'ALL',
                    search: ''
                };
                state.pagination.currentPage = 1;
                applyFiltersAndRender();
            });
        }

        // Export CSV
        const btnExport = document.getElementById('btnExportCSV');
        if (btnExport) {
            btnExport.addEventListener('click', exportFilteredCSV);
        }
    }

    function populateSelect(selectId, options) {
        const sel = document.getElementById(selectId);
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = `<option value="ALL">${sel.options[0].text}</option>`;
        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt;
            el.textContent = opt;
            sel.appendChild(el);
        });
        sel.value = currentVal;
    }

    // 4. Seletor Temporal Segmentado
    function initPeriodSelector() {
        const btnAll = document.getElementById('btnAllDates');
        const btnLatest = document.getElementById('btnLatestDate');
        const btnToday = document.getElementById('btnToday');

        function setPeriod(period) {
            state.activePeriod = period;
            [btnAll, btnLatest, btnToday].forEach(b => b && b.classList.remove('active'));
            if (period === 'all' && btnAll) btnAll.classList.add('active');
            if (period === 'latest' && btnLatest) btnLatest.classList.add('active');
            if (period === 'today' && btnToday) btnToday.classList.add('active');
            state.pagination.currentPage = 1;
            applyFiltersAndRender();
        }

        if (btnAll) btnAll.addEventListener('click', () => setPeriod('all'));
        if (btnLatest) btnLatest.addEventListener('click', () => setPeriod('latest'));
        if (btnToday) btnToday.addEventListener('click', () => setPeriod('today'));
    }

    // 5. Aplicação dos Filtros
    function applyFiltersAndRender() {
        let list = [...state.normalizedRecords];

        // Filtro Temporal
        if (state.activePeriod === 'latest' && state.latestDateStr) {
            list = list.filter(r => r.dataBR === state.latestDateStr);
        } else if (state.activePeriod === 'today') {
            list = list.filter(r => r.dataBR === state.todayDateStr);
        }

        // Filtros Categóricos
        if (state.filters.frente !== 'ALL') {
            list = list.filter(r => r.frente === state.filters.frente);
        }
        if (state.filters.os !== 'ALL') {
            list = list.filter(r => r.os === state.filters.os);
        }
        if (state.filters.responsavel !== 'ALL') {
            list = list.filter(r => r.responsavel === state.filters.responsavel);
        }

        // Filtro Faixa Técnica
        if (state.filters.statusTecnico !== 'ALL') {
            list = list.filter(r => {
                const cls = window.DosagemEngine.classifyRecord((r.dosagem ?? r.profundidade), state.targetConfig);
                return cls.status === state.filters.statusTecnico;
            });
        }

        // Filtro GPS
        if (state.filters.gps === 'GPS_VALIDO') {
            list = list.filter(r => r.hasValidCoords);
        } else if (state.filters.gps === 'GPS_INVALIDO') {
            list = list.filter(r => !r.hasValidCoords);
        }

        // Filtro Busca Textual
        if (state.filters.search) {
            const term = state.filters.search;
            list = list.filter(r => {
                return r.id.toLowerCase().includes(term) ||
                       r.frente.toLowerCase().includes(term) ||
                       r.os.toLowerCase().includes(term) ||
                       r.responsavel.toLowerCase().includes(term) ||
                       r.local.toLowerCase().includes(term);
            });
        }

        state.filteredRecords = list;

        // Atualiza Contadores
        const lblFiltered = document.getElementById('lblFilteredCount');
        const lblTotal = document.getElementById('lblTotalCount');
        if (lblFiltered) lblFiltered.innerText = list.length;
        if (lblTotal) lblTotal.innerText = state.normalizedRecords.length;

        // Renderiza KPIs
        renderKPICards();

        // Atualiza Gráficos
        updateChartsAndVisuals();

        // Atualiza Mapa
        updateMap();

        // Atualiza Tabela de OS
        renderOSTable();

        // Atualiza Tabela Geral
        renderRecordsTable();
    }

    // 6. Cards Executivos (KPIs)
    function renderKPICards() {
        const m = window.DosagemEngine.calculateMetrics(state.filteredRecords, state.targetConfig);

        setElText('cardTotalMedicoes', m.totalMedicoes.toLocaleString('pt-BR'));
        setElText('cardProfMedia', `${m.media.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} ${state.targetConfig.unidade}`);
        setElText('cardProfMediana', `${m.mediana.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} ${state.targetConfig.unidade}`);
        setElText('cardProfMin', m.min.toLocaleString('pt-BR', { minimumFractionDigits: 1 }));
        setElText('cardProfMax', `${m.max.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} ${state.targetConfig.unidade}`);
        setElText('cardStdDev', `±${m.desvioPadrao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        setElText('cardCVPerc', `CV: ${m.cvPerc.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`);

        setElText('cardPercDentro', `${m.percDentro.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`);
        setElText('cardCountDentro', `${m.dentroFaixa} medições`);

        setElText('cardPercAbaixo', `${m.percAbaixo.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`);
        setElText('cardCountAbaixo', `${m.abaixoFaixa} medições`);

        setElText('cardPercAcima', `${m.percAcima.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`);
        setElText('cardCountAcima', `${m.acimaFaixa} medições`);

        setElText('cardTotalOS', m.osCount);
        setElText('cardTotalFrentes', m.frentesCount);
    }

    function setElText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    // 7. Gráficos Chart.js
    function initCharts() {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? '#2e3238' : '#e2e8f0';

        // 1. Donut: Distribuição de Conformidade
        const ctxDonut = document.getElementById('chartDonut');
        if (ctxDonut) {
            state.charts.donut = new Chart(ctxDonut, {
                type: 'doughnut',
                data: {
                    labels: ['Dentro da Meta', 'Abaixo da Meta', 'Acima da Meta'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#10b981', '#f59e0b', '#a855f7'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function (ctx) {
                                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                    const val = ctx.raw || 0;
                                    const perc = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                                    return ` ${ctx.label}: ${val} medições (${perc}%)`;
                                }
                            }
                        }
                    },
                    cutout: '72%'
                }
            });
        }

        // 2. Linha: Evolução Temporal com as 2 Metas
        const ctxEvolution = document.getElementById('chartEvolution');
        if (ctxEvolution) {
            state.charts.evolution = new Chart(ctxEvolution, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Média Medida (cm)',
                            data: [],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.3,
                            borderWidth: 2.5,
                            pointRadius: 4,
                            pointBackgroundColor: '#10b981'
                        },
                        {
                            label: `Meta Mínima (${state.targetConfig.min} cm)`,
                            data: [],
                            borderColor: '#f59e0b',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            pointRadius: 0,
                            fill: false
                        },
                        {
                            label: `Meta Máxima (${state.targetConfig.max} cm)`,
                            data: [],
                            borderColor: '#a855f7',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            pointRadius: 0,
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 10 } },
                            grid: { display: false }
                        },
                        y: {
                            ticks: { color: textColor, font: { family: 'JetBrains Mono' } },
                            grid: { color: gridColor }
                        }
                    }
                }
            });
        }

        // 3. Histograma de Frequência
        const ctxHistogram = document.getElementById('chartHistogram');
        if (ctxHistogram) {
            state.charts.histogram = new Chart(ctxHistogram, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Medições',
                        data: [],
                        backgroundColor: '#0284c7',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 10 } }, grid: { display: false } },
                        y: { ticks: { color: textColor, font: { family: 'JetBrains Mono' } }, grid: { color: gridColor } }
                    }
                }
            });
        }

        // 4. Médias por Frente
        const ctxFrentes = document.getElementById('chartFrentes');
        if (ctxFrentes) {
            state.charts.frentes = new Chart(ctxFrentes, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Média (cm)',
                        data: [],
                        backgroundColor: '#10b981',
                        borderRadius: 6
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textColor, font: { family: 'JetBrains Mono' } }, grid: { color: gridColor } },
                        y: { ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 10 } }, grid: { display: false } }
                    }
                }
            });
        }
    }

    function updateChartsAndVisuals() {
        const chartRecords = state.syncWithGlobalFilter
            ? state.filteredRecords
            : getRecordsForDateRange(state.filteredRecords, state.evolutionRange);

        const m = window.DosagemEngine.calculateMetrics(chartRecords, state.targetConfig);
        const timeSeries = window.DosagemEngine.calculateTimeSeries(chartRecords);
        const histogram = window.DosagemEngine.calculateHistogram(chartRecords);
        const frentes = window.DosagemEngine.calculateFrenteBreakdown(chartRecords);

        // 1. Donut: Centro SEMPRE exibe o que está na meta
        if (state.charts.donut) {
            state.charts.donut.data.datasets[0].data = [m.dentroFaixa, m.abaixoFaixa, m.acimaFaixa];
            state.charts.donut.update();
        }

        // Centro do Donut: SEMPRE exibe percentual e contagem na meta
        setElText('donutCenterPerc', `${m.percDentro.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`);
        setElText('donutCenterCount', `${m.dentroFaixa} de ${m.totalMedicoes}`);

        // Detalhamento Numérico Explícito e Barras de Progresso
        const lblDentro = document.getElementById('labelRangeDentro');
        const lblAbaixo = document.getElementById('labelRangeAbaixo');
        const lblAcima = document.getElementById('labelRangeAcima');
        if (lblDentro) lblDentro.innerText = `${state.targetConfig.min} a ${state.targetConfig.max} ${state.targetConfig.unidade}`;
        if (lblAbaixo) lblAbaixo.innerText = `< ${state.targetConfig.min} ${state.targetConfig.unidade}`;
        if (lblAcima) lblAcima.innerText = `> ${state.targetConfig.max} ${state.targetConfig.unidade}`;

        setElText('donutValDentro', `${m.dentroFaixa} (${m.percDentro.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%)`);
        const barDentro = document.getElementById('donutBarDentro');
        if (barDentro) barDentro.style.width = `${m.percDentro}%`;

        setElText('donutValAbaixo', `${m.abaixoFaixa} (${m.percAbaixo.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%)`);
        const barAbaixo = document.getElementById('donutBarAbaixo');
        if (barAbaixo) barAbaixo.style.width = `${m.percAbaixo}%`;

        setElText('donutValAcima', `${m.acimaFaixa} (${m.percAcima.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%)`);
        const barAcima = document.getElementById('donutBarAcima');
        if (barAcima) barAcima.style.width = `${m.percAcima}%`;

                // 2. Evolução Temporal com Filtro Rápido (Todos, 15D, 7D)
        if (state.charts.evolution) {
            let labels = timeSeries.labels;
            let medias = timeSeries.medias;

            if (state.evolutionRange === '7D' && labels.length > 7) {
                labels = labels.slice(-7);
                medias = medias.slice(-7);
            } else if (state.evolutionRange === '15D' && labels.length > 15) {
                labels = labels.slice(-15);
                medias = medias.slice(-15);
            }

            state.charts.evolution.data.labels = labels;
            state.charts.evolution.data.datasets[0].data = medias;
            state.charts.evolution.data.datasets[1].data = new Array(labels.length).fill(state.targetConfig.min);
            state.charts.evolution.data.datasets[2].data = new Array(labels.length).fill(state.targetConfig.max);
            state.charts.evolution.update();
        }
        setElText('evolutionDaysCount', `${timeSeries.labels.length} dias avaliados`);

        // 3. Histograma
        if (state.charts.histogram) {
            state.charts.histogram.data.labels = histogram.labels;
            state.charts.histogram.data.datasets[0].data = histogram.counts;
            state.charts.histogram.update();
        }

        // 4. Frentes
        if (state.charts.frentes) {
            state.charts.frentes.data.labels = frentes.map(f => f.frente);
            state.charts.frentes.data.datasets[0].data = frentes.map(f => f.media);
            state.charts.frentes.update();
        }
    }

    // 8. Mapa Geográfico Leaflet
    function initMap() {
        const mapContainer = document.getElementById('mapContainer') || document.getElementById('mapSubsolagem') || document.getElementById('mapDosagem');
        if (!mapContainer) return;

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
            center: [-20.85, -48.55],
            zoom: 11,
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

    function updateMap() {
        if (!state.map || !state.markersLayer) return;
        state.markersLayer.clearLayers();

        const mapRecords = state.mapSyncWithGlobal
            ? state.filteredRecords
            : getRecordsForDateRange(state.filteredRecords, state.mapRange);

        const validCoords = mapRecords.filter(r => r.hasValidCoords);
        setElText('mapPointsCount', `${validCoords.length} pontos plotados`);

        if (validCoords.length === 0) return;

        const bounds = [];
        validCoords.forEach(r => {
            const cls = window.DosagemEngine.classifyRecord((r.dosagem ?? r.profundidade), state.targetConfig);
            const marker = L.circleMarker([r.lat, r.lng], {
                radius: 6,
                fillColor: cls.color,
                color: '#ffffff',
                weight: 1.5,
                opacity: 0.9,
                fillOpacity: 0.8
            });

            marker.bindPopup(`
                <div class="text-xs space-y-1 font-sans">
                    <div class="font-bold text-sm text-slate-800">#${r.id} • ${r.frente}</div>
                    <div class="text-slate-600">OS: <strong>${r.os}</strong> | Talhão: ${r.local}</div>
                    <div class="text-slate-600">Inspetor: ${r.responsavel}</div>
                    <div class="text-slate-600">Data: ${r.dataStr}</div>
                    <div class="pt-1 mt-1 border-t text-sm font-bold" style="color: ${cls.color};">
                        Medição: ${(r.dosagem ?? r.profundidade)} ${state.targetConfig.unidade} (${cls.status})
                    </div>
                </div>
            `);

            state.markersLayer.addLayer(marker);
            bounds.push([r.lat, r.lng]);
        });

        if (bounds.length > 0) {
            state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
        }
    }

    // 9. Tabela de Análise por OS
    function renderOSTable() {
        const tbody = document.getElementById('tableOSBody');
        if (!tbody) return;

        let osList = window.DosagemEngine.calculateOSVariability(state.filteredRecords, state.targetConfig);

        const sortMode = state.sortOS;
        if (sortMode === 'volume') osList.sort((a, b) => b.totalMedicoes - a.totalMedicoes);
        else if (sortMode === 'cv') osList.sort((a, b) => b.cvPerc - a.cvPerc);
        else if (sortMode === 'media_asc') osList.sort((a, b) => a.media - b.media);
        else if (sortMode === 'media_desc') osList.sort((a, b) => b.media - a.media);
        else if (sortMode === 'conformidade') osList.sort((a, b) => a.percConforme - b.percConforme);

        if (osList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-400">Nenhuma Ordem de Serviço encontrada com os filtros atuais.</td></tr>`;
            return;
        }

        tbody.innerHTML = osList.map(item => {
            const badgeColor = item.percConforme >= 80 ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' :
                               item.percConforme >= 60 ? 'text-amber-500 bg-amber-500/10 border-amber-500/30' :
                               'text-rose-500 bg-rose-500/10 border-rose-500/30';
            return `
                <tr class="hover:bg-slate-500/5 transition-colors">
                    <td class="p-3 font-mono font-bold text-emerald-500">${item.os}</td>
                    <td class="p-3 text-[11px] text-[var(--text-secondary)] line-clamp-1" title="${item.frentes.join(', ')}">${item.frentes.join(', ') || '-'}</td>
                    <td class="p-3 text-center font-mono font-semibold">${item.totalMedicoes}</td>
                    <td class="p-3 text-right font-mono font-bold">${item.media.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</td>
                    <td class="p-3 text-right font-mono text-[11px] text-[var(--text-secondary)]">${item.min} - ${item.max}</td>
                    <td class="p-3 text-right font-mono">${item.amplitude}</td>
                    <td class="p-3 text-right font-mono text-indigo-400">±${item.desvioPadrao}</td>
                    <td class="p-3 text-right font-mono text-indigo-400 font-bold">${item.cvPerc}%</td>
                    <td class="p-3 text-center">
                        <span class="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${badgeColor}">
                            ${item.percConforme}%
                        </span>
                    </td>
                    <td class="p-3 text-center">
                        <button class="btn-filter-os px-2.5 py-1 rounded bg-[var(--bg-page)] hover:bg-emerald-500 hover:text-white border text-[10px] font-semibold transition-colors"
                                data-os="${item.os}">
                            Filtrar
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-filter-os').forEach(btn => {
            btn.addEventListener('click', () => {
                const osVal = btn.getAttribute('data-os');
                document.getElementById('filterOS').value = osVal;
                state.filters.os = osVal;
                state.pagination.currentPage = 1;
                applyFiltersAndRender();
            });
        });
    }

    // 10. Tabela Geral de Medições Detalhadas
    function renderRecordsTable() {
        const tbody = document.getElementById('tableRecordsBody');
        if (!tbody) return;

        const total = state.filteredRecords.length;
        state.pagination.totalPages = Math.ceil(total / state.pagination.pageSize) || 1;
        if (state.pagination.currentPage > state.pagination.totalPages) {
            state.pagination.currentPage = 1;
        }

        const startIdx = (state.pagination.currentPage - 1) * state.pagination.pageSize;
        const pageRecords = state.filteredRecords.slice(startIdx, startIdx + state.pagination.pageSize);

        if (pageRecords.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="p-8 text-center text-slate-400">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
            setElText('paginationInfo', 'Nenhum registro');
            return;
        }

        setElText('paginationInfo', `Mostrando ${startIdx + 1} a ${Math.min(startIdx + state.pagination.pageSize, total)} de ${total.toLocaleString('pt-BR')} registros`);

        tbody.innerHTML = pageRecords.map(r => {
            const cls = window.DosagemEngine.classifyRecord((r.dosagem ?? r.profundidade), state.targetConfig);
            return `
                <tr class="hover:bg-slate-500/5 transition-colors">
                    <td class="p-3 font-mono font-bold text-emerald-500">#${r.id}</td>
                    <td class="p-3 font-mono text-[11px]">${r.dataStr}</td>
                    <td class="p-3 font-medium text-[11px]">${r.frente}</td>
                    <td class="p-3 font-mono font-bold">${r.os}</td>
                    <td class="p-3 text-[11px] text-[var(--text-secondary)]">${r.local}</td>
                    <td class="p-3 text-[11px] text-[var(--text-secondary)]">${r.responsavel}</td>
                    <td class="p-3 text-right font-mono font-bold text-sm">${(r.dosagem ?? r.profundidade) != null ? (r.dosagem ?? r.profundidade).toLocaleString('pt-BR', { minimumFractionDigits: 1 }) : '-'}</td>
                    <td class="p-3 text-center">
                        <span class="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${cls.badgeClass}">
                            ${cls.status}
                        </span>
                    </td>
                    <td class="p-3 text-center font-mono text-[11px]">${r.duracaoMinutos > 0 ? r.duracaoMinutos + ' min' : '< 1 min'}</td>
                    <td class="p-3 text-center font-mono text-[11px]">
                        ${r.hasValidCoords ? '<span class="text-emerald-500 font-bold">✓ GPS</span>' : '<span class="text-rose-500">✕ Ausente</span>'}
                    </td>
                    <td class="p-3 text-center">
                        <button class="btn-inspect px-2.5 py-1 rounded bg-[var(--bg-page)] hover:bg-emerald-500 hover:text-white border text-[10px] font-semibold transition-colors"
                                data-id="${r.id}">
                            Raio-X
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-inspect').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const rec = state.normalizedRecords.find(item => item.id === id);
                if (rec) openRecordModal(rec);
            });
        });

        renderPaginationControls();
    }

    function renderPaginationControls() {
        const container = document.getElementById('paginationControls');
        if (!container) return;

        const totalP = state.pagination.totalPages;
        const curP = state.pagination.currentPage;

        container.innerHTML = `
            <button id="btnPrevPage" class="px-2.5 py-1 rounded border ${curP === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:border-emerald-500'}">Anterior</button>
            <span class="font-mono px-2">Página ${curP} de ${totalP}</span>
            <button id="btnNextPage" class="px-2.5 py-1 rounded border ${curP === totalP ? 'opacity-40 cursor-not-allowed' : 'hover:border-emerald-500'}">Próxima</button>
        `;

        const btnPrev = document.getElementById('btnPrevPage');
        const btnNext = document.getElementById('btnNextPage');
        if (btnPrev && curP > 1) {
            btnPrev.addEventListener('click', () => {
                state.pagination.currentPage--;
                renderRecordsTable();
            });
        }
        if (btnNext && curP < totalP) {
            btnNext.addEventListener('click', () => {
                state.pagination.currentPage++;
                renderRecordsTable();
            });
        }
    }

    function initTableListeners() {
        const selectSort = document.getElementById('selectSortOS');
        if (selectSort) {
            selectSort.addEventListener('change', () => {
                state.sortOS = selectSort.value;
                renderOSTable();
            });
        }

        const pageSizeSel = document.getElementById('pageSizeSelect');
        if (pageSizeSel) {
            pageSizeSel.addEventListener('change', () => {
                state.pagination.pageSize = parseInt(pageSizeSel.value, 10);
                state.pagination.currentPage = 1;
                renderRecordsTable();
            });
        }
    }

    // 11. Modal de Ajuste de Faixa Técnica
    function initTargetModal() {
        const modal = document.getElementById('targetModal');
        const btnOpen = document.getElementById('btnOpenTargetModal');
        const btnClose = document.getElementById('btnCloseTargetModal');
        const btnSave = document.getElementById('btnSaveTargets');
        const btnReset = document.getElementById('btnResetDefaultTargets');
        const inMin = document.getElementById('inputTargetMin');
        const inMax = document.getElementById('inputTargetMax');

        function openModal() {
            inMin.value = state.targetConfig.min;
            inMax.value = state.targetConfig.max;
            modal.classList.remove('hidden');
        }

        function closeModal() {
            modal.classList.add('hidden');
        }

        if (btnOpen) btnOpen.addEventListener('click', openModal);
        if (btnClose) btnClose.addEventListener('click', closeModal);

        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const newMin = parseFloat(inMin.value);
                const newMax = parseFloat(inMax.value);
                if (isNaN(newMin) || isNaN(newMax) || newMin >= newMax) {
                    alert('Por favor insira limites válidos (Mínimo deve ser menor que o Máximo).');
                    return;
                }
                state.targetConfig = window.DosagemEngine.saveTargetConfig({ min: newMin, max: newMax });
                updateTargetBanner();
                closeModal();
                applyFiltersAndRender();
            });
        }

        if (btnReset) {
            btnReset.addEventListener('click', () => {
                localStorage.removeItem('mapfy_dosagem_sulco_targets');
                state.targetConfig = window.DosagemEngine.getTargetConfig();
                inMin.value = state.targetConfig.min;
                inMax.value = state.targetConfig.max;
                updateTargetBanner();
                closeModal();
                applyFiltersAndRender();
            });
        }
    }

    // Recurso Oculto: Ctrl + Double Click nos gráficos para calibrar metas
    
    // Filtros Rápidos da Evolução Temporal (Todos, 15D, 7D)
        // Filtros Rápidos da Evolução Temporal (Todos, 15D, 7D) e Vínculo com Topo
    function initEvolutionFilter() {
        const btnSync = document.getElementById('btnSyncGlobalFilter') || document.getElementById('btnToggleSyncFilter');
        const syncIcon = document.getElementById('syncIcon');
        const syncText = document.getElementById('syncText');
        const evoButtons = document.querySelectorAll('.btn-evo-filter');

        function updateEvoControlsUI() {
            if (btnSync) {
                if (state.syncWithGlobalFilter) {
                    btnSync.className = "btn-sync-filter sync-locked";
                    if (syncIcon) syncIcon.innerText = "🔒";
                    if (syncText) syncText.innerText = "Filtro Global Ativo";
                    btnSync.title = "Os gráficos analíticos obedecem ao Filtro Principal do topo. Clique para destravar o modo autônomo.";
                } else {
                    btnSync.className = "btn-sync-filter sync-unlocked";
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
                        btn.classList.remove('text-slate-700', 'hover:text-emerald-500');
                    } else {
                        btn.classList.remove('active', 'bg-emerald-600', 'shadow-xs', 'text-white');
                        btn.classList.add('text-slate-700', 'dark:text-white', 'hover:text-emerald-500');
                    }
                }
            });
        }

        if (btnSync) {
            btnSync.addEventListener('click', () => {
                state.syncWithGlobalFilter = !state.syncWithGlobalFilter;
                updateEvoControlsUI();
                updateChartsAndVisuals();
            });
        }

        evoButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (state.syncWithGlobalFilter) return;
                state.evolutionRange = btn.getAttribute('data-evo-range') || '7D';
                updateEvoControlsUI();
                updateChartsAndVisuals();
            });
        });

        updateEvoControlsUI();
    }

    // Controle do Filtro Autônomo do Mapa (Geolocalização das Medições em Campo)
    function initMapFilter() {
        const btnMapSync = document.getElementById('btnToggleMapSyncFilter');
        const mapSyncIcon = document.getElementById('mapSyncIcon');
        const mapSyncText = document.getElementById('mapSyncText');
        const mapButtons = document.querySelectorAll('.btn-map-filter');

        function updateMapControlsUI() {
            if (btnMapSync) {
                if (state.mapSyncWithGlobal) {
                    btnMapSync.className = "btn-sync-filter sync-locked";
                    if (mapSyncIcon) mapSyncIcon.innerText = "🔒";
                    if (mapSyncText) mapSyncText.innerText = "Filtro Global Ativo";
                    btnMapSync.title = "O mapa obedece ao Filtro Principal do topo. Clique para destravar o modo autônomo do mapa.";
                } else {
                    btnMapSync.className = "btn-sync-filter sync-unlocked";
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
                        btn.classList.remove('text-slate-700', 'hover:text-emerald-500');
                    } else {
                        btn.classList.remove('active', 'bg-emerald-600', 'shadow-xs', 'text-white');
                        btn.classList.add('text-slate-700', 'dark:text-white', 'hover:text-emerald-500');
                    }
                }
            });
        }

        if (btnMapSync) {
            btnMapSync.addEventListener('click', () => {
                state.mapSyncWithGlobal = !state.mapSyncWithGlobal;
                updateMapControlsUI();
                updateMap();
            });
        }

        mapButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (state.mapSyncWithGlobal) return;
                state.mapRange = btn.getAttribute('data-map-range') || '7D';
                updateMapControlsUI();
                updateMap();
            });
        });

        updateMapControlsUI();
    }

    function initPowerUserShortcuts() {
        const triggers = ['chartEvolutionCard', 'chartHistogramCard', 'chartEvolution', 'chartHistogram'];
        triggers.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('dblclick', (e) => {
                    if (e.ctrlKey) {
                        const btnOpen = document.getElementById('btnOpenTargetModal');
                        if (btnOpen) btnOpen.click();
                    }
                });
            }
        });
    }

    // 12. Modal Raio-X Individual
    function openRecordModal(r) {
        const modal = document.getElementById('recordModal');
        if (!modal) return;

        const cls = window.DosagemEngine.classifyRecord((r.dosagem ?? r.profundidade), state.targetConfig);
        setElText('modalRecordId', r.id);
        setElText('modalRecordSubtitle', `${r.frente} • OS ${r.os} • Talhão ${r.local}`);

        const badge = document.getElementById('modalRecordBadge');
        if (badge) {
            badge.innerText = cls.status;
            badge.className = `text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${cls.badgeClass}`;
        }

        const content = document.getElementById('modalRecordContent');
        if (content) {
            content.innerHTML = `
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl border bg-slate-500/5">
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Medição</span>
                        <strong class="text-xl font-mono" style="color: ${cls.color};">${(r.dosagem ?? r.profundidade) != null ? (r.dosagem ?? r.profundidade).toLocaleString('pt-BR', { minimumFractionDigits: 1 }) : '-'} ${state.targetConfig.unidade}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Faixa Técnica</span>
                        <strong class="font-mono text-emerald-500">${state.targetConfig.min} a ${state.targetConfig.max} ${state.targetConfig.unidade}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Data / Hora</span>
                        <strong class="font-mono">${r.dataStr}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Frente</span>
                        <strong>${r.frente}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Ordem de Serviço</span>
                        <strong class="font-mono text-emerald-500">${r.os}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Talhão</span>
                        <strong class="font-mono">${r.local}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Inspetor</span>
                        <strong>${r.responsavel}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Coordenadas GPS</span>
                        <span class="font-mono text-[11px]">${r.hasValidCoords ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}` : '<span class="text-rose-500">Ausente</span>'}</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Duração</span>
                        <span class="font-mono text-[11px]">${r.duracaoMinutos > 0 ? r.duracaoMinutos + ' min' : '< 1 min'}</span>
                    </div>
                </div>
            `;
        }

        modal.classList.remove('hidden');

        const btnClose = document.getElementById('btnCloseRecordModal');
        const btnCloseF = document.getElementById('btnCloseRecordModalFooter');
        if (btnClose) btnClose.onclick = () => modal.classList.add('hidden');
        if (btnCloseF) btnCloseF.onclick = () => modal.classList.add('hidden');
    }

    // 13. Exportação de Planilha CSV
    function exportFilteredCSV() {
        const headers = ['ID', 'Data', 'Frente', 'OS', 'Local', 'Responsavel', 'Medicao_cm', 'Status_Tecnico', 'Latitude', 'Longitude'];
        const rows = state.filteredRecords.map(r => {
            const cls = window.DosagemEngine.classifyRecord((r.dosagem ?? r.profundidade), state.targetConfig);
            return [
                r.id,
                `"${r.dataStr}"`,
                `"${r.frente}"`,
                `"${r.os}"`,
                `"${r.local}"`,
                `"${r.responsavel}"`,
                (r.dosagem ?? r.profundidade) != null ? String((r.dosagem ?? r.profundidade)).replace('.', ',') : '',
                `"${cls.status}"`,
                r.lat ? String(r.lat).replace('.', ',') : '',
                r.lng ? String(r.lng).replace('.', ',') : ''
            ].join(';');
        });

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `pitangueiras_dosagem_sulco_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

})();
