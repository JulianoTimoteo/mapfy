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
 * Controlador Principal do Painel de Inspeções das Frentes Agrícolas
 * Usina Pitangueiras • Área de Vivência / Colheita
 */

(function () {
    'use strict';

    // Estado da Aplicação
    const state = {
        allRecords: [],
        filteredRecords: [],
        maxAvailableDateBR: '',
        maxAvailableDateISO: '',
        todayBR: '',
        activeFilters: {
            date: '',
            dateStart: '',
            dateEnd: '',
            frente: 'ALL',
            responsavel: 'ALL',
            turno: 'ALL',
            status: 'ALL',
            resultado: 'ALL',
            itemNaoConforme: 'ALL',
            hasObs: 'ALL',
            search: ''
        },
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
        isLatestDateMode: true
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

        document.querySelectorAll('#themeToggleBtn, #themeToggleBtnToolbar, .theme-toggle-btn').forEach(btn => {
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
        const raw = window.RAW_INSPECTIONS || [];
        state.allRecords = raw.map(ComplianceEngine.normalizeRecord);

        // Identifica a maior data válida de inspeção (Seção 4)
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

        // Data de hoje formatada
        const now = new Date();
        state.todayBR = ComplianceEngine.formatDateBR(now);

        // REGRA DE CARGA: Safra Completa (347 inspeções) para visão analítica completa imediata
        state.periodScope = 'all';
        state.activeFilters.date = '';
        state.isLatestDateMode = false;

        // Atualiza badges numéricos do seletor rápido
        const badgeAll = document.getElementById('badgeAll');
        if (badgeAll) badgeAll.innerText = state.allRecords.length;

        const badgeLatest = document.getElementById('badgeLatest');
        if (badgeLatest && state.maxAvailableDateBR) {
            badgeLatest.innerText = state.maxAvailableDateBR.substring(0, 5);
        }

        // Atualiza cabeçalho com data da última atualização
        const lastSyncEl = document.getElementById('lastSyncDate');
        if (lastSyncEl && maxRecord) {
            lastSyncEl.innerText = `${maxRecord.dataHoraBR} (ID: ${maxRecord.id})`;
        }
    }

    /**
     * Inicialização dos Controles da Interface
     */
    function initUI() {
        populateSelectOptions();
        setupFilterListeners();
        setupHeaderButtons();
        setupTableControls();
        setupModal();
    }

    /**
     * Popula dinamicamente os selects de filtros
     */
    function populateSelectOptions() {
        const frenteSelect = document.getElementById('filterFrente');
        const respSelect = document.getElementById('filterResponsavel');

        // Frentes distintas
        const frentes = Array.from(new Set(state.allRecords.map(r => r.frente))).sort();
        frentes.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.innerText = f;
            frenteSelect.appendChild(opt);
        });

        // Responsáveis distintos
        const resps = Array.from(new Set(state.allRecords.map(r => r.responsavel))).sort();
        resps.forEach(r => {
            if (r && r !== 'Não Informado') {
                const opt = document.createElement('option');
                opt.value = r;
                opt.innerText = r;
                respSelect.appendChild(opt);
            }
        });

        // Input de Data inicializado com a data mais recente
        const dateInput = document.getElementById('filterDate');
        if (dateInput && state.maxAvailableDateISO) {
            dateInput.value = state.maxAvailableDateISO;
        }
    }

    /**
     * Listeners dos Filtros Globais
     */
    function setupFilterListeners() {
        const dateInput = document.getElementById('filterDate');
        const frenteSelect = document.getElementById('filterFrente');
        const respSelect = document.getElementById('filterResponsavel');
        const turnoSelect = document.getElementById('filterTurno');
        const resultadoSelect = document.getElementById('filterResultado');
        const itemSelect = document.getElementById('filterItem');
        const obsSelect = document.getElementById('filterObs');
        const searchInput = document.getElementById('globalSearch');

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

        respSelect.addEventListener('change', (e) => {
            state.activeFilters.responsavel = e.target.value;
            state.pagination.page = 1;
            applyFilters();
        });

        turnoSelect.addEventListener('change', (e) => {
            state.activeFilters.turno = e.target.value;
            state.pagination.page = 1;
            applyFilters();
        });

        resultadoSelect.addEventListener('change', (e) => {
            state.activeFilters.resultado = e.target.value;
            state.pagination.page = 1;
            applyFilters();
        });

        itemSelect.addEventListener('change', (e) => {
            state.activeFilters.itemNaoConforme = e.target.value;
            state.pagination.page = 1;
            applyFilters();
        });

        obsSelect.addEventListener('change', (e) => {
            state.activeFilters.hasObs = e.target.value;
            state.pagination.page = 1;
            applyFilters();
        });

        searchInput.addEventListener('input', (e) => {
            state.activeFilters.search = e.target.value.toLowerCase().trim();
            state.pagination.page = 1;
            applyFilters();
        });

        document.getElementById('btnClearFilters').addEventListener('click', resetFilters);
    }

    /**
     * Atualização Visual do Seletor Rápido de Período
     */
    function updatePeriodToggleUI() {
        const btnAll = document.getElementById('btnAllDates');
        const btnLatest = document.getElementById('btnLatestDate');
        const btnToday = document.getElementById('btnToday');

        if (btnAll) btnAll.classList.toggle('active', state.periodScope === 'all');
        if (btnLatest) btnLatest.classList.toggle('active', state.periodScope === 'latest');
        if (btnToday) btnToday.classList.toggle('active', state.periodScope === 'today');
    }

    /**
     * Define o escopo temporal com diferenciação visual clara
     */
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
                showToast(`Nenhuma inspeção registrada hoje (${state.todayBR}). Exibindo última data disponível (${state.maxAvailableDateBR}).`);
                setPeriodScope('latest');
                return;
            }
        }

        updatePeriodToggleUI();
        state.pagination.page = 1;
        applyFilters();
    }

    /**
     * Botões Rápidos de Navegação de Datas no Cabeçalho
     */
    function setupHeaderButtons() {
        const btnAll = document.getElementById('btnAllDates');
        const btnLatest = document.getElementById('btnLatestDate');
        const btnToday = document.getElementById('btnToday');

        if (btnAll) btnAll.addEventListener('click', () => setPeriodScope('all'));
        if (btnLatest) btnLatest.addEventListener('click', () => setPeriodScope('latest'));
        if (btnToday) btnToday.addEventListener('click', () => setPeriodScope('today'));

        // Botão Exportar CSV
        document.getElementById('btnExportCSV').addEventListener('click', exportFilteredCSV);

        // Botão Imprimir
        document.getElementById('btnPrintReport').addEventListener('click', () => {
            window.print();
        });

        updatePeriodToggleUI();
    }

    /**
     * Reseta todos os filtros
     */
    function resetFilters() {
        state.periodScope = 'all';
        state.activeFilters = {
            date: '',
            dateStart: '',
            dateEnd: '',
            frente: 'ALL',
            responsavel: 'ALL',
            turno: 'ALL',
            status: 'ALL',
            resultado: 'ALL',
            itemNaoConforme: 'ALL',
            hasObs: 'ALL',
            search: ''
        };
        state.isLatestDateMode = false;

        const dateInput = document.getElementById('filterDate');
        if (dateInput) dateInput.value = '';
        document.getElementById('filterFrente').value = 'ALL';
        document.getElementById('filterResponsavel').value = 'ALL';
        document.getElementById('filterTurno').value = 'ALL';
        document.getElementById('filterResultado').value = 'ALL';
        document.getElementById('filterItem').value = 'ALL';
        document.getElementById('filterObs').value = 'ALL';
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

        state.filteredRecords = state.allRecords.filter(r => {
            // Filtro por Data
            if (f.date && r.dataBR !== f.date) return false;

            // Filtro por Frente
            if (f.frente !== 'ALL' && r.frente !== f.frente) return false;

            // Filtro por Responsável
            if (f.responsavel !== 'ALL' && r.responsavel !== f.responsavel) return false;

            // Filtro por Turno
            if (f.turno !== 'ALL') {
                if (f.turno === 'OUTROS') {
                    if (!r.turnoAtipico) return false;
                } else if (r.turno !== f.turno) return false;
            }

            // Filtro por Resultado de Conformidade
            if (f.resultado !== 'ALL') {
                if (r.compliance.classificacao !== f.resultado) return false;
            }

            // Filtro por Item Específico com Não Conformidade / Ocorrência
            if (f.itemNaoConforme !== 'ALL') {
                const rule = ComplianceEngine.COMPLIANCE_RULES[f.itemNaoConforme];
                if (rule) {
                    const ans = r.answers[f.itemNaoConforme];
                    if (rule.type === 'CRITICO' && ans === rule.expected) return false;
                    if (rule.type === 'OCORRENCIA' && ans !== 'SIM') return false;
                }
            }

            // Filtro por Presença de Observações
            if (f.hasObs === 'WITH_OBS' && !r.obs) return false;
            if (f.hasObs === 'WITHOUT_OBS' && r.obs) return false;

            // Busca Textual
            if (f.search) {
                const q = f.search;
                const matchId = r.id.toLowerCase().includes(q);
                const matchFrente = r.frente.toLowerCase().includes(q);
                const matchResp = r.responsavel.toLowerCase().includes(q);
                const matchLocal = r.local.toLowerCase().includes(q);
                const matchObs = r.obs ? r.obs.toLowerCase().includes(q) : false;
                if (!matchId && !matchFrente && !matchResp && !matchLocal && !matchObs) return false;
            }

            return true;
        });

        // Ordenação
        sortRecords();

        // Recalcula KPIs
        const metrics = ComplianceEngine.calculateMetrics(state.filteredRecords);
        const frenteList = ComplianceEngine.buildFrenteAnalysis(state.filteredRecords);
        const matrixData = ComplianceEngine.buildComplianceMatrix(state.filteredRecords);
        const alertsList = ComplianceEngine.buildAlertsList(state.filteredRecords);

        // Renderiza Componentes Sincronizados
        renderHeaderContext(metrics);
        renderCards(metrics);
        renderFilterTags();
        renderAlerts(alertsList);
        renderFrenteAnalysis(frenteList);
        renderComplianceMatrix(matrixData);
        renderTable();
        renderCharts(metrics, frenteList);
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
     * Cabeçalho de Contexto (Período Ativo e Quantidade de Inspeções)
     */
    function renderHeaderContext(metrics) {
        const dateDisplayEl = document.getElementById('currentDateDisplay');
        const countDisplayEl = document.getElementById('currentCountDisplay');

        if (dateDisplayEl) {
            if (state.periodScope === 'all') {
                dateDisplayEl.innerHTML = `🌐 <strong>Safra Completa</strong> <span class="opacity-80 font-normal">(${metrics.totalInspecoes} inspeções consolidadas • 19/06/2026 a ${state.maxAvailableDateBR})</span>`;
            } else if (state.periodScope === 'latest') {
                dateDisplayEl.innerHTML = `📅 <strong>Última Data Disponível: ${state.maxAvailableDateBR}</strong> <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 ml-2">Ativo</span>`;
            } else if (state.periodScope === 'today') {
                dateDisplayEl.innerHTML = `📆 <strong>Data de Hoje: ${state.todayBR}</strong> <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 ml-2">Ativo</span>`;
            } else if (state.activeFilters.date) {
                dateDisplayEl.innerHTML = `🗓️ <strong>Data Filtrada: ${state.activeFilters.date}</strong>`;
            } else {
                dateDisplayEl.innerHTML = `🔍 <strong>Filtro Personalizado</strong>`;
            }
        }

        if (countDisplayEl) {
            countDisplayEl.innerText = `${metrics.totalInspecoes} inspeções no filtro`;
        }
    }

    /**
     * Renderização dos 8 Cards Executivos (Seção 8)
     */
    function renderCards(m) {
        // Card 1: Inspeções Realizadas
        setCardValue('cardTotalInspecoes', m.totalInspecoes.toLocaleString());
        // Card 2: Frentes Inspecionadas
        setCardValue('cardFrentesInspecionadas', m.frentesInspecionadas);
        // Card 3: Não Conformidades Confirmadas
        setCardValue('cardNaoConformes', m.inspecoesNaoConformes);
        // Card 4: Itens Não Conformes
        setCardValue('cardTotalItensFalhas', m.totalItensNaoConformes);
        // Card 5: Inspeções Conformes
        setCardValue('cardConformes', m.inspecoesConformes);
        setCardValue('cardConformesPerc', `${m.taxaConformidade}%`);
        // Card 6: Inspeções Abertas
        setCardValue('cardAbertas', m.inspecoesAbertas);
        // Card 7: Pendências de Informação
        setCardValue('cardPendencias', m.pendenciasInformacao);
        // Card 8: Frentes que Exigem Atenção
        setCardValue('cardFrentesAtencao', m.frentesAtencao);

        // Click nos cards para filtrar rapidamente
        setupCardClicks();
    }

    function setCardValue(id, val) {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    }

    function setupCardClicks() {
        const mapCardToFilter = {
            cardNaoConformesContainer: () => {
                document.getElementById('filterResultado').value = 'NÃO CONFORME';
                state.activeFilters.resultado = 'NÃO CONFORME';
                applyFilters();
            },
            cardConformesContainer: () => {
                document.getElementById('filterResultado').value = 'CONFORME';
                state.activeFilters.resultado = 'CONFORME';
                applyFilters();
            },
            cardTotalInspecoesContainer: () => {
                document.getElementById('filterResultado').value = 'ALL';
                state.activeFilters.resultado = 'ALL';
                applyFilters();
            }
        };

        for (const [id, action] of Object.entries(mapCardToFilter)) {
            const el = document.getElementById(id);
            if (el && !el.dataset.bound) {
                el.addEventListener('click', action);
                el.dataset.bound = 'true';
            }
        }
    }

    /**
     * Tags de Filtros Ativos
     */
    function renderFilterTags() {
        const container = document.getElementById('activeFilterTags');
        if (!container) return;

        container.innerHTML = '';
        const f = state.activeFilters;
        const tags = [];

        if (f.date) tags.push({ label: `Data: ${f.date}`, clear: () => { f.date = ''; document.getElementById('filterDate').value = ''; } });
        if (f.frente !== 'ALL') tags.push({ label: `Frente: ${f.frente}`, clear: () => { f.frente = 'ALL'; document.getElementById('filterFrente').value = 'ALL'; } });
        if (f.responsavel !== 'ALL') tags.push({ label: `Resp: ${f.responsavel}`, clear: () => { f.responsavel = 'ALL'; document.getElementById('filterResponsavel').value = 'ALL'; } });
        if (f.turno !== 'ALL') tags.push({ label: `Turno: ${f.turno}`, clear: () => { f.turno = 'ALL'; document.getElementById('filterTurno').value = 'ALL'; } });
        if (f.resultado !== 'ALL') tags.push({ label: `Resultado: ${f.resultado}`, clear: () => { f.resultado = 'ALL'; document.getElementById('filterResultado').value = 'ALL'; } });
        if (f.itemNaoConforme !== 'ALL') {
            const rule = ComplianceEngine.COMPLIANCE_RULES[f.itemNaoConforme];
            tags.push({ label: `Item: ${rule ? rule.shortLabel : f.itemNaoConforme}`, clear: () => { f.itemNaoConforme = 'ALL'; document.getElementById('filterItem').value = 'ALL'; } });
        }
        if (f.hasObs !== 'ALL') tags.push({ label: `OBS: ${f.hasObs === 'WITH_OBS' ? 'Com' : 'Sem'}`, clear: () => { f.hasObs = 'ALL'; document.getElementById('filterObs').value = 'ALL'; } });
        if (f.search) tags.push({ label: `Busca: "${f.search}"`, clear: () => { f.search = ''; document.getElementById('globalSearch').value = ''; } });

        if (tags.length === 0) {
            container.innerHTML = '<span class="text-xs text-[var(--text-muted)] italic">Nenhum filtro restritivo adicional ativo</span>';
            return;
        }

        tags.forEach(t => {
            const tagEl = document.createElement('span');
            tagEl.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
            tagEl.innerHTML = `
                <span>${t.label}</span>
                <button class="hover:text-emerald-700 dark:hover:text-emerald-300 font-bold ml-1">✕</button>
            `;
            tagEl.querySelector('button').addEventListener('click', () => {
                t.clear();
                applyFilters();
            });
            container.appendChild(tagEl);
        });
    }

    /**
     * Central de Atenção Operacional (Seção 18)
     */
    function renderAlerts(alerts) {
        const container = document.getElementById('alertsContainer');
        const badgeEl = document.getElementById('alertsCountBadge');
        if (!container) return;

        if (badgeEl) badgeEl.innerText = `${alerts.length} Ocorrências`;

        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="p-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-color)]">
                    ✓ Nenhuma não conformidade ou ocorrência operacional detectada para os filtros selecionados.
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        alerts.slice(0, 10).forEach(al => {
            const isCritica = al.priority === 'CRÍTICA';
            const bgClass = isCritica ? 'bg-rose-500/10 border-rose-500/30' : 'bg-amber-500/10 border-amber-500/30';
            const badgeClass = isCritica ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-900';
            const textClass = isCritica ? 'text-rose-500' : 'text-amber-500';

            const itemEl = document.createElement('div');
            itemEl.className = `p-3.5 rounded-xl border ${bgClass} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-all hover:scale-[1.01]`;
            itemEl.innerHTML = `
                <div class="flex items-start gap-3">
                    <span class="px-2 py-0.5 rounded font-mono font-bold text-[10px] ${badgeClass}">${al.priority}</span>
                    <div>
                        <div class="font-bold ${textClass}">${al.frente} • Turno ${al.turno}</div>
                        <div class="text-[var(--text-secondary)] mt-0.5">${al.motivo}</div>
                        <div class="text-[10px] text-[var(--text-muted)] font-mono mt-1">ID: ${al.id} • ${al.dataHora} • Resp: ${al.responsavel}</div>
                    </div>
                </div>
                <button class="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-emerald-500 text-xs font-semibold whitespace-nowrap self-end sm:self-center">
                    Inspecionar ➔
                </button>
            `;
            itemEl.querySelector('button').addEventListener('click', () => {
                openRecordModal(al.record);
            });
            container.appendChild(itemEl);
        });

        if (alerts.length > 10) {
            const moreEl = document.createElement('div');
            moreEl.className = 'text-center text-xs text-[var(--text-muted)] pt-2 font-mono';
            moreEl.innerText = `+ ${alerts.length - 10} outras ocorrências no período (use a tabela para ver todas)`;
            container.appendChild(moreEl);
        }
    }

    /**
     * Análise Comparativa por Frente (Seção 11)
     */
    function renderFrenteAnalysis(frentes) {
        const tbody = document.getElementById('frenteTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (frentes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-xs text-[var(--text-muted)]">Nenhuma frente localizada.</td></tr>`;
            return;
        }

        frentes.forEach(f => {
            const statusClass = f.statusGeral === 'CRÍTICO' ? 'bg-rose-500/15 text-rose-500 border-rose-500/30' :
                               (f.statusGeral === 'ATENÇÃO' ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' :
                               'bg-emerald-500/15 text-emerald-500 border-emerald-500/30');

            const tr = document.createElement('tr');
            tr.className = 'border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] cursor-pointer text-xs';
            tr.innerHTML = `
                <td class="p-3 font-bold text-[var(--text-primary)]">${f.frente}</td>
                <td class="p-3 font-mono text-center">${f.total}</td>
                <td class="p-3 font-mono text-center font-bold text-rose-500">${f.naoConformes} (${f.percNaoConforme}%)</td>
                <td class="p-3 font-mono text-center font-bold text-amber-500">${f.totalItensQuebrados}</td>
                <td class="p-3 font-mono text-center font-bold text-emerald-500">${f.conformes} (${f.percConforme}%)</td>
                <td class="p-3 font-mono text-center text-[var(--text-muted)]">${f.ultimaDataBR}</td>
                <td class="p-3 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusClass}">${f.statusGeral}</span>
                </td>
            `;
            tr.addEventListener('click', () => {
                document.getElementById('filterFrente').value = f.frente;
                state.activeFilters.frente = f.frente;
                applyFilters();
            });
            tbody.appendChild(tr);
        });
    }

    /**
     * Matriz Visual de Conformidade: Frentes x Itens de Checklist (Seção 12)
     */
    function renderComplianceMatrix(data) {
        const thead = document.getElementById('matrixThead');
        const tbody = document.getElementById('matrixTbody');
        if (!thead || !tbody) return;

        // Cabeçalho da Matriz
        thead.innerHTML = '';
        const trHead = document.createElement('tr');
        trHead.className = 'border-b border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] font-semibold';
        trHead.innerHTML = `<th class="p-2.5 text-left sticky left-0 bg-[var(--bg-card)] z-10">Frente Agrícola</th>`;

        data.itemKeys.forEach(k => {
            const rule = data.rules[k];
            trHead.innerHTML += `<th class="p-2.5 text-center whitespace-nowrap font-medium" title="${rule.label}">${rule.shortLabel}</th>`;
        });
        thead.appendChild(trHead);

        // Corpo da Matriz
        tbody.innerHTML = '';
        data.frentes.forEach(frente => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] text-xs';
            let html = `<td class="p-2.5 font-bold text-[var(--text-primary)] sticky left-0 bg-[var(--bg-card)] z-10 whitespace-nowrap">${frente}</td>`;

            data.itemKeys.forEach(k => {
                const cell = data.matrix[frente][k];
                let icon = '✓';
                let cellClass = 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
                let tooltip = `Conforme (${cell.conformes}/${cell.total})`;

                if (cell.naoConformes > 0) {
                    icon = '✕';
                    cellClass = 'bg-rose-500/20 text-rose-500 border-rose-500/40 font-bold';
                    tooltip = `${cell.naoConformes} Não Conformidade(s) detectada(s)`;
                } else if (cell.ocorrencias > 0) {
                    icon = '⚠';
                    cellClass = 'bg-amber-500/20 text-amber-500 border-amber-500/40 font-bold';
                    tooltip = `${cell.ocorrencias} Ocorrência(s) de item quebrado`;
                } else if (cell.pendencias > 0) {
                    icon = 'ℹ';
                    cellClass = 'bg-sky-500/20 text-sky-500 border-sky-500/40';
                    tooltip = `${cell.pendencias} Ausência procedimental`;
                }

                html += `
                    <td class="p-2 text-center">
                        <div class="matrix-cell inline-flex items-center justify-center w-7 h-7 rounded-lg border text-xs ${cellClass}"
                             title="${tooltip}" data-frente="${frente}" data-item="${k}">
                            ${icon}
                        </div>
                    </td>
                `;
            });

            tr.innerHTML = html;
            tbody.appendChild(tr);
        });

        // Click nas células da matriz
        tbody.querySelectorAll('.matrix-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const frente = cell.getAttribute('data-frente');
                const item = cell.getAttribute('data-item');
                document.getElementById('filterFrente').value = frente;
                document.getElementById('filterItem').value = item;
                state.activeFilters.frente = frente;
                state.activeFilters.itemNaoConforme = item;
                applyFilters();
            });
        });
    }

    /**
     * Tabela Completa de Inspeções (Seção 13)
     */
    function renderTable() {
        const tbody = document.getElementById('tableBody');
        const paginationInfo = document.getElementById('paginationInfo');
        const pageControls = document.getElementById('pageControls');
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

        pageRecords.forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] cursor-pointer text-xs';
            
            const badgeClass = r.compliance.classificacao === 'NÃO CONFORME' ? 'bg-rose-500/20 text-rose-500 border-rose-500/40' :
                              (r.compliance.classificacao === 'ATENÇÃO' ? 'bg-amber-500/20 text-amber-500 border-amber-500/40' :
                              'bg-emerald-500/20 text-emerald-500 border-emerald-500/40');

            tr.innerHTML = `
                <td class="p-3 font-mono font-bold text-emerald-500">${r.id}</td>
                <td class="p-3 font-mono whitespace-nowrap">${r.dataHoraBR}</td>
                <td class="p-3 font-semibold">${r.frente}</td>
                <td class="p-3 font-mono text-center">${r.turno}</td>
                <td class="p-3">${r.responsavel}</td>
                <td class="p-3 font-mono text-[var(--text-muted)]">${r.local}</td>
                <td class="p-3 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}">
                        ${r.compliance.badgeIcon} ${r.compliance.classificacao}
                    </span>
                </td>
                <td class="p-3 font-mono text-center font-bold">${r.compliance.indiceConformidadePerc}%</td>
                <td class="p-3 max-w-[140px] truncate text-[var(--text-secondary)]" title="${r.obs || 'Sem observação'}">
                    ${r.obs ? '📝 ' + r.obs : '<span class="text-[var(--text-muted)]">-</span>'}
                </td>
                <td class="p-3 text-center">
                    <button class="px-2.5 py-1 rounded bg-[var(--bg-subtle)] hover:bg-emerald-600 hover:text-white border border-[var(--border-color)] text-[11px] font-semibold transition-colors">
                        Raio-X
                    </button>
                </td>
            `;

            tr.addEventListener('click', () => {
                openRecordModal(r);
            });
            tbody.appendChild(tr);
        });

        // Controles de Paginação
        if (paginationInfo) {
            paginationInfo.innerText = `Mostrando ${startIdx + 1} a ${Math.min(total, startIdx + pageSize)} de ${total.toLocaleString()} inspeções`;
        }

        renderPaginationControls();
    }

    function renderPaginationControls() {
        const controls = document.getElementById('pageControls');
        if (!controls) return;

        const { page, totalPages } = state.pagination;
        controls.innerHTML = `
            <button id="btnPrevPage" ${page <= 1 ? 'disabled' : ''} class="px-3 py-1 rounded-lg border text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                ◄ Anterior
            </button>
            <span class="px-3 py-1 font-mono text-xs">Página ${page} de ${totalPages}</span>
            <button id="btnNextPage" ${page >= totalPages ? 'disabled' : ''} class="px-3 py-1 rounded-lg border text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                Próxima ►
            </button>
        `;

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

    function setupTableControls() {
        const pageSizeSelect = document.getElementById('pageSizeSelect');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                state.pagination.pageSize = parseInt(e.target.value, 10);
                state.pagination.page = 1;
                renderTable();
            });
        }
    }

    /**
     * Gráficos Interativos (Chart.js)
     */
    function initCharts() {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

        // 1. Gráfico de Rosca: Distribuição de Conformidade
        const ctxDonut = document.getElementById('chartDonut');
        if (ctxDonut) {
            state.charts.donut = new Chart(ctxDonut, {
                type: 'doughnut',
                data: {
                    labels: ['Conforme', 'Atenção (Ocorrência)', 'Não Conforme'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } } }
                    },
                    cutout: '70%'
                }
            });
        }

        // 2. Gráfico de Barras: Itens com Mais Ocorrências
        const ctxItems = document.getElementById('chartItems');
        if (ctxItems) {
            state.charts.items = new Chart(ctxItems, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Ocorrências Registradas',
                        data: [],
                        backgroundColor: '#f59e0b',
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
                        y: { ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }, grid: { display: false } }
                    }
                }
            });
        }

        // 3. Gráfico de Turnos
        const ctxTurnos = document.getElementById('chartTurnos');
        if (ctxTurnos) {
            state.charts.turnos = new Chart(ctxTurnos, {
                type: 'bar',
                data: {
                    labels: ['Turno A', 'Turno B', 'Turno C'],
                    datasets: [{
                        label: 'Inspeções',
                        data: [0, 0, 0],
                        backgroundColor: '#0284c7',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textColor }, grid: { display: false } },
                        y: { ticks: { color: textColor }, grid: { color: gridColor } }
                    }
                }
            });
        }
    }

    function renderCharts(m, frentes) {
        // 1. Atualiza Donut de Conformidade
        if (state.charts.donut) {
            state.charts.donut.data.datasets[0].data = [m.inspecoesConformes, m.inspecoesAtencao, m.inspecoesNaoConformes];
            state.charts.donut.update();
        }

        // Percentuais com fallback defensivo seguro
        const tot = m.totalInspecoes || (m.inspecoesConformes + m.inspecoesAtencao + m.inspecoesNaoConformes) || 1;
        const pConf = (m.percConforme !== undefined && !isNaN(m.percConforme)) ? m.percConforme : Number(((m.inspecoesConformes / tot) * 100).toFixed(1));
        const pAtenc = (m.percAtencao !== undefined && !isNaN(m.percAtencao)) ? m.percAtencao : Number(((m.inspecoesAtencao / tot) * 100).toFixed(1));
        const pNaoConf = (m.percNaoConforme !== undefined && !isNaN(m.percNaoConforme)) ? m.percNaoConforme : Number(((m.inspecoesNaoConformes / tot) * 100).toFixed(1));

        // Overlay Central do Donut
        const centerPercEl = document.getElementById('donutCenterPerc');
        if (centerPercEl) centerPercEl.innerText = `${pConf}%`;

        // Detalhamento Numérico Explicito e Barras de Progresso (SEMPRE COM DADOS, NUNCA EM BRANCO)
        const valConf = document.getElementById('donutValConforme');
        const barConf = document.getElementById('donutBarConforme');
        if (valConf) valConf.innerText = `${m.inspecoesConformes} (${pConf}%)`;
        if (barConf) barConf.style.width = `${pConf}%`;

        const valAtencao = document.getElementById('donutValAtencao');
        const barAtencao = document.getElementById('donutBarAtencao');
        if (valAtencao) valAtencao.innerText = `${m.inspecoesAtencao} (${pAtenc}%)`;
        if (barAtencao) barAtencao.style.width = `${pAtenc}%`;

        const valNaoConf = document.getElementById('donutValNaoConforme');
        const barNaoConf = document.getElementById('donutBarNaoConforme');
        if (valNaoConf) valNaoConf.innerText = `${m.inspecoesNaoConformes} (${pNaoConf}%)`;
        if (barNaoConf) barNaoConf.style.width = `${pNaoConf}%`;

        const valTotal = document.getElementById('donutValTotal');
        if (valTotal) valTotal.innerText = `${m.totalInspecoes} inspeções avaliadas`;

        const scopeBadge = document.getElementById('donutScopeBadge');
        if (scopeBadge) {
            scopeBadge.innerText = state.periodScope === 'all' ? '% da safra' : (state.periodScope === 'latest' ? 'Última data' : (state.activeFilters.date || 'Filtro'));
        }

        // 2. Atualiza Itens com Ocorrências
        const counts = {};
        state.filteredRecords.forEach(r => {
            if (r.answers.itemQuebrado === 'SIM') counts['Item Quebrado / Falta'] = (counts['Item Quebrado / Falta'] || 0) + 1;
            if (r.answers.aguaHigienizacao === 'NÃO') counts['Sem Água Higienização'] = (counts['Sem Água Higienização'] || 0) + 1;
            if (r.answers.fitaIsolamento === 'NÃO') counts['Sem Fita Isolamento'] = (counts['Sem Fita Isolamento'] || 0) + 1;
            if (r.answers.coneSinalizacao === 'NÃO') counts['Sem Cone Sinalização'] = (counts['Sem Cone Sinalização'] || 0) + 1;
            if (r.answers.extintor === 'NÃO') counts['Extintor Pendente'] = (counts['Extintor Pendente'] || 0) + 1;
        });

        const sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        if (state.charts.items) {
            state.charts.items.data.labels = sortedKeys;
            state.charts.items.data.datasets[0].data = sortedKeys.map(k => counts[k]);
            state.charts.items.update();
        }

        // Badges com dados explícitos de ocorrências
        const itemsContainer = document.getElementById('itemsBreakdownContainer');
        if (itemsContainer) {
            itemsContainer.innerHTML = '';
            if (sortedKeys.length === 0) {
                itemsContainer.innerHTML = '<span class="text-[11px] text-emerald-500 font-semibold col-span-3">Nenhuma ocorrência registrada no período!</span>';
            } else {
                sortedKeys.forEach(k => {
                    const count = counts[k];
                    const perc = m.totalInspecoes > 0 ? ((count / m.totalInspecoes) * 100).toFixed(1) : 0;
                    const el = document.createElement('div');
                    el.className = 'p-2 rounded-xl border bg-slate-50 dark:bg-slate-800/50 flex flex-col justify-between';
                    el.style.borderColor = 'var(--border-color)';
                    el.innerHTML = `
                        <span class="text-[10px] text-[var(--text-secondary)] font-medium line-clamp-1" title="${k}">${k}</span>
                        <div class="flex items-baseline justify-between mt-1">
                            <span class="text-xs font-mono font-bold text-amber-500">${count}</span>
                            <span class="text-[9px] font-mono text-[var(--text-muted)]">${perc}%</span>
                        </div>
                    `;
                    itemsContainer.appendChild(el);
                });
            }
        }

        // 3. Atualiza Turnos
        let tA = 0, tB = 0, tC = 0, tOutros = 0;
        state.filteredRecords.forEach(r => {
            if (r.turno === 'A') tA++;
            else if (r.turno === 'B') tB++;
            else if (r.turno === 'C') tC++;
            else tOutros++;
        });

        if (state.charts.turnos) {
            state.charts.turnos.data.datasets[0].data = [tA, tB, tC];
            state.charts.turnos.update();
        }

        // Badges com dados explícitos de turnos
        const turnosContainer = document.getElementById('turnosBreakdownContainer');
        if (turnosContainer) {
            const percA = m.totalInspecoes > 0 ? ((tA / m.totalInspecoes) * 100).toFixed(1) : 0;
            const percB = m.totalInspecoes > 0 ? ((tB / m.totalInspecoes) * 100).toFixed(1) : 0;
            const percC = m.totalInspecoes > 0 ? ((tC / m.totalInspecoes) * 100).toFixed(1) : 0;
            const percOutros = m.totalInspecoes > 0 ? ((tOutros / m.totalInspecoes) * 100).toFixed(1) : 0;

            turnosContainer.innerHTML = `
                <div class="p-2 rounded-xl border bg-slate-50 dark:bg-slate-800/50 text-center" style="border-color: var(--border-color);">
                    <div class="text-[10px] text-[var(--text-secondary)] font-bold">Turno A</div>
                    <div class="text-xs font-mono font-bold text-sky-500">${tA}</div>
                    <div class="text-[9px] font-mono text-[var(--text-muted)]">${percA}%</div>
                </div>
                <div class="p-2 rounded-xl border bg-slate-50 dark:bg-slate-800/50 text-center" style="border-color: var(--border-color);">
                    <div class="text-[10px] text-[var(--text-secondary)] font-bold">Turno B</div>
                    <div class="text-xs font-mono font-bold text-sky-500">${tB}</div>
                    <div class="text-[9px] font-mono text-[var(--text-muted)]">${percB}%</div>
                </div>
                <div class="p-2 rounded-xl border bg-slate-50 dark:bg-slate-800/50 text-center" style="border-color: var(--border-color);">
                    <div class="text-[10px] text-[var(--text-secondary)] font-bold">Turno C</div>
                    <div class="text-xs font-mono font-bold text-sky-500">${tC}</div>
                    <div class="text-[9px] font-mono text-[var(--text-muted)]">${percC}%</div>
                </div>
                <div class="p-2 rounded-xl border bg-slate-50 dark:bg-slate-800/50 text-center" style="border-color: var(--border-color);">
                    <div class="text-[10px] text-[var(--text-secondary)] font-bold">Outros</div>
                    <div class="text-xs font-mono font-bold text-slate-400">${tOutros}</div>
                    <div class="text-[9px] font-mono text-[var(--text-muted)]">${percOutros}%</div>
                </div>
            `;
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
     * Mapa Geográfico Interativo (Leaflet)
     */
    function initMap() {
        const mapContainer = document.getElementById('mapContainer');
        if (!mapContainer || typeof L === 'undefined') return;

        // Centro padrão: Região da Usina Pitangueiras (SP)
        state.map = L.map('mapContainer').setView([-20.95, -48.55], 10);

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
        validCoords.forEach(r => {
            const color = r.compliance.classificacao === 'NÃO CONFORME' ? '#ef4444' :
                         (r.compliance.classificacao === 'ATENÇÃO' ? '#f59e0b' : '#10b981');

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
                    <div class="font-bold text-slate-900">${r.frente} • Turno ${r.turno}</div>
                    <div class="text-slate-600 mt-0.5">ID: ${r.id} • ${r.dataHoraBR}</div>
                    <div class="text-slate-600">Local: Fazenda/Talhão ${r.local}</div>
                    <div class="mt-1 font-semibold" style="color: ${color};">Resultado: ${r.compliance.classificacao}</div>
                    <button onclick="window.dashboardOpenModalById('${r.id}')" class="mt-2 w-full py-1 bg-slate-900 text-white rounded text-[11px] font-semibold">
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
     * Modal de Detalhamento / Raio-X Individual (Seção 14)
     */
    function setupModal() {
        const modal = document.getElementById('recordModal');
        const btnClose = document.getElementById('modalCloseBtn');
        if (btnClose) {
            btnClose.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        }
    }

    function openRecordModal(r) {
        const modal = document.getElementById('recordModal');
        if (!modal) return;

        document.getElementById('modalRecordId').innerText = r.id;
        document.getElementById('modalRecordDate').innerText = r.dataHoraBR;
        document.getElementById('modalRecordFrente').innerText = r.frente;
        document.getElementById('modalRecordTurno').innerText = r.turno;
        document.getElementById('modalRecordResp').innerText = r.responsavel;
        document.getElementById('modalRecordUser').innerText = r.usuario;
        document.getElementById('modalRecordLocal').innerText = r.local;

        // Duração da Inspeção
        const duracaoEl = document.getElementById('modalRecordDuracao');
        if (duracaoEl) {
            if (r.duracaoInconsistente) {
                duracaoEl.innerHTML = `<span class="text-rose-500 font-bold">Inconsistente (${r.duracaoMinutos} min)</span>`;
            } else if (r.duracaoMinutos !== null) {
                duracaoEl.innerText = `${r.duracaoMinutos} minutos`;
            } else {
                duracaoEl.innerText = 'N/D';
            }
        }

        // Status de Conformidade
        const badgeEl = document.getElementById('modalRecordStatus');
        if (badgeEl) {
            badgeEl.innerText = `${r.compliance.badgeIcon} ${r.compliance.classificacao}`;
            badgeEl.className = `px-3 py-1 rounded-full text-xs font-bold ${
                r.compliance.classificacao === 'NÃO CONFORME' ? 'bg-rose-500/20 text-rose-500 border border-rose-500/40' :
                (r.compliance.classificacao === 'ATENÇÃO' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40' :
                'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40')
            }`;
        }

        // Auditoria do Score
        const scoreAuditEl = document.getElementById('modalScoreAudit');
        if (scoreAuditEl) {
            scoreAuditEl.innerHTML = `
                <div class="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] text-xs">
                    <div class="flex justify-between items-center">
                        <span class="text-[var(--text-secondary)]">Score Original do Mapfy:</span>
                        <span class="font-mono font-bold">${r.scoreOriginal} (${r.scoreDescOriginal})</span>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-[var(--text-secondary)]">Conformidade Real Calculada:</span>
                        <span class="font-mono font-bold text-emerald-500">${r.compliance.indiceConformidadePerc}% de itens conformes</span>
                    </div>
                    ${r.compliance.scoreIncompativel ? '<div class="text-[10px] text-amber-500 mt-1.5 font-medium">⚠ Inconsistência detectada: Score original registrado como Baixo (0,00) em inspeção operacionalmente conforme.</div>' : ''}
                </div>
            `;
        }

        // Checklist dos 11 Itens
        const checklistEl = document.getElementById('modalChecklistItems');
        if (checklistEl) {
            checklistEl.innerHTML = '';
            for (const [k, rule] of Object.entries(ComplianceEngine.COMPLIANCE_RULES)) {
                const ans = r.answers[k];
                let icon = '✓';
                let iconColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
                let isProblem = false;

                if (rule.type === 'CRITICO' && ans !== rule.expected) {
                    icon = '✕';
                    iconColor = 'text-rose-500 bg-rose-500/10 border-rose-500/30 font-bold';
                    isProblem = true;
                } else if (rule.type === 'OCORRENCIA' && ans === 'SIM') {
                    icon = '⚠';
                    iconColor = 'text-amber-500 bg-amber-500/10 border-amber-500/30 font-bold';
                    isProblem = true;
                } else if (rule.type === 'PROCEDIMENTAL' && ans === 'NÃO') {
                    icon = 'ℹ';
                    iconColor = 'text-sky-500 bg-sky-500/10 border-sky-500/30';
                }

                const itemRow = document.createElement('div');
                itemRow.className = `p-2.5 rounded-lg border flex items-center justify-between text-xs ${isProblem ? 'border-rose-500/40 bg-rose-500/5' : 'border-[var(--border-color)] bg-[var(--bg-subtle)]'}`;
                itemRow.innerHTML = `
                    <div class="flex items-center gap-2.5">
                        <span class="w-6 h-6 rounded-md flex items-center justify-center border text-[11px] ${iconColor}">${icon}</span>
                        <div>
                            <div class="font-medium text-[var(--text-primary)]">${rule.label}</div>
                            <div class="text-[10px] text-[var(--text-muted)]">${rule.category}</div>
                        </div>
                    </div>
                    <div class="font-mono font-bold text-right">
                        <span>${ans}</span>
                    </div>
                `;
                checklistEl.appendChild(itemRow);
            }
        }

        // Observação textual
        const obsEl = document.getElementById('modalRecordObs');
        if (obsEl) {
            obsEl.innerText = r.obs ? r.obs : 'Nenhuma observação registrada para esta inspeção.';
        }

        // Link de Coordenadas
        const mapLinkEl = document.getElementById('modalRecordMapLink');
        if (mapLinkEl) {
            if (r.hasValidCoords) {
                mapLinkEl.href = `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`;
                mapLinkEl.classList.remove('hidden');
                mapLinkEl.innerText = `Abrir no Google Maps (${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}) ↗`;
            } else {
                mapLinkEl.classList.add('hidden');
            }
        }

        modal.classList.remove('hidden');
    }

    // Expor função para os popups do Leaflet
    window.dashboardOpenModalById = function (id) {
        const r = state.allRecords.find(x => x.id === id);
        if (r) openRecordModal(r);
    };

    /**
     * Exportação CSV dos Registros Filtrados (Seção 20)
     */
    function exportFilteredCSV() {
        if (state.filteredRecords.length === 0) {
            showToast('Nenhum registro para exportar.');
            return;
        }

        const headers = [
            'ID', 'Data', 'Frente', 'Turno', 'Responsável', 'Local', 'Classificação',
            'Índice Conformidade %', 'Água Potável', 'Água Higienização', 'Papel Higiênico',
            'Papel Toalha', 'Pia e Descarga', 'Limpeza', 'Item Quebrado', 'Fita Isolamento',
            'Cone Sinalização', 'Bancos Fixos', 'Extintor', 'OBS', 'Latitude', 'Longitude'
        ];

        const rows = state.filteredRecords.map(r => [
            r.id,
            r.dataHoraBR,
            `"${r.frente}"`,
            r.turno,
            `"${r.responsavel}"`,
            `"${r.local}"`,
            r.compliance.classificacao,
            r.compliance.indiceConformidadePerc,
            r.answers.aguaPotavel,
            r.answers.aguaHigienizacao,
            r.answers.papelHigienico,
            r.answers.papelToalha,
            r.answers.piaDescarga,
            r.answers.limpeza,
            r.answers.itemQuebrado,
            r.answers.fitaIsolamento,
            r.answers.coneSinalizacao,
            r.answers.bancosFixos,
            r.answers.extintor,
            `"${(r.obs || '').replace(/"/g, '""')}"`,
            r.lat !== null ? r.lat : '',
            r.lng !== null ? r.lng : ''
        ]);

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Inspecoes_Vivencia_Pitangueiras_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Exibe toast notification informativo
     */
    function showToast(msg) {
        let toast = document.getElementById('appToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'appToast';
            toast.className = 'fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs border border-slate-700 shadow-2xl transition-opacity duration-300';
            document.body.appendChild(toast);
        }
        toast.innerText = msg;
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
        }, 4000);
    }

})();
