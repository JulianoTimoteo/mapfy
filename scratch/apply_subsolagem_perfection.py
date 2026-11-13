import re
from pathlib import Path

sub_dir = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda\!@#Mapfy_2026\DashBoard\subsolagem")
html_file = sub_dir / "index.html"
js_file = sub_dir / "js" / "dashboard.js"

# =========================================================================
# 1. ATUALIZAÇÃO DO index.html
# =========================================================================
html_content = html_file.read_text(encoding="utf-8")

# A. Remover o botão "Hoje" e ajustar os botões de período do topo
old_period_pattern = r'<!-- Bloco Esquerdo: Seletor Rápido de Período Temporal -->.*?<!-- Bloco Direito: Ferramentas Operacionais Executivas -->'
new_period_block = """<!-- Bloco Esquerdo: Seletor Rápido de Período Temporal -->
                    <div class="flex items-center gap-2">
                        <span class="text-[11px] font-bold text-white uppercase tracking-wider hidden sm:inline">Período:</span>
                        <div class="period-segmented-group shadow-sm">
                            <!-- Botão Safra Completa -->
                            <button id="btnAllDates" type="button" class="period-toggle-btn active" data-period="all"
                                    title="Exibir todo o histórico da safra">
                                <span>🌐</span>
                                <span>Safra Completa</span>
                                <span class="period-badge" id="badgeAll">367</span>
                            </button>

                            <!-- Botão Última Data -->
                            <button id="btnLatestDate" type="button" class="period-toggle-btn" data-period="latest"
                                    title="Filtrar pela data mais recente com medições registradas na base">
                                <span>📅</span>
                                <span>Última Data</span>
                                <span class="period-badge" id="badgeLatest"></span>
                            </button>
                        </div>
                    </div>

                    <!-- Bloco Direito: Ferramentas Operacionais Executivas -->"""

html_content = re.sub(old_period_pattern, new_period_block, html_content, flags=re.DOTALL)

# B. Transformar o input date em select de datas com medições reais
old_date_input = r'<input type="date" id="filterDate"[^>]*>'
new_date_select = """<select id="filterDate"
                               class="w-full p-2 rounded-xl border text-xs font-bold font-mono focus:outline-none focus:border-emerald-500 text-white"
                               style="background: var(--bg-page); border-color: var(--border-color); color: #ffffff;">
                            <option value="">Todas as Datas com Registros</option>
                        </select>"""
html_content = re.sub(old_date_input, new_date_select, html_content)

# C. Evolução Temporal: Inserir o botão de vincular/desvincular ao filtro global e ativar 7D por padrão
old_evo_buttons = r'<div class="inline-flex p-0\.5 rounded-lg border text-xs font-semibold shadow-sm"[^>]*>.*?</div>'
new_evo_header = """<div class="flex items-center gap-2 flex-wrap">
                            <!-- Botão de Sincronização com Filtro Global do Topo -->
                            <button id="btnSyncGlobalFilter" type="button"
                                    class="px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-slate-800 text-white border-slate-700 hover:border-emerald-500"
                                    title="Quando desativado, este gráfico exibe sempre os últimos 7 dias. Clique para sincronizar com o filtro de data do topo.">
                                <span id="syncIcon">🔓</span>
                                <span id="syncText">Filtro Local (7D)</span>
                            </button>

                            <!-- Botões de Período Local: Todos, 15D, 7D -->
                            <div class="inline-flex p-0.5 rounded-lg border text-xs font-semibold shadow-xs" style="background: var(--bg-kpi); border-color: var(--border-color);">
                                <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-white hover:text-emerald-400" data-evo-range="ALL" title="Exibir todo o histórico da safra">Todos</button>
                                <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-white hover:text-emerald-400" data-evo-range="15D" title="Últimos 15 dias com medições">15D</button>
                                <button type="button" class="btn-evo-filter active px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-white bg-emerald-600 shadow-xs" data-evo-range="7D" title="Últimos 7 dias com medições (Padrão)">7D</button>
                            </div>
                        </div>"""

# Substitui apenas a div de botões dentro do header de evolução
html_content = re.sub(
    r'(<div class="inline-flex p-0\.5 rounded-lg border text-xs font-semibold shadow-sm"[^>]*>.*?</div>)',
    new_evo_header,
    html_content,
    count=1,
    flags=re.DOTALL
)

