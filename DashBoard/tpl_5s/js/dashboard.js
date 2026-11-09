/**
 * dashboard.js
 * Controlador da Central de Inteligência de 5S e Gestão TPL
 * Usina Pitangueiras - Safra 2026
 */

// ==========================================================================
// Plugin Universal de Rótulos de Dados (Garante valores visíveis em barras e donuts)
// ==========================================================================
(function() {
    function registerPlugin() {
        if (typeof Chart === 'undefined' || !Chart.register) return;
        const universalDataLabelsPlugin = {
            id: 'pitangueiras_universal_datalabels_tpl5s',
            beforeDraw(chart) {
                chart._centerTotalDrawn = false;
            },
            afterDatasetsDraw(chart) {
                const chartType = chart.config.type;
                if (chartType !== 'bar' && chartType !== 'doughnut' && chartType !== 'pie') return;

                const ctx = chart.ctx;
                const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark-theme');
                const defaultTextColor = isDark ? '#F1F5F9' : '#1E293B';
                const chartArea = chart.chartArea || { top: 0, bottom: chart.height, left: 0, right: chart.width };

                chart.data.datasets.forEach((dataset, datasetIdx) => {
                    const meta = chart.getDatasetMeta(datasetIdx);
                    if (!meta || meta.hidden) return;

                    meta.data.forEach((element, index) => {
                        const rawVal = dataset.data ? dataset.data[index] : null;
                        if (rawVal === undefined || rawVal === null || rawVal === '' || rawVal === 0 || rawVal === '0') return;
                        const numVal = Number(rawVal);
                        if (isNaN(numVal) || numVal === 0) return;

                        ctx.save();
                        ctx.font = 'bold 11px Inter, sans-serif';

                        if (chartType === 'doughnut' || chartType === 'pie') {
                            const pos = element.tooltipPosition ? element.tooltipPosition() : null;
                            if (pos) {
                                ctx.fillStyle = '#FFFFFF';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                                ctx.shadowBlur = 4;
                                ctx.fillText(String(rawVal), pos.x, pos.y);
                            }
                        } else if (chartType === 'bar' && chart.options && chart.options.indexAxis === 'y') {
                            const fitsOutside = (element.x + 28 <= chartArea.right);
                            if (fitsOutside) {
                                ctx.fillStyle = defaultTextColor;
                                ctx.textAlign = 'left';
                                ctx.textBaseline = 'middle';
                                ctx.fillText(String(rawVal), element.x + 6, element.y);
                            } else {
                                ctx.fillStyle = '#FFFFFF';
                                ctx.textAlign = 'right';
                                ctx.textBaseline = 'middle';
                                ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                                ctx.shadowBlur = 3;
                                ctx.fillText(String(rawVal), element.x - 6, element.y);
                            }
                        } else if (chartType === 'bar') {
                            const fitsOutside = (element.y - 14 >= chartArea.top);
                            if (fitsOutside) {
                                ctx.fillStyle = defaultTextColor;
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'bottom';
                                ctx.fillText(String(rawVal), element.x, element.y - 3);
                            } else {
                                ctx.fillStyle = '#FFFFFF';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'top';
                                ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                                ctx.shadowBlur = 3;
                                ctx.fillText(String(rawVal), element.x, element.y + 4);
                            }
                        }
                        ctx.restore();
                    });
                });

                // Totalizador no Centro de Gráficos Doughnut
                if (chartType === 'doughnut') {
                    const pluginsList = chart.config?.plugins || [];
                    const hasCustomCenter = pluginsList.some(p => p && (p.id === 'centerText' || p.id === 'donutCenterText' || (typeof p.id === 'string' && p.id.toLowerCase().includes('center'))));
                    if (hasCustomCenter || chart.options?.plugins?.centerTotal === false || chart.options?.centerTotal === false) return;
                    if (chart._centerTotalDrawn) return;

                    const parent = chart.canvas ? chart.canvas.parentElement : null;
                    const hasHtmlCenter = parent && parent.querySelector('#donutCenterPerc, [id*="CenterPerc"], [id*="centerPerc"], [id*="donutCenter"]');
                    if (!hasHtmlCenter && chart.chartArea) {
                        chart._centerTotalDrawn = true;
                        let totalSum = 0;
                        chart.data.datasets.forEach(ds => {
                            if (Array.isArray(ds.data)) {
                                ds.data.forEach(v => {
                                    const n = typeof v === 'number' ? v : parseFloat(v);
                                    if (!isNaN(n) && isFinite(n)) totalSum += n;
                                });
                            }
                        });

                        if (totalSum > 0) {
                            const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                            const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

                            const meta = chart.getDatasetMeta(0);
                            let innerRadius = meta && meta.controller ? meta.controller.innerRadius : 40;
                            if (!innerRadius || innerRadius <= 0) innerRadius = 45;

                            ctx.save();
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';

                            const fontSizeNum = Math.max(16, Math.round(innerRadius * 0.44));
                            const fontSizeLabel = Math.max(9, Math.round(innerRadius * 0.20));

                            // Valor Somado
                            ctx.font = `bold ${fontSizeNum}px 'JetBrains Mono', 'Plus Jakarta Sans', sans-serif`;
                            ctx.fillStyle = defaultTextColor;
                            ctx.shadowColor = 'transparent';
                            ctx.fillText(Number.isInteger(totalSum) ? totalSum.toLocaleString('pt-BR') : totalSum.toFixed(1), centerX, centerY - (fontSizeLabel * 0.55));

                            // Rótulo "TOTAL"
                            ctx.font = `600 ${fontSizeLabel}px 'Plus Jakarta Sans', sans-serif`;
                            ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
                            ctx.fillText('TOTAL', centerX, centerY + (fontSizeNum * 0.55));

                            ctx.restore();
                        }
                    }
                }

            }
        };
        try {
            Chart.register(universalDataLabelsPlugin);
        } catch(e) {}
    }
    if (typeof Chart !== 'undefined' && Chart.register) {
        registerPlugin();
    } else {
        document.addEventListener('DOMContentLoaded', registerPlugin);
    }
})();

