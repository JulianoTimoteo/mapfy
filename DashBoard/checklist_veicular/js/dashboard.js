/**
 * dashboard.js
 * ============
 * Controlador Reativo da Central de Inteligência e Gestão de Frota
 * Usina Pitangueiras • Safra 2026
 */

(function () {
    'use strict';

    // Plugin Universal de Rótulos de Dados com Totalizador no Centro do Donut
    const universalDataLabelsPlugin = {
        id: 'universalDataLabelsChecklist',
        afterDatasetsDraw(chart) {
            const ctx = chart.ctx;
            const chartType = chart.config.type;
            if (chartType !== 'bar' && chartType !== 'doughnut' && chartType !== 'pie') return;

            const isDark = document.documentElement.classList.contains('dark');
            const defaultTextColor = isDark ? '#F1F5F9' : '#1E293B';
            const chartArea = chart.chartArea || { top: 0, bottom: chart.height, left: 0, right: chart.width };

            chart.data.datasets.forEach((dataset, datasetIdx) => {
                const meta = chart.getDatasetMeta(datasetIdx);
                if (meta.hidden) return;

                meta.data.forEach((element, index) => {
                    const val = dataset.data ? dataset.data[index] : null;
                    if (val === undefined || val === null || val === 0 || val === '0' || val === '' || isNaN(val)) return;

                    ctx.save();
                    ctx.font = 'bold 11px Inter, sans-serif';

                    if (chartType === 'doughnut' || chartType === 'pie') {
                        const pos = element.tooltipPosition ? element.tooltipPosition() : null;
                        if (pos) {
                            ctx.fillStyle = '#FFFFFF';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                            ctx.shadowBlur = 4;
                            ctx.fillText(String(val), pos.x, pos.y);
                        }
                    } else if (chartType === 'bar' && chart.options && chart.options.indexAxis === 'y') {
                        ctx.fillStyle = defaultTextColor;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(String(val), element.x + 6, element.y);
                    } else if (chartType === 'bar') {
                        ctx.fillStyle = defaultTextColor;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(String(val), element.x, element.y - 3);
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

    if (typeof Chart !== 'undefined' && Chart.register) {
        Chart.register(universalDataLabelsPlugin);
    }

    function getNormalizedRecords() {
        const raw = typeof CHECKLIST_DATA !== 'undefined' ? CHECKLIST_DATA : (window.CHECKLIST_DATA || []);
        if (typeof ChecklistEngine !== 'undefined' && typeof ChecklistEngine.normalizeRecord === 'function') {
            return raw.map(ChecklistEngine.normalizeRecord);
        }
        return raw;
    }

    // Estado da Aplicação
    const state = {
        allRecords: getNormalizedRecords(),
        filteredRecords: [],
        filters: {
            dataInicio: '',
            dataFim: '',
            frota: 'TODAS',
            gestor: 'TODOS',
            condutor: 'TODOS',
            criticidade: 'TODAS',
            componente: 'TODOS',
            videotelemetria: 'TODAS',
            abrirOs: 'TODAS',
            somenteComAvaria: false,
            somenteComOS: false,
            somenteReincidentes: false,
            search: ''
        },
        activeTab: 'visao_executiva',
        selectedVeiculoProntuario: null,
        evolutionRange: 'ALL',
        pagination: {
            page: 1,
            pageSize: 15
        },
        charts: {},
        map: null,
        markersLayer: null
    };
    window.dashboardState = state;
    window.state = state;

    function _bootstrapApp() {
        initTheme();
        initState();
        initDropdowns();
        initTabs();
        initEvolutionFilter();
        initFilterListeners();
        initCharts();
        initMap();
        applyFilters();
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

        const btn = document.getElementById('themeToggleBtn') || document.getElementById('themeToggle');
        if (btn) {
            btn.addEventListener('click', () => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('mapfy_theme', isDark ? 'dark' : 'light');
                const icon = document.getElementById('themeIcon');
                if (icon) icon.innerText = isDark ? '🌙' : '☀️';
                updateChartsTheme();
            });
        }
    }

    // 2. Inicialização do Estado
    function initState() {
        if (!state.allRecords || state.allRecords.length === 0 || !state.allRecords[0]?.frota_codigo) {
            state.allRecords = getNormalizedRecords();
        }
        state.filteredRecords = [...state.allRecords];
        // Selecionar primeiro veículo com avarias para prontuário padrão
        const reinc = ChecklistEngine.buildReincidenciaIntelligence(state.allRecords);
        if (reinc.veiculos.length > 0) {
            state.selectedVeiculoProntuario = reinc.veiculos[0].codigo;
        } else {
            state.selectedVeiculoProntuario = state.allRecords[0]?.frota_codigo || null;
        }
    }

    // 3. Dropdowns Dinâmicos
    function initDropdowns() {
        populateSelect('filterFrota', getUniqueValues('frota_codigo', true), 'Todas as Frotas');
        populateSelect('filterGestor', getUniqueValues('gestor', false), 'Todos os Gestores');
        populateSelect('filterCondutor', getUniqueValues('condutor', false), 'Todos os Condutores');
        
        // Componentes únicos
        const compSet = new Set();
        state.allRecords.forEach(r => {
            if (Array.isArray(r.componentes)) {
                r.componentes.forEach(c => compSet.add(c.nome));
            }
        });
        populateSelect('filterComponente', [...compSet].sort(), 'Todos os Componentes');

        // Seletor do Prontuário Digital
        const prontuarioSelect = document.getElementById('selectProntuarioFrota');
        if (prontuarioSelect) {
            prontuarioSelect.innerHTML = '';
            const frotasDisponiveis = [...new Set(state.allRecords.map(r => r.frota_codigo).filter(f => f && f !== "NÃO_IDENTIFICADA"))].sort();
            frotasDisponiveis.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f;
                const rec = state.allRecords.find(r => r.frota_codigo === f);
                opt.innerText = `Frota ${f} • ${rec?.frota_modelo || ''} (${rec?.frota_placa || 'Sem placa'})`;
                if (f === state.selectedVeiculoProntuario) opt.selected = true;
                prontuarioSelect.appendChild(opt);
            });

            prontuarioSelect.addEventListener('change', (e) => {
                state.selectedVeiculoProntuario = e.target.value;
                renderProntuarioSection();
            });
        }
    }

    function getUniqueValues(field, isFrota = false) {
        const set = new Set();
        state.allRecords.forEach(r => {
            const v = r[field];
            if (v && v !== "NÃO INFORMADO" && v !== "NÃO_IDENTIFICADA") {
                set.add(v);
            }
        });
        return [...set].sort();
    }

    function populateSelect(id, values, defaultLabel) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = `<option value="TODAS">${defaultLabel}</option>`;
        values.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.innerText = v;
            el.appendChild(opt);
        });
    }

    // 4. Alternância de Telas / Abas
    function initTabs() {
        const tabButtons = document.querySelectorAll('.nav-tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                if (!targetTab) return;

                state.activeTab = targetTab;
                tabButtons.forEach(b => b.classList.remove('active', 'text-emerald-500', 'border-b-2', 'border-emerald-500'));
                btn.classList.add('active', 'text-emerald-500', 'border-b-2', 'border-emerald-500');

                // Esconder todas as seções e exibir a ativa
                document.querySelectorAll('.tab-content-section').forEach(sec => {
                    sec.classList.add('hidden');
                });
                const activeSec = document.getElementById(`tabSection_${targetTab}`);
                if (activeSec) activeSec.classList.remove('hidden');

                // Ajustar mapa se aba de mapa for ativada
                if (targetTab === 'mapa' && state.map) {
                    setTimeout(() => state.map.invalidateSize(), 200);
                }
            });
        });
    }

    // 5. Filtros Rápidos de Evolução (Todos, 15D, 7D)
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
                updateEvolutionChart();
            });
        });
    }

    // 6. Listeners de Filtros Globais
    function initFilterListeners() {
        const bindFilter = (id, key) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', (e) => {
                state.filters[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                state.pagination.page = 1;
                applyFilters();
            });
        };

        bindFilter('filterDataInicio', 'dataInicio');
        bindFilter('filterDataFim', 'dataFim');
        bindFilter('filterFrota', 'frota');
        bindFilter('filterGestor', 'gestor');
        bindFilter('filterCondutor', 'condutor');
        bindFilter('filterCriticidade', 'criticidade');
        bindFilter('filterComponente', 'componente');
        bindFilter('filterVideo', 'videotelemetria');
        bindFilter('filterAbrirOs', 'abrirOs');
        bindFilter('chkSomenteComAvaria', 'somenteComAvaria');
        bindFilter('chkSomenteComOS', 'somenteComOS');
        bindFilter('chkSomenteReincidentes', 'somenteReincidentes');

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state.filters.search = e.target.value.toLowerCase().trim();
                state.pagination.page = 1;
                applyFilters();
            });
        }

        const btnReset = document.getElementById('btnResetFilters');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                state.filters = {
                    dataInicio: '',
                    dataFim: '',
                    frota: 'TODAS',
                    gestor: 'TODOS',
                    condutor: 'TODOS',
                    criticidade: 'TODAS',
                    componente: 'TODOS',
                    videotelemetria: 'TODAS',
                    abrirOs: 'TODAS',
                    somenteComAvaria: false,
                    somenteComOS: false,
                    somenteReincidentes: false,
                    search: ''
                };
                document.querySelectorAll('#filterDataInicio, #filterDataFim, #searchInput').forEach(el => el.value = '');
                document.querySelectorAll('#filterFrota, #filterGestor, #filterCondutor, #filterCriticidade, #filterComponente, #filterVideo, #filterAbrirOs').forEach(el => el.value = 'TODAS');
                document.querySelectorAll('#chkSomenteComAvaria, #chkSomenteComOS, #chkSomenteReincidentes').forEach(el => el.checked = false);
                state.pagination.page = 1;
                applyFilters();
            });
        }

        // Exportações
        document.getElementById('btnExportExcel')?.addEventListener('click', exportToExcel);
        document.getElementById('btnExportCSV')?.addEventListener('click', exportToCSV);
    }

    // 7. Aplicação de Filtros e Renderização Central
    function applyFilters() {
        const f = state.filters;

        // Pré-calcular reincidentes se filtro ativo
        let reincCodigos = new Set();
        if (f.somenteReincidentes) {
            const reincData = ChecklistEngine.buildReincidenciaIntelligence(state.allRecords);
            reincCodigos = new Set(reincData.veiculos.map(v => v.codigo));
        }

        state.filteredRecords = state.allRecords.filter(r => {
            if (f.dataInicio && r.data_dia) {
                if (r.data_dia < f.dataInicio) return false;
            }
            if (f.dataFim && r.data_dia) {
                if (r.data_dia > f.dataFim) return false;
            }
            if (f.frota !== 'TODAS' && r.frota_codigo !== f.frota) return false;
            if (f.gestor !== 'TODOS' && f.gestor !== 'TODAS' && r.gestor !== f.gestor) return false;
            if (f.condutor !== 'TODOS' && f.condutor !== 'TODAS' && r.condutor !== f.condutor) return false;
            if (f.criticidade && f.criticidade !== 'TODAS') {
                if (!r.criticidade || !r.criticidade.toLowerCase().startsWith(f.criticidade.toLowerCase())) return false;
            }
            if (f.videotelemetria && f.videotelemetria !== 'TODAS') {
                const wantSim = f.videotelemetria.toUpperCase().includes('SIM');
                const isSim = (r.videotelemetria || '').toUpperCase().includes('SIM');
                if (wantSim !== isSim) return false;
            }
            if (f.abrirOs && f.abrirOs !== 'TODAS') {
                const wantSim = f.abrirOs.toUpperCase().includes('SIM');
                const isSim = (r.abrir_os || '').toUpperCase().includes('SIM');
                if (wantSim !== isSim) return false;
            }

            if (f.componente !== 'TODOS' && f.componente !== 'TODAS') {
                const hasComp = (r.componentes || []).some(c => c.nome === f.componente);
                if (!hasComp) return false;
            }

            if (f.somenteComAvaria && !r.tem_avaria) return false;
            if (f.somenteComOS && !r.os_numero) return false;
            if (f.somenteReincidentes && !reincCodigos.has(r.frota_codigo)) return false;

            if (f.search) {
                const s = f.search;
                const matchId = (r.id || '').toLowerCase().includes(s);
                const matchFrota = (r.frota_codigo || '').toLowerCase().includes(s) || (r.frota_modelo || '').toLowerCase().includes(s) || (r.frota_placa || '').toLowerCase().includes(s);
                const matchGestor = (r.gestor || '').toLowerCase().includes(s);
                const matchCondutor = (r.condutor || '').toLowerCase().includes(s);
                const matchObs = (r.observacoes || '').toLowerCase().includes(s);
                const matchOs = (r.os_numero || '').toLowerCase().includes(s);
                if (!matchId && !matchFrota && !matchGestor && !matchCondutor && !matchObs && !matchOs) return false;
            }

            return true;
        });

        // Atualizar todas as visões
        updateKPIs();
        updateCharts();
        renderProntuarioSection();
        renderReincidenciaSection();
        renderAtencaoPrioritaria();
        renderGestoresCondutoresSection();
        renderVideotelemetriaSection();
        renderManutencaoSection();
        renderAuditoriaSection();
        renderTable();
        updateMapMarkers();
    }

    // 8. Atualização dos 10 Cards de KPIs
    function updateKPIs() {
        const kpis = ChecklistEngine.calculateKPIs(state.filteredRecords);

        setElText('kpiTotalInspecoes', kpis.totalInspecoes.toLocaleString('pt-BR'));
        setElText('kpiVeiculosDistintos', kpis.veiculosDistintos.toLocaleString('pt-BR'));
        setElText('kpiCondutoresDistintos', kpis.condutoresDistintos.toLocaleString('pt-BR'));
        setElText('kpiGestoresDistintos', kpis.gestoresDistintos.toLocaleString('pt-BR'));
        
        setElText('kpiCriticidadeLeve', kpis.criticidadeLeve.toLocaleString('pt-BR'));
        setElText('kpiPercLeve', `${kpis.percLeve}% da base`);

        setElText('kpiCriticidadeModerado', kpis.criticidadeModerado.toLocaleString('pt-BR'));
        setElText('kpiPercModerado', `${kpis.percModerado}% da base`);

        setElText('kpiInspecoesComAvarias', kpis.inspecoesComAvarias.toLocaleString('pt-BR'));
        setElText('kpiPercComAvarias', `${kpis.percComAvarias}%`);

        setElText('kpiTotalComponentes', kpis.totalComponentesDanificados.toLocaleString('pt-BR'));
        
        setElText('kpiVideoSim', kpis.videotelemetriaSim.toLocaleString('pt-BR'));
        setElText('kpiPercVideoSim', `${kpis.percVideoSim}% com vídeo`);

        setElText('kpiAbrirOsSim', kpis.abrirOsSim.toLocaleString('pt-BR'));
        setElText('kpiDetalheOS', `${kpis.comNumeroOs} c/ OS • ${kpis.semNumeroOs} pend.`);
    }

    function setElText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    // 9. Inicialização e Atualização dos Gráficos
    function initCharts() {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94A3B8' : '#64748B';

        // 1. Donut Criticidade (com Cross-Filtering interativo)
        const ctxCrit = document.getElementById('chartCriticidade')?.getContext('2d');
        if (ctxCrit) {
            state.charts.criticidade = new Chart(ctxCrit, {
                type: 'doughnut',
                data: {
                    labels: ['Leve (Liberado)', 'Moderado (Condutor notificado)', 'Não Classificado'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#10B981', '#F59E0B', '#64748B'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onHover: (e, active) => {
                        e.native.target.style.cursor = active.length ? 'pointer' : 'default';
                    },
                    onClick: (evt, activeElements) => {
                        if (!activeElements || activeElements.length === 0) return;
                        const index = activeElements[0].index;
                        const mapCrit = ['Leve', 'Moderado', 'TODAS'];
                        const selected = mapCrit[index] || 'TODAS';
                        state.filters.criticidade = (state.filters.criticidade === selected) ? 'TODAS' : selected;
                        const sel = document.getElementById('filterCriticidade');
                        if (sel) sel.value = state.filters.criticidade;
                        state.pagination.page = 1;
                        applyFilters();
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, color: textColor } }
                    },
                    cutout: '62%'
                }
            });
        }

        // 2. Donut Videotelemetria (com Cross-Filtering interativo)
        const ctxVideo = document.getElementById('chartVideotelemetria')?.getContext('2d');
        if (ctxVideo) {
            state.charts.video = new Chart(ctxVideo, {
                type: 'doughnut',
                data: {
                    labels: ['Videotelemetria SIM', 'Videotelemetria NÃO'],
                    datasets: [{
                        data: [0, 0],
                        backgroundColor: ['#06B6D4', '#94A3B8'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onHover: (e, active) => {
                        e.native.target.style.cursor = active.length ? 'pointer' : 'default';
                    },
                    onClick: (evt, activeElements) => {
                        if (!activeElements || activeElements.length === 0) return;
                        const index = activeElements[0].index;
                        const selected = index === 0 ? 'SIM' : 'NÃO';
                        state.filters.videotelemetria = (state.filters.videotelemetria === selected) ? 'TODAS' : selected;
                        const sel = document.getElementById('filterVideo');
                        if (sel) sel.value = state.filters.videotelemetria;
                        state.pagination.page = 1;
                        applyFilters();
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, color: textColor } }
                    },
                    cutout: '62%'
                }
            });
        }

        // 3. Donut Ordens de Serviço (com Cross-Filtering interativo)
        const ctxOS = document.getElementById('chartManutencaoOS')?.getContext('2d');
        if (ctxOS) {
            state.charts.os = new Chart(ctxOS, {
                type: 'doughnut',
                data: {
                    labels: ['OS Aberta (Com Número)', 'Solicitada (Sem Número)', 'OS Direta', 'Sem Solicitação'],
                    datasets: [{
                        data: [0, 0, 0, 0],
                        backgroundColor: ['#10B981', '#F59E0B', '#3B82F6', '#64748B'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onHover: (e, active) => {
                        e.native.target.style.cursor = active.length ? 'pointer' : 'default';
                    },
                    onClick: (evt, activeElements) => {
                        if (!activeElements || activeElements.length === 0) return;
                        const index = activeElements[0].index;
                        // Se index 3 (Sem Solicitação), filtra 'NÃO'. Se 0, 1 ou 2, filtra 'SIM'.
                        const selected = index === 3 ? 'NÃO' : 'SIM';
                        state.filters.abrirOs = (state.filters.abrirOs === selected) ? 'TODAS' : selected;
                        const sel = document.getElementById('filterAbrirOs');
                        if (sel) sel.value = state.filters.abrirOs;
                        state.pagination.page = 1;
                        applyFilters();
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, color: textColor } }
                    },
                    cutout: '62%'
                }
            });
        }

        // 4. Bar Componentes Danificados
        const ctxComps = document.getElementById('chartComponentes')?.getContext('2d');
        if (ctxComps) {
            state.charts.componentes = new Chart(ctxComps, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Ocorrências',
                        data: [],
                        backgroundColor: '#EF4444',
                        borderRadius: 6
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    onHover: (e, active) => {
                        e.native.target.style.cursor = active.length ? 'pointer' : 'default';
                    },
                    onClick: (evt, activeElements) => {
                        if (!activeElements || activeElements.length === 0) return;
                        const index = activeElements[0].index;
                        const compNome = state.charts.componentes?.data?.labels[index];
                        if (compNome) {
                            state.filters.componente = (state.filters.componente === compNome) ? 'TODOS' : compNome;
                            const sel = document.getElementById('filterComponente');
                            if (sel) sel.value = state.filters.componente;
                            state.pagination.page = 1;
                            applyFilters();
                        }
                    },
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textColor }, grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } },
                        y: { ticks: { color: textColor, font: { size: 11 } }, grid: { display: false } }
                    }
                }
            });
        }

        // 5. Linha/Barra de Evolução Temporal
        const ctxEvo = document.getElementById('chartEvolucaoTemporal')?.getContext('2d');
        if (ctxEvo) {
            state.charts.evolucao = new Chart(ctxEvo, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [
                        { label: 'Inspeções Leves', data: [], backgroundColor: '#10B981', borderRadius: 4, stack: 'Stack 0' },
                        { label: 'Inspeções Moderadas', data: [], backgroundColor: '#F59E0B', borderRadius: 4, stack: 'Stack 0' },
                        { label: 'Com Avarias', data: [], backgroundColor: '#EF4444', type: 'line', borderColor: '#EF4444', borderWidth: 2, tension: 0.3, fill: false }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', labels: { boxWidth: 10, color: textColor } }
                    },
                    scales: {
                        x: { ticks: { color: textColor, maxRotation: 45 }, grid: { display: false } },
                        y: { ticks: { color: textColor }, grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } }
                    }
                }
            });
        }

        // 6. Bar Categorias de Componentes
        const ctxCat = document.getElementById('chartCategoriasComponentes')?.getContext('2d');
        if (ctxCat) {
            state.charts.categorias = new Chart(ctxCat, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Ocorrências',
                        data: [],
                        backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B'],
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textColor }, grid: { display: false } },
                        y: { ticks: { color: textColor }, grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } }
                    }
                }
            });
        }
    }

    function updateCharts() {
        const kpis = ChecklistEngine.calculateKPIs(state.filteredRecords);
        const compData = ChecklistEngine.buildComponentesRanking(state.filteredRecords);
        const manData = ChecklistEngine.buildManutencaoAnalysis(state.filteredRecords);

        // Donut Criticidade
        if (state.charts.criticidade) {
            state.charts.criticidade.data.datasets[0].data = [kpis.criticidadeLeve, kpis.criticidadeModerado, kpis.criticidadeOutros];
            state.charts.criticidade.update();
        }

        // Donut Videotelemetria
        if (state.charts.video) {
            state.charts.video.data.datasets[0].data = [kpis.videotelemetriaSim, kpis.videotelemetriaNao];
            state.charts.video.update();
        }

        // Donut OS
        if (state.charts.os) {
            state.charts.os.data.datasets[0].data = [manData.comNumero, manData.solicitadaSemNumero, manData.diretaComNumero, manData.semSolicitacao];
            state.charts.os.update();
        }

        // Ranking Componentes (Top 10)
        if (state.charts.componentes) {
            const top10 = compData.ranking.slice(0, 10);
            state.charts.componentes.data.labels = top10.map(c => c.nome);
            state.charts.componentes.data.datasets[0].data = top10.map(c => c.totalOcorrencias);
            state.charts.componentes.update();
        }

        // Categorias
        if (state.charts.categorias) {
            state.charts.categorias.data.labels = compData.categorias.map(c => c.categoria);
            state.charts.categorias.data.datasets[0].data = compData.categorias.map(c => c.totalOcorrencias);
            state.charts.categorias.update();
        }

        // Evolução Temporal
        updateEvolutionChart();
    }

    function updateEvolutionChart() {
        if (!state.charts.evolucao) return;
        const ts = ChecklistEngine.buildTimeSeries(state.filteredRecords, state.evolutionRange);
        state.charts.evolucao.data.labels = ts.labels;
        state.charts.evolucao.data.datasets[0].data = ts.leves;
        state.charts.evolucao.data.datasets[1].data = ts.moderados;
        state.charts.evolucao.data.datasets[2].data = ts.comAvarias;
        state.charts.evolucao.update();
    }

    function updateChartsTheme() {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94A3B8' : '#64748B';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

        Object.values(state.charts).forEach(c => {
            if (c.options.scales) {
                if (c.options.scales.x) {
                    c.options.scales.x.ticks.color = textColor;
                    if (c.options.scales.x.grid) c.options.scales.x.grid.color = gridColor;
                }
                if (c.options.scales.y) {
                    c.options.scales.y.ticks.color = textColor;
                    if (c.options.scales.y.grid) c.options.scales.y.grid.color = gridColor;
                }
            }
            if (c.options.plugins && c.options.plugins.legend) {
                c.options.plugins.legend.labels.color = textColor;
            }
            c.update();
        });
    }

    // 10. Prontuário Digital do Veículo (Diferencial 1)
    function renderProntuarioSection() {
        const container = document.getElementById('prontuarioContent');
        if (!container) return;

        const prontuario = ChecklistEngine.buildProntuarioVeiculo(state.allRecords, state.selectedVeiculoProntuario);
        if (!prontuario) {
            container.innerHTML = `<div class="p-8 text-center text-sm text-[var(--text-muted)]">Nenhum veículo selecionado para visualização do prontuário digital.</div>`;
            return;
        }

        const isLeve = prontuario.ultimoStatusCriticidade === 'Leve';
        const statusBadgeClass = isLeve ? 'badge-leve' : 'badge-moderado';
        const statusIcon = isLeve ? 'fa-circle-check text-emerald-500' : 'fa-triangle-exclamation text-amber-500';

        container.innerHTML = `
            <!-- Cabeçalho do Prontuário -->
            <div class="p-5 border-b border-[var(--border-color)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[var(--kpi-bg)] rounded-t-2xl">
                <div class="flex items-center gap-3.5">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 font-mono font-extrabold text-lg">
                        <i class="fa-solid fa-car-side"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="text-base sm:text-lg font-bold font-mono text-[var(--text-primary)]">FROTA ${prontuario.codigo}</h3>
                            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${statusBadgeClass}">
                                <i class="fa-solid ${statusIcon} mr-1"></i> ${prontuario.ultimoStatusCriticidade}
                            </span>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-mono border border-[var(--border-color)] text-[var(--text-secondary)]">
                                ${prontuario.tipo}
                            </span>
                        </div>
                        <p class="text-xs text-[var(--text-secondary)] mt-0.5">
                            ${prontuario.modelo} • Placa: <strong class="font-mono text-[var(--text-primary)]">${prontuario.placa}</strong>
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-2 self-end md:self-auto text-xs font-mono">
                    <span class="text-[var(--text-secondary)]">Última Inspeção:</span>
                    <strong class="text-emerald-500 font-bold">${prontuario.ultimaData}</strong>
                </div>
            </div>

            <!-- 4 Cards de Resumo do Veículo -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 p-5 border-b border-[var(--border-color)]">
                <div class="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-center">
                    <div class="text-[10px] text-[var(--text-secondary)] font-medium uppercase">Total de Inspeções</div>
                    <div class="text-xl font-mono font-bold text-[var(--text-primary)] mt-1">${prontuario.totalInspecoes}</div>
                    <div class="text-[10px] text-[var(--text-muted)] mt-0.5">Histórico completo</div>
                </div>
                <div class="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-center">
                    <div class="text-[10px] text-[var(--text-secondary)] font-medium uppercase">Com Avarias</div>
                    <div class="text-xl font-mono font-bold text-amber-500 mt-1">${prontuario.inspecoesComAvaria}</div>
                    <div class="text-[10px] text-[var(--text-muted)] mt-0.5">${prontuario.totalComponentes} componentes</div>
                </div>
                <div class="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-center">
                    <div class="text-[10px] text-[var(--text-secondary)] font-medium uppercase">Gestor Mais Recente</div>
                    <div class="text-xs font-bold text-[var(--text-primary)] mt-1 truncate" title="${prontuario.gestorMaisRecente}">${prontuario.gestorMaisRecente}</div>
                    <div class="text-[10px] text-[var(--text-muted)] mt-0.5">${prontuario.todosGestores.length} gestores no histórico</div>
                </div>
                <div class="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-center">
                    <div class="text-[10px] text-[var(--text-secondary)] font-medium uppercase">Reincidência</div>
                    <div class="text-xl font-mono font-bold ${prontuario.possuiReincidencia ? 'text-rose-500' : 'text-emerald-500'} mt-1">
                        ${prontuario.possuiReincidencia ? `${prontuario.reincidencias.length} Alertas` : 'Nenhuma'}
                    </div>
                    <div class="text-[10px] text-[var(--text-muted)] mt-0.5">${prontuario.possuiReincidencia ? 'Danos repetidos' : 'Sem recorrência'}</div>
                </div>
            </div>

            <!-- Seção de Reincidência Específica do Veículo -->
            ${prontuario.possuiReincidencia ? `
            <div class="p-5 border-b border-[var(--border-color)] bg-rose-500/5">
                <h4 class="text-xs font-bold text-rose-500 uppercase tracking-wide flex items-center gap-1.5 mb-2.5">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    Componentes com Danos Reincidentes neste Veículo
                </h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    ${prontuario.reincidencias.map(rc => `
                        <div class="p-2.5 rounded-xl border border-rose-500/30 bg-[var(--card-bg)] text-xs">
                            <div class="font-bold text-[var(--text-primary)] flex items-center justify-between">
                                <span>${rc.componente}</span>
                                <span class="px-2 py-0.2 rounded-full bg-rose-500/15 text-rose-500 font-mono font-bold">${rc.ocorrencias}x</span>
                            </div>
                            <div class="text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                                Datas: ${rc.datas.join(', ')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Linha do Tempo de Inspeções do Veículo -->
            <div class="p-5">
                <h4 class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-timeline text-emerald-500"></i>
                    Histórico Cronológico de Inspeções (${prontuario.totalInspecoes} eventos)
                </h4>
                <div class="space-y-3 max-h-96 overflow-y-auto pr-1">
                    ${prontuario.historicoInspecoes.map(insp => {
                        const isMod = insp.criticidade === 'Moderado';
                        const badgeCls = isMod ? 'badge-moderado' : 'badge-leve';
                        return `
                        <div class="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] hover:border-emerald-500/50 transition cursor-pointer text-xs" onclick="openRecordModal('${insp.id}')">
                            <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border-color)]/60">
                                <div class="flex items-center gap-2 font-mono">
                                    <span class="font-bold text-emerald-500">#${insp.id}</span>
                                    <span>•</span>
                                    <span class="text-[var(--text-primary)] font-bold">${insp.data}</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeCls}">${insp.criticidade}</span>
                                    <span class="px-2 py-0.5 rounded-full text-[10px] font-mono border ${insp.videotelemetria === 'SIM' ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30' : 'bg-slate-500/10 text-slate-500 border-slate-500/30'}">Vídeo: ${insp.videotelemetria}</span>
                                    ${insp.os_numero ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 text-blue-500 border border-blue-500/30 font-bold">OS #${insp.os_numero}</span>` : ''}
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-[11px] text-[var(--text-secondary)]">
                                <div><strong>Condutor:</strong> ${insp.condutor}</div>
                                <div><strong>Gestor:</strong> ${insp.gestor}</div>
                            </div>
                            ${insp.componentes.length > 0 ? `
                            <div class="mt-2 pt-2 border-t border-[var(--border-color)]/60">
                                <span class="font-semibold text-rose-500">Componentes Danificados:</span>
                                <div class="flex flex-wrap gap-1 mt-1">
                                    ${insp.componentes.map(c => `<span class="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px]">${c.nome}</span>`).join('')}
                                </div>
                            </div>
                            ` : ''}
                            ${insp.observacoes ? `
                            <div class="mt-2 text-[11px] text-[var(--text-secondary)] italic bg-[var(--kpi-bg)] p-2 rounded-lg border border-[var(--border-color)]/60">
                                "${insp.observacoes}"
                            </div>
                            ` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // 11. Seção de Reincidência da Frota (Diferencial 2)
    function renderReincidenciaSection() {
        const container = document.getElementById('reincidenciaContent');
        if (!container) return;

        const reinc = ChecklistEngine.buildReincidenciaIntelligence(state.filteredRecords);

        container.innerHTML = `
            <div class="p-5 border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-4 bg-[var(--kpi-bg)] rounded-t-2xl">
                <div>
                    <h3 class="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-2">
                        <i class="fa-solid fa-arrows-rotate text-rose-500"></i>
                        Matriz de Reincidência de Avarias por Veículo
                    </h3>
                    <p class="text-xs text-[var(--text-secondary)] mt-0.5">
                        Identificação de veículos que apresentaram repetidamente danos no mesmo componente em datas distintas.
                    </p>
                </div>
                <div class="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 font-mono text-xs font-bold">
                    ${reinc.totalVeiculosReincidentes} Veículos com Reincidência
                </div>
            </div>

            <div class="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
                <!-- Ranking dos Componentes Mais Reincidentes -->
                <div class="lg:col-span-1 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]">
                    <h4 class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <i class="fa-solid fa-ranking-star text-amber-500"></i>
                        Componentes com Mais Reincidência
                    </h4>
                    <div class="space-y-2">
                        ${reinc.componentesRanking.map(cr => `
                            <div class="p-2.5 rounded-xl border border-[var(--border-color)] flex items-center justify-between text-xs">
                                <div>
                                    <div class="font-bold text-[var(--text-primary)]">${cr.componente}</div>
                                    <div class="text-[10px] text-[var(--text-muted)] font-mono">${cr.veiculosCount} veículos afetados</div>
                                </div>
                                <span class="font-mono font-bold text-rose-500 text-sm">${cr.totalCasos}x</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Tabela de Veículos Reincidentes -->
                <div class="lg:col-span-2 overflow-x-auto">
                    <table class="w-full text-xs text-left">
                        <thead>
                            <tr class="text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                                <th class="pb-2">Frota</th>
                                <th class="pb-2">Modelo / Placa</th>
                                <th class="pb-2 text-center">Inspeções</th>
                                <th class="pb-2">Componentes Reincidentes</th>
                                <th class="pb-2 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[var(--border-color)]">
                            ${reinc.veiculos.map(v => `
                                <tr class="hover:bg-[var(--card-hover)] transition">
                                    <td class="py-3 font-mono font-bold text-emerald-500">${v.codigo}</td>
                                    <td class="py-3">
                                        <div class="font-semibold text-[var(--text-primary)]">${v.modelo}</div>
                                        <div class="text-[10px] text-[var(--text-muted)] font-mono">${v.placa} • ${v.tipo}</div>
                                    </td>
                                    <td class="py-3 text-center font-mono font-bold">${v.totalInspecoes}</td>
                                    <td class="py-3">
                                        <div class="flex flex-wrap gap-1">
                                            ${v.reincidencias.map(r => `
                                                <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/30">
                                                    ${r.componente} (${r.ocorrencias}x)
                                                </span>
                                            `).join('')}
                                        </div>
                                    </td>
                                    <td class="py-3 text-right">
                                        <button onclick="selecionarVeiculoProntuario('${v.codigo}')" class="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-600 hover:text-white font-mono text-[10px] font-bold transition">
                                            Ver Ficha
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    window.selecionarVeiculoProntuario = function (codigo) {
        state.selectedVeiculoProntuario = codigo;
        const select = document.getElementById('selectProntuarioFrota');
        if (select) select.value = codigo;

        // Alternar para a aba de prontuário
        document.querySelector('.nav-tab-btn[data-tab="prontuario"]')?.click();
        renderProntuarioSection();
    };

    // 12. Veículos com Atenção Prioritária
    function renderAtencaoPrioritaria() {
        const tbody = document.getElementById('atencaoPrioritariaBody');
        if (!tbody) return;

        const lista = ChecklistEngine.buildVeiculosAtencaoPrioritaria(state.filteredRecords);
        tbody.innerHTML = '';

        if (lista.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-xs text-[var(--text-muted)]">Nenhum veículo com criticidade moderada ou componentes danificados no filtro atual.</td></tr>`;
            return;
        }

        lista.slice(0, 15).forEach(v => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-[var(--card-hover)] transition cursor-pointer text-xs';
            tr.innerHTML = `
                <td class="p-3 font-mono font-bold text-emerald-500">${v.codigo}</td>
                <td class="p-3 font-semibold text-[var(--text-primary)]">
                    <div>${v.modelo}</div>
                    <div class="text-[10px] text-[var(--text-muted)] font-mono">${v.placa} • ${v.tipo}</div>
                </td>
                <td class="p-3 text-center font-mono font-bold">${v.inspecoes}</td>
                <td class="p-3 text-center font-mono font-bold text-amber-500">${v.moderados}</td>
                <td class="p-3 text-center font-mono font-bold text-rose-500">${v.compsDanificados}</td>
                <td class="p-3 text-center font-mono">
                    <span class="${v.comOS > 0 ? 'text-blue-500 font-bold' : 'text-[var(--text-muted)]'}">${v.comOS} OS</span>
                </td>
                <td class="p-3 text-right">
                    <button onclick="selecionarVeiculoProntuario('${v.codigo}')" class="px-2 py-1 rounded bg-[var(--kpi-bg)] hover:bg-emerald-500 hover:text-white border border-[var(--border-color)] text-[10px] font-mono transition">
                        Prontuário
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 13. Gestores e Condutores
    function renderGestoresCondutoresSection() {
        const tbodyGest = document.getElementById('rankingGestoresBody');
        if (tbodyGest) {
            const gestList = ChecklistEngine.buildGestoresAnalysis(state.filteredRecords);
            tbodyGest.innerHTML = '';
            gestList.forEach(g => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-[var(--card-hover)] transition text-xs';
                tr.innerHTML = `
                    <td class="p-2.5 font-bold text-[var(--text-primary)]">${g.gestor}</td>
                    <td class="p-2.5 text-center font-mono">${g.veiculosCount}</td>
                    <td class="p-2.5 text-center font-mono font-bold">${g.inspecoes}</td>
                    <td class="p-2.5 text-center font-mono text-amber-500 font-bold">${g.comAvaria}</td>
                    <td class="p-2.5 text-center font-mono text-rose-500">${g.componentesDanificados}</td>
                    <td class="p-2.5 text-right font-mono">${g.taxaAvaria}%</td>
                `;
                tbodyGest.appendChild(tr);
            });
        }

        const tbodyCond = document.getElementById('rankingCondutoresBody');
        if (tbodyCond) {
            const condList = ChecklistEngine.buildCondutoresAnalysis(state.filteredRecords);
            tbodyCond.innerHTML = '';
            condList.slice(0, 30).forEach(c => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-[var(--card-hover)] transition text-xs';
                tr.innerHTML = `
                    <td class="p-2.5 font-semibold text-[var(--text-primary)]">${c.condutor}</td>
                    <td class="p-2.5 text-center font-mono">${c.veiculosCount}</td>
                    <td class="p-2.5 text-center font-mono font-bold">${c.inspecoes}</td>
                    <td class="p-2.5 text-center font-mono text-amber-500">${c.comAvaria}</td>
                    <td class="p-2.5 text-right font-mono text-[var(--text-muted)]">${c.ultimaInspecao}</td>
                `;
                tbodyCond.appendChild(tr);
            });
        }
    }

    // 14. Videotelemetria (Matriz 2x2)
    function renderVideotelemetriaSection() {
        const vMat = ChecklistEngine.buildVideotelemetriaMatrix(state.filteredRecords);
        setElText('videoMatSimAvaria', `${vMat.simComAvaria} (${vMat.percSimComAvaria}%)`);
        setElText('videoMatSimSemAvaria', `${vMat.simSemAvaria} (${vMat.percSimSemAvaria}%)`);
        setElText('videoMatNaoAvaria', `${vMat.naoComAvaria} (${vMat.percNaoComAvaria}%)`);
        setElText('videoMatNaoSemAvaria', `${vMat.naoSemAvaria} (${vMat.percNaoSemAvaria}%)`);
    }

    // 15. Manutenção e Ordens de Serviço
    function renderManutencaoSection() {
        const man = ChecklistEngine.buildManutencaoAnalysis(state.filteredRecords);
        const tbody = document.getElementById('tabelaOSBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (man.listaOS.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-xs text-[var(--text-muted)]">Nenhuma Ordem de Serviço identificada no filtro atual.</td></tr>`;
            return;
        }

        man.listaOS.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-[var(--card-hover)] transition text-xs';
            tr.innerHTML = `
                <td class="p-3 font-mono font-bold text-blue-500">#${item.numero}</td>
                <td class="p-3 font-mono font-semibold text-emerald-500">${item.veiculo}</td>
                <td class="p-3 text-[var(--text-primary)]">${item.modelo}</td>
                <td class="p-3 text-[var(--text-secondary)]">${item.data}</td>
                <td class="p-3 text-rose-500 font-medium">${item.componentes}</td>
                <td class="p-3 text-[var(--text-secondary)] truncate max-w-xs" title="${item.obs}">"${item.obs || '--'}"</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 16. Auditoria de Qualidade dos Dados
    function renderAuditoriaSection() {
        const inconsList = state.filteredRecords.filter(r => r.tem_inconsistencia);
        setElText('auditTotalInconsistencias', inconsList.length.toLocaleString('pt-BR'));

        const tbody = document.getElementById('tabelaAuditoriaBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (inconsList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-xs text-[var(--text-muted)]">Nenhuma inconsistência de dados identificada no filtro atual.</td></tr>`;
            return;
        }

        inconsList.slice(0, 30).forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-[var(--card-hover)] transition cursor-pointer text-xs';
            tr.onclick = () => openRecordModal(r.id);
            tr.innerHTML = `
                <td class="p-2.5 font-mono text-emerald-500 font-bold">#${r.id}</td>
                <td class="p-2.5 font-mono">${r.frota_codigo}</td>
                <td class="p-2.5 text-[var(--text-secondary)]">${r.data}</td>
                <td class="p-2.5">
                    <div class="space-y-1">
                        ${r.inconsistencias.map(inc => `
                            <span class="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/30">
                                ${inc}
                            </span>
                        `).join('')}
                    </div>
                </td>
                <td class="p-2.5 text-right font-mono text-[10px] text-[var(--text-muted)]">Ver Detalhes</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 17. Tabela Analítica Completa e Paginação
    function renderTable() {
        const tbody = document.getElementById('inspecoesTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        const total = state.filteredRecords.length;

        if (total === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-xs text-[var(--text-muted)]">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
            setElText('tablePaginationInfo', '0 de 0 registros');
            return;
        }

        const { page, pageSize } = state.pagination;
        const start = (page - 1) * pageSize;
        const pageRecords = state.filteredRecords.slice(start, start + pageSize);

        pageRecords.forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-[var(--card-hover)] transition cursor-pointer text-xs border-b border-[var(--border-color)]/60';
            tr.onclick = () => openRecordModal(r.id);

            const isMod = r.criticidade === 'Moderado';
            const badgeCls = isMod ? 'badge-moderado' : 'badge-leve';

            tr.innerHTML = `
                <td class="p-3 font-mono font-bold text-emerald-500">#${r.id}</td>
                <td class="p-3 font-mono text-[var(--text-secondary)]">${r.data}</td>
                <td class="p-3">
                    <div class="font-bold text-[var(--text-primary)] font-mono">${r.frota_codigo}</div>
                    <div class="text-[10px] text-[var(--text-muted)] truncate max-w-xs">${r.frota_modelo}</div>
                </td>
                <td class="p-3 font-mono text-[var(--text-secondary)]">${r.frota_placa || '--'}</td>
                <td class="p-3 text-[var(--text-primary)] truncate max-w-xs" title="${r.gestor}">${r.gestor}</td>
                <td class="p-3 text-[var(--text-secondary)] truncate max-w-xs" title="${r.condutor}">${r.condutor}</td>
                <td class="p-3 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeCls}">${r.criticidade}</span>
                </td>
                <td class="p-3 text-center">
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono ${r.videotelemetria === 'SIM' ? 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20' : 'bg-slate-500/10 text-slate-500'}">
                        ${r.videotelemetria}
                    </span>
                </td>
                <td class="p-3 text-center font-mono">
                    ${r.os_numero ? `<span class="px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-500 font-bold border border-blue-500/30">#${r.os_numero}</span>` : (r.abrir_os === 'SIM' ? '<span class="text-amber-500 text-[10px] font-bold">Solicitada</span>' : '<span class="text-[var(--text-muted)] text-[10px]">--</span>')}
                </td>
                <td class="p-3 text-right">
                    <button class="px-2 py-1 rounded bg-[var(--kpi-bg)] hover:bg-emerald-500 hover:text-white border border-[var(--border-color)] text-[10px] font-mono transition">
                        Ver
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Controles de Paginação
        const totalPages = Math.ceil(total / pageSize);
        setElText('tablePaginationInfo', `Mostrando ${start + 1}–${Math.min(start + pageSize, total)} de ${total.toLocaleString('pt-BR')} inspeções`);
        
        const prevBtn = document.getElementById('btnTablePrev');
        const nextBtn = document.getElementById('btnTableNext');
        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = page >= totalPages;
    }

    document.getElementById('btnTablePrev')?.addEventListener('click', () => {
        if (state.pagination.page > 1) {
            state.pagination.page--;
            renderTable();
        }
    });

    document.getElementById('btnTableNext')?.addEventListener('click', () => {
        const totalPages = Math.ceil(state.filteredRecords.length / state.pagination.pageSize);
        if (state.pagination.page < totalPages) {
            state.pagination.page++;
            renderTable();
        }
    });

    // 18. Mapa Geoprocessado (Leaflet + OpenStreetMap Puro)
    function initMap() {
        const mapContainer = document.getElementById('mapContainer');
        if (!mapContainer || typeof L === 'undefined') return;

        state.map = L.map('mapContainer', {
            center: [-21.047, -48.265],
            zoom: 13,
            zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(state.map);

        state.markersLayer = L.layerGroup().addTo(state.map);
    }

    function updateMapMarkers() {
        if (!state.map || !state.markersLayer) return;
        state.markersLayer.clearLayers();

        const bounds = [];
        const recordsWithGps = state.filteredRecords.filter(r => r.lat && r.lon && r.lat !== 0);

        recordsWithGps.slice(0, 300).forEach(r => {
            const isMod = r.criticidade === 'Moderado';
            const color = isMod ? '#F59E0B' : '#10B981';

            const marker = L.circleMarker([r.lat, r.lon], {
                radius: 6,
                fillColor: color,
                color: '#FFFFFF',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.85
            });

            marker.bindPopup(`
                <div class="p-1 font-sans text-xs">
                    <div class="font-bold text-emerald-500 font-mono">FROTA ${r.frota_codigo} • #${r.id}</div>
                    <div class="text-[11px] font-semibold text-[var(--text-primary)] mt-0.5">${r.frota_modelo}</div>
                    <div class="text-[10px] text-[var(--text-secondary)] mt-1">Data: ${r.data}</div>
                    <div class="text-[10px] text-[var(--text-secondary)]">Criticidade: <strong>${r.criticidade}</strong></div>
                    <div class="text-[10px] text-[var(--text-secondary)]">Condutor: ${r.condutor}</div>
                    ${r.componentes.length > 0 ? `<div class="text-[10px] text-rose-500 font-bold mt-1">Danos: ${r.componentes.map(c => c.nome).join(', ')}</div>` : ''}
                    <div class="mt-2 pt-1 border-t border-[var(--border-color)]">
                        <button onclick="openRecordModal('${r.id}')" class="px-2 py-0.5 bg-emerald-500 text-white rounded text-[10px] font-bold">Ver Detalhes</button>
                    </div>
                </div>
            `);

            state.markersLayer.addLayer(marker);
            bounds.push([r.lat, r.lon]);
        });

        if (bounds.length > 0) {
            state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
        }
    }

    // 19. Modal Individual Completo
    window.openRecordModal = function (id) {
        const r = state.allRecords.find(item => String(item.id) === String(id));
        if (!r) return;

        setElText('modalRecordId', `#${r.id}`);
        setElText('modalData', r.data);
        setElText('modalFrotaCodigo', r.frota_codigo);
        setElText('modalFrotaModelo', r.frota_modelo);
        setElText('modalFrotaPlaca', r.frota_placa || 'Não Informada');
        setElText('modalFrotaTipo', r.frota_tipo);
        setElText('modalCriticidade', r.criticidade);
        setElText('modalGestor', r.gestor);
        setElText('modalCondutor', r.condutor);
        setElText('modalUsuario', r.usuario);
        setElText('modalVideo', r.videotelemetria);
        setElText('modalAbrirOs', r.abrir_os);
        setElText('modalOsNumero', r.os_numero || 'Não Informado');
        setElText('modalDuracao', `${r.duracao_min} min`);
        setElText('modalCoords', `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`);
        setElText('modalObs', r.observacoes || 'Nenhuma observação registrada.');

        const compContainer = document.getElementById('modalComponentesList');
        if (compContainer) {
            compContainer.innerHTML = '';
            if (r.componentes.length === 0) {
                compContainer.innerHTML = `<span class="text-xs text-[var(--text-muted)] italic">Nenhum componente declarado danificado.</span>`;
            } else {
                r.componentes.forEach(c => {
                    const tag = document.createElement('span');
                    tag.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/25';
                    tag.innerText = `${c.codigo ? `[${c.codigo}] ` : ''}${c.nome} (${c.categoria})`;
                    compContainer.appendChild(tag);
                });
            }
        }

        const modal = document.getElementById('recordDetailModal');
        if (modal) modal.classList.remove('hidden');
    };

    window.closeRecordModal = function () {
        const modal = document.getElementById('recordDetailModal');
        if (modal) modal.classList.add('hidden');
    };

    // 20. Exportação XLSX e CSV
    function exportToExcel() {
        if (!window.XLSX) {
            alert('Biblioteca SheetJS indisponível.');
            return;
        }

        const rows = state.filteredRecords.map(r => ({
            'ID Inspeção': r.id,
            'Data Lançamento': r.data,
            'Código Frota': r.frota_codigo,
            'Modelo Veículo': r.frota_modelo,
            'Placa': r.frota_placa,
            'Tipo Frota': r.frota_tipo,
            'Estado Criticidade': r.criticidade,
            'Gestor': r.gestor,
            'Condutor': r.condutor,
            'Videotelemetria': r.videotelemetria,
            'Componentes Danificados': r.componentes.map(c => c.nome).join('; '),
            'Qtd Componentes': r.qtd_componentes,
            'Observações': r.observacoes,
            'Abrir OS': r.abrir_os,
            'Número OS': r.os_numero,
            'Latitude': r.lat,
            'Longitude': r.lon,
            'Duração (min)': r.duracao_min,
            'Usuário Lançamento': r.usuario
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Gestao_Frota');
        XLSX.writeFile(wb, `Gestao_Frota_Pitangueiras_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    function exportToCSV() {
        const headers = ['ID', 'Data', 'Frota', 'Modelo', 'Placa', 'Tipo', 'Criticidade', 'Gestor', 'Condutor', 'Videotelemetria', 'Componentes', 'Observacoes', 'Abrir_OS', 'Numero_OS'];
        const rows = state.filteredRecords.map(r => [
            r.id,
            `"${r.data}"`,
            `"${r.frota_codigo}"`,
            `"${r.frota_modelo.replace(/"/g, '""')}"`,
            `"${r.frota_placa}"`,
            `"${r.frota_tipo}"`,
            `"${r.criticidade}"`,
            `"${r.gestor}"`,
            `"${r.condutor}"`,
            `"${r.videotelemetria}"`,
            `"${r.componentes.map(c => c.nome).join(', ')}"`,
            `"${(r.observacoes || '').replace(/"/g, '""')}"`,
            `"${r.abrir_os}"`,
            `"${r.os_numero}"`
        ]);

        const csvContent = '\uFEFF' + [headers.join(';')].concat(rows.map(e => e.join(';'))).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Gestao_Frota_Pitangueiras_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

})();
