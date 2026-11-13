import os, re

def patch_area_vivencia():
    folder = 'area_vivencia'
    print(f"--- Patching {folder} ---")
    html_path = f"DashBoard/{folder}/index.html"
    js_path = f"DashBoard/{folder}/js/dashboard.js"
    
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Botão de Sync dos Gráficos Analíticos (no Donut de Distribuição de Conformidade)
    # L717-724
    old_donut_header = '''                    <div class="flex items-center justify-between gap-4 mb-3 pb-3 border-b"
                         style="border-color: var(--border-color);">
                        <div>
                            <h2 class="text-sm font-bold tracking-tight text-[var(--text-primary)]">Distribuição de Conformidade</h2>
                            <p class="text-[11px] text-[var(--text-secondary)] mt-0.5" id="donutSubtitle">Classificação de qualidade operacional</p>
                        </div>
                        <span class="text-xs text-[var(--text-muted)] font-mono font-semibold" id="donutScopeBadge">% da safra</span>
                    </div>'''

    new_donut_header = '''                    <div class="flex items-center justify-between gap-4 mb-3 pb-3 border-b flex-wrap"
                         style="border-color: var(--border-color);">
                        <div>
                            <h2 class="text-sm font-bold tracking-tight text-[var(--text-primary)]">Distribuição de Conformidade</h2>
                            <p class="text-[11px] text-[var(--text-secondary)] mt-0.5" id="donutSubtitle">Classificação de qualidade operacional</p>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
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
                        </div>
                    </div>'''

    if 'btnSyncGlobalFilter' not in html and old_donut_header in html:
        html = html.replace(old_donut_header, new_donut_header, 1)
        print(f"[{folder}] Inserido btnSyncGlobalFilter no Donut")

    # Botão de Sync no Mapa
    # L846: <div class="flex items-center gap-3 text-xs">
    old_map_header = '''                <div class="flex items-center gap-3 text-xs">
                    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Conforme</span>
                    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Atenção</span>
                    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Não Conforme</span>
                </div>'''

    new_map_header = '''                <div class="flex items-center gap-3 text-xs flex-wrap">
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
                    </div>

                    <div class="flex items-center gap-3 text-xs border-l pl-3 ml-1" style="border-color: var(--border-color);">
                        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Conforme</span>
                        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Atenção</span>
                        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Não Conforme</span>
                    </div>
                </div>'''

    if 'btnToggleMapSyncFilter' not in html and old_map_header in html:
        html = html.replace(old_map_header, new_map_header, 1)
        print(f"[{folder}] Inserido btnToggleMapSyncFilter no Mapa")

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)

    # JS Patch area_vivencia
    with open(js_path, 'r', encoding='utf-8') as f:
        js = f.read()

    # State
    if "syncWithGlobalFilter: true" not in js:
        js = js.replace(
            "activeFilters: {",
            "evolutionRange: '7D',\n        syncWithGlobalFilter: true,\n        mapSyncWithGlobal: true,\n        mapRange: '7D',\n        activeFilters: {",
            1
        )
        print(f"[{folder}] Inseridos campos de sync no state JS")

    # Helpers e Listeners
    helper_code = '''
    function getRecordsForDateRange(records, range) {
        if (!range || range === 'ALL' || !records || records.length === 0) return records;
        const daysSet = new Set();
        records.forEach(r => {
            const d = r.dataBR || r.data_dia || (r.dataStr ? r.dataStr.split(' ')[0] : '') || (r.data ? String(r.data).split(' ')[0] : '');
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
            const d = r.dataBR || r.data_dia || (r.dataStr ? r.dataStr.split(' ')[0] : '') || (r.data ? String(r.data).split(' ')[0] : '');
            return targetDays.has(d);
        });
    }

    function initEvolutionFilter() {
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
                        btn.classList.remove('text-slate-700', 'hover:text-emerald-500');
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
                applyFilters();
            });
        }

        evoButtons.forEach(btn => {
            if (!btn._listenerAttached) {
                btn._listenerAttached = true;
                btn.addEventListener('click', () => {
                    if (state.syncWithGlobalFilter) return;
                    state.evolutionRange = btn.getAttribute('data-evo-range') || '7D';
                    updateEvoControlsUI();
                    applyFilters();
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
                        btn.classList.remove('text-slate-700', 'hover:text-emerald-500');
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
                renderMap();
            });
        }

        mapButtons.forEach(btn => {
            if (!btn._listenerAttached) {
                btn._listenerAttached = true;
                btn.addEventListener('click', () => {
                    if (state.mapSyncWithGlobal) return;
                    state.mapRange = btn.getAttribute('data-map-range') || '7D';
                    updateMapControlsUI();
                    renderMap();
                });
            }
        });

        updateMapControlsUI();
    }
'''
    if 'function getRecordsForDateRange' not in js:
        js = js.replace('function applyFilters()', helper_code + '\n    function applyFilters()', 1)
        print(f"[{folder}] Inseridos helpers e filtros no JS")

    # Inserir chamadas em _bootstrapApp
    if 'initEvolutionFilter();' not in js:
        js = js.replace('initCharts();', 'initCharts();\n        initEvolutionFilter();\n        initMapFilter();', 1)
        print(f"[{folder}] Adicionadas chamadas em _bootstrapApp")

    # Atualizar applyFilters para usar chartRecords nos gráficos
    js = js.replace(
        'renderCharts(metrics, frentes);',
        '''const chartRecords = state.syncWithGlobalFilter
            ? state.filteredRecords
            : getRecordsForDateRange(state.filteredRecords, state.evolutionRange);
        const chartMetrics = AreaVivenciaEngine.calculateMetrics(chartRecords);
        const chartFrentes = AreaVivenciaEngine.groupByFrente(chartRecords);
        renderCharts(chartMetrics, chartFrentes);''',
        1
    )

    # Atualizar renderMap para usar mapRecords
    js = js.replace(
        'const validCoords = state.filteredRecords.filter(r => r.hasValidCoords);',
        '''const mapRecords = state.mapSyncWithGlobal
            ? state.filteredRecords
            : getRecordsForDateRange(state.filteredRecords, state.mapRange);
        const validCoords = mapRecords.filter(r => r.hasValidCoords);''',
        1
    )

    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(js)
    print(f"[{folder}] JS salvo com sucesso!\n")

patch_area_vivencia()
