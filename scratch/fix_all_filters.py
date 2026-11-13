import os, re

# Configuração de cada módulo: (pasta, função_de_filtro, função_de_mapa)
modules_config = [
    {
        'folder': 'qualidade_muda',
        'apply_fn': 'applyFiltersAndRender',
        'map_fn': 'renderMapMarkers',
        'data_key': 'state.filteredRecords'
    },
    {
        'folder': 'viabilidade_gemas',
        'apply_fn': 'applyFiltersAndRender',
        'map_fn': 'renderMapMarkers',
        'data_key': 'state.filteredRecords'
    },
    {
        'folder': 'qualidade_cana',
        'apply_fn': 'applyFiltersAndRender',
        'map_fn': 'renderMapMarkers',
        'data_key': 'state.filteredRecords'
    },
    {
        'folder': 'cobricao',
        'apply_fn': 'applyFilters',
        'map_fn': '() => { const mapRecords = state.mapSyncWithGlobal ? state.filteredData : getRecordsForDateRange(state.filteredData, state.mapRange); updateMap(mapRecords); }',
        'data_key': 'state.filteredData'
    },
    {
        'folder': 'dosagem_cobricao',
        'apply_fn': 'applyFilters',
        'map_fn': '() => { const mapRecords = state.mapSyncWithGlobal ? state.filteredData : getRecordsForDateRange(state.filteredData, state.mapRange); updateMap(mapRecords); }',
        'data_key': 'state.filteredData'
    },
    {
        'folder': 'arremate_acabamento',
        'apply_fn': 'applyFilters',
        'map_fn': '() => { const mapRecords = state.mapSyncWithGlobal ? state.filteredData : getRecordsForDateRange(state.filteredData, state.mapRange); updateMap(mapRecords); }',
        'data_key': 'state.filteredData'
    },
    {
        'folder': 'herbicida',
        'apply_fn': 'applyFilters',
        'map_fn': 'updateMapMarkers',
        'data_key': 'state.filteredRecords'
    },
    {
        'folder': 'broca_armadilha',
        'apply_fn': 'applyFilters',
        'map_fn': 'updateMapMarkers',
        'data_key': 'state.filteredRecords'
    }
]

