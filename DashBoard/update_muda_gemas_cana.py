import os, re

# ==========================================
# 1. QUALIDADE DA MUDA
# ==========================================
qm_html_path = 'DashBoard/qualidade_muda/index.html'
qm_js_path = 'DashBoard/qualidade_muda/js/dashboard.js'

with open(qm_html_path, 'r', encoding='utf-8') as f:
    qm_html = f.read()

qm_html = qm_html.replace('max-w-[1600px]', 'w-full max-w-[1920px]')
qm_html = qm_html.replace('grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10', 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 min-[2200px]:grid-cols-10')

buttons_muda = '''<!-- Filtros Rápidos de Janela Temporal: Todos, 15D, 7D -->
                    <div class="inline-flex p-0.5 rounded-lg border text-xs font-semibold shadow-sm" style="background: var(--bg-kpi); border-color: var(--border-color);">
                        <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-white bg-emerald-600 shadow-sm" data-evo-range="ALL" title="Exibir todo o histórico de dias">Todos</button>
                        <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-[var(--text-secondary)] hover:text-emerald-500" data-evo-range="15D" title="Últimos 15 dias com medições">15D</button>
                        <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-[var(--text-secondary)] hover:text-emerald-500" data-evo-range="7D" title="Últimos 7 dias com medições">7D</button>
                    </div>'''

if 'btn-evo-filter' not in qm_html:
    target = '<div class="inline-flex p-0.5 rounded-lg border text-xs"'
    qm_html = qm_html.replace(target, buttons_muda + '\n\n                    ' + target, 1)

with open(qm_html_path, 'w', encoding='utf-8') as f:
    f.write(qm_html)
print('[HTML] Updated qualidade_muda')

with open(qm_js_path, 'r', encoding='utf-8') as f:
    qm_js = f.read()

if 'evolutionRange:' not in qm_js:
    qm_js = qm_js.replace("evolutionMode: 'volume',", "evolutionMode: 'volume',\n        evolutionRange: 'ALL',")

old_qm_evo_start = "const evo = window.QualidadeMudaEngine.calculateTemporalEvolution(state.filteredRecords);"
new_qm_evo_start = """let evo = window.QualidadeMudaEngine.calculateTemporalEvolution(state.filteredRecords);
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
        }"""

if 'if (state.evolutionRange ===' not in qm_js:
    qm_js = qm_js.replace(old_qm_evo_start, new_qm_evo_start, 1)

init_evo_listener = '''
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
                if (typeof updateEvolutionChart === 'function') {
                    updateEvolutionChart();
                } else if (typeof updateChartsAndVisuals === 'function') {
                    updateChartsAndVisuals();
                }
            });
        });
    }
'''

if 'function initEvolutionFilter()' not in qm_js:
    qm_js = qm_js.replace('function bindEvents() {', init_evo_listener + '\n    function bindEvents() {')

if 'initEvolutionFilter();' not in qm_js:
    qm_js = qm_js.replace('bindEvents();', 'bindEvents();\n        initEvolutionFilter();')

with open(qm_js_path, 'w', encoding='utf-8') as f:
    f.write(qm_js)
print('[JS] Updated qualidade_muda')


# ==========================================
# 2. VIABILIDADE DE GEMAS
# ==========================================
vg_html_path = 'DashBoard/viabilidade_gemas/index.html'
vg_js_path = 'DashBoard/viabilidade_gemas/js/dashboard.js'

with open(vg_html_path, 'r', encoding='utf-8') as f:
    vg_html = f.read()

vg_html = vg_html.replace('max-w-[1600px]', 'w-full max-w-[1920px]')

if 'btn-evo-filter' not in vg_html:
    target = '<div class="inline-flex p-0.5 rounded-lg border text-xs"'
    if target in vg_html:
        vg_html = vg_html.replace(target, buttons_muda + '\n\n                    ' + target, 1)

with open(vg_html_path, 'w', encoding='utf-8') as f:
    f.write(vg_html)
print('[HTML] Updated viabilidade_gemas')

with open(vg_js_path, 'r', encoding='utf-8') as f:
    vg_js = f.read()

if 'evolutionRange:' not in vg_js:
    vg_js = vg_js.replace("evolutionMode: 'volume',", "evolutionMode: 'volume',\n        evolutionRange: 'ALL',")

old_vg_evo_start = "const evo = window.ViabilidadeGemasEngine.calculateTemporalEvolution(state.filteredRecords);"
new_vg_evo_start = """let evo = window.ViabilidadeGemasEngine.calculateTemporalEvolution(state.filteredRecords);
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
        }"""

if 'if (state.evolutionRange ===' not in vg_js:
    vg_js = vg_js.replace(old_vg_evo_start, new_vg_evo_start, 1)

if 'function initEvolutionFilter()' not in vg_js:
    vg_js = vg_js.replace('function bindEvents() {', init_evo_listener + '\n    function bindEvents() {')

if 'initEvolutionFilter();' not in vg_js:
    vg_js = vg_js.replace('bindEvents();', 'bindEvents();\n        initEvolutionFilter();')

with open(vg_js_path, 'w', encoding='utf-8') as f:
    f.write(vg_js)
print('[JS] Updated viabilidade_gemas')


# ==========================================
# 3. QUALIDADE DA CANA
# ==========================================
qc_html_path = 'DashBoard/qualidade_cana/index.html'
qc_js_path = 'DashBoard/qualidade_cana/js/dashboard.js'

with open(qc_html_path, 'r', encoding='utf-8') as f:
    qc_html = f.read()

qc_html = qc_html.replace('max-w-[1600px]', 'w-full max-w-[1920px]')

if 'btn-evo-filter' not in qc_html:
    pattern = r'(<h3[^>]*>Evolução Temporal[^<]*</h3>)'
    qc_html = re.sub(pattern, r'\1\n                    ' + buttons_muda, qc_html, count=1)

with open(qc_html_path, 'w', encoding='utf-8') as f:
    f.write(qc_html)
print('[HTML] Updated qualidade_cana')

with open(qc_js_path, 'r', encoding='utf-8') as f:
    qc_js = f.read()

if 'evolutionRange:' not in qc_js:
    qc_js = qc_js.replace("filters: {", "evolutionRange: 'ALL',\n        filters: {", 1)

old_qc_evo = "const evo = window.QualidadeCanaEngine.calculateTemporalEvolution(state.filteredRecords);"
new_qc_evo = """let evo = window.QualidadeCanaEngine.calculateTemporalEvolution(state.filteredRecords);
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
        }"""

if 'if (state.evolutionRange ===' not in qc_js:
    qc_js = qc_js.replace(old_qc_evo, new_qc_evo, 1)

if 'function initEvolutionFilter()' not in qc_js:
    qc_js += init_evo_listener

if 'initEvolutionFilter();' not in qc_js:
    qc_js = qc_js.replace('initCharts();', 'initCharts();\n        initEvolutionFilter();')

with open(qc_js_path, 'w', encoding='utf-8') as f:
    f.write(qc_js)
print('[JS] Updated qualidade_cana')

print('All updated successfully!')