(function () {
    'use strict';

    function getNormalizedRecords() {
        const raw = window.TPL_5S_DATA || [];
        if (window.Tpl5sEngine && typeof window.Tpl5sEngine.normalizeRecord === 'function') {
            return raw.map(window.Tpl5sEngine.normalizeRecord);
        }
        return raw;
    }

    const state = {
        allRecords: getNormalizedRecords(),
        filteredRecords: [],
        activeFilters: {
            dataInicio: '',
            dataFim: '',
            setor: 'TODOS',
            frente: 'TODAS',
            responsavel: 'TODOS',
            apenasNok: false,
            apenasExtintorNok: false,
            apenasEpiNok: false,
            apenasGeo: true,
            buscaTexto: ''
        },
        mapMode: 'all',
        map: null,
        markersLayer: null,
        charts: {},
        timelineMode: 'dia',
        currentPage: 1,
        pageSize: 25
    };
    window.dashboardState = state;
    window.state = state;

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        if (!state.allRecords || state.allRecords.length === 0 || !state.allRecords[0]?.q01) {
            state.allRecords = getNormalizedRecords();
        }
        state.filteredRecords = [...state.allRecords];
        initTheme();
        initFilters();
        initMap();
        initCharts();
        updateAllViews();
        bindEvents();
    }

    // --- GERENCIAMENTO DE TEMA (CLARO/ESCURO) ---
    function initTheme() {
        const savedTheme = localStorage.getItem('pitangueiras_theme') || 'light';
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.addEventListener('click', () => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('pitangueiras_theme', isDark ? 'dark' : 'light');
                updateChartThemes();
            });
        }
    }

    // --- INICIALIZAÇÃO DE FILTROS ---
    function initFilters() {
        const setores = new Set();
        const frentes = new Set();
        const resps = new Set();

        state.allRecords.forEach(r => {
            if (r.setor) setores.add(r.setor);
            if (r.frente) frentes.add(r.frente);
            if (r.responsavel) resps.add(r.responsavel);
        });

        populateSelect('filterSetor', Array.from(setores).sort(), 'Todos os Setores');
        populateSelect('filterFrente', Array.from(frentes).sort(), 'Todas as Frentes');
        populateSelect('filterResponsavel', Array.from(resps).sort(), 'Todos os Responsáveis');
    }

    function populateSelect(id, items, defaultLabel) {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = `<option value="${id === 'filterSetor' ? 'TODOS' : (id === 'filterFrente' ? 'TODAS' : 'TODOS')}">${defaultLabel}</option>`;
        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            sel.appendChild(opt);
        });
    }

    // --- MAPA LEAFLET COM OPENSTREETMAP ---
    function initMap() {
        const container = document.getElementById('mapContainer');
        if (!container) return;

        state.map = L.map('mapContainer', {
            center: [-21.05, -48.35],
            zoom: 11,
            zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors | Usina Pitangueiras 2026',
            maxZoom: 19
        }).addTo(state.map);

        state.markersLayer = L.markerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 35
        });
        state.map.addLayer(state.markersLayer);
    }

    function updateMapMarkers() {
        if (!state.map || !state.markersLayer) return;
        state.markersLayer.clearLayers();

        const bounds = [];
        const records = state.filteredRecords;

        records.forEach(r => {
            if (!r.has_coords || r.lat === 0 || r.lon === 0) return;

            if (state.mapMode === 'ok' && r.tem_nok) return;
            if (state.mapMode === 'nok' && !r.tem_nok) return;
            if (state.mapMode === 'extintor' && r.q07 !== 'NOK') return;

            bounds.push([r.lat, r.lon]);

            let pinBg = r.pin_color || '#10B981';
            let iconText = r.tem_nok ? '!' : '✓';
            if (r.q07 === 'NOK') iconText = 'E';

            const customIcon = L.divIcon({
                className: 'custom-map-icon',
                html: `<div class="custom-map-pin" style="background-color: ${pinBg};">${iconText}</div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13],
                popupAnchor: [0, -13]
            });

            const marker = L.marker([r.lat, r.lon], { icon: customIcon });

            const popupContent = `
                <div class="p-1 space-y-1 text-xs">
                    <div class="flex items-center justify-between gap-2 border-b pb-1 font-bold text-slate-800 dark:text-white">
                        <span>#${r.id} • ${r.setor}</span>
                        <span class="badge ${r.tem_nok ? 'badge-red' : 'badge-emerald'}">${r.perc_conformidade}% Conf.</span>
                    </div>
                    <div><b>Data:</b> ${r.data} | <b>Duração:</b> ${r.duracao_min} min</div>
                    <div><b>Frente:</b> ${r.frente}</div>
                    <div><b>Responsável:</b> ${r.responsavel}</div>
                    <div><b>Extintor:</b> <span class="font-bold ${r.q07 === 'NOK' ? 'text-red-600' : 'text-emerald-600'}">${r.q07}</span> | <b>EPIs:</b> ${r.q06}</div>
                    ${r.obs ? `<div class="pt-1 border-t text-[11px] text-amber-700 dark:text-amber-300"><b>Obs:</b> ${r.obs}</div>` : ''}
                    <div class="pt-1 text-right">
                        <button type="button" onclick="event.stopPropagation(); window.abrirModalVistoria('${r.id}')" class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline">Ver vistoria completa →</button>
                    </div>
                </div>
            `;
            marker.bindPopup(popupContent);
            state.markersLayer.addLayer(marker);
        });

        if (bounds.length > 0) {
            state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
        }
    }

    // --- GRÁFICOS INTERATIVOS VIA CHART.JS ---
    function initCharts() {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94A3B8' : '#64748B';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

        // 1. Gráfico de Setores (Barras)
        const ctxSetores = document.getElementById('chartSetores')?.getContext('2d');
        if (ctxSetores) {
            state.charts.setores = new Chart(ctxSetores, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [
                        { label: '100% OK', data: [], backgroundColor: '#10B981', borderRadius: 4 },
                        { label: 'Com NOK', data: [], backgroundColor: '#EF4444', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { grid: { display: false }, ticks: { color: textColor } },
                        y: { beginAtZero: true, grace: '12%', grid: { color: gridColor }, ticks: { color: textColor, precision: 0 } }
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, color: textColor } }
                    }
                }
            });
        }

        // 2. Gráfico de Status (Doughnut)
        const ctxStatus = document.getElementById('chartStatus')?.getContext('2d');
        if (ctxStatus) {
            state.charts.status = new Chart(ctxStatus, {
                type: 'doughnut',
                data: {
                    labels: ['Aberto', 'Fechado', 'Validado'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#F59E0B', '#10B981', '#3B82F6'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, color: textColor } }
                    },
                    cutout: '60%'
                }
            });
        }

        // 3. Gráfico de Frentes (Horizontal Bar)
        const ctxFrentes = document.getElementById('chartFrentes')?.getContext('2d');
        if (ctxFrentes) {
            state.charts.frentes = new Chart(ctxFrentes, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Vistorias',
                        data: [],
                        backgroundColor: '#3B82F6',
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { beginAtZero: true, grace: '12%', grid: { color: gridColor }, ticks: { color: textColor, precision: 0 } },
                        y: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }

        // 4. Gráfico Temporal (Barra)
        const ctxTimeline = document.getElementById('chartTimeline')?.getContext('2d');
        if (ctxTimeline) {
            state.charts.timeline = new Chart(ctxTimeline, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [
                        { label: 'Total Vistorias', data: [], backgroundColor: '#10B981', borderRadius: 4 },
                        { label: 'Vistorias com NOK', data: [], backgroundColor: '#EF4444', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } },
                        y: { beginAtZero: true, grace: '12%', grid: { color: gridColor }, ticks: { color: textColor, precision: 0 } }
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, color: textColor } }
                    }
                }
            });
        }
    }

    function updateChartThemes() {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94A3B8' : '#64748B';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

        Object.values(state.charts).forEach(c => {
            if (!c) return;
            if (c.options.scales) {
                if (c.options.scales.x) {
                    if (c.options.scales.x.ticks) c.options.scales.x.ticks.color = textColor;
                    if (c.options.scales.x.grid) c.options.scales.x.grid.color = gridColor;
                }
                if (c.options.scales.y) {
                    if (c.options.scales.y.ticks) c.options.scales.y.ticks.color = textColor;
                    if (c.options.scales.y.grid) c.options.scales.y.grid.color = gridColor;
                }
            }
            if (c.options.plugins && c.options.plugins.legend) {
                c.options.plugins.legend.labels.color = textColor;
            }
            c.update();
        });
    }

    // --- ATUALIZAÇÃO COMPLETA DAS VISÕES ---
    function updateAllViews() {
        const records = state.filteredRecords;
        const kpis = Tpl5sEngine.computeKPIs(records);
        const questions = Tpl5sEngine.computeQuestionBreakdown(records);
        const setores = Tpl5sEngine.computeSetorBreakdown(records);
        const frentes = Tpl5sEngine.computeFrenteRanking(records);
        const timeline = Tpl5sEngine.computeTemporalData(records, state.timelineMode);

        // Atualiza KPIs
        setText('kpiTotalVistorias', kpis.total);
        setText('kpiConformidadeGeral', `${kpis.percConformidadeGlobal}%`);
        setText('kpiVistorias100Ok', kpis.vistorias100Ok);
        setText('kpiPerc100Ok', `${(100 - kpis.percVistoriasComNok).toFixed(1)}% das vistorias`);
        setText('kpiComNok', kpis.vistoriasComNok);
        setText('kpiPercComNok', `${kpis.percVistoriasComNok}% das vistorias`);
        setText('kpiExtintorNok', kpis.extintoresNok);
        setText('kpiEpiNok', kpis.episNok);
        setText('kpiTotalOk', kpis.totalOk);
        setText('kpiTotalAvaliados', `de ${kpis.totalItensAvaliados} avaliados`);
        setText('kpiSetoresCount', kpis.setoresCount);
        setText('kpiFrentesCount', kpis.frentesCount);
        setText('kpiGeo', `${kpis.percGeo}%`);
        setText('kpiHeaderBadge', `${kpis.total} Vistorias Filtradas`);

        // Renderiza Cards dos 6 Pilares do Checklist
        renderChecklistCards(questions);

        // Atualiza Gráficos
        if (state.charts.setores) {
            state.charts.setores.data.labels = setores.map(s => s.setor);
            state.charts.setores.data.datasets[0].data = setores.map(s => s.total - s.vistoriasComNok);
            state.charts.setores.data.datasets[1].data = setores.map(s => s.vistoriasComNok);
            state.charts.setores.update();
        }

        if (state.charts.status) {
            state.charts.status.data.datasets[0].data = [kpis.abertos, kpis.fechados, kpis.validados];
            state.charts.status.update();
        }

        if (state.charts.frentes) {
            const topFrentes = frentes.slice(0, 7);
            state.charts.frentes.data.labels = topFrentes.map(f => f.frente.length > 25 ? f.frente.slice(0, 22) + '...' : f.frente);
            state.charts.frentes.data.datasets[0].data = topFrentes.map(f => f.total);
            state.charts.frentes.update();
        }

        if (state.charts.timeline) {
            state.charts.timeline.data.labels = timeline.map(t => t.label);
            state.charts.timeline.data.datasets[0].data = timeline.map(t => t.total);
            state.charts.timeline.data.datasets[1].data = timeline.map(t => t.nok);
            state.charts.timeline.update();
        }

        // Atualiza Mapa
        updateMapMarkers();

        // Atualiza Tabela Analítica
        renderTable();
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function renderChecklistCards(questions) {
        const container = document.getElementById('checklistCardsContainer');
        if (!container) return;

        container.innerHTML = questions.map(q => {
            const isCritical = (q.key === 'q07' || q.key === 'q06');
            const hasNok = q.nok > 0;
            const badgeClass = isCritical && hasNok ? 'badge-red' : (hasNok ? 'badge-amber' : 'badge-emerald');
            
            return `
                <div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600 transition flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between gap-2 mb-1.5">
                            <span class="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                Questão ${q.id} • ${q.category}
                            </span>
                            <span class="badge ${badgeClass} text-[10px]">
                                ${q.percOk}% OK
                            </span>
                        </div>
                        <h4 class="text-xs font-bold text-slate-800 dark:text-white line-clamp-2 leading-snug mb-2">
                            ${q.title}
                        </h4>
                    </div>

                    <div>
                        <!-- Barra de progresso OK / NOK -->
                        <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden flex mb-2">
                            <div class="bg-emerald-500 h-full" style="width: ${q.percOk}%" title="${q.ok} Conformes"></div>
                            <div class="bg-red-500 h-full" style="width: ${q.percNok}%" title="${q.nok} Irregulares"></div>
                        </div>

                        <div class="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                            <span><b class="text-emerald-600 dark:text-emerald-400">${q.ok}</b> OK</span>
                            <span><b class="${q.nok > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}">${q.nok}</b> NOK</span>
                            <span><b class="text-slate-500">${q.na}</b> N/A</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // --- TABELA ANALÍTICA COM PAGINAÇÃO E MODAL ---
    function renderTable() {
        const tbody = document.getElementById('tableBody');
        const countInfo = document.getElementById('tableCountInfo');
        const paginationInfo = document.getElementById('paginationInfo');
        const btnPrev = document.getElementById('btnPrevPage');
        const btnNext = document.getElementById('btnNextPage');
        if (!tbody) return;

        const records = state.filteredRecords;
        const total = records.length;
        const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
        if (state.currentPage > totalPages) state.currentPage = totalPages;

        const startIdx = (state.currentPage - 1) * state.pageSize;
        const endIdx = Math.min(startIdx + state.pageSize, total);
        const pageRecords = records.slice(startIdx, endIdx);

        if (countInfo) countInfo.textContent = `Mostrando ${startIdx + 1}–${endIdx} de ${total} registros`;
        if (paginationInfo) paginationInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
        if (btnPrev) btnPrev.disabled = (state.currentPage <= 1);
        if (btnNext) btnNext.disabled = (state.currentPage >= totalPages);

        if (pageRecords.length === 0) {
            tbody.innerHTML = `<tr><td colspan="13" class="text-center py-8 text-slate-500 text-xs">Nenhum registro encontrado com os filtros selecionados.</td></tr>`;
            return;
        }

        tbody.innerHTML = pageRecords.map(r => {
            const badgeStatus = r.status === 'Fechado' ? 'badge-emerald' : (r.status === 'Validado' ? 'badge-slate' : 'badge-amber');
            
            const cellQ = (ans) => {
                if (ans === 'OK') return '<span class="text-emerald-600 font-bold">OK</span>';
                if (ans === 'NOK') return '<span class="text-red-600 font-extrabold bg-red-100 dark:bg-red-950 px-1 py-0.5 rounded">NOK</span>';
                return '<span class="text-slate-400">N/A</span>';
            };

            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td class="py-2 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">#${r.id}</td>
                    <td class="py-2 px-3 whitespace-nowrap">${r.data}</td>
                    <td class="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">${r.setor}</td>
                    <td class="py-2 px-3 truncate max-w-[160px]" title="${r.frente}">${r.frente}</td>
                    <td class="py-2 px-3 truncate max-w-[130px]" title="${r.responsavel}">${r.responsavel}</td>
                    <td class="py-2 px-3 text-center">${cellQ(r.q01)}</td>
                    <td class="py-2 px-3 text-center">${cellQ(r.q03)}</td>
                    <td class="py-2 px-3 text-center">${cellQ(r.q04)}</td>
                    <td class="py-2 px-3 text-center">${cellQ(r.q05)}</td>
                    <td class="py-2 px-3 text-center">${cellQ(r.q06)}</td>
                    <td class="py-2 px-3 text-center">${cellQ(r.q07)}</td>
                    <td class="py-2 px-3 text-center"><span class="badge ${badgeStatus} text-[10px]">${r.status}</span></td>
                    <td class="py-2 px-3 text-center">
                        <button onclick="window.abrirModalVistoria(${r.id})" class="px-2 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                            Ver →
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // --- MODAL DE DETALHES ---
    window.abrirModalVistoria = function (id) {
        const strId = String(id).trim();
        let r = (state.allRecords || []).find(item => String(item.id || item.ID || '').trim() === strId);
        if (!r && window.TPL_5S_DATA) {
            r = window.TPL_5S_DATA.find(item => String(item.id || item.ID || '').trim() === strId);
        }
        if (!r) {
            console.warn('[TPL 5S] Vistoria não encontrada:', id);
            return;
        }

        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        const modal = document.getElementById('detailModal');
        if (!modal || !body) return;

        if (title) title.textContent = `Vistoria #${r.id} — Setor ${r.setor}`;

        const itemRow = (label, val) => {
            let valClass = 'text-slate-700 dark:text-slate-300';
            if (val === 'OK') valClass = 'text-emerald-600 dark:text-emerald-400 font-bold';
            if (val === 'NOK') valClass = 'text-red-600 dark:text-red-400 font-bold';
            return `
                <div class="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-xs">
                    <span class="text-slate-500">${label}</span>
                    <span class="${valClass}">${val || '-'}</span>
                </div>
            `;
        };

        body.innerHTML = `
            <div class="grid grid-cols-2 gap-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div>
                    <span class="text-[11px] text-slate-400 block">Data & Horário</span>
                    <span class="font-bold text-slate-800 dark:text-slate-100">${r.data} (${r.duracao_min} min de inspeção)</span>
                </div>
                <div>
                    <span class="text-[11px] text-slate-400 block">Status MapFy</span>
                    <span class="badge ${r.status === 'Fechado' ? 'badge-emerald' : 'badge-amber'}">${r.status}</span>
                </div>
                <div>
                    <span class="text-[11px] text-slate-400 block">Frente de Trabalho</span>
                    <span class="font-semibold text-slate-800 dark:text-slate-200">${r.frente}</span>
                </div>
                <div>
                    <span class="text-[11px] text-slate-400 block">Responsável Vistoria</span>
                    <span class="font-semibold text-slate-800 dark:text-slate-200">${r.responsavel}</span>
                </div>
                <div>
                    <span class="text-[11px] text-slate-400 block">Operação / Atividade</span>
                    <span class="font-semibold text-slate-800 dark:text-slate-200">${r.operacao || 'Não informada'}</span>
                </div>
                <div>
                    <span class="text-[11px] text-slate-400 block">Coordenadas GPS</span>
                    <span class="font-mono text-slate-700 dark:text-slate-300">${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}</span>
                </div>
            </div>

            <div class="pt-2">
                <h5 class="font-bold uppercase tracking-wider text-[11px] text-slate-500 mb-2">Avaliação dos 6 Requisitos 5S</h5>
                ${itemRow('01. Área de Vivência em boas condições de organização e limpeza', r.q01)}
                ${itemRow('03. Não há itens faltando, quebrados ou com sinais de mal uso', r.q03)}
                ${itemRow('04. Sinalização adequada e acesso ao local seguro', r.q04)}
                ${itemRow('05. Organização, limpeza e conservação dos equipamentos', r.q05)}
                ${itemRow('06. Colaboradores utilizando os EPIs adequados', r.q06)}
                ${itemRow('07. Extintor está válido e carregado', r.q07)}
            </div>

            ${r.obs ? `
                <div class="pt-2">
                    <h5 class="font-bold uppercase tracking-wider text-[11px] text-amber-600 dark:text-amber-400 mb-1">Observações Registradas</h5>
                    <div class="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200">
                        ${r.obs}
                    </div>
                </div>
            ` : ''}
        `;

        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    };

    window.fecharModalVistoria = function () {
        const modal = document.getElementById('detailModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    };

    function bindEvents() {
        // Fechar Modal
        const modal = document.getElementById('detailModal');
        const btnClose = document.getElementById('modalCloseBtn');
        const btnCloseBottom = document.getElementById('modalCloseBottomBtn');
        [btnClose, btnCloseBottom].forEach(b => {
            if (b) b.addEventListener('click', (e) => {
                e.stopPropagation();
                window.fecharModalVistoria();
            });
        });
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) window.fecharModalVistoria();
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.style.display !== 'none' && !modal.classList.contains('hidden')) {
                window.fecharModalVistoria();
            }
        });

        // Filtros
        const onFilterChange = () => {
            applyFilters();
            updateAllViews();
        };

        ['filterDataInicio', 'filterDataFim', 'filterSetor', 'filterFrente', 'filterResponsavel', 'chkApenasNok', 'chkExtintorNok', 'chkEpiNok', 'chkApenasGeo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', onFilterChange);
        });

        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.addEventListener('input', onFilterChange);

        const btnClear = document.getElementById('btnClearFilters');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                document.getElementById('filterDataInicio').value = '';
                document.getElementById('filterDataFim').value = '';
                document.getElementById('filterSetor').value = 'TODOS';
                document.getElementById('filterFrente').value = 'TODAS';
                document.getElementById('filterResponsavel').value = 'TODOS';
                document.getElementById('chkApenasNok').checked = false;
                document.getElementById('chkExtintorNok').checked = false;
                document.getElementById('chkEpiNok').checked = false;
                document.getElementById('chkApenasGeo').checked = true;
                if (searchInput) searchInput.value = '';
                state.mapMode = 'all';
                onFilterChange();
            });
        }

        // Filtros de Mapa
        const setMapMode = (mode, btnActive) => {
            state.mapMode = mode;
            ['btnMapAll', 'btnMapOk', 'btnMapNok', 'btnMapExtintor'].forEach(id => {
                const b = document.getElementById(id);
                if (b) {
                    b.classList.remove('ring-2', 'ring-emerald-500');
                }
            });
            btnActive?.classList.add('ring-2', 'ring-emerald-500');
            updateMapMarkers();
        };

        document.getElementById('btnMapAll')?.addEventListener('click', function() { setMapMode('all', this); });
        document.getElementById('btnMapOk')?.addEventListener('click', function() { setMapMode('ok', this); });
        document.getElementById('btnMapNok')?.addEventListener('click', function() { setMapMode('nok', this); });
        document.getElementById('btnMapExtintor')?.addEventListener('click', function() { setMapMode('extintor', this); });

        // Timeline Modes
        document.getElementById('btnTimelineDia')?.addEventListener('click', function() {
            state.timelineMode = 'dia';
            this.classList.replace('bg-slate-200', 'bg-emerald-600');
            this.classList.replace('text-slate-700', 'text-white');
            document.getElementById('btnTimelineMes')?.classList.replace('bg-emerald-600', 'bg-slate-200');
            document.getElementById('btnTimelineMes')?.classList.replace('text-white', 'text-slate-700');
            updateAllViews();
        });
        document.getElementById('btnTimelineMes')?.addEventListener('click', function() {
            state.timelineMode = 'mes';
            this.classList.replace('bg-slate-200', 'bg-emerald-600');
            this.classList.replace('text-slate-700', 'text-white');
            document.getElementById('btnTimelineDia')?.classList.replace('bg-emerald-600', 'bg-slate-200');
            document.getElementById('btnTimelineDia')?.classList.replace('text-white', 'text-slate-700');
            updateAllViews();
        });

        // Paginação
        document.getElementById('selectPageSize')?.addEventListener('change', (e) => {
            state.pageSize = parseInt(e.target.value, 10);
            state.currentPage = 1;
            renderTable();
        });
        document.getElementById('btnPrevPage')?.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                renderTable();
            }
        });
        document.getElementById('btnNextPage')?.addEventListener('click', () => {
            state.currentPage++;
            renderTable();
        });

        // Exportação
        document.getElementById('btnExportExcel')?.addEventListener('click', exportToExcel);
        document.getElementById('btnExportCSV')?.addEventListener('click', exportToCSV);

        // Window resize
        window.addEventListener('resize', () => {
            if (state.map) state.map.invalidateSize();
            Object.values(state.charts).forEach(c => c && c.resize());
        });
    }

    function applyFilters() {
        const dIni = document.getElementById('filterDataInicio')?.value;
        const dFim = document.getElementById('filterDataFim')?.value;
        const setor = document.getElementById('filterSetor')?.value;
        const frente = document.getElementById('filterFrente')?.value;
        const resp = document.getElementById('filterResponsavel')?.value;
        const chkNok = document.getElementById('chkApenasNok')?.checked;
        const chkExtintor = document.getElementById('chkExtintorNok')?.checked;
        const chkEpi = document.getElementById('chkEpiNok')?.checked;
        const chkGeo = document.getElementById('chkApenasGeo')?.checked;
        const search = document.getElementById('searchInput')?.value.toLowerCase().trim();

        state.filteredRecords = state.allRecords.filter(r => {
            if (setor && setor !== 'TODOS' && r.setor !== setor) return false;
            if (frente && frente !== 'TODAS' && r.frente !== frente) return false;
            if (resp && resp !== 'TODOS' && r.responsavel !== resp) return false;
            if (chkNok && !r.tem_nok) return false;
            if (chkExtintor && r.q07 !== 'NOK') return false;
            if (chkEpi && r.q06 !== 'NOK') return false;
            if (chkGeo && (!r.has_coords || r.lat === 0)) return false;

            if (dIni && r.data_dia) {
                const parts = r.data_dia.split('/');
                const rDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                if (rDate < dIni) return false;
            }
            if (dFim && r.data_dia) {
                const parts = r.data_dia.split('/');
                const rDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                if (rDate > dFim) return false;
            }

            if (search) {
                const hay = `${r.id} ${r.setor} ${r.frente} ${r.responsavel} ${r.obs} ${r.operacao}`.toLowerCase();
                if (!hay.includes(search)) return false;
            }

            return true;
        });

        state.currentPage = 1;
    }

    // --- EXPORTAÇÕES ---
    function exportToExcel() {
        if (!window.XLSX) {
            alert('Biblioteca Excel não carregada.');
            return;
        }

        const data = state.filteredRecords.map(r => ({
            'ID': r.id,
            'Data': r.data,
            'Setor': r.setor,
            'Frente': r.frente,
            'Responsável': r.responsavel,
            'Operação': r.operacao,
            'Status': r.status,
            '01-Área de Vivência': r.q01,
            '03-Itens e Ferramentas': r.q03,
            '04-Sinalização e Acesso': r.q04,
            '05-Conservação Equipamentos': r.q05,
            '06-EPIs': r.q06,
            '07-Extintor': r.q07,
            'Total Avaliados': r.total_avaliados,
            'Total OK': r.total_ok,
            'Total NOK': r.total_nok,
            '% Conformidade': r.perc_conformidade,
            'Latitude': r.lat,
            'Longitude': r.lon,
            'Observação': r.obs
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '5S_Gestao_TPL');
        XLSX.writeFile(wb, `5S_Gestao_TPL_Pitangueiras_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    function exportToCSV() {
        const records = state.filteredRecords;
        if (records.length === 0) {
            alert('Nenhum registro para exportar.');
            return;
        }

        const headers = ['ID', 'Data', 'Setor', 'Frente', 'Responsavel', 'Status', 'Q01_Vivencia', 'Q03_Itens', 'Q04_Sinalizacao', 'Q05_Equipamentos', 'Q06_EPI', 'Q07_Extintor', 'Perc_Conformidade', 'Latitude', 'Longitude', 'Observacao'];
        const csvRows = [headers.join(';')];

        records.forEach(r => {
            const row = [
                r.id,
                `"${r.data}"`,
                `"${r.setor}"`,
                `"${r.frente}"`,
                `"${r.responsavel}"`,
                `"${r.status}"`,
                `"${r.q01}"`,
                `"${r.q03}"`,
                `"${r.q04}"`,
                `"${r.q05}"`,
                `"${r.q06}"`,
                `"${r.q07}"`,
                r.perc_conformidade,
                r.lat,
                r.lon,
                `"${(r.obs || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(';'));
        });

        const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `5S_Gestao_TPL_Pitangueiras_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

})();