for cfg in modules_config:
    folder = cfg['folder']
    apply_fn = cfg['apply_fn']
    map_fn = cfg['map_fn']
    data_key = cfg['data_key']
    
    js_path = f"DashBoard/{folder}/js/dashboard.js"
    print(f"=== Corrigindo {folder} ===")
    
    with open(js_path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. Garantir campos no state
    if "syncWithGlobalFilter: true" not in code:
        code = re.sub(
            r"(const state = \{[\s\S]*?filters: \{|const state = \{[\s\S]*?activeFilters: \{)",
            r"const state = {\n        evolutionRange: '7D',\n        syncWithGlobalFilter: true,\n        mapSyncWithGlobal: true,\n        mapRange: '7D',\n        filters: {",
            code,
            count=1
        )
        print(f"[{folder}] Inserido state")

    # 2. Remover implementações antigas de initEvolutionFilter e initMapFilter
    # Substituir qualquer function initEvolutionFilter antiga
    code = re.sub(r'function initEvolutionFilter\(\)\s*\{[\s\S]*?\n    \}', '/* old initEvolutionFilter removed */', code)
    code = re.sub(r'function initMapFilter\(\)\s*\{[\s\S]*?\n    \}', '/* old initMapFilter removed */', code)
    code = re.sub(r'function getRecordsForDateRange\([^\)]*\)\s*\{[\s\S]*?\n    \}', '/* old getRecordsForDateRange removed */', code)

    # 3. Remover chamadas duplicadas de initEvolutionFilter() dentro de listeners de filtros
    # Ex: initEvolutionFilter(); dentro de setQuickPeriod ou checkboxes
    code = code.replace('initEvolutionFilter();\n        applyFiltersAndRender();', 'applyFiltersAndRender();')
    code = code.replace('initEvolutionFilter();\n        applyFilters();', 'applyFilters();')

    # 4. Construir bloco padrão definitivo
    map_call = f"{map_fn}();" if not map_fn.startswith('()') else f"({map_fn})();"
    
    filters_block = f'''
    /**
     * Função Utilitária para Recorte por Dias Distintos em Modo Autônomo
     */
    function getRecordsForDateRange(records, range) {{
        if (!range || range === 'ALL' || !records || records.length === 0) return records;
        const daysSet = new Set();
        records.forEach(r => {{
            const d = r.dataBR || r.data_dia || (r.dataStr ? r.dataStr.split(' ')[0] : '') || (r.data ? String(r.data).split(' ')[0] : '');
            if (d && d.includes('/')) daysSet.add(d);
        }});

        const sortedDays = Array.from(daysSet).sort((a, b) => {{
            const pA = a.split('/');
            const pB = b.split('/');
            if (pA.length === 3 && pB.length === 3) {{
                return new Date(pA[2], pA[1] - 1, pA[0]) - new Date(pB[2], pB[1] - 1, pB[0]);
            }}
            return a.localeCompare(b);
        }});

        const count = range === '7D' ? 7 : (range === '15D' ? 15 : sortedDays.length);
        const targetDays = new Set(sortedDays.slice(-count));

        return records.filter(r => {{
            const d = r.dataBR || r.data_dia || (r.dataStr ? r.dataStr.split(' ')[0] : '') || (r.data ? String(r.data).split(' ')[0] : '');
            return targetDays.has(d);
        }});
    }}

    function initEvolutionFilter() {{
        const btnSync = document.getElementById('btnSyncGlobalFilter');
        const syncIcon = document.getElementById('syncIcon');
        const syncText = document.getElementById('syncText');
        const evoButtons = document.querySelectorAll('.btn-evo-filter');

        function updateEvoControlsUI() {{
            if (btnSync) {{
                if (state.syncWithGlobalFilter) {{
                    btnSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm";
                    if (syncIcon) syncIcon.innerText = "🔒";
                    if (syncText) syncText.innerText = "Filtro Global Ativo";
                    btnSync.title = "Os gráficos analíticos obedecem ao Filtro Principal do topo. Clique para destravar o modo autônomo.";
                }} else {{
                    btnSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white border-slate-300 dark:border-slate-700 hover:border-emerald-500";
                    if (syncIcon) syncIcon.innerText = "🔓";
                    if (syncText) syncText.innerText = "Filtro Autônomo";
                    btnSync.title = `Modo autônomo ativo (${{state.evolutionRange}}). Clique para travar novamente com o Filtro Global.`;
                }}
            }}

            evoButtons.forEach(btn => {{
                const range = btn.getAttribute('data-evo-range') || '7D';
                if (state.syncWithGlobalFilter) {{
                    btn.disabled = true;
                    btn.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                    btn.classList.remove('cursor-pointer');
                }} else {{
                    btn.disabled = false;
                    btn.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                    btn.classList.add('cursor-pointer');
                    if (range === state.evolutionRange) {{
                        btn.classList.add('active', 'bg-emerald-600', 'shadow-xs', 'text-white');
                        btn.classList.remove('text-slate-700', 'hover:text-emerald-500', 'text-[var(--text-secondary)]');
                    }} else {{
                        btn.classList.remove('active', 'bg-emerald-600', 'shadow-xs', 'text-white');
                        btn.classList.add('text-slate-700', 'dark:text-white', 'hover:text-emerald-500');
                    }}
                }}
            }});
        }}

        if (btnSync && !btnSync._listenerAttached) {{
            btnSync._listenerAttached = true;
            btnSync.addEventListener('click', () => {{
                state.syncWithGlobalFilter = !state.syncWithGlobalFilter;
                updateEvoControlsUI();
                if (typeof {apply_fn} === 'function') {apply_fn}();
            }});
        }}

        evoButtons.forEach(btn => {{
            if (!btn._listenerAttached) {{
                btn._listenerAttached = true;
                btn.addEventListener('click', () => {{
                    if (state.syncWithGlobalFilter) return;
                    state.evolutionRange = btn.getAttribute('data-evo-range') || '7D';
                    updateEvoControlsUI();
                    if (typeof {apply_fn} === 'function') {apply_fn}();
                }});
            }}
        }});

        updateEvoControlsUI();
    }}

    function initMapFilter() {{
        const btnMapSync = document.getElementById('btnToggleMapSyncFilter');
        const mapSyncIcon = document.getElementById('mapSyncIcon');
        const mapSyncText = document.getElementById('mapSyncText');
        const mapButtons = document.querySelectorAll('.btn-map-filter');

        function updateMapControlsUI() {{
            if (btnMapSync) {{
                if (state.mapSyncWithGlobal) {{
                    btnMapSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm";
                    if (mapSyncIcon) mapSyncIcon.innerText = "🔒";
                    if (mapSyncText) mapSyncText.innerText = "Filtro Global Ativo";
                    btnMapSync.title = "O mapa obedece ao Filtro Principal do topo. Clique para destravar o modo autônomo do mapa.";
                }} else {{
                    btnMapSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white border-slate-300 dark:border-slate-700 hover:border-emerald-500";
                    if (mapSyncIcon) mapSyncIcon.innerText = "🔓";
                    if (mapSyncText) mapSyncText.innerText = "Filtro Autônomo";
                    btnMapSync.title = `Modo autônomo do mapa ativo (${{state.mapRange}}). Clique para travar novamente com o Filtro Global.`;
                }}
            }}

            mapButtons.forEach(btn => {{
                const range = btn.getAttribute('data-map-range') || '7D';
                if (state.mapSyncWithGlobal) {{
                    btn.disabled = true;
                    btn.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                    btn.classList.remove('cursor-pointer');
                }} else {{
                    btn.disabled = false;
                    btn.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                    btn.classList.add('cursor-pointer');
                    if (range === state.mapRange) {{
                        btn.classList.add('active', 'bg-emerald-600', 'shadow-xs', 'text-white');
                        btn.classList.remove('text-slate-700', 'hover:text-emerald-500', 'text-[var(--text-secondary)]');
                    }} else {{
                        btn.classList.remove('active', 'bg-emerald-600', 'shadow-xs', 'text-white');
                        btn.classList.add('text-slate-700', 'dark:text-white', 'hover:text-emerald-500');
                    }}
                }}
            }});
        }}

        if (btnMapSync && !btnMapSync._listenerAttached) {{
            btnMapSync._listenerAttached = true;
            btnMapSync.addEventListener('click', () => {{
                state.mapSyncWithGlobal = !state.mapSyncWithGlobal;
                updateMapControlsUI();
                {map_call}
            }});
        }}

        mapButtons.forEach(btn => {{
            if (!btn._listenerAttached) {{
                btn._listenerAttached = true;
                btn.addEventListener('click', () => {{
                    if (state.mapSyncWithGlobal) return;
                    state.mapRange = btn.getAttribute('data-map-range') || '7D';
                    updateMapControlsUI();
                    {map_call}
                }});
            }}
        }});

        updateMapControlsUI();
    }}
'''

    # Inserir antes de function applyFilters ou antes do fechamento
    if 'function applyFilters' in code:
        code = code.replace('function applyFilters', filters_block + '\n    function applyFilters', 1)
    elif 'function applyFiltersAndRender' in code:
        code = code.replace('function applyFiltersAndRender', filters_block + '\n    function applyFiltersAndRender', 1)
    else:
        # Inserir antes do })(); final
        code = code.replace('})();', filters_block + '\n})();', 1)

    # Garantir que initEvolutionFilter() e initMapFilter() sejam chamados na inicialização
    if 'initEvolutionFilter();' not in code:
        if '_bootstrapApp()' in code or 'function _bootstrapApp()' in code:
            code = code.replace('initCharts();', 'initCharts();\n        initEvolutionFilter();\n        initMapFilter();', 1)
        elif 'initEventListeners();' in code:
            code = code.replace('initEventListeners();', 'initEventListeners();\n        initEvolutionFilter();\n        initMapFilter();', 1)

    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"[{folder}] Atualizado com sucesso!\n")