# D. Distribuição de Conformidade: Aumentar o donut, centralizar número e legendas lado a lado
old_donut_block = r'<!-- Canvas da Rosca com Percentual Central em Destaque -->.*?<!-- Total Denominador -->\s*<div class="pt-1\.5 flex items-center justify-between text-\[10px\] text-\[var\(--text-muted\)\] font-mono border-t"[^>]*>.*?</div>\s*</div>'
new_donut_block = """<!-- Canvas da Rosca com Percentual Central em Destaque (Expandido e Centralizado) -->
                    <div class="relative aspect-square w-full max-w-[280px] sm:max-w-[310px] mx-auto my-2">
                        <canvas id="chartDonut"></canvas>
                        <div id="donutCenterOverlay" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none text-center">
                            <span class="text-3xl sm:text-4xl font-black font-mono text-emerald-400 leading-none" id="donutCenterPerc">83,7%</span>
                            <span class="text-[11px] font-extrabold uppercase tracking-wider text-white mt-1">Na Meta</span>
                            <span class="text-[10px] font-mono text-white font-bold" id="donutCenterCount">307 de 367</span>
                        </div>
                    </div>
                </div>

                <!-- Legenda Horizontal Lado a Lado com Cores e Valores (Zero Cinza) -->
                <div class="mt-4 pt-3 border-t grid grid-cols-3 gap-2 text-center" style="border-color: var(--border-color);" id="donutDataContainer">
                    <!-- 1. Dentro da Faixa -->
                    <div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col items-center justify-center">
                        <div class="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span>Dentro</span>
                        </div>
                        <span class="text-[9px] text-white font-mono mt-0.5">(45 a 55 cm)</span>
                        <span class="font-mono font-black text-xs sm:text-sm text-white mt-1" id="donutValDentro">307 (83,7%)</span>
                    </div>

                    <!-- 2. Abaixo da Faixa -->
                    <div class="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col items-center justify-center">
                        <div class="flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
                            <span class="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                            <span>Abaixo</span>
                        </div>
                        <span class="text-[9px] text-white font-mono mt-0.5">(&lt; 45 cm)</span>
                        <span class="font-mono font-black text-xs sm:text-sm text-white mt-1" id="donutValAbaixo">42 (11,4%)</span>
                    </div>

                    <!-- 3. Acima da Faixa -->
                    <div class="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 flex flex-col items-center justify-center">
                        <div class="flex items-center gap-1.5 text-[11px] font-bold text-purple-400">
                            <span class="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span>
                            <span>Acima</span>
                        </div>
                        <span class="text-[9px] text-white font-mono mt-0.5">(&gt; 55 cm)</span>
                        <span class="font-mono font-black text-xs sm:text-sm text-white mt-1" id="donutValAcima">18 (4,9%)</span>
                    </div>
                </div>

                <!-- Total Denominador -->
                <div class="mt-3 pt-2 flex items-center justify-between text-xs text-white font-mono border-t" style="border-color: var(--border-color);">
                    <span class="text-white font-bold">Total de Medições:</span>
                    <span id="donutValTotal" class="font-extrabold text-emerald-400 text-sm">367 avaliadas</span>
                </div>
            </div>"""

html_content = re.sub(old_donut_block, new_donut_block, html_content, flags=re.DOTALL)

html_file.write_text(html_content, encoding="utf-8")
print("index.html atualizado com sucesso!")

# =========================================================================
# 2. ATUALIZAÇÃO DO dashboard.js
# =========================================================================
js_content = js_file.read_text(encoding="utf-8")

# A. Atualizar estado padrão: syncWithGlobalFilter=false, evolutionRange='7D'
js_content = js_content.replace(
    "evolutionRange: 'ALL',",
    "evolutionRange: '7D',\n        syncWithGlobalFilter: false,"
)

# B. Configuração do Donut no initCharts:
old_donut_init = """        // 1. Gráfico de Rosca: Distribuição de Conformidade Técnica
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
        }"""

