import os, re

# Dashboards com arquitetura padrão de timeSeries (canteirizacao, subsolagem, sulcacao, abertura_asa, paralelismo, dosagem_sulco)
standard_dashboards = ['subsolagem', 'sulcacao', 'abertura_asa', 'paralelismo', 'dosagem_sulco']

buttons_html = '''<div class="inline-flex p-0.5 rounded-lg border text-xs font-semibold shadow-sm" style="background: var(--bg-kpi); border-color: var(--border-color);">
                            <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-white bg-emerald-600 shadow-sm" data-evo-range="ALL" title="Exibir todo o histórico de dias">Todos</button>
                            <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-[var(--text-secondary)] hover:text-emerald-500" data-evo-range="15D" title="Últimos 15 dias com medições">15D</button>
                            <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-[var(--text-secondary)] hover:text-emerald-500" data-evo-range="7D" title="Últimos 7 dias com medições">7D</button>
                        </div>'''

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
                if (typeof updateChartsAndVisuals === 'function') {
                    updateChartsAndVisuals();
                } else if (typeof applyFiltersAndRender === 'function') {
                    applyFiltersAndRender();
                } else if (typeof updateEvolutionChart === 'function') {
                    updateEvolutionChart();
                }
            });
        });
    }
'''

for d in standard_dashboards:
    html_path = f'DashBoard/{d}/index.html'
    js_path = f'DashBoard/{d}/js/dashboard.js'

    if os.path.exists(html_path):
        with open(html_path, 'r', encoding='utf-8') as f:
            html = f.read()

        html = html.replace('max-w-[1600px]', 'w-full max-w-[1920px]')
        html = re.sub(r'grid-cols-2\s+sm:grid-cols-5\s+lg:grid-cols-10', 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 min-[2200px]:grid-cols-10', html)

        if 'btn-evo-filter' not in html:
            # Insere os botões antes da legenda de Min/Max
            pattern = r'(<div class="flex items-center gap-2 text-xs font-mono">)'
            html = re.sub(pattern, buttons_html + r'\n                        \1', html, count=1)

        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f'[HTML] Updated {d}')

    if os.path.exists(js_path):
        with open(js_path, 'r', encoding='utf-8') as f:
            js = f.read()

        # Adiciona evolutionRange no state
        if 'evolutionRange:' not in js:
            js = re.sub(r'(activePeriod:\s*[\'"][^\'"]+[\'"],?)', r"\1\n        evolutionRange: 'ALL',", js)
            if 'evolutionRange:' not in js:
                js = re.sub(r'(filters:\s*\{)', r"evolutionRange: 'ALL',\n        \1", js)

        # Atualiza a renderização da timeSeries no evolution chart
        if d == 'subsolagem':
            old_pattern = r'if\s*\(state\.charts\.evolution\)\s*\{[\s\S]*?state\.charts\.evolution\.update\(\);'
            new_subsolagem_update = '''if (state.charts.evolution) {
            let labels = timeSeries.labels;
            let medias = timeSeries.medias;
            let minLine = timeSeries.targetMinLine;
            let maxLine = timeSeries.targetMaxLine;

            if (state.evolutionRange === '7D' && labels.length > 7) {
                labels = labels.slice(-7);
                medias = medias.slice(-7);
                minLine = minLine.slice(-7);
                maxLine = maxLine.slice(-7);
            } else if (state.evolutionRange === '15D' && labels.length > 15) {
                labels = labels.slice(-15);
                medias = medias.slice(-15);
                minLine = minLine.slice(-15);
                maxLine = maxLine.slice(-15);
            }

            state.charts.evolution.data.labels = labels;
            state.charts.evolution.data.datasets[0].data = medias;
            state.charts.evolution.data.datasets[1].data = minLine;
            state.charts.evolution.data.datasets[2].data = maxLine;
            state.charts.evolution.update();'''
            js = re.sub(old_pattern, new_subsolagem_update, js, count=1)
        else:
            old_pattern = r'if\s*\(state\.charts\.evolution\)\s*\{[\s\S]*?state\.charts\.evolution\.update\(\);\s*\}'
            new_std_update = '''if (state.charts.evolution) {
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
            js = re.sub(old_pattern, new_std_update, js, count=1)

        # Adiciona initEvolutionFilter
        if 'function initEvolutionFilter()' not in js:
            target = 'function initPowerUserShortcuts()'
            if target in js:
                js = js.replace(target, init_evo_fn + '\n    ' + target)
            else:
                js += init_evo_fn

        if 'initEvolutionFilter();' not in js:
            js = js.replace('initCharts();', 'initCharts();\n        initEvolutionFilter();')

        with open(js_path, 'w', encoding='utf-8') as f:
            f.write(js)
        print(f'[JS] Updated {d}')

print('Standard dashboards updated!')
