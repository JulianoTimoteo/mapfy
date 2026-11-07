with open('DashBoard/subsolagem/js/dashboard.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update initCharts - chartEvolution tooltip configuration
old_chart_evo = """                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false }
                    },"""

new_chart_evo = """                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#F8FAFC',
                            titleFont: { size: 12, weight: 'bold', family: "'Plus Jakarta Sans', sans-serif" },
                            bodyColor: '#CBD5E1',
                            bodyFont: { size: 11, family: "'Plus Jakarta Sans', sans-serif" },
                            borderColor: 'rgba(16, 185, 129, 0.3)',
                            borderWidth: 1,
                            padding: 10,
                            cornerRadius: 8,
                            callbacks: {
                                afterBody: function(tooltipItems) {
                                    if (!tooltipItems || tooltipItems.length === 0) return [];
                                    const idx = tooltipItems[0].dataIndex;
                                    const meta = state.charts.evolution ? state.charts.evolution._metaData : null;
                                    if (!meta) return [];
                                    const lines = [];
                                    if (meta.osList && meta.osList[idx] && meta.osList[idx] !== 'N/A') {
                                        lines.push(`📋 OS: ${meta.osList[idx]}`);
                                    }
                                    if (meta.frentesList && meta.frentesList[idx] && meta.frentesList[idx] !== 'N/A') {
                                        lines.push(`🚜 Frente: ${meta.frentesList[idx]}`);
                                    }
                                    if (meta.locaisList && meta.locaisList[idx] && meta.locaisList[idx] !== 'N/A') {
                                        lines.push(`📍 Local/Talhão: ${meta.locaisList[idx]}`);
                                    }
                                    if (meta.counts && meta.counts[idx]) {
                                        lines.push(`📊 Medições: ${meta.counts[idx]}`);
                                    }
                                    return lines;
                                }
                            }
                        }
                    },"""

# Replace in code
if old_chart_evo in code:
    code = code.replace(old_chart_evo, new_chart_evo)
    print("1. Updated chartEvolution tooltip")
else:
    print("1. Failed to find old_chart_evo")

# 2. Update renderCharts evolution data slicing & meta assignment
old_render_evo = """        if (state.charts.evolution) {
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
            state.charts.evolution.update();"""

new_render_evo = """        if (state.charts.evolution) {
            let labels = timeSeries.labels;
            let medias = timeSeries.medias;
            let minLine = timeSeries.targetMinLine;
            let maxLine = timeSeries.targetMaxLine;
            let osList = timeSeries.osList || [];
            let frentesList = timeSeries.frentesList || [];
            let locaisList = timeSeries.locaisList || [];
            let counts = timeSeries.counts || [];

            if (state.evolutionRange === '7D' && labels.length > 7) {
                labels = labels.slice(-7);
                medias = medias.slice(-7);
                minLine = minLine.slice(-7);
                maxLine = maxLine.slice(-7);
                osList = osList.slice(-7);
                frentesList = frentesList.slice(-7);
                locaisList = locaisList.slice(-7);
                counts = counts.slice(-7);
            } else if (state.evolutionRange === '15D' && labels.length > 15) {
                labels = labels.slice(-15);
                medias = medias.slice(-15);
                minLine = minLine.slice(-15);
                maxLine = maxLine.slice(-15);
                osList = osList.slice(-15);
                frentesList = frentesList.slice(-15);
                locaisList = locaisList.slice(-15);
                counts = counts.slice(-15);
            }

            state.charts.evolution._metaData = {
                osList,
                frentesList,
                locaisList,
                counts
            };

            state.charts.evolution.data.labels = labels;
            state.charts.evolution.data.datasets[0].data = medias;
            state.charts.evolution.data.datasets[1].data = minLine;
            state.charts.evolution.data.datasets[2].data = maxLine;
            state.charts.evolution.update();"""

if old_render_evo in code:
    code = code.replace(old_render_evo, new_render_evo)
    print("2. Updated renderCharts evolution data slicing & meta")
else:
    print("2. Failed to find old_render_evo")

# 3. Update renderFrenteAnalysis with ↺ Limpar Filtro and toggle logic
old_frente_analysis = """    function renderFrenteAnalysis(frentes) {
        const tbody = document.getElementById('frenteTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (frentes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="text-center p-6 text-xs text-[var(--text-muted)]">Nenhuma frente localizada.</td></tr>`;
            return;
        }

        frentes.forEach(f => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] cursor-pointer text-xs';
            tr.innerHTML = `
                <td class="p-3 font-bold text-[var(--text-primary)]">${f.frente}</td>
                <td class="p-3 font-mono text-center font-bold">${f.total}</td>
                <td class="p-3 font-mono text-center font-bold text-emerald-500">${f.media} cm</td>
                <td class="p-3 font-mono text-center">${f.mediana} cm</td>
                <td class="p-3 font-mono text-center text-amber-500">${f.min} cm</td>
                <td class="p-3 font-mono text-center text-purple-500">${f.max} cm</td>
                <td class="p-3 font-mono text-center text-sky-500">±${f.stdDev}</td>
                <td class="p-3 font-mono text-center">${f.totalOS}</td>
                <td class="p-3 font-mono text-center">${f.totalLocais}</td>
                <td class="p-3 font-mono text-center font-bold text-emerald-500">${f.percDentro}% (${f.dentro})</td>
                <td class="p-3 font-mono text-center text-[var(--text-muted)]">${f.ultimaDataBR}</td>
            `;
            tr.addEventListener('click', () => {
                document.getElementById('filterFrente').value = f.frente;
                state.activeFilters.frente = f.frente;
                applyFilters();
            });
            tbody.appendChild(tr);
        });
    }"""

new_frente_analysis = """    function renderFrenteAnalysis(frentes) {
        const tbody = document.getElementById('frenteTableBody');
        const containerBtn = document.getElementById('frenteFilterActiveContainer');
        const hintText = document.getElementById('frenteHintText');

        if (containerBtn) {
            if (state.activeFilters.frente !== 'ALL') {
                containerBtn.innerHTML = `
                    <button id="btnClearFrenteFilter" type="button" class="px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30" title="Clique para remover o filtro desta frente">
                        <span>↺</span>
                        <span>Limpar Filtro (${state.activeFilters.frente})</span>
                    </button>
                `;
                const btnClear = containerBtn.querySelector('#btnClearFrenteFilter');
                if (btnClear) {
                    btnClear.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        document.getElementById('filterFrente').value = 'ALL';
                        state.activeFilters.frente = 'ALL';
                        applyFilters();
                    });
                }
                if (hintText) hintText.style.display = 'none';
            } else {
                containerBtn.innerHTML = '';
                if (hintText) hintText.style.display = '';
            }
        }

        if (!tbody) return;
        tbody.innerHTML = '';

        if (frentes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="text-center p-6 text-xs text-[var(--text-muted)]">Nenhuma frente localizada.</td></tr>`;
            return;
        }

        frentes.forEach(f => {
            const isSelected = (state.activeFilters.frente === f.frente);
            const tr = document.createElement('tr');
            tr.className = `border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] cursor-pointer text-xs transition-colors ${isSelected ? 'bg-emerald-500/15 dark:bg-emerald-500/20 ring-1 ring-emerald-500/40 font-semibold' : ''}`;
            tr.innerHTML = `
                <td class="p-3 font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    ${isSelected ? '<span class="text-emerald-500">✓</span>' : ''}
                    <span>${f.frente}</span>
                </td>
                <td class="p-3 font-mono text-center font-bold">${f.total}</td>
                <td class="p-3 font-mono text-center font-bold text-emerald-500">${f.media} cm</td>
                <td class="p-3 font-mono text-center">${f.mediana} cm</td>
                <td class="p-3 font-mono text-center text-amber-500">${f.min} cm</td>
                <td class="p-3 font-mono text-center text-purple-500">${f.max} cm</td>
                <td class="p-3 font-mono text-center text-sky-500">±${f.stdDev}</td>
                <td class="p-3 font-mono text-center">${f.totalOS}</td>
                <td class="p-3 font-mono text-center">${f.totalLocais}</td>
                <td class="p-3 font-mono text-center font-bold text-emerald-500">${f.percDentro}% (${f.dentro})</td>
                <td class="p-3 font-mono text-center text-[var(--text-muted)]">${f.ultimaDataBR}</td>
            `;
            tr.addEventListener('click', () => {
                if (state.activeFilters.frente === f.frente) {
                    // Toggle desligar se clicar na mesma linha
                    document.getElementById('filterFrente').value = 'ALL';
                    state.activeFilters.frente = 'ALL';
                } else {
                    document.getElementById('filterFrente').value = f.frente;
                    state.activeFilters.frente = f.frente;
                }
                applyFilters();
            });
            tbody.appendChild(tr);
        });
    }"""

if old_frente_analysis in code:
    code = code.replace(old_frente_analysis, new_frente_analysis)
    print("3. Updated renderFrenteAnalysis with Limpar Filtro & toggle")
else:
    print("3. Failed to find old_frente_analysis")

# 4. Update renderOSAnalysis with ↺ Limpar Filtro and toggle logic
old_os_analysis = """        osList.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] cursor-pointer text-xs';
            tr.innerHTML = `
                <td class="p-2.5 font-mono font-bold text-emerald-500">${item.os}</td>
                <td class="p-2.5 truncate max-w-[160px]" title="${item.frentes}">${item.frentes}</td>
                <td class="p-2.5 truncate max-w-[140px]" title="${item.locais}">${item.locais}</td>
                <td class="p-2.5 font-mono text-center font-bold">${item.total}</td>
                <td class="p-2.5 font-mono text-center font-bold text-emerald-500">${item.media} cm</td>
                <td class="p-2.5 font-mono text-center">${item.mediana} cm</td>
                <td class="p-2.5 font-mono text-center">${item.min} / ${item.max} cm</td>
                <td class="p-2.5 font-mono text-center text-sky-500">±${item.stdDev}</td>
                <td class="p-2.5 font-mono text-center font-bold ${item.percDentro >= 80 ? 'text-emerald-500' : 'text-amber-500'}">${item.percDentro}%</td>
                <td class="p-2.5 font-mono text-center text-[var(--text-muted)]">${item.primeiraDataBR} a ${item.ultimaDataBR}</td>
            `;
            tr.addEventListener('click', () => {
                document.getElementById('filterOS').value = item.os;
                state.activeFilters.os = item.os;
                applyFilters();
            });
            tbody.appendChild(tr);
        });"""

new_os_analysis = """        const containerBtnOS = document.getElementById('osFilterActiveContainer');
        if (containerBtnOS) {
            if (state.activeFilters.os !== 'ALL') {
                containerBtnOS.innerHTML = `
                    <button id="btnClearOSFilter" type="button" class="px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 mr-2" title="Clique para remover o filtro desta OS">
                        <span>↺</span>
                        <span>Limpar OS (${state.activeFilters.os})</span>
                    </button>
                `;
                const btnClearOS = containerBtnOS.querySelector('#btnClearOSFilter');
                if (btnClearOS) {
                    btnClearOS.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        document.getElementById('filterOS').value = 'ALL';
                        state.activeFilters.os = 'ALL';
                        applyFilters();
                    });
                }
            } else {
                containerBtnOS.innerHTML = '';
            }
        }

        osList.forEach(item => {
            const isSelected = (state.activeFilters.os === item.os);
            const tr = document.createElement('tr');
            tr.className = `border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] cursor-pointer text-xs transition-colors ${isSelected ? 'bg-emerald-500/15 dark:bg-emerald-500/20 ring-1 ring-emerald-500/40 font-semibold' : ''}`;
            tr.innerHTML = `
                <td class="p-2.5 font-mono font-bold text-emerald-500 flex items-center gap-1.5">
                    ${isSelected ? '<span>✓</span>' : ''}
                    <span>${item.os}</span>
                </td>
                <td class="p-2.5 truncate max-w-[160px]" title="${item.frentes}">${item.frentes}</td>
                <td class="p-2.5 truncate max-w-[140px]" title="${item.locais}">${item.locais}</td>
                <td class="p-2.5 font-mono text-center font-bold">${item.total}</td>
                <td class="p-2.5 font-mono text-center font-bold text-emerald-500">${item.media} cm</td>
                <td class="p-2.5 font-mono text-center">${item.mediana} cm</td>
                <td class="p-2.5 font-mono text-center">${item.min} / ${item.max} cm</td>
                <td class="p-2.5 font-mono text-center text-sky-500">±${item.stdDev}</td>
                <td class="p-2.5 font-mono text-center font-bold ${item.percDentro >= 80 ? 'text-emerald-500' : 'text-amber-500'}">${item.percDentro}%</td>
                <td class="p-2.5 font-mono text-center text-[var(--text-muted)]">${item.primeiraDataBR} a ${item.ultimaDataBR}</td>
            `;
            tr.addEventListener('click', () => {
                if (state.activeFilters.os === item.os) {
                    // Toggle desligar se clicar na mesma linha
                    document.getElementById('filterOS').value = 'ALL';
                    state.activeFilters.os = 'ALL';
                } else {
                    document.getElementById('filterOS').value = item.os;
                    state.activeFilters.os = item.os;
                }
                applyFilters();
            });
            tbody.appendChild(tr);
        });"""

if old_os_analysis in code:
    code = code.replace(old_os_analysis, new_os_analysis)
    print("4. Updated renderOSAnalysis with Limpar Filtro & toggle")
else:
    print("4. Failed to find old_os_analysis")

with open('DashBoard/subsolagem/js/dashboard.js', 'w', encoding='utf-8') as f:
    f.write(code)
print("Finished updating dashboard.js")