new_donut_init = """        // Desativa datalabels globalmente para não poluir os outros gráficos
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.defaults.set('plugins.datalabels', { display: false });
        }

        // 1. Gráfico de Rosca: Distribuição de Conformidade Técnica com Rótulos nas Fatias
        const ctxDonut = document.getElementById('chartDonut');
        if (ctxDonut) {
            const donutPlugins = (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [];
            state.charts.donut = new Chart(ctxDonut, {
                type: 'doughnut',
                plugins: donutPlugins,
                data: {
                    labels: ['Dentro da Meta', 'Abaixo da Meta', 'Acima da Meta'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#10b981', '#f59e0b', '#a855f7'],
                        borderWidth: 2,
                        borderColor: isDark ? '#1c1e22' : '#ffffff',
                        hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const val = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                    return ` ${context.label}: ${val} (${pct}%)`;
                                }
                            }
                        },
                        datalabels: {
                            display: true,
                            color: '#ffffff',
                            font: {
                                family: 'Plus Jakarta Sans',
                                weight: 'bold',
                                size: 14
                            },
                            formatter: function(value, ctx) {
                                if (!value || value <= 0) return '';
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
                                return `${value}\\n(${pct}%)`;
                            },
                            textAlign: 'center'
                        }
                    },
                    cutout: '66%'
                }
            });
        }"""

if old_donut_init in js_content:
    js_content = js_content.replace(old_donut_init, new_donut_init)
    print("Donut init substituído com sucesso!")
else:
    print("Aviso: Trecho old_donut_init não encontrado exatamente.")

# C. Atualizar populateSelectOptions para popular filterDate com datas reais
old_populate_date = "    function populateSelectOptions() {"
new_populate_date = """    function populateSelectOptions() {
        const dateSelect = document.getElementById('filterDate');
        if (dateSelect) {
            dateSelect.innerHTML = '<option value="">Todas as Datas com Registros</option>';
            const dateCounts = {};
            state.allRecords.forEach(r => {
                if (r.dataBR) {
                    dateCounts[r.dataBR] = (dateCounts[r.dataBR] || 0) + 1;
                }
            });
            const sortedDates = Object.keys(dateCounts).sort((a, b) => {
                const [d1, m1, y1] = a.split('/').map(Number);
                const [d2, m2, y2] = b.split('/').map(Number);
                return new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
            });
            sortedDates.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.innerText = `${d} (${dateCounts[d]} medições)`;
                dateSelect.appendChild(opt);
            });
        }"""
js_content = js_content.replace(old_populate_date, new_populate_date)

# D. Atualizar setupFilterListeners para lidar com filterDate como select
old_filter_date_listener = """        if (dateInput) {
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
        }"""

new_filter_date_listener = """        if (dateInput) {
            dateInput.addEventListener('change', (e) => {
                const val = e.target.value.trim();
                if (val) {
                    state.activeFilters.date = val;
                    if (state.activeFilters.date === state.maxAvailableDateBR) {
                        state.periodScope = 'latest';
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
        }"""
js_content = js_content.replace(old_filter_date_listener, new_filter_date_listener)

# E. Atualizar setPeriodScope
old_set_period_scope = """    function setPeriodScope(scope) {
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
    }"""

new_set_period_scope = """    function setPeriodScope(scope) {
        state.periodScope = scope;
        const dateInput = document.getElementById('filterDate');

        if (scope === 'all') {
            state.activeFilters.date = '';
            state.isLatestDateMode = false;
            if (dateInput) dateInput.value = '';
        } else if (scope === 'latest') {
            state.activeFilters.date = state.maxAvailableDateBR;
            state.isLatestDateMode = true;
            if (dateInput) dateInput.value = state.maxAvailableDateBR;
        }

        updatePeriodToggleUI();
        state.pagination.page = 1;
        applyFilters();
    }"""
js_content = js_content.replace(old_set_period_scope, new_set_period_scope)

# F. Atualizar updatePeriodToggleUI para exibir a data e contagem no badgeLatest
old_update_period = """    function updatePeriodToggleUI() {
        const btnAll = document.getElementById('btnAllDates');
        const btnLatest = document.getElementById('btnLatestDate');
        const btnToday = document.getElementById('btnToday');

        if (btnAll) btnAll.classList.toggle('active', state.periodScope === 'all');
        if (btnLatest) btnLatest.classList.toggle('active', state.periodScope === 'latest');
        if (btnToday) btnToday.classList.toggle('active', state.periodScope === 'today');
    }"""

