import os, re

def patch_grupo_1c(folder, engine_name):
    html_path = f"DashBoard/{folder}/index.html"
    js_path = f"DashBoard/{folder}/js/dashboard.js"
    
    print(f"--- Patching {folder} ---")
    
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. HTML: Inserir btnSyncGlobalFilter e botões no cabeçalho de Evolução (Gráfico C)
    evo_ctrl = '''
                <div class="chart-card-tools" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <!-- Botão de Sincronização com Filtro Global do Topo -->
                    <button id="btnSyncGlobalFilter" type="button"
                            class="px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm"
                            title="Quando ativo, este gráfico e as análises obedecem ao Filtro Principal do topo. Clique para alternar para modo autônomo.">
                        <span id="syncIcon">🔒</span>
                        <span id="syncText">Filtro Global Ativo</span>
                    </button>

                    <!-- Botões de Período Local: Todos, 15D, 7D -->
                    <div id="evoPeriodControls" class="inline-flex p-0.5 rounded-lg border text-xs font-semibold shadow-xs" style="background: var(--bg-kpi, #1e293b); border-color: var(--border-color, rgba(148, 163, 184, 0.2));">
                        <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-slate-700 dark:text-white hover:text-emerald-500 opacity-40 cursor-not-allowed pointer-events-none" data-evo-range="ALL" disabled title="Exibir todo o histórico da safra">Todos</button>
                        <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-slate-700 dark:text-white hover:text-emerald-500 opacity-40 cursor-not-allowed pointer-events-none" data-evo-range="15D" disabled title="Últimos 15 dias com medições">15D</button>
                        <button type="button" class="btn-evo-filter active px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-white bg-emerald-600 shadow-xs opacity-40 cursor-not-allowed pointer-events-none" data-evo-range="7D" disabled title="Últimos 7 dias com medições (Padrão)">7D</button>
                    </div>
'''
    if 'btnSyncGlobalFilter' not in html:
        # Substituir <div class="chart-card-tools"> por nosso container com os botões
        if '<div class="chart-card-tools">' in html:
            html = html.replace('<div class="chart-card-tools">', evo_ctrl, 1)
            print(f"[{folder}] Inserido btnSyncGlobalFilter no HTML")
        elif '<div class="chart-view-toggle" id="timePeriodToggle">' in html:
            html = html.replace('<div class="chart-view-toggle" id="timePeriodToggle">', evo_ctrl + '\n<div class="chart-view-toggle" id="timePeriodToggle">', 1)
            print(f"[{folder}] Inserido btnSyncGlobalFilter antes de timePeriodToggle")

    # 2. HTML: Mapa controles e id
    map_ctrl = '''
            <div class="chart-card-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                <div class="flex items-center gap-2 flex-wrap">
                    <!-- Botão de Sincronização Autônoma do Mapa com Filtro Principal -->
                    <button id="btnToggleMapSyncFilter" type="button"
                            class="px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm"
                            title="Quando ativo, o mapa plota todos os pontos do Filtro Principal do topo. Clique para alternar para modo autônomo.">
                        <span id="mapSyncIcon">🔒</span>
                        <span id="mapSyncText">Filtro Global Ativo</span>
                    </button>

                    <!-- Botões de Período Autônomo do Mapa: Todos, 15D, 7D -->
                    <div id="mapPeriodControls" class="inline-flex p-0.5 rounded-lg border text-xs font-semibold shadow-xs" style="background: var(--bg-kpi, #1e293b); border-color: var(--border-color, rgba(148, 163, 184, 0.2));">
                        <button type="button" class="btn-map-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-slate-700 dark:text-white hover:text-emerald-500 opacity-40 cursor-not-allowed pointer-events-none" data-map-range="ALL" disabled title="Exibir todo o histórico do mapa">Todos</button>
                        <button type="button" class="btn-map-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-slate-700 dark:text-white hover:text-emerald-500 opacity-40 cursor-not-allowed pointer-events-none" data-map-range="15D" disabled title="Últimos 15 dias com medições">15D</button>
                        <button type="button" class="btn-map-filter active px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-white bg-emerald-600 shadow-xs opacity-40 cursor-not-allowed pointer-events-none" data-map-range="7D" disabled title="Últimos 7 dias com medições">7D</button>
                    </div>
                </div>
'''
    if 'btnToggleMapSyncFilter' not in html:
        # Inserir no mapa
        if '<div class="map-card">' in html:
            html = html.replace('<div class="map-card">', '<div class="map-card">\n' + map_ctrl, 1)
            print(f"[{folder}] Inserido btnToggleMapSyncFilter no HTML")
        elif '<div id="map-container"></div>' in html:
            html = html.replace('<div id="map-container"></div>', map_ctrl + '\n<div id="map-container"></div>', 1)
            print(f"[{folder}] Inserido btnToggleMapSyncFilter antes do mapa")

    # Garantir id="mapContainer" no container do mapa além de map-container
    if 'id="map-container"' in html:
        html = html.replace('id="map-container"', 'id="mapContainer"', 1)
        print(f"[{folder}] Padronizado id de map-container para mapContainer")

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)

    # 3. JS Patch
    with open(js_path, 'r', encoding='utf-8') as f:
        js = f.read()

    # Atualizar state
    if "syncWithGlobalFilter: true" not in js:
        # Procurar onde inserir no state
        js = re.sub(
            r"(const state = \{[\s\S]*?filters: \{)",
            r"const state = {\n        evolutionRange: '7D',\n        syncWithGlobalFilter: true,\n        mapSyncWithGlobal: true,\n        mapRange: '7D',\n        filters: {",
            js,
            count=1
        )
        print(f"[{folder}] Inseridos campos de sync no state JS")

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
        # Inserir antes de updateDashboard
        js = js.replace('function updateDashboard()', helper_fn + '\n    function updateDashboard()', 1)
        print(f"[{folder}] Inserida função getRecordsForDateRange no JS")

    # Inserir initEvolutionFilter e initMapFilter
    filters_impl = '''
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
                updateDashboard();
            });
        }

        evoButtons.forEach(btn => {
            if (!btn._listenerAttached) {
                btn._listenerAttached = true;
                btn.addEventListener('click', () => {
                    if (state.syncWithGlobalFilter) return;
                    state.evolutionRange = btn.getAttribute('data-evo-range') || '7D';
                    updateEvoControlsUI();
                    updateDashboard();
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
                const mapRecords = state.mapSyncWithGlobal
                    ? state.filteredData
                    : getRecordsForDateRange(state.filteredData, state.mapRange);
                updateMap(mapRecords);
            });
        }

        mapButtons.forEach(btn => {
            if (!btn._listenerAttached) {
                btn._listenerAttached = true;
                btn.addEventListener('click', () => {
                    if (state.mapSyncWithGlobal) return;
                    state.mapRange = btn.getAttribute('data-map-range') || '7D';
                    updateMapControlsUI();
                    const mapRecords = state.mapSyncWithGlobal
                        ? state.filteredData
                        : getRecordsForDateRange(state.filteredData, state.mapRange);
                    updateMap(mapRecords);
                });
            }
        });

        updateMapControlsUI();
    }
'''
    if 'function initEvolutionFilter' not in js:
        # Inserir antes de initEventListeners
        js = js.replace('function initEventListeners()', filters_impl + '\n    function initEventListeners()', 1)
        print(f"[{folder}] Inseridas funções initEvolutionFilter e initMapFilter")

    # Chamar initEvolutionFilter e initMapFilter em initEventListeners
    if 'initEvolutionFilter();' not in js:
        js = js.replace('function initEventListeners() {', 'function initEventListeners() {\n        initEvolutionFilter();\n        initMapFilter();', 1)
        print(f"[{folder}] Adicionadas chamadas em initEventListeners")

    # Ajustar updateDashboard para usar chartRecords e mapRecords
    js = js.replace(
        'updateMap(state.filteredData);',
        '''const mapRecords = state.mapSyncWithGlobal
            ? state.filteredData
            : getRecordsForDateRange(state.filteredData, state.mapRange);
        updateMap(mapRecords);''',
        1
    )

    # Permitir que updateCharts use chartRecords
    js = js.replace(
        'function updateCharts() {',
        '''function updateCharts(customRecords) {
        const recordsToUse = customRecords || (state.syncWithGlobalFilter
            ? state.filteredData
            : getRecordsForDateRange(state.filteredData, state.evolutionRange));''',
        1
    )

    # Garantir suporte a mapContainer além de map-container em initMap
    js = js.replace(
        "document.getElementById('map-container')",
        "document.getElementById('mapContainer') || document.getElementById('map-container')",
        1
    )

    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(js)
    print(f"[{folder}] JS salvo com sucesso!\n")

patch_grupo_1c('cobricao', 'CobricaoEngine')
patch_grupo_1c('dosagem_cobricao', 'DosagemCobricaoEngine')
patch_grupo_1c('arremate_acabamento', 'ArremateAcabamentoEngine')
