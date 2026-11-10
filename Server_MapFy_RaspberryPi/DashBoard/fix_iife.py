import re

# 1. Fix subsolagem/js/dashboard.js
sub_path = 'DashBoard/subsolagem/js/dashboard.js'
with open(sub_path, 'r', encoding='utf-8') as f:
    sub_code = f.read()

sub_iife_idx = sub_code.rfind('})();')
if sub_iife_idx != -1 and 'function initEvolutionFilter()' in sub_code[sub_iife_idx:]:
    # Remove initEvolutionFilter from outside IIFE
    sub_code_clean = sub_code[:sub_iife_idx].rstrip()
    evo_func = """
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
"""
    new_sub = sub_code_clean + "\n" + evo_func + "\n})();\n"
    with open(sub_path, 'w', encoding='utf-8') as f:
        f.write(new_sub)
    print("subsolagem fixed!")

# 2. Fix qualidade_cana/js/dashboard.js
qc_path = 'DashBoard/qualidade_cana/js/dashboard.js'
with open(qc_path, 'r', encoding='utf-8') as f:
    qc_code = f.read()

qc_iife_idx = qc_code.rfind('})();')
if qc_iife_idx != -1 and 'function initEvolutionFilter()' in qc_code[qc_iife_idx:]:
    qc_code_clean = qc_code[:qc_iife_idx].rstrip()
    evo_func_qc = """
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
"""
    new_qc = qc_code_clean + "\n" + evo_func_qc + "\n})();\n"
    with open(qc_path, 'w', encoding='utf-8') as f:
        f.write(new_qc)
    print("qualidade_cana fixed!")
