# Add initEvolutionFilter to qualidade_muda and viabilidade_gemas

for path in ['DashBoard/qualidade_muda/js/dashboard.js', 'DashBoard/viabilidade_gemas/js/dashboard.js']:
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # Call initEvolutionFilter in DOMContentLoaded if not present
    if 'initEvolutionFilter();' not in code:
        code = code.replace('applyFiltersAndRender();', 'initEvolutionFilter();\n        applyFiltersAndRender();')

    # Define initEvolutionFilter inside IIFE before })();
    if 'function initEvolutionFilter()' not in code:
        iife_pos = code.rfind('})();')
        func = """
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
"""
        code = code[:iife_pos].rstrip() + "\n" + func + "\n})();\n"

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print("Updated:", path)
