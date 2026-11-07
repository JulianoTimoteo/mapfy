with open('DashBoard/common/js/fullscreen_inspector.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Add calls to initAllControls and refreshEnhancements
old_init_calls = """        try { setupTimelineQuickFilters(); } catch (e) { console.warn('[Pitangueiras] setupTimelineQuickFilters error:', e); }
        try { setupUniversalItemInfoSystem(); } catch (e) { console.warn('[Pitangueiras] setupUniversalItemInfoSystem error:', e); }"""

new_init_calls = """        try { setupTimelineQuickFilters(); } catch (e) { console.warn('[Pitangueiras] setupTimelineQuickFilters error:', e); }
        try { setupUniversalTimelineTooltips(); } catch (e) { console.warn('[Pitangueiras] setupUniversalTimelineTooltips error:', e); }
        try { setupUniversalTableFilterClearButtons(); } catch (e) { console.warn('[Pitangueiras] setupUniversalTableFilterClearButtons error:', e); }
        try { setupUniversalItemInfoSystem(); } catch (e) { console.warn('[Pitangueiras] setupUniversalItemInfoSystem error:', e); }"""

old_refresh_calls = """        try { setupTimelineQuickFilters(); } catch (e) { console.warn(e); }
        try { setupUniversalItemInfoSystem(); } catch (e) { console.warn(e); }"""

new_refresh_calls = """        try { setupTimelineQuickFilters(); } catch (e) { console.warn(e); }
        try { setupUniversalTimelineTooltips(); } catch (e) { console.warn(e); }
        try { setupUniversalTableFilterClearButtons(); } catch (e) { console.warn(e); }
        try { setupUniversalItemInfoSystem(); } catch (e) { console.warn(e); }"""

code = code.replace(old_init_calls, new_init_calls)
code = code.replace(old_refresh_calls, new_refresh_calls)

# New functions implementations to be placed before the Knowledge Base section
target_anchor = "    // =========================================================================" + "\n" + "    // 8. DICIONÁRIO COMPLETO DE METADADOS & CONHECIMENTO DOS INDICADORES"

new_functions = """    // =========================================================================
    // 7.1 TOOLTIP ENRIQUECIDO UNIVERSAL PARA EVOLUÇÃO TEMPORAL (OS, FRENTE, TALHÃO)
    // =========================================================================
    function setupUniversalTimelineTooltips() {
        if (typeof Chart === 'undefined') return;
        const timelineCanvases = document.querySelectorAll(
            'canvas[id*="Evolution"], canvas[id*="Timeline"], canvas[id*="temporal"], canvas[id*="Evolucao"], canvas[id*="timeline"]'
        );

        timelineCanvases.forEach(canvas => {
            const chart = Chart.getChart ? Chart.getChart(canvas) : null;
            if (!chart || !chart.options) return;
            if (chart._pitangueiras_tooltip_calibrated) return;
            chart._pitangueiras_tooltip_calibrated = true;

            if (!chart.options.plugins) chart.options.plugins = {};
            if (!chart.options.plugins.tooltip) chart.options.plugins.tooltip = {};
            const tt = chart.options.plugins.tooltip;
            if (!tt.callbacks) tt.callbacks = {};

            const origAfterBody = tt.callbacks.afterBody;

            tt.callbacks.afterBody = function(tooltipItems) {
                let existingLines = [];
                if (typeof origAfterBody === 'function') {
                    try {
                        const res = origAfterBody.call(this, tooltipItems);
                        if (Array.isArray(res)) existingLines = res;
                        else if (typeof res === 'string') existingLines = [res];
                    } catch (e) {}
                }

                // Se o chart já tiver linhas ricas de OS ou Frente, preserva
                const hasOS = existingLines.some(l => typeof l === 'string' && (l.includes('OS') || l.includes('Frente')));
                if (hasOS) return existingLines;

                if (!tooltipItems || tooltipItems.length === 0) return existingLines;
                const item = tooltipItems[0];
                const dateLabel = (item.label || item.name || '').trim();
                if (!dateLabel) return existingLines;

                // Tenta extrair registros da base ativa do dashboard
                const records = (window.state && window.state.filteredRecords) 
                             || (window.state && window.state.allRecords)
                             || (window.dashboardState && window.dashboardState.filteredRecords)
                             || (window.dashboardState && window.dashboardState.allRecords)
                             || window.BROCA_ARMADILHA_DATA
                             || window.rawBrocaData
                             || [];

                if (!Array.isArray(records) || records.length === 0) return existingLines;

                const osSet = new Set();
                const frentesSet = new Set();
                const locaisSet = new Set();
                let count = 0;

                for (let i = 0; i < records.length; i++) {
                    const r = records[i];
                    if (!r) continue;
                    const rDate = (r.dataBR || r.data_formatada || r.data || r.Data || r.dataInstalacao || '').trim();
                    const rIso = (r.isoDate || r.dataIso || '').trim();
                    
                    const matchesDate = rDate === dateLabel || 
                                        rDate.startsWith(dateLabel) || 
                                        dateLabel.startsWith(rDate.substring(0, 5)) ||
                                        (rIso && (rIso === dateLabel || rIso.endsWith(dateLabel)));

                    if (matchesDate) {
                        count++;
                        const os = r.os || r.OS || r.numOS || r.ordemServico || r.ordem_servico;
                        if (os && os !== '-' && os !== 'N/A') osSet.add(String(os));

                        const frente = r.frente || r.Frente || r.frenteOperacional || r.frente_operacional;
                        if (frente && frente !== '-' && frente !== 'N/A') frentesSet.add(String(frente));

                        const local = r.localidadeTalhao || r.local || r.Local || r.talhao || r.Talhao || r.fazenda || r.Fazenda;
                        if (local && local !== '-' && local !== 'N/A') locaisSet.add(String(local));
                    }
                }

                const extraLines = [];
                if (osSet.size > 0) {
                    const arr = Array.from(osSet).sort();
                    extraLines.push(`📋 OS: ${arr.length > 3 ? `${arr.slice(0, 3).join(', ')} (+${arr.length - 3})` : arr.join(', ')}`);
                }
                if (frentesSet.size > 0) {
                    const arr = Array.from(frentesSet).sort();
                    extraLines.push(`🚜 Frente: ${arr.join(', ')}`);
                }
                if (locaisSet.size > 0) {
                    const arr = Array.from(locaisSet).sort();
                    extraLines.push(`📍 Local/Talhão: ${arr.length > 3 ? `${arr.slice(0, 3).join(', ')} (+${arr.length - 3})` : arr.join(', ')}`);
                }
                if (count > 0 && !existingLines.some(l => l.includes('Medições') || l.includes('Lançamentos'))) {
                    extraLines.push(`📊 Apontamentos: ${count}`);
                }

                return [...existingLines, ...extraLines];
            };
        });
    }

    // =========================================================================
    // 7.2 BOTÃO UNIVERSAL DE LIMPAR FILTRO (↺) PARA FRENTE, OS E OUTRAS TABELAS
    // =========================================================================
    function setupUniversalTableFilterClearButtons() {
        const activeFilters = (window.state && window.state.activeFilters) ? window.state.activeFilters : 
                              (window.dashboardState && window.dashboardState.activeFilters) ? window.dashboardState.activeFilters : null;
        if (!activeFilters) return;

        ['frente', 'os', 'responsavel', 'fazenda'].forEach(key => {
            const val = activeFilters[key];
            if (val && val !== 'ALL' && val !== 'all' && val !== '') {
                const tables = document.querySelectorAll('table');
                tables.forEach(table => {
                    const sec = table.closest('section, .app-card, div.rounded-2xl');
                    if (!sec) return;
                    const text = sec.textContent || '';
                    const matchKey = (key === 'frente' && text.includes('Frente')) ||
                                     (key === 'os' && text.includes('OS')) ||
                                     (key === 'responsavel' && text.includes('Responsáv')) ||
                                     (key === 'fazenda' && text.includes('Fazenda'));
                    if (matchKey && !sec.querySelector(`.btn-clear-univ-${key}`)) {
                        const header = sec.querySelector('.flex.items-center.justify-between, .flex.items-start.justify-between, h2, h3, h4')?.closest('div.flex');
                        if (header && !header.querySelector(`.btn-clear-univ-${key}`)) {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.className = `btn-clear-univ-${key} px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 ml-auto`;
                            btn.innerHTML = `<span>↺</span><span>Limpar Filtro (${val})</span>`;
                            btn.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                activeFilters[key] = 'ALL';
                                const sel = document.querySelector(`#filter${key.charAt(0).toUpperCase() + key.slice(1)}, #select${key.charAt(0).toUpperCase() + key.slice(1)}`);
                                if (sel) sel.value = 'ALL';
                                if (typeof window.applyFilters === 'function') window.applyFilters();
                                else if (typeof window.filtrar === 'function') window.filtrar();
                                else if (typeof window.updateAllViews === 'function') window.updateAllViews();
                                btn.remove();
                            });
                            header.appendChild(btn);
                        }
                    }
                });
            } else {
                document.querySelectorAll(`.btn-clear-univ-${key}`).forEach(el => el.remove());
            }
        });
    }

"""

if target_anchor in code:
    code = code.replace(target_anchor, new_functions + target_anchor)
    print("Added setupUniversalTimelineTooltips and setupUniversalTableFilterClearButtons")
else:
    print("Target anchor not found!")

with open('DashBoard/common/js/fullscreen_inspector.js', 'w', encoding='utf-8') as f:
    f.write(code)
print("Updated fullscreen_inspector.js")
