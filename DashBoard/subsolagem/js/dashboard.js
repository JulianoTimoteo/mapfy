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
 * dashboard.js - Subsolagem
 * =========================
 * Controlador Principal do Painel de Monitoramento de Qualidade da Subsolagem
 * Usina Pitangueiras • Plantio / Preparo de Solo
 */

(function () {
    'use strict';

    // Estado Central da Aplicação
    const state = {
        allRecords: [],
        filteredRecords: [],
        targetConfig: null,
        periodScope: 'all', // 'all', 'latest', 'today', 'custom'
        evolutionRange: 'ALL', // 'ALL', '15D', '7D'
        maxAvailableDateBR: '',
        maxAvailableDateISO: '',
        todayBR: '',
        activeFilters: {
            date: '',
            frente: 'ALL',
            os: 'ALL',
            responsavel: 'ALL',
            faixa: 'ALL',
            local: 'ALL',
            gps: 'ALL',
            search: ''
        },
        osSort: 'total', // 'total', 'stdDev', 'amplitude', 'mediaDesc', 'mediaAsc', 'percDentro'
        pagination: {
            page: 1,
            pageSize: 15,
            totalPages: 1
        },
        sort: {
            field: 'dataParsed',
            order: 'desc'
        },
        charts: {},
        map: null,
        markerCluster: null,
        isLatestDateMode: false
    };
    window.dashboardState = state;
    window.state = state;

    /**
     * Inicialização no carregamento da página
     */
    function _bootstrapApp() {
        initTheme();
        initData();
        initUI();
        initMap();
        initCharts();
        initEvolutionFilter();
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
        const savedTheme = localStorage.getItem('mapfy_theme') || localStorage.getItem('pitangueiras_theme') || 'dark';
        if (savedTheme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            document.documentElement.classList.add('dark');
        }
        updateThemeBtnUI();

        const themeButtons = document.querySelectorAll('#themeToggleBtn, #themeToggleBtnToolbar, .theme-toggle-btn');
        themeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('mapfy_theme', isDark ? 'dark' : 'light');
                localStorage.setItem('pitangueiras_theme', isDark ? 'dark' : 'light');
                updateThemeBtnUI();
                updateChartsTheme();
            });
        });
    }

    function updateThemeBtnUI() {
        const isDark = document.documentElement.classList.contains('dark');
        const iconToolbar = document.getElementById('themeIconToolbar');
        const labelToolbar = document.getElementById('themeLabelToolbar');
        if (iconToolbar) iconToolbar.innerText = isDark ? '🌙' : '☀️';
        if (labelToolbar) labelToolbar.innerText = isDark ? 'Escuro' : 'Claro';

        const icon = document.getElementById('themeIcon');
        const label = document.getElementById('themeLabel');
        if (icon) icon.innerText = isDark ? '🌙' : '☀️';
        if (label) label.innerText = isDark ? 'Escuro' : 'Claro';
    }

    /**
     * Carga e Normalização dos Dados
     */
    function initData() {
        state.targetConfig = SubsolagemEngine.getTargetConfig();

        const raw = window.RAW_SUBSOLAGEM || [];
        state.allRecords = raw.map(SubsolagemEngine.normalizeRecord);

        // Identifica a maior data válida de medição
        let maxRecord = null;
        state.allRecords.forEach(r => {
            if (r.dataParsed) {
                if (!maxRecord || r.dataParsed > maxRecord.dataParsed) {
                    maxRecord = r;
                }
            }
        });

        if (maxRecord) {
            state.maxAvailableDateBR = maxRecord.dataBR;
            state.maxAvailableDateISO = maxRecord.isoDate;
        }

        const now = new Date();
        state.todayBR = SubsolagemEngine.formatDateBR(now);

        // Padrão de Carga: Safra Completa (367 medições)
        state.periodScope = 'all';
        state.activeFilters.date = '';
        state.isLatestDateMode = false;

        // Atualiza Badges do Cabeçalho
        const badgeAll = document.getElementById('badgeAll');
        if (badgeAll) badgeAll.innerText = state.allRecords.length;

        const badgeLatest = document.getElementById('badgeLatest');
        if (badgeLatest && state.maxAvailableDateBR) {
            badgeLatest.innerText = state.maxAvailableDateBR.substring(0, 5);
        }

        const lastSyncEl = document.getElementById('lastSyncDate');
        if (lastSyncEl && maxRecord) {
            lastSyncEl.innerText = `${maxRecord.dataHoraBR} (ID: ${maxRecord.id})`;
        }

        updateTargetDisplayUI();
    }

    function updateTargetDisplayUI() {
        const rangeText = `${state.targetConfig.min} a ${state.targetConfig.max} ${state.targetConfig.unidade}`;
        const targetDisplay = document.getElementById('targetRangeDisplay');
        if (targetDisplay) targetDisplay.innerText = rangeText;

        const bannerTarget = document.getElementById('bannerTargetRange');
        if (bannerTarget) bannerTarget.innerText = rangeText;
    }

    /**
     * Inicialização dos Controles da Interface
     */
    function initUI() {
        populateSelectOptions();
        setupFilterListeners();
        setupHeaderButtons();
        setupTableControls();
        setupRecordModal();
        setupTargetModal();
        setupSecretTargetEditing();
    }

    /**
     * Popula dinamicamente os selects de filtros
     */
    function populateSelectOptions() {
        const frenteSelect = document.getElementById('filterFrente');
        const osSelect = document.getElementById('filterOS');
        const respSelect = document.getElementById('filterResponsavel');
        const localSelect = document.getElementById('filterLocal');

        // Frentes
        const frentes = Array.from(new Set(state.allRecords.map(r => r.frente))).filter(Boolean).sort();
        frentes.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.innerText = f;
            frenteSelect.appendChild(opt);
        });

        // OS
        const osList = Array.from(new Set(state.allRecords.map(r => r.os))).filter(os => os && os !== 'Sem OS').sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        osList.forEach(os => {
            const opt = document.createElement('option');
            opt.value = os;
            opt.innerText = `OS ${os}`;
            osSelect.appendChild(opt);
        });

        // Responsáveis
        const resps = Array.from(new Set(state.allRecords.map(r => r.responsavel))).filter(r => r && r !== 'Não Informado').sort();
        resps.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.innerText = r;
            respSelect.appendChild(opt);
        });

        // Locais
        const locais = Array.from(new Set(state.allRecords.map(r => r.local))).filter(l => l && l !== 'Não Informado').sort();
        locais.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l;
            opt.innerText = l;
            localSelect.appendChild(opt);
        });
    }

    /**
     * Listeners dos Filtros Globais
     */
    function setupFilterListeners() {
        const dateInput = document.getElementById('filterDate');
        const frenteSelect = document.getElementById('filterFrente');
        const osSelect = document.getElementById('filterOS');
        const respSelect = document.getElementById('filterResponsavel');
        const faixaSelect = document.getElementById('filterFaixa');
        const localSelect = document.getElementById('filterLocal');
        const gpsSelect = document.getElementById('filterGPS');
        const searchInput = document.getElementById('globalSearch');
        const osSortSelect = document.getElementById('osSortSelect');

        if (dateInput) {
            dateInput.addEventListener('change', (e) => {
                if (e.target.value) {
                    const [y, m, d] = e.target.value.split('-');
                    state.activeFilters.date = `${d}/${m}/${y}`;
                    if (state.activeFilters.date === state.maxAvailableDateBR) {
                        state.periodScope = 'latest';
                    } else if (state.activeFilters.date === state.todayBR) {
                        state.periodScope = 'today';
                    } else {
                        state.periodScope = 'custom';
                    }
                    state.isLatestDateMode = (state.activeFilters.date === state.maxAvailableDateBR);
                } else {
                    state.activeFilters.date = '';
                    state.periodScope = 'all';
                    state.isLatestDateMode = false;
                }
                updatePeriodToggleUI();
                state.pagination.page = 1;
                applyFilters();
            });
        }

        frenteSelect.addEventListener('change', (e) => {
            state.activeFilters.frente = e.target.value;
            state.pagination.page = 1;
            applyFilters();
        });

        osSelect.addEventListener('change', (e) => {
            state.activeFilters.os = e.target.value;
            state.pagination.page = 1;
            applyFilters();
        });

        respSelect.addEventListener('change', (e) => {
            state.activeFilters.responsavel = e.target.value;
            state.pagination.page = 1;
            applyFilters();
        });

        faixaSelect.addEventListener('change', (e) => {
            state.activeFilters.faixa = e.target.value;
            state.pagination.page = 1;
            applyFilters();
        });

        localSelect.addEventListener('change', (e) => {
            state.activeFilters.local = e.target.value;
            state.pagination.page = 1;
            applyFilters();
        });

        gpsSelect.addEventListener('change', (e) => {
            state.activeFilters.gps = e.target.value;
            state.pagination.page = 1;
            applyFilters();
        });

        searchInput.addEventListener('input', (e) => {
            state.activeFilters.search = e.target.value.toLowerCase().trim();
            state.pagination.page = 1;
            applyFilters();
        });

        if (osSortSelect) {
            osSortSelect.addEventListener('change', (e) => {
                state.osSort = e.target.value;
                const osList = SubsolagemEngine.buildOSAnalysis(state.filteredRecords, state.targetConfig);
                renderOSAnalysis(osList);
            });
        }

        document.getElementById('btnClearFilters').addEventListener('click', resetFilters);
    }

    /**
     * Atualização Visual do Seletor de Período Temporal
     */
    function updatePeriodToggleUI() {
        const btnAll = document.getElementById('btnAllDates');
        const btnLatest = document.getElementById('btnLatestDate');
        const btnToday = document.getElementById('btnToday');

        if (btnAll) btnAll.classList.toggle('active', state.periodScope === 'all');
        if (btnLatest) btnLatest.classList.toggle('active', state.periodScope === 'latest');
        if (btnToday) btnToday.classList.toggle('active', state.periodScope === 'today');
    }

    function setPeriodScope(scope) {
        state.periodScope = scope;
        const dateInput = document.getElementById('filterDate');

        if (scope === 'all') {
            state.activeFilters.date = '';
            state.isLatestDateMode = false;
            if (dateInput) dateInput.value = '';
        } else if (scope === 'latest') {
            state.activeFilters.date = state.maxAvailableDateBR;
            state.isLatestDateMode = true;
            if (dateInput) dateInput.value = state.maxAvailableDateISO;
        } else if (scope === 'today') {
            const hasToday = state.allRecords.some(r => r.dataBR === state.todayBR);
            if (hasToday) {
                state.activeFilters.date = state.todayBR;
                state.isLatestDateMode = (state.todayBR === state.maxAvailableDateBR);
                if (dateInput) {
                    const now = new Date();
                    const y = now.getFullYear();
                    const m = String(now.getMonth() + 1).padStart(2, '0');
                    const d = String(now.getDate()).padStart(2, '0');
                    dateInput.value = `${y}-${m}-${d}`;
                }
            } else {
                showToast(`Nenhuma medição registrada hoje (${state.todayBR}). Exibindo última data disponível (${state.maxAvailableDateBR}).`);
                setPeriodScope('latest');
                return;
            }
        }

        updatePeriodToggleUI();
        state.pagination.page = 1;
        applyFilters();
    }

    /**
     * Botões do Cabeçalho
     */
    function setupHeaderButtons() {
        const btnAll = document.getElementById('btnAllDates');
        const btnLatest = document.getElementById('btnLatestDate');
        const btnToday = document.getElementById('btnToday');

        if (btnAll) btnAll.addEventListener('click', () => setPeriodScope('all'));
        if (btnLatest) btnLatest.addEventListener('click', () => setPeriodScope('latest'));
        if (btnToday) btnToday.addEventListener('click', () => setPeriodScope('today'));

        document.getElementById('btnExportCSV').addEventListener('click', exportFilteredCSV);
        document.getElementById('btnPrintReport').addEventListener('click', () => window.print());

        updatePeriodToggleUI();
    }

    /**
     * Reseta todos os filtros
     */
    function resetFilters() {
        state.periodScope = 'all';
        state.activeFilters = {
            date: '',
            frente: 'ALL',
            os: 'ALL',
            responsavel: 'ALL',
            faixa: 'ALL',
            local: 'ALL',
            gps: 'ALL',
            search: ''
        };
        state.isLatestDateMode = false;

        const dateInput = document.getElementById('filterDate');
        if (dateInput) dateInput.value = '';
        document.getElementById('filterFrente').value = 'ALL';
        document.getElementById('filterOS').value = 'ALL';
        document.getElementById('filterResponsavel').value = 'ALL';
        document.getElementById('filterFaixa').value = 'ALL';
        document.getElementById('filterLocal').value = 'ALL';
        document.getElementById('filterGPS').value = 'ALL';
        document.getElementById('globalSearch').value = '';

        updatePeriodToggleUI();
        state.pagination.page = 1;
        applyFilters();
    }

    /**
     * Aplicação Central de Filtros Globais
     */
    function applyFilters() {
        const f = state.activeFilters;
        const cfg = state.targetConfig;

        state.filteredRecords = state.allRecords.filter(r => {
            // Filtro por Data
            if (f.date && r.dataBR !== f.date) return false;

            // Filtro por Frente
            if (f.frente !== 'ALL' && r.frente !== f.frente) return false;

            // Filtro por OS
            if (f.os !== 'ALL' && r.os !== f.os) return false;

            // Filtro por Responsável
            if (f.responsavel !== 'ALL' && r.responsavel !== f.responsavel) return false;

            // Filtro por Local
            if (f.local !== 'ALL' && r.local !== f.local) return false;

            // Filtro por GPS
            if (f.gps === 'GPS_VALIDO' && !r.hasValidCoords) return false;
            if (f.gps === 'GPS_INVALIDO' && r.hasValidCoords) return false;

            // Filtro por Faixa Técnica
            if (f.faixa !== 'ALL') {
                const cls = SubsolagemEngine.classifyDepth(r.profundidade, cfg);
                if (cls.status !== f.faixa) return false;
            }

            // Busca Textual
            if (f.search) {
                const q = f.search;
                const matchId = r.id.toLowerCase().includes(q);
                const matchOs = r.os.toLowerCase().includes(q);
                const matchFrente = r.frente.toLowerCase().includes(q);
                const matchResp = r.responsavel.toLowerCase().includes(q);
                const matchLocal = r.local.toLowerCase().includes(q);
                if (!matchId && !matchOs && !matchFrente && !matchResp && !matchLocal) return false;
            }

            return true;
        });

        // Ordenação
        sortRecords();

        // Métricas e Análises
        const metrics = SubsolagemEngine.calculateMetrics(state.filteredRecords, cfg);
        const frenteList = SubsolagemEngine.buildFrenteAnalysis(state.filteredRecords, cfg);
        const osList = SubsolagemEngine.buildOSAnalysis(state.filteredRecords, cfg);
        const respList = SubsolagemEngine.buildResponsavelAnalysis(state.filteredRecords);
        const histogram = SubsolagemEngine.buildHistogram(state.filteredRecords, 5);
        const timeSeries = SubsolagemEngine.buildTimeSeries(state.filteredRecords, cfg);

        // Renderização dos Componentes
        renderHeaderContext(metrics);
        renderCards(metrics);
        renderFilterTags();
        renderCharts(metrics, histogram, timeSeries, frenteList);
        renderFrenteAnalysis(frenteList);
        renderOSAnalysis(osList);
        renderRespAnalysis(respList);
        renderDurationAuditing(metrics);
        renderTable();
        renderMap();
    }

    /**
     * Ordenação dos Registros Filtrados
     */
    function sortRecords() {
        const { field, order } = state.sort;
        state.filteredRecords.sort((a, b) => {
            let valA = a[field];
            let valB = b[field];

            if (field === 'dataParsed') {
                valA = a.dataParsed ? a.dataParsed.getTime() : 0;
                valB = b.dataParsed ? b.dataParsed.getTime() : 0;
            } else if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = String(valB || '').toLowerCase();
            }

            if (valA < valB) return order === 'asc' ? -1 : 1;
            if (valA > valB) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    /**
     * Cabeçalho de Contexto (Período Selecionado e Total de Medições)
     */
    function renderHeaderContext(metrics) {
        const dateDisplayEl = document.getElementById('currentDateDisplay');
        const countDisplayEl = document.getElementById('currentCountDisplay');

        if (dateDisplayEl) {
            if (state.periodScope === 'all') {
                dateDisplayEl.innerHTML = `🌐 <strong>Safra Completa</strong> <span class="opacity-80 font-normal">(${metrics.totalMedicoes} medições consolidadas • Jan/2026 a Out/2026)</span>`;
            } else if (state.periodScope === 'latest') {
                dateDisplayEl.innerHTML = `📅 <strong>Última Data: ${state.maxAvailableDateBR}</strong> <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 ml-2">Ativo</span>`;
            } else if (state.periodScope === 'today') {
                dateDisplayEl.innerHTML = `📆 <strong>Hoje: ${state.todayBR}</strong> <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 ml-2">Ativo</span>`;
            } else if (state.activeFilters.date) {
                dateDisplayEl.innerHTML = `🗓️ <strong>Data Filtrada: ${state.activeFilters.date}</strong>`;
            } else {
                dateDisplayEl.innerHTML = `🔍 <strong>Filtro Personalizado</strong>`;
            }
        }

        if (countDisplayEl) {
            countDisplayEl.innerText = `${metrics.totalMedicoes} medições no filtro`;
        }
    }

    /**
     * Renderização dos 10 Cards Executivos (Seção 8)
     */
    function renderCards(m) {
        const u = m.targetConfig.unidade || 'cm';
        setCardValue('cardTotalMedicoes', m.totalMedicoes.toLocaleString());
        setCardValue('cardProfMedia', `${m.media} ${u}`);
        setCardValue('cardProfMediana', `${m.mediana} ${u}`);
        setCardValue('cardProfMin', `${m.min} ${u}`);
        setCardValue('cardProfMax', `${m.max} ${u}`);
        setCardValue('cardProfStdDev', `±${m.stdDev}`);
        setCardValue('cardTotalOS', m.totalOS);
        setCardValue('cardTotalLocais', m.totalLocais);
        setCardValue('cardDentroFaixa', `${m.percDentro}%`);
        setCardValue('cardDentroFaixaSub', `${m.dentroFaixa} de ${m.validCount}`);
        setCardValue('cardPendencias', m.pendenciasCount);
    }

    function setCardValue(id, val) {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    }

    /**
     * Tags de Filtros Ativos
     */
    function renderFilterTags() {
        const container = document.getElementById('activeFilterTags');
        if (!container) return;
        container.innerHTML = '';

        const tags = [];
        const f = state.activeFilters;

        if (f.date) tags.push({ label: `Data: ${f.date}`, key: 'date' });
        if (f.frente !== 'ALL') tags.push({ label: `Frente: ${f.frente}`, key: 'frente' });
        if (f.os !== 'ALL') tags.push({ label: `OS: ${f.os}`, key: 'os' });
        if (f.responsavel !== 'ALL') tags.push({ label: `Resp: ${f.responsavel}`, key: 'responsavel' });
        if (f.faixa !== 'ALL') tags.push({ label: `Faixa: ${f.faixa}`, key: 'faixa' });
        if (f.local !== 'ALL') tags.push({ label: `Local: ${f.local}`, key: 'local' });
        if (f.gps !== 'ALL') tags.push({ label: `GPS: ${f.gps}`, key: 'gps' });
        if (f.search) tags.push({ label: `Busca: "${f.search}"`, key: 'search' });

        if (tags.length === 0) {
            container.innerHTML = `<span class="text-[11px] text-[var(--text-muted)] font-mono">Nenhum filtro restritivo ativo</span>`;
            return;
        }

        tags.forEach(t => {
            const badge = document.createElement('span');
            badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
            badge.innerHTML = `<span>${t.label}</span><button class="hover:text-rose-500 text-xs font-bold leading-none">✕</button>`;
            badge.querySelector('button').addEventListener('click', () => {
                if (t.key === 'date') {
                    state.activeFilters.date = '';
                    const dInput = document.getElementById('filterDate');
                    if (dInput) dInput.value = '';
                } else if (t.key === 'search') {
                    state.activeFilters.search = '';
                    document.getElementById('globalSearch').value = '';
                } else {
                    state.activeFilters[t.key] = 'ALL';
                    const selectEl = document.getElementById(`filter${t.key.charAt(0).toUpperCase() + t.key.slice(1)}`);
                    if (selectEl) selectEl.value = 'ALL';
                }
                applyFilters();
            });
            container.appendChild(badge);
        });
    }

    /**
     * Gráficos com Chart.js (Seção 12)
     */
    function initCharts() {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? '#2e3238' : '#e2e8f0';

        // 1. Gráfico de Rosca: Distribuição de Conformidade Técnica
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
                        legend: { position: 'bottom', labels: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 10 } } }
                    },
                    cutout: '72%'
                }
            });
        }

        // 2. Gráfico de Linha: Evolução Temporal com as 2 Linhas de Meta (Min e Max)
        const ctxEvolution = document.getElementById('chartEvolution');
        if (ctxEvolution) {
            state.charts.evolution = new Chart(ctxEvolution, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Profundidade Média (cm)',
                            data: [],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            fill: true,
                            tension: 0.3,
                            borderWidth: 2.5,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#10b981'
                        },
                        {
                            label: 'Meta Mínima',
                            data: [],
                            borderColor: '#f59e0b',
                            borderDash: [5, 5],
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: false
                        },
                        {
                            label: 'Meta Máxima',
                            data: [],
                            borderColor: '#a855f7',
                            borderDash: [5, 5],
                            borderWidth: 2,
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
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#F8FAFC',
                            titleFont: { size: 12, weight: 'bold', family: "'Plus Jakarta Sans', sans-serif" },
                            bodyColor: '#CBD5E1',
                            bodyFont: { size: 11, family: "'Plus Jakarta Sans', sans-serif" },
                            borderColor: 'rgba(16, 185, 129, 0.3)',
                            borderWidth: 1,
                            padding: 10,
                            cornerRadius: 8,
                            callbacks: {
                                afterBody: function(tooltipItems) {
                                    if (!tooltipItems || tooltipItems.length === 0) return [];
                                    const idx = tooltipItems[0].dataIndex;
                                    const meta = state.charts.evolution ? state.charts.evolution._metaData : null;
                                    if (!meta) return [];
                                    const lines = [];
                                    if (meta.osList && meta.osList[idx] && meta.osList[idx] !== 'N/A') {
                                        lines.push(`📋 OS: ${meta.osList[idx]}`);
                                    }
                                    if (meta.frentesList && meta.frentesList[idx] && meta.frentesList[idx] !== 'N/A') {
                                        lines.push(`🚜 Frente: ${meta.frentesList[idx]}`);
                                    }
                                    if (meta.locaisList && meta.locaisList[idx] && meta.locaisList[idx] !== 'N/A') {
                                        lines.push(`📍 Local/Talhão: ${meta.locaisList[idx]}`);
                                    }
                                    if (meta.counts && meta.counts[idx]) {
                                        lines.push(`📊 Medições: ${meta.counts[idx]}`);
                                    }
                                    return lines;
                                }
                            }
                        }
                    },
                    scales: {
                        x: { ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } }, grid: { display: false } },
                        y: { ticks: { color: textColor, font: { family: 'JetBrains Mono' } }, grid: { color: gridColor }, suggestedMin: 30, suggestedMax: 65 }
                    }
                }
            });
        }

        // 3. Histograma de Frequência por Classes de 5 cm
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
                        label: 'Profundidade Média (cm)',
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
                        x: { ticks: { color: textColor, font: { family: 'JetBrains Mono' } }, grid: { color: gridColor }, suggestedMin: 30, suggestedMax: 60 },
                        y: { ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 10 } }, grid: { display: false } }
                    }
                }
            });
        }
    }

    function renderCharts(m, histogram, timeSeries, frentes) {
        // 1. Donut
        if (state.charts.donut) {
            state.charts.donut.data.datasets[0].data = [m.dentroFaixa, m.abaixoFaixa, m.acimaFaixa];
            state.charts.donut.update();
        }

        const centerPercEl = document.getElementById('donutCenterPerc');
        if (centerPercEl) centerPercEl.innerText = `${m.percDentro}%`;
        const centerCountEl = document.getElementById('donutCenterCount');
        if (centerCountEl) centerCountEl.innerText = `${m.dentroFaixa} de ${m.totalMedicoes}`;

        // Detalhamento Numérico Explicito e Barras (SEMPRE COM DADOS)
        const valDentro = document.getElementById('donutValDentro');
        const barDentro = document.getElementById('donutBarDentro');
        if (valDentro) valDentro.innerText = `${m.dentroFaixa} (${m.percDentro}%)`;
        if (barDentro) barDentro.style.width = `${m.percDentro}%`;

        const valAbaixo = document.getElementById('donutValAbaixo');
        const barAbaixo = document.getElementById('donutBarAbaixo');
        if (valAbaixo) valAbaixo.innerText = `${m.abaixoFaixa} (${m.percAbaixo}%)`;
        if (barAbaixo) barAbaixo.style.width = `${m.percAbaixo}%`;

        const valAcima = document.getElementById('donutValAcima');
        const barAcima = document.getElementById('donutBarAcima');
        if (valAcima) valAcima.innerText = `${m.acimaFaixa} (${m.percAcima}%)`;
        if (barAcima) barAcima.style.width = `${m.percAcima}%`;

        const valTotal = document.getElementById('donutValTotal');
        if (valTotal) valTotal.innerText = `${m.totalMedicoes} avaliadas`;

        const scopeBadge = document.getElementById('donutScopeBadge');
        if (scopeBadge) {
            scopeBadge.innerText = state.periodScope === 'all' ? '% da safra' : (state.periodScope === 'latest' ? 'Última data' : (state.activeFilters.date || 'Filtro'));
        }

        // 2. Gráfico de Evolução com as 2 Linhas de Meta (Min e Max)
        if (state.charts.evolution) {
            let labels = timeSeries.labels;
            let medias = timeSeries.medias;
            let minLine = timeSeries.targetMinLine;
            let maxLine = timeSeries.targetMaxLine;
            let osList = timeSeries.osList || [];
            let frentesList = timeSeries.frentesList || [];
            let locaisList = timeSeries.locaisList || [];
            let counts = timeSeries.counts || [];

            if (state.evolutionRange === '7D' && labels.length > 7) {
                labels = labels.slice(-7);
                medias = medias.slice(-7);
                minLine = minLine.slice(-7);
                maxLine = maxLine.slice(-7);
                osList = osList.slice(-7);
                frentesList = frentesList.slice(-7);
                locaisList = locaisList.slice(-7);
                counts = counts.slice(-7);
            } else if (state.evolutionRange === '15D' && labels.length > 15) {
                labels = labels.slice(-15);
                medias = medias.slice(-15);
                minLine = minLine.slice(-15);
                maxLine = maxLine.slice(-15);
                osList = osList.slice(-15);
                frentesList = frentesList.slice(-15);
                locaisList = locaisList.slice(-15);
                counts = counts.slice(-15);
            }

            state.charts.evolution._metaData = {
                osList,
                frentesList,
                locaisList,
                counts
            };

            state.charts.evolution.data.labels = labels;
            state.charts.evolution.data.datasets[0].data = medias;
            state.charts.evolution.data.datasets[1].data = minLine;
            state.charts.evolution.data.datasets[2].data = maxLine;
            state.charts.evolution.update();

            const daysEl = document.getElementById('evolutionDaysCount');
            if (daysEl) daysEl.innerText = `${timeSeries.labels.length} dias monitorados`;
        }

        // 3. Histograma
        if (state.charts.histogram) {
            state.charts.histogram.data.labels = histogram.labels;
            state.charts.histogram.data.datasets[0].data = histogram.counts;
            state.charts.histogram.update();

            const histContainer = document.getElementById('histogramBreakdownContainer');
            if (histContainer) {
                histContainer.innerHTML = '';
                histogram.labels.forEach((lbl, i) => {
                    const c = histogram.counts[i];
                    const p = histogram.percentages[i];
                    const el = document.createElement('div');
                    el.className = 'p-2 rounded-xl border bg-slate-50 dark:bg-slate-800/50 text-center';
                    el.style.borderColor = 'var(--border-color)';
                    el.innerHTML = `
                        <div class="text-[10px] text-[var(--text-secondary)] font-medium">${lbl}</div>
                        <div class="text-xs font-mono font-bold text-sky-500 mt-0.5">${c}</div>
                        <div class="text-[9px] font-mono text-[var(--text-muted)]">${p}%</div>
                    `;
                    histContainer.appendChild(el);
                });
            }
        }

        // 4. Médias por Frente
        if (state.charts.frentes) {
            state.charts.frentes.data.labels = frentes.map(f => f.frente);
            state.charts.frentes.data.datasets[0].data = frentes.map(f => f.media);
            state.charts.frentes.update();
        }
    }

    function updateChartsTheme() {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#475569';
        Object.values(state.charts).forEach(c => {
            if (c.options.scales) {
                if (c.options.scales.x) c.options.scales.x.ticks.color = textColor;
                if (c.options.scales.y) c.options.scales.y.ticks.color = textColor;
            }
            if (c.options.plugins && c.options.plugins.legend && c.options.plugins.legend.labels) {
                c.options.plugins.legend.labels.color = textColor;
            }
            c.update();
        });
    }

    /**
     * Análise por Frente (Seção 10)
     */
    function renderFrenteAnalysis(frentes) {
        const tbody = document.getElementById('frenteTableBody');
        const containerBtn = document.getElementById('frenteFilterActiveContainer');
        const hintText = document.getElementById('frenteHintText');

        if (containerBtn) {
            if (state.activeFilters.frente !== 'ALL') {
                containerBtn.innerHTML = `
                    <button id="btnClearFrenteFilter" type="button" class="px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30" title="Clique para remover o filtro desta frente">
                        <span>↺</span>
                        <span>Limpar Filtro (${state.activeFilters.frente})</span>
                    </button>
                `;
                const btnClear = containerBtn.querySelector('#btnClearFrenteFilter');
                if (btnClear) {
                    btnClear.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        document.getElementById('filterFrente').value = 'ALL';
                        state.activeFilters.frente = 'ALL';
                        applyFilters();
                    });
                }
                if (hintText) hintText.style.display = 'none';
            } else {
                containerBtn.innerHTML = '';
                if (hintText) hintText.style.display = '';
            }
        }

        if (!tbody) return;
        tbody.innerHTML = '';

        if (frentes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="text-center p-6 text-xs text-[var(--text-muted)]">Nenhuma frente localizada.</td></tr>`;
            return;
        }

        frentes.forEach(f => {
            const isSelected = (state.activeFilters.frente === f.frente);
            const tr = document.createElement('tr');
            tr.className = `border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] cursor-pointer text-xs transition-colors ${isSelected ? 'bg-emerald-500/15 dark:bg-emerald-500/20 ring-1 ring-emerald-500/40 font-semibold' : ''}`;
            tr.innerHTML = `
                <td class="p-3 font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    ${isSelected ? '<span class="text-emerald-500">✓</span>' : ''}
                    <span>${f.frente}</span>
                </td>
                <td class="p-3 font-mono text-center font-bold">${f.total}</td>
                <td class="p-3 font-mono text-center font-bold text-emerald-500">${f.media} cm</td>
                <td class="p-3 font-mono text-center">${f.mediana} cm</td>
                <td class="p-3 font-mono text-center text-amber-500">${f.min} cm</td>
                <td class="p-3 font-mono text-center text-purple-500">${f.max} cm</td>
                <td class="p-3 font-mono text-center text-sky-500">±${f.stdDev}</td>
                <td class="p-3 font-mono text-center">${f.totalOS}</td>
                <td class="p-3 font-mono text-center">${f.totalLocais}</td>
                <td class="p-3 font-mono text-center font-bold text-emerald-500">${f.percDentro}% (${f.dentro})</td>
                <td class="p-3 font-mono text-center text-[var(--text-muted)]">${f.ultimaDataBR}</td>
            `;
            tr.addEventListener('click', () => {
                if (state.activeFilters.frente === f.frente) {
                    // Toggle desligar se clicar na mesma linha
                    document.getElementById('filterFrente').value = 'ALL';
                    state.activeFilters.frente = 'ALL';
                } else {
                    document.getElementById('filterFrente').value = f.frente;
                    state.activeFilters.frente = f.frente;
                }
                applyFilters();
            });
            tbody.appendChild(tr);
        });
    }

    /**
     * Controle de Qualidade por OS (Seção 11)
     */
    function renderOSAnalysis(osList) {
        const tbody = document.getElementById('osTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (osList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center p-6 text-xs text-[var(--text-muted)]">Nenhuma OS localizada.</td></tr>`;
            return;
        }

        // Ordenação conforme o seletor
        const sortKey = state.osSort;
        osList.sort((a, b) => {
            if (sortKey === 'stdDev') return b.stdDev - a.stdDev;
            if (sortKey === 'amplitude') return b.amplitude - a.amplitude;
            if (sortKey === 'mediaDesc') return b.media - a.media;
            if (sortKey === 'mediaAsc') return a.media - b.media;
            if (sortKey === 'percDentro') return b.percDentro - a.percDentro;
            return b.total - a.total; // padrão: total
        });

        const containerBtnOS = document.getElementById('osFilterActiveContainer');
        if (containerBtnOS) {
            if (state.activeFilters.os !== 'ALL') {
                containerBtnOS.innerHTML = `
                    <button id="btnClearOSFilter" type="button" class="px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 mr-2" title="Clique para remover o filtro desta OS">
                        <span>↺</span>
                        <span>Limpar OS (${state.activeFilters.os})</span>
                    </button>
                `;
                const btnClearOS = containerBtnOS.querySelector('#btnClearOSFilter');
                if (btnClearOS) {
                    btnClearOS.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        document.getElementById('filterOS').value = 'ALL';
                        state.activeFilters.os = 'ALL';
                        applyFilters();
                    });
                }
            } else {
                containerBtnOS.innerHTML = '';
            }
        }

        osList.forEach(item => {
            const isSelected = (state.activeFilters.os === item.os);
            const tr = document.createElement('tr');
            tr.className = `border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] cursor-pointer text-xs transition-colors ${isSelected ? 'bg-emerald-500/15 dark:bg-emerald-500/20 ring-1 ring-emerald-500/40 font-semibold' : ''}`;
            tr.innerHTML = `
                <td class="p-2.5 font-mono font-bold text-emerald-500 flex items-center gap-1.5">
                    ${isSelected ? '<span>✓</span>' : ''}
                    <span>${item.os}</span>
                </td>
                <td class="p-2.5 truncate max-w-[160px]" title="${item.frentes}">${item.frentes}</td>
                <td class="p-2.5 truncate max-w-[140px]" title="${item.locais}">${item.locais}</td>
                <td class="p-2.5 font-mono text-center font-bold">${item.total}</td>
                <td class="p-2.5 font-mono text-center font-bold text-emerald-500">${item.media} cm</td>
                <td class="p-2.5 font-mono text-center">${item.mediana} cm</td>
                <td class="p-2.5 font-mono text-center">${item.min} / ${item.max} cm</td>
                <td class="p-2.5 font-mono text-center text-sky-500">±${item.stdDev}</td>
                <td class="p-2.5 font-mono text-center font-bold ${item.percDentro >= 80 ? 'text-emerald-500' : 'text-amber-500'}">${item.percDentro}%</td>
                <td class="p-2.5 font-mono text-center text-[var(--text-muted)]">${item.primeiraDataBR} a ${item.ultimaDataBR}</td>
            `;
            tr.addEventListener('click', () => {
                if (state.activeFilters.os === item.os) {
                    // Toggle desligar se clicar na mesma linha
                    document.getElementById('filterOS').value = 'ALL';
                    state.activeFilters.os = 'ALL';
                } else {
                    document.getElementById('filterOS').value = item.os;
                    state.activeFilters.os = item.os;
                }
                applyFilters();
            });
            tbody.appendChild(tr);
        });
    }

    /**
     * Análise por Responsável (Seção 15)
     */
    function renderRespAnalysis(resps) {
        const tbody = document.getElementById('respTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        resps.forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] cursor-pointer text-xs';
            tr.innerHTML = `
                <td class="p-2.5 font-bold text-[var(--text-primary)]">${r.responsavel}</td>
                <td class="p-2.5 font-mono text-center font-bold">${r.total}</td>
                <td class="p-2.5 font-mono text-center font-bold text-emerald-500">${r.media} cm</td>
                <td class="p-2.5 font-mono text-center">${r.mediana} cm</td>
                <td class="p-2.5 font-mono text-center text-sky-500">±${r.stdDev}</td>
                <td class="p-2.5 font-mono text-center">${r.totalFrentes}</td>
                <td class="p-2.5 font-mono text-center">${r.totalOS}</td>
            `;
            tr.addEventListener('click', () => {
                document.getElementById('filterResponsavel').value = r.responsavel;
                state.activeFilters.responsavel = r.responsavel;
                applyFilters();
            });
            tbody.appendChild(tr);
        });
    }

    /**
     * Auditoria de Duração (Seção 16)
     */
    function renderDurationAuditing(m) {
        const durMediaEl = document.getElementById('statDuracaoMedia');
        const durZeroEl = document.getElementById('statDuracaoZero');
        const durAtipicaEl = document.getElementById('statDuracaoAtipica');
        const coordsEl = document.getElementById('statCoordsValidas');

        let zeros = 0, atipicos = 0;
        state.filteredRecords.forEach(r => {
            if (r.duracaoMinutos === 0) zeros++;
            if (r.duracaoMinutos > 120) atipicos++;
        });

        if (durMediaEl) durMediaEl.innerText = `${m.duracaoMediaMinutos} min`;
        if (durZeroEl) durZeroEl.innerText = `${zeros} medições`;
        if (durAtipicaEl) durAtipicaEl.innerText = `${atipicos} medições`;
        if (coordsEl) {
            const perc = m.totalMedicoes > 0 ? ((m.coordsValidasCount / m.totalMedicoes) * 100).toFixed(1) : 0;
            coordsEl.innerText = `${perc}% (${m.coordsValidasCount}/${m.totalMedicoes})`;
        }
    }

    /**
     * Mapa Geográfico Leaflet (Seção 13)
     */
    function initMap() {
        const mapContainer = document.getElementById('mapContainer');
        if (!mapContainer || typeof L === 'undefined') return;

        state.map = L.map('mapContainer').setView([-21.05, -48.33], 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(state.map);

        state.markerCluster = L.markerClusterGroup ? L.markerClusterGroup() : L.layerGroup();
        state.map.addLayer(state.markerCluster);
    }

    function renderMap() {
        if (!state.map || !state.markerCluster) return;
        state.markerCluster.clearLayers();

        const validCoords = state.filteredRecords.filter(r => r.hasValidCoords);
        const bounds = [];
        const cfg = state.targetConfig;

        validCoords.forEach(r => {
            const cls = SubsolagemEngine.classifyDepth(r.profundidade, cfg);
            const color = cls.color;

            const marker = L.circleMarker([r.lat, r.lng], {
                radius: 7,
                fillColor: color,
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.85
            });

            marker.bindPopup(`
                <div class="p-1 font-sans text-xs">
                    <div class="font-bold text-slate-900">${r.frente} • OS ${r.os}</div>
                    <div class="text-slate-600 mt-0.5">ID: ${r.id} • ${r.dataHoraBR}</div>
                    <div class="text-slate-600">Local: ${r.local}</div>
                    <div class="text-slate-600">Responsável: ${r.responsavel}</div>
                    <div class="mt-1 font-bold font-mono" style="color: ${color};">
                        Profundidade: ${r.profundidade} cm (${cls.label})
                    </div>
                    <button onclick="window.subsolagemOpenModalById('${r.id}')" class="mt-2 w-full py-1 bg-slate-900 text-white rounded text-[11px] font-semibold">
                        Ver Raio-X Completo
                    </button>
                </div>
            `);

            state.markerCluster.addLayer(marker);
            bounds.push([r.lat, r.lng]);
        });

        if (bounds.length > 0) {
            state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
        }
    }

    /**
     * Tabela Completa de Registros (Seção 17)
     */
    function setupTableControls() {
        document.getElementById('btnPrevPage').addEventListener('click', () => {
            if (state.pagination.page > 1) {
                state.pagination.page--;
                renderTable();
            }
        });

        document.getElementById('btnNextPage').addEventListener('click', () => {
            if (state.pagination.page < state.pagination.totalPages) {
                state.pagination.page++;
                renderTable();
            }
        });
    }

    function renderTable() {
        const tbody = document.getElementById('tableBody');
        const paginationInfo = document.getElementById('paginationInfo');
        const currentPageNum = document.getElementById('currentPageNum');
        const btnPrev = document.getElementById('btnPrevPage');
        const btnNext = document.getElementById('btnNextPage');
        if (!tbody) return;

        const total = state.filteredRecords.length;
        const { page, pageSize } = state.pagination;
        state.pagination.totalPages = Math.max(1, Math.ceil(total / pageSize));

        const startIdx = (page - 1) * pageSize;
        const pageRecords = state.filteredRecords.slice(startIdx, startIdx + pageSize);

        tbody.innerHTML = '';
        if (pageRecords.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center p-8 text-xs text-[var(--text-muted)]">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
            if (paginationInfo) paginationInfo.innerText = '0 registros';
            return;
        }

        const cfg = state.targetConfig;

        pageRecords.forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] cursor-pointer text-xs';
            
            const cls = SubsolagemEngine.classifyDepth(r.profundidade, cfg);

            tr.innerHTML = `
                <td class="p-3 font-mono font-bold text-emerald-500">${r.id}</td>
                <td class="p-3 font-mono whitespace-nowrap">${r.dataHoraBR}</td>
                <td class="p-3 truncate max-w-[160px]" title="${r.frente}">${r.frente}</td>
                <td class="p-3 font-mono font-bold">${r.os}</td>
                <td class="p-3 truncate max-w-[140px]" title="${r.local}">${r.local}</td>
                <td class="p-3 truncate max-w-[160px]" title="${r.responsavel}">${r.responsavel}</td>
                <td class="p-3 font-mono font-bold text-center text-sm" style="color: ${cls.color};">${r.profundidade !== null ? r.profundidade + ' cm' : '-'}</td>
                <td class="p-3 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls.badgeClass}">
                        ${cls.status}
                    </span>
                </td>
                <td class="p-3 text-center font-mono text-[11px] text-[var(--text-muted)]">${r.status}</td>
                <td class="p-3 text-center">
                    <button class="px-2.5 py-1 rounded-lg border hover:bg-emerald-500 hover:text-white transition-all text-[11px] font-semibold" style="border-color: var(--border-color);">
                        Raio-X
                    </button>
                </td>
            `;

            tr.addEventListener('click', () => openRecordModal(r));
            tbody.appendChild(tr);
        });

        if (paginationInfo) {
            const endIdx = Math.min(startIdx + pageSize, total);
            paginationInfo.innerText = `Exibindo ${startIdx + 1}-${endIdx} de ${total}`;
        }
        if (currentPageNum) currentPageNum.innerText = page;
        if (btnPrev) btnPrev.disabled = (page <= 1);
        if (btnNext) btnNext.disabled = (page >= state.pagination.totalPages);
    }

    /**
     * Modal de Detalhamento / Raio-X Individual
     */
    function setupRecordModal() {
        const modal = document.getElementById('recordModal');
        const btnClose = document.getElementById('modalCloseBtn');
        if (btnClose) btnClose.addEventListener('click', () => modal.classList.add('hidden'));
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        }
        window.subsolagemOpenModalById = function (id) {
            const r = state.allRecords.find(item => item.id === id);
            if (r) openRecordModal(r);
        };
    }

    function openRecordModal(r) {
        const modal = document.getElementById('recordModal');
        if (!modal) return;

        const cls = SubsolagemEngine.classifyDepth(r.profundidade, state.targetConfig);
        const badge = document.getElementById('modalClassificationBadge');
        if (badge) {
            badge.innerText = cls.label;
            badge.className = `text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${cls.badgeClass}`;
        }

        document.getElementById('modalRecordId').innerText = r.id;
        document.getElementById('modalRecordDate').innerText = `${r.dataHoraBR} • Data Lançamento: ${r.dataLancamentoBR}`;
        document.getElementById('modalProfundidade').innerText = r.profundidade !== null ? `${r.profundidade} ${state.targetConfig.unidade}` : 'Sem medição';
        document.getElementById('modalOS').innerText = r.os;
        document.getElementById('modalFrente').innerText = r.frente;
        document.getElementById('modalResponsavel').innerText = r.responsavel;
        document.getElementById('modalLocal').innerText = r.local;
        document.getElementById('modalLat').innerText = r.lat !== null ? r.lat.toFixed(6) : 'Ausente';
        document.getElementById('modalLng').innerText = r.lng !== null ? r.lng.toFixed(6) : 'Ausente';
        document.getElementById('modalDataInicio').innerText = r.dataInicioStr || '-';
        document.getElementById('modalDataFim').innerText = r.dataFimStr || '-';
        document.getElementById('modalDuracao').innerText = `${r.duracaoMinutos} minutos`;
        document.getElementById('modalUsuario').innerText = r.usuario;
        document.getElementById('modalStatus').innerText = r.status;
        document.getElementById('modalScore').innerText = r.score;
        document.getElementById('modalScoreDesc').innerText = r.scoreDesc;

        modal.classList.remove('hidden');
    }

    /**
     * Modal de Configuração da Faixa Técnica
     */
    function setupTargetModal() {
        const modal = document.getElementById('targetModal');
        const btnOpen = document.getElementById('btnOpenTargetModal');
        const btnClose = document.getElementById('targetModalCloseBtn');
        const btnCancel = document.getElementById('btnCancelTarget');
        const btnSave = document.getElementById('btnSaveTarget');

        function openTargetModal() {
            document.getElementById('inputTargetMin').value = state.targetConfig.min;
            document.getElementById('inputTargetMax').value = state.targetConfig.max;
            document.getElementById('inputTargetUnidade').value = state.targetConfig.unidade;
            document.getElementById('checkTargetActive').checked = state.targetConfig.ativa;
            modal.classList.remove('hidden');
        }

        function closeTargetModal() {
            modal.classList.add('hidden');
        }

        if (btnOpen) btnOpen.addEventListener('click', openTargetModal);
        if (btnClose) btnClose.addEventListener('click', closeTargetModal);
        if (btnCancel) btnCancel.addEventListener('click', closeTargetModal);

        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const minVal = parseFloat(document.getElementById('inputTargetMin').value);
                const maxVal = parseFloat(document.getElementById('inputTargetMax').value);
                const unidade = document.getElementById('inputTargetUnidade').value.trim() || 'cm';
                const ativa = document.getElementById('checkTargetActive').checked;

                if (isNaN(minVal) || isNaN(maxVal) || minVal >= maxVal) {
                    alert('Por favor, informe valores válidos com Min < Max.');
                    return;
                }

                state.targetConfig = SubsolagemEngine.saveTargetConfig({
                    min: minVal,
                    max: maxVal,
                    unidade,
                    ativa
                });

                closeTargetModal();
                updateTargetDisplayUI();
                showToast(`Metas técnicas salvas: Min ${minVal} ${unidade} | Max ${maxVal} ${unidade}`);
                applyFilters();
            });
        }

        window.subsolagemOpenTargetConfig = openTargetModal;
    }

    /**
     * Recurso Secreto Solicitado pelo Usuário:
     * "os valores das metas podem ser alterados segurando ctrl + duplo clique"
     */
    function setupSecretTargetEditing() {
        const triggers = [
            document.getElementById('chartEvolutionCard'),
            document.getElementById('chartEvolution'),
            document.getElementById('chartHistogramCard'),
            document.getElementById('chartHistogram')
        ];

        triggers.forEach(el => {
            if (el) {
                el.addEventListener('dblclick', (e) => {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof window.subsolagemOpenTargetConfig === 'function') {
                            window.subsolagemOpenTargetConfig();
                        }
                    }
                });
            }
        });
    }

    /**
     * Exportação CSV dos Dados Filtrados
     */
    function exportFilteredCSV() {
        if (state.filteredRecords.length === 0) {
            showToast('Nenhum registro para exportar.');
            return;
        }

        const headers = [
            'ID', 'Usuario', 'Data', 'Latitude', 'Longitude', 'DataInicio', 'DataFim',
            'Status', 'Score', 'ScoreDesc', 'DataLancamento', 'Local', 'OS', 'Frente',
            'Responsavel', 'Profundidade_cm', 'Classificacao_Tecnica', 'Meta_Min', 'Meta_Max'
        ];

        const rows = [headers.join(';')];
        const cfg = state.targetConfig;

        state.filteredRecords.forEach(r => {
            const cls = SubsolagemEngine.classifyDepth(r.profundidade, cfg);
            const row = [
                `"${r.id}"`,
                `"${r.usuario}"`,
                `"${r.dataHoraBR}"`,
                `"${r.lat !== null ? r.lat : ''}"`,
                `"${r.lng !== null ? r.lng : ''}"`,
                `"${r.dataInicioStr}"`,
                `"${r.dataFimStr}"`,
                `"${r.status}"`,
                `"${r.score}"`,
                `"${r.scoreDesc}"`,
                `"${r.dataLancamentoBR}"`,
                `"${r.local}"`,
                `"${r.os}"`,
                `"${r.frente}"`,
                `"${r.responsavel}"`,
                `"${r.profundidade !== null ? r.profundidade : ''}"`,
                `"${cls.status}"`,
                `"${cfg.min}"`,
                `"${cfg.max}"`
            ];
            rows.push(row.join(';'));
        });

        const csvContent = '\uFEFF' + rows.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `subsolagem_pitangueiras_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Exportação de ${state.filteredRecords.length} registros concluída.`);
    }

    /**
     * Toast de Notificações
     */
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerText = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3500);
    }

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
                applyFilters();
            });
        });
    }

})();
