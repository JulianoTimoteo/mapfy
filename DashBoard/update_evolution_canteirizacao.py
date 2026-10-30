import os, re

html_path = 'DashBoard/canteirizacao/index.html'
js_path = 'DashBoard/canteirizacao/js/dashboard.js'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Responsiveness: max-w-[1600px] -> w-full max-w-[1920px]
html = html.replace('max-w-[1600px]', 'w-full max-w-[1920px]')

# 2. KPI grid: lg:grid-cols-10 -> grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 min-[2200px]:grid-cols-10
html = html.replace('grid-cols-2 sm:grid-cols-5 lg:grid-cols-10', 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 min-[2200px]:grid-cols-10')

# 3. Evolution buttons
buttons_html = '''<div class="inline-flex p-0.5 rounded-lg border text-xs font-semibold shadow-sm" style="background: var(--bg-kpi); border-color: var(--border-color);">
                            <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-white bg-emerald-600 shadow-sm" data-evo-range="ALL" title="Exibir todo o histórico de dias">Todos</button>
                            <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-[var(--text-secondary)] hover:text-emerald-500" data-evo-range="15D" title="Últimos 15 dias com medições">15D</button>
                            <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-[var(--text-secondary)] hover:text-emerald-500" data-evo-range="7D" title="Últimos 7 dias com medições">7D</button>
                        </div>'''

if 'btn-evo-filter' not in html:
    # Find the legend div right above chartEvolutionContainer
    pattern = r'(<div class="flex items-center gap-2 text-xs font-mono">)'
    html = re.sub(pattern, buttons_html + r'\n                        \1', html, count=1)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
print('[HTML] Updated canteirizacao index.html')

# Update JS
with open(js_path, 'r', encoding='utf-8') as f:
    js = f.read()

# Add evolutionRange in state
if 'evolutionRange:' not in js:
    js = js.replace("activePeriod: 'all',", "activePeriod: 'all',\n        evolutionRange: 'ALL',")

# Update timeSeries slicing in updateChartsAndVisuals
old_ts_block = '''        // 2. Evolução Temporal
        if (state.charts.evolution) {
            state.charts.evolution.data.labels = timeSeries.labels;
            state.charts.evolution.data.datasets[0].data = timeSeries.medias;
            state.charts.evolution.data.datasets[1].data = new Array(timeSeries.labels.length).fill(state.targetConfig.min);
            state.charts.evolution.data.datasets[2].data = new Array(timeSeries.labels.length).fill(state.targetConfig.max);
            state.charts.evolution.update();
        }'''

new_ts_block = '''        // 2. Evolução Temporal com Filtro Rápido (Todos, 15D, 7D)
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
        }'''

if 'let labels = timeSeries.labels;' not in js:
    # Use regex if exact whitespace differs
    pattern = r'// 2\. Evolu[çc][ãa]o Temporal\s+if \(state\.charts\.evolution\) \{[\s\S]*?state\.charts\.evolution\.update\(\);\s+\}'
    js = re.sub(pattern, new_ts_block, js, count=1)

# Add initEvolutionFilter
init_evo_fn = '''
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
                updateChartsAndVisuals();
            });
        });
    }
'''

if 'function initEvolutionFilter()' not in js:
    # Insert right before initPowerUserShortcuts or at end of file
    target = 'function initPowerUserShortcuts()'
    if target in js:
        js = js.replace(target, init_evo_fn + '\n    ' + target)
    else:
        js = js + init_evo_fn

# Call initEvolutionFilter on DOMContentLoaded
if 'initEvolutionFilter();' not in js:
    js = js.replace('initCharts();', 'initCharts();\n        initEvolutionFilter();')

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js)
print('[JS] Updated canteirizacao dashboard.js')