new_update_period = """    function updatePeriodToggleUI() {
        const btnAll = document.getElementById('btnAllDates');
        const btnLatest = document.getElementById('btnLatestDate');
        const badgeLatest = document.getElementById('badgeLatest');

        if (btnAll) btnAll.classList.toggle('active', state.periodScope === 'all');
        if (btnLatest) btnLatest.classList.toggle('active', state.periodScope === 'latest');
        if (badgeLatest && state.maxAvailableDateBR) {
            const countLatest = state.allRecords.filter(r => r.dataBR === state.maxAvailableDateBR).length;
            badgeLatest.innerText = `${state.maxAvailableDateBR} (${countLatest})`;
        }
    }"""
js_content = js_content.replace(old_update_period, new_update_period)

# G. Atualizar applyFilters para que timeSeries respeite syncWithGlobalFilter
old_apply_ts = "const timeSeries = SubsolagemEngine.buildTimeSeries(state.filteredRecords, cfg);"
new_apply_ts = """// Se o vínculo com o topo estiver desativado, exibe histórico local completo sem restrição de data do topo
        const timeSeriesRecords = state.syncWithGlobalFilter
            ? state.filteredRecords
            : state.allRecords.filter(r => {
                if (state.activeFilters.frente !== 'ALL' && r.frente !== state.activeFilters.frente) return false;
                if (state.activeFilters.os !== 'ALL' && r.os !== state.activeFilters.os) return false;
                if (state.activeFilters.responsavel !== 'ALL' && r.responsavel !== state.activeFilters.responsavel) return false;
                return true;
            });
        const timeSeries = SubsolagemEngine.buildTimeSeries(timeSeriesRecords, cfg);"""
js_content = js_content.replace(old_apply_ts, new_apply_ts)

# H. Atualizar initEvolutionFilter
old_init_evo = """    // Filtros Rápidos da Evolução Temporal (Todos, 15D, 7D)
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
    }"""

new_init_evo = """    // Filtros Rápidos da Evolução Temporal (Todos, 15D, 7D) e Vínculo com Topo
    function initEvolutionFilter() {
        const btnSync = document.getElementById('btnSyncGlobalFilter');
        const syncIcon = document.getElementById('syncIcon');
        const syncText = document.getElementById('syncText');

        if (btnSync) {
            btnSync.addEventListener('click', () => {
                state.syncWithGlobalFilter = !state.syncWithGlobalFilter;
                if (state.syncWithGlobalFilter) {
                    btnSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm";
                    if (syncIcon) syncIcon.innerText = "🔗";
                    if (syncText) syncText.innerText = "Vinculado ao Topo";
                    btnSync.title = "Gráfico sincronizado com o filtro de data do topo. Clique para desvincular.";
                } else {
                    btnSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-slate-800 text-white border-slate-700 hover:border-emerald-500";
                    if (syncIcon) syncIcon.innerText = "🔓";
                    if (syncText) syncText.innerText = `Filtro Local (${state.evolutionRange})`;
                    btnSync.title = "Quando desativado, este gráfico exibe sempre o histórico local. Clique para vincular.";
                }
                applyFilters();
            });
        }

        const buttons = document.querySelectorAll('.btn-evo-filter');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const range = btn.getAttribute('data-evo-range') || '7D';
                state.evolutionRange = range;
                buttons.forEach(b => {
                    b.classList.remove('active', 'bg-emerald-600', 'shadow-xs');
                    b.classList.add('hover:text-emerald-400');
                });
                btn.classList.add('active', 'bg-emerald-600', 'shadow-xs');
                btn.classList.remove('hover:text-emerald-400');
                if (!state.syncWithGlobalFilter && syncText) {
                    syncText.innerText = `Filtro Local (${range})`;
                }
                applyFilters();
            });
        });
    }"""
js_content = js_content.replace(old_init_evo, new_init_evo)

js_file.write_text(js_content, encoding="utf-8")
print("dashboard.js atualizado com sucesso!")
