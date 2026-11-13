import os
import re

targets = ['sulcacao', 'abertura_asa', 'paralelismo', 'dosagem_sulco']

btn_sync_html = """                        <div class="flex items-center gap-2 flex-wrap">
                            <!-- Botão de Sincronização com Filtro Global do Topo -->
                            <button type="button" id="btnSyncGlobalFilter" class="px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm" title="Quando ativo, este gráfico e as análises obedecem ao Filtro Principal do topo. Clique para alternar para modo autônomo.">
                                <span id="syncIcon">🔒</span>
                                <span id="syncText">Filtro Global Ativo</span>
                            </button>

                            <!-- Botões de Período Local: Todos, 15D, 7D (Padrão 7D) -->
                            <div id="evoPeriodControls" class="inline-flex p-0.5 rounded-lg border text-xs font-semibold shadow-xs" style="background: var(--bg-kpi); border-color: var(--border-color);">
                                <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-slate-700 dark:text-white hover:text-emerald-500 opacity-40 cursor-not-allowed pointer-events-none" data-evo-range="ALL" disabled title="Exibir todo o histórico da safra">Todos</button>
                                <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-slate-700 dark:text-white hover:text-emerald-500 opacity-40 cursor-not-allowed pointer-events-none" data-evo-range="15D" disabled title="Últimos 15 dias com medições">15D</button>
                                <button type="button" class="btn-evo-filter active px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-white bg-emerald-600 shadow-xs opacity-40 cursor-not-allowed pointer-events-none" data-evo-range="7D" disabled title="Últimos 7 dias com medições (Padrão)">7D</button>
                            </div>
                        </div>"""

map_header_html = """                <div class="flex items-center gap-3 text-xs font-mono flex-wrap">
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

                    <div class="flex items-center gap-2 border-l pl-3 ml-1" style="border-color: var(--border-color);">
                        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-emerald-500"></span> Na Meta</span>
                        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-amber-500"></span> Abaixo</span>
                        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-purple-500"></span> Acima</span>
                        <span class="px-2 py-0.5 rounded bg-[var(--bg-page)] border text-[11px]" id="mapPointsCount">0 pontos plotados</span>
                    </div>
                </div>"""

date_helper_js = """    /**
     * Função Utilitária para Recorte por Dias Distintos em Modo Autônomo
     */
    function getRecordsForDateRange(records, range) {
        if (!range || range === 'ALL' || !records || records.length === 0) return records;
        const daysSet = new Set();
        records.forEach(r => {
            const d = r.dataBR || (r.dataStr ? r.dataStr.split(' ')[0] : '') || (r.data_dia || '');
            if (d) daysSet.add(d);
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
            const d = r.dataBR || (r.dataStr ? r.dataStr.split(' ')[0] : '') || (r.data_dia || '');
            return targetDays.has(d);
        });
    }"""

filters_js = """    // Filtros Rápidos da Evolução Temporal (Todos, 15D, 7D) e Vínculo com Topo
    function initEvolutionFilter() {
        const btnSync = document.getElementById('btnSyncGlobalFilter') || document.getElementById('btnToggleSyncFilter');
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

        if (btnSync) {
            btnSync.addEventListener('click', () => {
                state.syncWithGlobalFilter = !state.syncWithGlobalFilter;
                updateEvoControlsUI();
                updateChartsAndVisuals();
            });
        }

        evoButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (state.syncWithGlobalFilter) return;
                state.evolutionRange = btn.getAttribute('data-evo-range') || '7D';
                updateEvoControlsUI();
                updateChartsAndVisuals();
            });
        });

        updateEvoControlsUI();
    }

    // Controle do Filtro Autônomo do Mapa (Geolocalização das Medições em Campo)
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

        if (btnMapSync) {
            btnMapSync.addEventListener('click', () => {
                state.mapSyncWithGlobal = !state.mapSyncWithGlobal;
                updateMapControlsUI();
                updateMap();
            });
        }

        mapButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (state.mapSyncWithGlobal) return;
                state.mapRange = btn.getAttribute('data-map-range') || '7D';
                updateMapControlsUI();
                updateMap();
            });
        });

        updateMapControlsUI();
    }"""

