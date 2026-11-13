import os, re

def patch_grupo_1b(folder, engine_name):
    html_path = f"DashBoard/{folder}/index.html"
    js_path = f"DashBoard/{folder}/js/dashboard.js"
    
    print(f"--- Patching {folder} ---")
    
    # 1. HTML Patch
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Botão de Sync da Evolução
    # Procurar onde ficam os botões da evolução
    # <div class="inline-flex p-0.5 rounded-lg border text-xs font-semibold shadow-sm" ...>
    #     <button type="button" class="btn-evo-filter ...
    evo_btn_pattern = r'(<div class="inline-flex p-0\.5 rounded-lg border text-xs font-semibold shadow-sm"[^>]*>[\s\S]*?)(<button type="button" class="btn-evo-filter[^>]*>Todos</button>[\s\S]*?</div>)'
    
    evo_replacement = (
        r'''<div class="flex items-center gap-2 flex-wrap">
                        <!-- Botão de Sincronização com Filtro Global do Topo -->
                        <button id="btnSyncGlobalFilter" type="button"
                                class="px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm"
                                title="Quando ativo, este gráfico e as análises obedecem ao Filtro Principal do topo. Clique para alternar para modo autônomo.">
                            <span id="syncIcon">🔒</span>
                            <span id="syncText">Filtro Global Ativo</span>
                        </button>

                        <!-- Botões de Período Local: Todos, 15D, 7D -->
                        <div id="evoPeriodControls" class="inline-flex p-0.5 rounded-lg border text-xs font-semibold shadow-xs" style="background: var(--bg-kpi); border-color: var(--border-color);">
                            <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-slate-700 dark:text-white hover:text-emerald-500 opacity-40 cursor-not-allowed pointer-events-none" data-evo-range="ALL" disabled title="Exibir todo o histórico da safra">Todos</button>
                            <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-slate-700 dark:text-white hover:text-emerald-500 opacity-40 cursor-not-allowed pointer-events-none" data-evo-range="15D" disabled title="Últimos 15 dias com medições">15D</button>
                            <button type="button" class="btn-evo-filter active px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-white bg-emerald-600 shadow-xs opacity-40 cursor-not-allowed pointer-events-none" data-evo-range="7D" disabled title="Últimos 7 dias com medições (Padrão)">7D</button>
                        </div>
                    </div>'''
    )
    
    if 'btnSyncGlobalFilter' not in html:
        # Substituir os botões da evolução
        subbed, count = re.subn(evo_btn_pattern, evo_replacement, html, count=1)
        if count > 0:
            html = subbed
            print(f"[{folder}] Inserido btnSyncGlobalFilter no HTML")
        else:
            print(f"[{folder}] ATENÇÃO: padrão de botões de evolução não encontrado no HTML")

    # Controles de Mapa no HTML
    # Procurar a legenda do mapa ou botão centralizar
    # <div class="flex items-center gap-3 text-xs flex-wrap">
    map_ctrl_replacement = (
        r'''<div class="flex items-center gap-3 text-xs flex-wrap">
                    <!-- Botão de Sincronização Autônoma do Mapa com Filtro Principal -->
                    <button id="btnToggleMapSyncFilter" type="button"
                            class="px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm"
                            title="Quando ativo, o mapa plota todos os pontos do Filtro Principal do topo. Clique para alternar para modo autônomo.">
                        <span id="mapSyncIcon">🔒</span>
                        <span id="mapSyncText">Filtro Global Ativo</span>
                    </button>

                    <!-- Botões de Período Autônomo do Mapa: Todos, 15D, 7D -->
                    <div id="mapPeriodControls" class="inline-flex p-0.5 rounded-lg border text-xs font-semibold shadow-xs" style="background: var(--bg-kpi); border-color: var(--border-color);">
                        <button type="button" class="btn-map-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-slate-700 dark:text-white hover:text-emerald-500 opacity-40 cursor-not-allowed pointer-events-none" data-map-range="ALL" disabled title="Exibir todo o histórico do mapa">Todos</button>
                        <button type="button" class="btn-map-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-slate-700 dark:text-white hover:text-emerald-500 opacity-40 cursor-not-allowed pointer-events-none" data-map-range="15D" disabled title="Últimos 15 dias com medições">15D</button>
                        <button type="button" class="btn-map-filter active px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-white bg-emerald-600 shadow-xs opacity-40 cursor-not-allowed pointer-events-none" data-map-range="7D" disabled title="Últimos 7 dias com medições">7D</button>
                    </div>\n'''
    )

    if 'btnToggleMapSyncFilter' not in html:
        # Procurar onde inserir antes da legenda do mapa
        # <div class="flex items-center gap-3 text-xs flex-wrap">
        if '<div class="flex items-center gap-3 text-xs flex-wrap">' in html:
            html = html.replace('<div class="flex items-center gap-3 text-xs flex-wrap">', map_ctrl_replacement, 1)
            print(f"[{folder}] Inserido btnToggleMapSyncFilter no HTML")
        elif '<div class="flex items-center gap-3 text-xs">' in html:
            html = html.replace('<div class="flex items-center gap-3 text-xs">', map_ctrl_replacement, 1)
            print(f"[{folder}] Inserido btnToggleMapSyncFilter no HTML")
        else:
            print(f"[{folder}] ATENÇÃO: padrão de container do mapa não encontrado no HTML")

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)

    # 2. JS Patch
    with open(js_path, 'r', encoding='utf-8') as f:
        js = f.read()

    # Inicializar state
    if "syncWithGlobalFilter: true" not in js:
        js = re.sub(
            r"(evolutionRange:\s*['\"][^'\"]*['\"],?)",
            r"evolutionRange: '7D',\n        syncWithGlobalFilter: true,\n        mapSyncWithGlobal: true,\n        mapRange: '7D',",
            js,
            count=1
        )
        print(f"[{folder}] Atualizado state no JS")

    # Inserir getRecordsForDateRange se não existir
    if 'function getRecordsForDateRange' not in js:
        helper_fn = '''
    /**
     * Função Utilitária para Recorte por Dias Distintos em Modo Autônomo
     */
    function getRecordsForDateRange(records, range) {
        if (!range || range === 'ALL' || !records || records.length === 0) return records;
        const daysSet = new Set();
        records.forEach(r => {
            const d = r.data_dia || r.dataBR || (r.dataStr ? r.dataStr.split(' ')[0] : '') || (r.data ? String(r.data).split(' ')[0] : '');
            if (d && d.includes('/')) daysSet.add(d);
        });

        const sortedDays = Array.from(daysSet).sort((a, b) => {
            const pA = a.split('/');
            const pB = b.split('/');
            if (pA.length === 3 && pB.length === 3) {
                return new Date(pA[2], pA[1] - 1, pA[0]) - new Date(pB[2], pB[1] - 1, pB[0]);
            }
            return a.localeCompare(b);
        });

        const count = range === '7D' ? 7 : (range === '15D' ? 15 : sortedDays.length);
        const targetDays = new Set(sortedDays.slice(-count));

        return records.filter(r => {
            const d = r.data_dia || r.dataBR || (r.dataStr ? r.dataStr.split(' ')[0] : '') || (r.data ? String(r.data).split(' ')[0] : '');
            return targetDays.has(d);
        });
    }
'''
        # Inserir antes de initEvolutionFilter
        js = js.replace('function initEvolutionFilter()', helper_fn + '\n    function initEvolutionFilter()', 1)
        print(f"[{folder}] Inserida função getRecordsForDateRange no JS")

    # Atualizar initEvolutionFilter e adicionar initMapFilter
    evo_map_filter_code = '''    function initEvolutionFilter() {
        const btnSync = document.getElementById('btnSyncGlobalFilter');
        const syncIcon = document.getElementById('syncIcon');
        const syncText = document.getElementById('syncText');
        const evoButtons = document.querySelectorAll('.btn-evo-filter');

        function updateEvoControlsUI() {
            if (btnSync) {
                if (state.syncWithGlobalFilter) {
                    btnSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm";
                    if (syncIcon) syncIcon.innerText = "🔒";
                    if (syncText) syncText.innerText = "Filtro Global Ativo";
                    btnSync.title = "Os gráficos analíticos obedecem ao Filtro Principal do topo. Clique para destravar o modo autônomo.";
                } else {
                    btnSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white border-slate-300 dark:border-slate-700 hover:border-emerald-500";
                    if (syncIcon) syncIcon.innerText = "🔓";
                    if (syncText) syncText.innerText = "Filtro Autônomo";
                    btnSync.title = `Modo autônomo ativo (${state.evolutionRange}). Clique para travar novamente com o Filtro Global.`;
                }
            }

            evoButtons.forEach(btn => {
                const range = btn.getAttribute('data-evo-range') || '7D';
                if (state.syncWithGlobalFilter) {
                    btn.disabled = true;
                    btn.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                    btn.classList.remove('cursor-pointer');
                } else {
                    btn.disabled = false;
                    btn.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                    btn.classList.add('cursor-pointer');
                    if (range === state.evolutionRange) {
                        btn.classList.add('active', 'bg-emerald-600', 'shadow-xs', 'text-white');
                        btn.classList.remove('text-slate-700', 'hover:text-emerald-500', 'text-[var(--text-secondary)]');
                    } else {
                        btn.classList.remove('active', 'bg-emerald-600', 'shadow-xs', 'text-white');
                        btn.classList.add('text-slate-700', 'dark:text-white', 'hover:text-emerald-500');
                    }
                }
            });
        }

        if (btnSync && !btnSync._listenerAttached) {
            btnSync._listenerAttached = true;
            btnSync.addEventListener('click', () => {
                state.syncWithGlobalFilter = !state.syncWithGlobalFilter;
                updateEvoControlsUI();
                if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
            });
        }

        evoButtons.forEach(btn => {
            if (!btn._listenerAttached) {
                btn._listenerAttached = true;
                btn.addEventListener('click', () => {
                    if (state.syncWithGlobalFilter) return;
                    state.evolutionRange = btn.getAttribute('data-evo-range') || '7D';
                    updateEvoControlsUI();
                    if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
                });
            }
        });

        updateEvoControlsUI();
    }

    function initMapFilter() {
        const btnMapSync = document.getElementById('btnToggleMapSyncFilter');
        const mapSyncIcon = document.getElementById('mapSyncIcon');
        const mapSyncText = document.getElementById('mapSyncText');
        const mapButtons = document.querySelectorAll('.btn-map-filter');

        function updateMapControlsUI() {
            if (btnMapSync) {
                if (state.mapSyncWithGlobal) {
                    btnMapSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm";
                    if (mapSyncIcon) mapSyncIcon.innerText = "🔒";
                    if (mapSyncText) mapSyncText.innerText = "Filtro Global Ativo";
                    btnMapSync.title = "O mapa obedece ao Filtro Principal do topo. Clique para destravar o modo autônomo do mapa.";
                } else {
                    btnMapSync.className = "px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white border-slate-300 dark:border-slate-700 hover:border-emerald-500";
                    if (mapSyncIcon) mapSyncIcon.innerText = "🔓";
                    if (mapSyncText) mapSyncText.innerText = "Filtro Autônomo";
                    btnMapSync.title = `Modo autônomo do mapa ativo (${state.mapRange}). Clique para travar novamente com o Filtro Global.`;
                }
            }

            mapButtons.forEach(btn => {
                const range = btn.getAttribute('data-map-range') || '7D';
                if (state.mapSyncWithGlobal) {
                    btn.disabled = true;
                    btn.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                    btn.classList.remove('cursor-pointer');
                } else {
                    btn.disabled = false;
                    btn.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                    btn.classList.add('cursor-pointer');
                    if (range === state.mapRange) {
                        btn.classList.add('active', 'bg-emerald-600', 'shadow-xs', 'text-white');
                        btn.classList.remove('text-slate-700', 'hover:text-emerald-500', 'text-[var(--text-secondary)]');
                    } else {
                        btn.classList.remove('active', 'bg-emerald-600', 'shadow-xs', 'text-white');
                        btn.classList.add('text-slate-700', 'dark:text-white', 'hover:text-emerald-500');
                    }
                }
            });
        }

        if (btnMapSync && !btnMapSync._listenerAttached) {
            btnMapSync._listenerAttached = true;
            btnMapSync.addEventListener('click', () => {
                state.mapSyncWithGlobal = !state.mapSyncWithGlobal;
                updateMapControlsUI();
                renderMapMarkers();
            });
        }

        mapButtons.forEach(btn => {
            if (!btn._listenerAttached) {
                btn._listenerAttached = true;
                btn.addEventListener('click', () => {
                    if (state.mapSyncWithGlobal) return;
                    state.mapRange = btn.getAttribute('data-map-range') || '7D';
                    updateMapControlsUI();
                    renderMapMarkers();
                });
            }
        });

        updateMapControlsUI();
    }
'''

    # Substituir a função initEvolutionFilter antiga
    old_evo_pattern = r'function initEvolutionFilter\(\)\s*\{[\s\S]*?\}\n(?=\s*(?:function|\(\)))'
    if re.search(old_evo_pattern, js):
        js = re.sub(old_evo_pattern, evo_map_filter_code, js, count=1)
        print(f"[{folder}] Substituída initEvolutionFilter e adicionada initMapFilter")

    # Inserir chamada de initMapFilter em _bootstrapApp
    if 'initMapFilter();' not in js:
        js = js.replace('initEvolutionFilter();', 'initEvolutionFilter();\n        initMapFilter();', 1)
        print(f"[{folder}] Adicionada chamada initMapFilter() em _bootstrapApp")

    # Modificar applyFiltersAndRender para alimentar gráficos com chartRecords
    # Procurar calculateMetrics(state.filteredRecords
    js = js.replace(
        'renderKPICards(m);',
        '''renderKPICards(m);
        const chartRecords = state.syncWithGlobalFilter
            ? state.filteredRecords
            : getRecordsForDateRange(state.filteredRecords, state.evolutionRange);
        const chartMetrics = window.''' + engine_name + '''.calculateMetrics(chartRecords, state.targetConfig || undefined);''',
        1
    )
    # Substituir renderDonutChart(m) por renderDonutChart(chartMetrics)
    js = js.replace('renderDonutChart(m);', 'renderDonutChart(chartMetrics);', 1)

    # Modificar renderMapMarkers para usar mapRecords
    js = js.replace(
        'const records = state.filteredRecords;',
        '''const mapRecords = state.mapSyncWithGlobal
            ? state.filteredRecords
            : getRecordsForDateRange(state.filteredRecords, state.mapRange);
        const records = mapRecords;''',
        1
    )

    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(js)
    print(f"[{folder}] JS gravado com sucesso!\n")

patch_grupo_1b('qualidade_muda', 'QualidadeMudaEngine')
patch_grupo_1b('viabilidade_gemas', 'ViabilidadeGemasEngine')
patch_grupo_1b('qualidade_cana', 'QualidadeCanaEngine')