for t in targets:
    html_file = f'DashBoard/{t}/index.html'
    js_file = f'DashBoard/{t}/js/dashboard.js'
    
    with open(html_file, 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Patch HTML: Substituir o bloco da evolução temporal com o botão de sync
    # Padrão: div com class que contém btn-evo-filter
    html = re.sub(
        r'<div class="inline-flex p-0\.5 rounded-lg border text-xs font-semibold shadow-xs"[^>]*>[\s\S]*?</div>\s*</div>\s*<div class="flex items-center gap-2 text-xs font-mono">',
        btn_sync_html + '\n                        </div>\n                        <div class="flex items-center gap-2 text-xs font-mono">',
        html
    )

    # 2. Patch HTML: Substituir cabeçalho do mapa
    html = re.sub(
        r'<div class="flex items-center gap-3 text-xs font-mono flex-wrap">[\s\S]*?</div>\s*</div>\s*<div id="(?:mapSubsolagem|mapDosagem|mapContainer)"',
        map_header_html + '\n            </div>\n\n            <div id="mapContainer"',
        html
    )

    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"Patched HTML: {t}")

    # Patch JS
    with open(js_file, 'r', encoding='utf-8') as f:
        js = f.read()

    # 3. Patch state no JS
    js = re.sub(
        r'evolutionRange:\s*[\'"][^\'"]*[\'"],\s*syncWithGlobalFilter:\s*(?:true|false),',
        "evolutionRange: '7D',\n        syncWithGlobalFilter: true,\n        mapSyncWithGlobal: true,\n        mapRange: '7D',",
        js
    )

    # 4. Inserir getRecordsForDateRange se não existir
    if 'function getRecordsForDateRange' not in js:
        js = re.sub(
            r'(window\.state\s*=\s*state;)',
            r'\1\n\n' + date_helper_js,
            js
        )

    # 5. Em _bootstrapApp: chamar initMapFilter()
    if 'initMapFilter();' not in js:
        js = re.sub(
            r'(initMap\(\);)',
            r'\1\n        initMapFilter();',
            js
        )

    # 6. Em updateChartsAndVisuals: usar chartRecords
    js = re.sub(
        r'function updateChartsAndVisuals\(\)\s*\{[\s\n]*const m = [^;]*calculateMetrics\(state\.filteredRecords,',
        """function updateChartsAndVisuals() {
        const chartRecords = state.syncWithGlobalFilter
            ? state.filteredRecords
            : getRecordsForDateRange(state.filteredRecords, state.evolutionRange);

        const m = window.""" + (re.findall(r'window\.([A-Za-z0-9_]+Engine)', js)[0] if re.findall(r'window\.([A-Za-z0-9_]+Engine)', js) else 'Engine') + """.calculateMetrics(chartRecords,""",
        js
    )
    # E substituir as outras 3 chamadas para usar chartRecords
    js = re.sub(r'calculateTimeSeries\(state\.filteredRecords\)', 'calculateTimeSeries(chartRecords)', js)
    js = re.sub(r'calculateHistogram\(state\.filteredRecords\)', 'calculateHistogram(chartRecords)', js)
    js = re.sub(r'calculateFrenteBreakdown\(state\.filteredRecords\)', 'calculateFrenteBreakdown(chartRecords)', js)

    # 7. Em initMap: buscar mapContainer ou mapSubsolagem ou mapDosagem
    js = re.sub(
        r'const mapContainer = document\.getElementById\([\'"][^\'"]*[\'"]\);',
        "const mapContainer = document.getElementById('mapContainer') || document.getElementById('mapSubsolagem') || document.getElementById('mapDosagem');",
        js
    )
    js = re.sub(
        r'state\.map\s*=\s*L\.map\([^\,]*\,',
        "state.map = L.map(mapContainer, ",
        js
    )

    # 8. Em updateMap: usar mapRecords
    js = re.sub(
        r'function updateMap\(\)\s*\{[\s\n]*if \(!state\.map \|\| !state\.markersLayer\) return;\s*state\.markersLayer\.clearLayers\(\);\s*const validCoords = state\.filteredRecords\.filter\(r => r\.hasValidCoords\);',
        """function updateMap() {
        if (!state.map || !state.markersLayer) return;
        state.markersLayer.clearLayers();

        const mapRecords = state.mapSyncWithGlobal
            ? state.filteredRecords
            : getRecordsForDateRange(state.filteredRecords, state.mapRange);

        const validCoords = mapRecords.filter(r => r.hasValidCoords);""",
        js
    )

    # 9. Substituir initEvolutionFilter pelo bloco completo com initMapFilter
    js = re.sub(
        r'function initEvolutionFilter\(\)\s*\{[\s\S]*?\}\s*function initPowerUserShortcuts',
        filters_js + '\n\n    function initPowerUserShortcuts',
        js
    )

    with open(js_file, 'w', encoding='utf-8') as f:
        f.write(js)
    print(f"Patched JS: {t}")
