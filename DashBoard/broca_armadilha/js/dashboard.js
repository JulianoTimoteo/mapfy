/**
 * dashboard.js
 * Controlador da Central de Inteligência de Infestação de Broca por Armadilha
 * Usina Pitangueiras - Safra 2026
 */

(function () {
    'use strict';

    const state = {
        allRecords: window.BROCA_ARMADILHA_DATA || [],
        filteredRecords: [],
        activeFilters: {
            dataInicio: '',
            dataFim: '',
            fazenda: 'TODAS',
            talhao: 'TODOS',
            etapa: 'TODAS',
            responsavel: 'TODOS',
            faixaGravidade: 'TODAS',
            somentePositivos: false,
            somenteRecolhimento: false,
            somenteCoords: true,
            buscaTexto: ''
        },
        mapMode: 'all',
        map: null,
        markersLayer: null,
        charts: {},
        timelineMode: 'dia',
        currentPage: 1,
        pageSize: 10
    };
    window.dashboardState = state;
    window.state = state;

    // Plugin fallback para garantir exibição dos números nos gráficos sob qualquer condição
    const fallbackDataLabelsPlugin = {
        id: 'pitangueiras_datalabels_fallback',
        afterDatasetsDraw(chart) {
            if (window.ChartDataLabels) return; // Se plugin oficial estiver carregado, delega a ele
            const ctx = chart.ctx;
            const isDark = document.documentElement.classList.contains('dark');
            const defaultTextColor = isDark ? '#F1F5F9' : '#1E293B';

            chart.data.datasets.forEach((dataset, datasetIdx) => {
                const meta = chart.getDatasetMeta(datasetIdx);
                if (meta.hidden) return;

                meta.data.forEach((element, index) => {
                    const val = dataset.data[index];
                    if (val === undefined || val === null || val === 0 || val === '') return;

                    ctx.save();
                    ctx.font = 'bold 10px Inter, sans-serif';

                    if (chart.config.type === 'doughnut') {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const pos = element.tooltipPosition();
                        ctx.fillText(String(val), pos.x, pos.y);
                    } else if (chart.config.type === 'bar' && chart.options.indexAxis === 'y') {
                        ctx.fillStyle = defaultTextColor;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(String(val), element.x + 5, element.y);
                    } else if (chart.config.type === 'bar') {
                        ctx.fillStyle = defaultTextColor;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(String(val), element.x, element.y - 3);
                    }
                    ctx.restore();
                });
            });

            // Totalizador no Centro de Gráficos Doughnut
            const chartType = chart.config.type;
            if (chartType === 'doughnut') {
                const parent = chart.canvas ? chart.canvas.parentElement : null;
                const hasHtmlCenter = parent && parent.querySelector('#donutCenterPerc, [id*="CenterPerc"], [id*="centerPerc"], [id*="donutCenter"]');
                if (!hasHtmlCenter && chart.chartArea) {
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

    document.addEventListener('DOMContentLoaded', init);

    function init() {
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
        const fazendas = new Set();
        const responsaveis = new Set();

        state.allRecords.forEach(r => {
            if (r.fazenda) fazendas.add(r.fazenda);
            if (r.responsavel_nome) responsaveis.add(r.responsavel_nome);
        });

        populateSelect('filterFazenda', Array.from(fazendas).sort(), 'Todas as Fazendas');
        populateSelect('filterResponsavel', Array.from(responsaveis).sort(), 'Todos os Responsáveis');
    }

    function populateSelect(id, items, defaultLabel) {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = `<option value="TODAS">${defaultLabel}</option>`;
        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            sel.appendChild(opt);
        });
    }

    // --- MAPA LEAFLET COM OPENSTREETMAP (ZERO CARTO, ZERO WATERMARKS) ---
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
            maxClusterRadius: 30
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

            // Filtro por modo do mapa
            if (state.mapMode === 'criticos' && r.machos <= 25) return;
            if (state.mapMode === 'positivos' && r.machos <= 0) return;
            if (state.mapMode === 'zerados' && r.machos > 0) return;

            bounds.push([r.lat, r.lon]);

            let pinBg = r.cor_marcador || '#10B981';
            let label = r.machos > 0 ? String(r.machos) : (r.is_instalacao ? 'I' : '0');

            const customIcon = L.divIcon({
                className: 'custom-map-icon',
                html: `<div class="custom-pin" style="background-color: ${pinBg};">${label}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
                popupAnchor: [0, -14]
            });

            const marker = L.marker([r.lat, r.lon], { icon: customIcon });

            const popupContent = `
                <div class="p-1 space-y-1 text-xs">
                    <div class="flex items-center justify-between gap-2 border-b pb-1 font-bold text-slate-800 dark:text-white">
                        <span>#${r.id} • ${r.local_display}</span>
                        <span class="badge" style="background-color: ${pinBg}20; color: ${pinBg};">${r.etapa}</span>
                    </div>
                    <div><b>Data:</b> ${r.data} | <b>Duração:</b> ${r.duracao_min} min</div>
                    <div><b>Captura:</b> <span class="font-bold text-amber-600 dark:text-amber-400">${r.machos} Brocas</span> (${r.faixa_captura})</div>
                    <div><b>Responsável:</b> ${r.responsavel_display}</div>
                    <div><b>Status:</b> ${r.status} | <b>Score:</b> ${r.score}</div>
                    <div class="pt-1 text-right">
                        <button onclick="window.abrirModalInspecao(${r.id})" class="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline">Ver ficha completa →</button>
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

    // --- GRÁFICOS INTERATIVOS COM EXIBIÇÃO DIRETA DE VALORES ---
    function initCharts() {
        if (window.ChartDataLabels) {
            Chart.register(ChartDataLabels);
        }
        Chart.register(fallbackDataLabelsPlugin);

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94A3B8' : '#64748B';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

        // 1. Fazendas (Top Fazendas com Maior Captura)
        const ctxFaz = document.getElementById('chartFazendas')?.getContext('2d');
        if (ctxFaz) {
            state.charts.fazendas = new Chart(ctxFaz, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Brocas Capturadas',
                        data: [],
                        backgroundColor: '#F59E0B',
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                            suggestedMax: 125,
                            grid: { color: gridColor },
                            ticks: { color: textColor, precision: 0 }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 10, weight: '500' } }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'end',
                            offset: 4,
                            color: isDark ? '#F1F5F9' : '#1E293B',
                            font: { weight: 'bold', size: 11 },
                            formatter: function (value) {
                                return value > 0 ? value : '';
                            }
                        }
                    }
                }
            });
        }

        // 2. Talhões (Top Talhões com Maior Pressão)
        const ctxTal = document.getElementById('chartTalhoes')?.getContext('2d');
        if (ctxTal) {
            state.charts.talhoes = new Chart(ctxTal, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Brocas Capturadas',
                        data: [],
                        backgroundColor: '#EF4444',
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                            suggestedMax: 115,
                            grid: { color: gridColor },
                            ticks: { color: textColor, precision: 0 }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 10, weight: '500' } }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'end',
                            offset: 4,
                            color: isDark ? '#F1F5F9' : '#1E293B',
                            font: { weight: 'bold', size: 11 },
                            formatter: function (value) {
                                return value > 0 ? value : '';
                            }
                        }
                    }
                }
            });
        }

        // 3. Timeline (Evolução Temporal)
        const ctxTime = document.getElementById('chartTimeline')?.getContext('2d');
        if (ctxTime) {
            state.charts.timeline = new Chart(ctxTime, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Brocas Capturadas',
                            data: [],
                            backgroundColor: '#F59E0B',
                            borderRadius: 4,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Lançamentos',
                            data: [],
                            backgroundColor: '#3B82F6',
                            borderRadius: 4,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 10 } }
                        },
                        y: {
                            beginAtZero: true,
                            position: 'left',
                            suggestedMax: 130,
                            grid: { color: gridColor },
                            ticks: { color: textColor, precision: 0 }
                        },
                        y1: {
                            beginAtZero: true,
                            position: 'right',
                            suggestedMax: 25,
                            grid: { display: false },
                            ticks: { color: textColor, precision: 0 }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { boxWidth: 10, color: textColor }
                        },
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'top',
                            offset: 2,
                            color: isDark ? '#F1F5F9' : '#1E293B',
                            font: { weight: 'bold', size: 10 },
                            formatter: function (value) {
                                return value > 0 ? value : '';
                            }
                        }
                    }
                }
            });
        }

        // 4. Severity Donut (Distribuição de Severidade)
        const ctxSev = document.getElementById('chartSeverity')?.getContext('2d');
        if (ctxSev) {
            state.charts.severity = new Chart(ctxSev, {
                type: 'doughnut',
                data: {
                    labels: ['Instalação (0)', 'Recolh. Zerado (0)', 'Baixo (1-10)', 'Médio (11-25)', 'Crítico (>25)'],
                    datasets: [{
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: ['#10B981', '#06B6D4', '#EAB308', '#F59E0B', '#EF4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { boxWidth: 10, color: textColor, font: { size: 10 } }
                        },
                        datalabels: {
                            display: true,
                            color: '#FFFFFF',
                            font: { weight: 'bold', size: 12 },
                            formatter: function (value) {
                                return value > 0 ? value : '';
                            }
                        }
                    },
                    cutout: '60%'
                }
            });
        }
    }

    function updateChartThemes() {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94A3B8' : '#64748B';
        const labelColor = isDark ? '#F1F5F9' : '#1E293B';
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
            if (c.options.plugins) {
                if (c.options.plugins.legend) {
                    c.options.plugins.legend.labels.color = textColor;
                }
                if (c.options.plugins.datalabels && c.config.type !== 'doughnut') {
                    c.options.plugins.datalabels.color = labelColor;
                }
            }
            c.update();
        });
    }

    // --- ATUALIZAÇÃO COMPLETA DAS VISÕES ---
    function updateAllViews() {
        const records = state.filteredRecords;
        const kpis = BrocaEngine.computeExecutiveKPIs(records);
        const farms = BrocaEngine.computeFarmRanking(records);
        const talhoes = BrocaEngine.computeTalhaoRanking(records);
        const responsaveis = BrocaEngine.computeResponsibleStats(records);
        const severities = BrocaEngine.computeSeverityDistribution(records);

        // Atualiza KPIs Executivos
        setText('kpiTotalCapturas', kpis.totalCapturas || kpis.totalMachos);
        setText('kpiTotalMachos', kpis.totalCapturas || kpis.totalMachos);
        setText('kpiTotalLancamentos', kpis.totalLancamentos);
        setText('kpiInstalacoes', kpis.instalacoesCount);
        setText('kpiRecolhimentos', kpis.recolhimentosCount);
        setText('kpiMediaGeral', kpis.mediaPorLancamento.toFixed(2));
        setText('kpiMediaRecolhimento', kpis.mediaPorRecolhimento.toFixed(2));
        setText('kpiMediaPositivos', kpis.mediaPositivos.toFixed(2));
        setText('kpiMaiorCaptura', kpis.maiorQuantidade);
        setText('kpiZerados', kpis.zeradosTotal);
        setText('kpiPercZerados', `${kpis.percZerados}% da base`);
        setText('kpiLocaisMonitorados', `${kpis.fazendasCount}/${kpis.talhoesLocaisCount}`);
        setText('kpiHeaderBadge', `${kpis.totalLancamentos} Lançamentos Auditados`);

        // Rankings Tabelas
        renderFarmTable(farms);
        renderTalhaoTable(talhoes);

        // Responsáveis Cards
        renderResponsibleCards(responsaveis);

        // Atualiza Gráficos
        updateChartsData(farms, talhoes, records, severities);

        // Atualiza Mapa
        updateMapMarkers();

        // Atualiza Tabela Analítica
        renderTable();
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function renderFarmTable(farms) {
        const tbody = document.getElementById('rankingFazendasBody');
        if (!tbody) return;

        tbody.innerHTML = farms.slice(0, 10).map(f => {
            const percFormatted = (f.participacaoPerc % 1 === 0)
                ? `${f.participacaoPerc}%`
                : `${f.participacaoPerc.toFixed(1)}%`;

            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td class="py-2 font-semibold text-slate-800 dark:text-slate-200">Fazenda ${f.fazenda}</td>
                    <td class="py-2 text-center text-slate-600 dark:text-slate-400">${f.talhoesCount}</td>
                    <td class="py-2 text-center text-slate-600 dark:text-slate-400">${f.totalLancamentos}</td>
                    <td class="py-2 text-center font-bold text-amber-600 dark:text-amber-400">${f.totalMachos}</td>
                    <td class="py-2 text-right font-bold text-slate-700 dark:text-slate-300">${percFormatted}</td>
                </tr>
            `;
        }).join('');
    }

    function renderTalhaoTable(talhoes) {
        const tbody = document.getElementById('rankingTalhoesBody');
        if (!tbody) return;

        tbody.innerHTML = talhoes.slice(0, 10).map(t => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                <td class="py-2 font-semibold text-slate-800 dark:text-slate-200">${t.local}</td>
                <td class="py-2 text-center font-bold text-rose-600 dark:text-rose-400">${t.totalMachos}</td>
                <td class="py-2 text-center text-slate-600 dark:text-slate-400">${t.mediaRecolh}</td>
                <td class="py-2 text-right"><span class="badge ${t.badgeClass} text-[10px]">${t.nivelRisco}</span></td>
            </tr>
        `).join('');
    }

    function renderResponsibleCards(responsaveis) {
        const cont = document.getElementById('containerResponsaveis');
        if (!cont) return;

        cont.innerHTML = responsaveis.map(r => `
            <div class="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-xs text-slate-900 dark:text-white truncate" title="${r.display}">${r.nome}</span>
                    <span class="badge badge-slate text-[10px]">${r.totalLancamentos} Lançamentos</span>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-3 text-[11px] pt-2 border-t border-slate-100 dark:border-slate-700">
                    <div><b>Instalações:</b> ${r.instalacoes}</div>
                    <div><b>Recolhimentos:</b> ${r.recolhimentos}</div>
                    <div><b>Capturas:</b> <span class="font-bold text-amber-600 dark:text-amber-400">${r.totalMachos}</span></div>
                    <div><b>Talhões:</b> ${r.talhoesCount}</div>
                </div>
                <div class="mt-2 text-right">
                    <button onclick="window.filtrarPorResponsavel('${r.nome}')" class="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline">Filtrar Lançamentos →</button>
                </div>
            </div>
        `).join('');
    }

    function updateChartsData(farms, talhoes, records, severities) {
        // 1. Fazendas (Top 10 com valores explícitos nas barras)
        if (state.charts.fazendas) {
            const topFaz = farms.slice(0, 10);
            const maxVal = Math.max(...topFaz.map(f => f.totalMachos), 10);
            state.charts.fazendas.options.scales.x.suggestedMax = Math.ceil(maxVal * 1.15);
            state.charts.fazendas.data.labels = topFaz.map(f => `Fazenda ${f.fazenda}`);
            state.charts.fazendas.data.datasets[0].data = topFaz.map(f => f.totalMachos);
            state.charts.fazendas.update();
        }

        // 2. Talhões (Top 10 com valores explícitos nas barras)
        if (state.charts.talhoes) {
            const topTal = talhoes.slice(0, 10);
            const maxVal = Math.max(...topTal.map(t => t.totalMachos), 10);
            state.charts.talhoes.options.scales.x.suggestedMax = Math.ceil(maxVal * 1.15);
            state.charts.talhoes.data.labels = topTal.map(t => t.local);
            state.charts.talhoes.data.datasets[0].data = topTal.map(t => t.totalMachos);
            state.charts.talhoes.update();
        }

        // 3. Timeline (Valores explícitos acima das barras)
        if (state.charts.timeline) {
            const timelineData = BrocaEngine.computeTemporalAnalytics(records, state.timelineMode);
            const maxCapt = Math.max(...timelineData.map(t => t.totalMachos), 10);
            const maxLanc = Math.max(...timelineData.map(t => t.totalLancamentos), 5);
            state.charts.timeline.options.scales.y.suggestedMax = Math.ceil(maxCapt * 1.25);
            state.charts.timeline.options.scales.y1.suggestedMax = Math.ceil(maxLanc * 1.3);
            state.charts.timeline.data.labels = timelineData.map(t => t.label);
            state.charts.timeline.data.datasets[0].data = timelineData.map(t => t.totalMachos);
            state.charts.timeline.data.datasets[1].data = timelineData.map(t => t.totalLancamentos);
            state.charts.timeline.update();
        }

        // 4. Severity Donut (Valores explícitos dentro das fatias e na legenda)
        if (state.charts.severity) {
            const dInstal = severities["Instalação (Ciclo Iniciado)"] || 0;
            const dZero = severities["Zero Capturas (Negativo)"] || 0;
            const dBaixa = severities["Baixa Captura (1-10)"] || 0;
            const dMedia = severities["Média Captura (11-25)"] || 0;
            const dCrit = severities["Foco Crítico (> 25)"] || 0;

            state.charts.severity.data.labels = [
                `Instalação (${dInstal})`,
                `Recolh. Zerado (${dZero})`,
                `Baixa 1-10 (${dBaixa})`,
                `Média 11-25 (${dMedia})`,
                `Crítico >25 (${dCrit})`
            ];
            state.charts.severity.data.datasets[0].data = [dInstal, dZero, dBaixa, dMedia, dCrit];
            state.charts.severity.update();
        }
    }

    // --- TABELA ANALÍTICA COM PAGINAÇÃO ---
    function renderTable() {
        const tbody = document.getElementById('tabelaBroca');
        const countLabel = document.getElementById('tableRecordCount');
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (!tbody) return;

        const records = state.filteredRecords;
        const total = records.length;
        const totalPages = Math.ceil(total / state.pageSize) || 1;

        if (state.currentPage > totalPages) state.currentPage = totalPages;
        if (state.currentPage < 1) state.currentPage = 1;

        if (countLabel) countLabel.textContent = `Mostrando ${total} de ${state.allRecords.length} lançamentos`;
        if (pageInfo) pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
        if (prevBtn) prevBtn.disabled = state.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = state.currentPage >= totalPages;

        const startIdx = (state.currentPage - 1) * state.pageSize;
        const pageRecords = records.slice(startIdx, startIdx + state.pageSize);

        if (pageRecords.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="text-center py-6 text-slate-500">Nenhum lançamento encontrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = pageRecords.map(r => {
            let etapaBadge = r.is_instalacao
                ? `<span class="badge badge-emerald">Instalação</span>`
                : `<span class="badge badge-blue">Recolhimento</span>`;

            let gravidadeBadge = `<span class="badge" style="background-color: ${r.cor_marcador}20; color: ${r.cor_marcador};">${r.faixa_captura}</span>`;

            return `
                <tr class="cursor-pointer" onclick="window.abrirModalInspecao(${r.id})">
                    <td class="font-bold text-amber-600 dark:text-amber-400">#${r.id}</td>
                    <td class="whitespace-nowrap">${r.data}</td>
                    <td>${etapaBadge}</td>
                    <td class="font-semibold">${r.fazenda}</td>
                    <td>${r.talhao}</td>
                    <td>${r.local_orig}</td>
                    <td class="font-bold text-center text-sm ${r.machos > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}">${r.machos}</td>
                    <td>${gravidadeBadge}</td>
                    <td class="max-w-[150px] truncate" title="${r.responsavel_display}">${r.responsavel_nome}</td>
                    <td><span class="badge badge-slate">${r.status}</span></td>
                    <td>
                        <button class="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-slate-700 dark:text-slate-200 transition">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // --- MODAL DE DETALHES ---
    window.abrirModalInspecao = function (id) {
        const r = state.allRecords.find(x => x.id === id);
        if (!r) return;

        const modal = document.getElementById('detailModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');

        if (!modal || !title || !body) return;

        title.textContent = `Armadilha #${r.id} • ${r.local_display}`;

        body.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                    <span class="font-bold text-slate-700 dark:text-slate-200 block border-b pb-1 mb-2 uppercase text-[11px]">
                        Identificação da Armadilha
                    </span>
                    <div class="space-y-1 text-slate-600 dark:text-slate-300">
                        <div><b>Fazenda:</b> ${r.fazenda}</div>
                        <div><b>Talhão:</b> ${r.talhao}</div>
                        <div><b>Etapa:</b> <span class="badge ${r.is_instalacao ? 'badge-emerald' : 'badge-blue'}">${r.etapa}</span></div>
                        <div><b>Data:</b> ${r.data}</div>
                        <div><b>Duração:</b> ${r.duracao_min} min</div>
                        <div><b>Status:</b> ${r.status} | <b>Score:</b> ${r.score}</div>
                    </div>
                </div>

                <div class="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <span class="font-bold text-amber-800 dark:text-amber-300 block border-b pb-1 mb-2 uppercase text-[11px]">
                        Contagem e Nível Entomológico
                    </span>
                    <div class="space-y-1 text-slate-700 dark:text-slate-200">
                        <div class="text-xl font-black text-amber-600 dark:text-amber-400">${r.machos} Brocas Capturadas</div>
                        <div><b>Classificação:</b> ${r.faixa_captura}</div>
                        <div class="pt-2 text-[11px] text-slate-500">
                            ${r.is_instalacao ? 'Armadilha instalada no campo. Início da atração por feromônio.' : 'Leitura da armadilha após período de exposição.'}
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                <span class="font-bold text-slate-700 dark:text-slate-200 block border-b pb-1 mb-2 uppercase text-[11px]">
                    Equipe e Georreferenciamento
                </span>
                <div class="space-y-1 text-slate-600 dark:text-slate-300">
                    <div><b>Responsável Lançamento:</b> ${r.responsavel_display}</div>
                    <div><b>Usuário MapFy:</b> ${r.usuario}</div>
                    <div><b>Coordenadas GPS:</b> Lat ${r.lat} | Lon ${r.lon}</div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    };

    window.filtrarPorResponsavel = function (nome) {
        const sel = document.getElementById('filterResponsavel');
        if (sel) {
            sel.value = nome;
            state.activeFilters.responsavel = nome;
            aplicarFiltros();
        }
    };

    // --- BIND DE EVENTOS ---
    function bindEvents() {
        ['filterFazenda', 'filterEtapa', 'filterResponsavel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    const keyMap = {
                        filterFazenda: 'fazenda',
                        filterEtapa: 'etapa',
                        filterResponsavel: 'responsavel'
                    };
                    state.activeFilters[keyMap[id]] = el.value;
                    aplicarFiltros();
                });
            }
        });

        const dtIni = document.getElementById('filterDataInicio');
        const dtFim = document.getElementById('filterDataFim');
        if (dtIni) dtIni.addEventListener('change', () => { state.activeFilters.dataInicio = dtIni.value; aplicarFiltros(); });
        if (dtFim) dtFim.addEventListener('change', () => { state.activeFilters.dataFim = dtFim.value; aplicarFiltros(); });

        const chkPos = document.getElementById('chkSomentePositivos');
        const chkRec = document.getElementById('chkSomenteRecolhimento');
        const chkCoords = document.getElementById('chkSomenteCoords');
        if (chkPos) chkPos.addEventListener('change', () => { state.activeFilters.somentePositivos = chkPos.checked; aplicarFiltros(); });
        if (chkRec) chkRec.addEventListener('change', () => { state.activeFilters.somenteRecolhimento = chkRec.checked; aplicarFiltros(); });
        if (chkCoords) chkCoords.addEventListener('change', () => { state.activeFilters.somenteCoords = chkCoords.checked; aplicarFiltros(); });

        const search = document.getElementById('searchInput');
        if (search) {
            search.addEventListener('input', () => {
                state.activeFilters.buscaTexto = search.value.trim();
                aplicarFiltros();
            });
        }

        const resetBtn = document.getElementById('btnResetFilters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                document.querySelectorAll('select').forEach(s => s.value = s.options[0].value);
                if (dtIni) dtIni.value = '';
                if (dtFim) dtFim.value = '';
                if (search) search.value = '';
                if (chkPos) chkPos.checked = false;
                if (chkRec) chkRec.checked = false;
                if (chkCoords) chkCoords.checked = true;

                state.activeFilters = {
                    dataInicio: '', dataFim: '', fazenda: 'TODAS', talhao: 'TODOS',
                    etapa: 'TODAS', responsavel: 'TODOS', faixaGravidade: 'TODAS',
                    somentePositivos: false, somenteRecolhimento: false,
                    somenteCoords: true, buscaTexto: ''
                };
                aplicarFiltros();
            });
        }

        const mapBtns = [
            { id: 'btnMapAll', mode: 'all' },
            { id: 'btnMapCriticos', mode: 'criticos' },
            { id: 'btnMapPositivos', mode: 'positivos' },
            { id: 'btnMapZerados', mode: 'zerados' }
        ];
        mapBtns.forEach(b => {
            const el = document.getElementById(b.id);
            if (el) {
                el.addEventListener('click', () => {
                    state.mapMode = b.mode;
                    mapBtns.forEach(x => {
                        const btnEl = document.getElementById(x.id);
                        if (btnEl) {
                            if (x.mode === b.mode) {
                                btnEl.className = 'px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-slate-700 shadow-xs text-slate-800 dark:text-white transition';
                            } else {
                                btnEl.className = 'px-2.5 py-1 rounded-md font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 transition';
                            }
                        }
                    });
                    updateMapMarkers();
                });
            }
        });

        const btnDia = document.getElementById('btnTimelineDia');
        const btnMes = document.getElementById('btnTimelineMes');
        if (btnDia && btnMes) {
            btnDia.addEventListener('click', () => {
                state.timelineMode = 'dia';
                btnDia.className = 'px-2 py-0.5 rounded font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300';
                btnMes.className = 'px-2 py-0.5 rounded font-semibold text-slate-500 hover:text-slate-800';
                updateChartsData(BrocaEngine.computeFarmRanking(state.filteredRecords), BrocaEngine.computeTalhaoRanking(state.filteredRecords), state.filteredRecords, BrocaEngine.computeSeverityDistribution(state.filteredRecords));
            });
            btnMes.addEventListener('click', () => {
                state.timelineMode = 'mes';
                btnMes.className = 'px-2 py-0.5 rounded font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300';
                btnDia.className = 'px-2 py-0.5 rounded font-semibold text-slate-500 hover:text-slate-800';
                updateChartsData(BrocaEngine.computeFarmRanking(state.filteredRecords), BrocaEngine.computeTalhaoRanking(state.filteredRecords), state.filteredRecords, BrocaEngine.computeSeverityDistribution(state.filteredRecords));
            });
        }

        const prevPage = document.getElementById('prevPage');
        const nextPage = document.getElementById('nextPage');
        if (prevPage) prevPage.addEventListener('click', () => { state.currentPage--; renderTable(); });
        if (nextPage) nextPage.addEventListener('click', () => { state.currentPage++; renderTable(); });

        const closeBtn = document.getElementById('modalCloseBtn');
        const closeBottomBtn = document.getElementById('modalCloseBottomBtn');
        const modal = document.getElementById('detailModal');
        const closeModal = () => modal?.classList.add('hidden');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (closeBottomBtn) closeBottomBtn.addEventListener('click', closeModal);
        if (modal) {
            modal.addEventListener('click', e => {
                if (e.target === modal) closeModal();
            });
        }

        const btnExcel = document.getElementById('btnExportExcel');
        const btnCsv = document.getElementById('btnExportCSV');
        if (btnExcel) btnExcel.addEventListener('click', exportToExcel);
        if (btnCsv) btnCsv.addEventListener('click', exportToCSV);

        // Redimensionamento Dinâmico (Celulares, Tablets, Notebooks, Desktops e TVs)
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (state.map) {
                    state.map.invalidateSize();
                }
                Object.values(state.charts).forEach(c => {
                    if (c) c.resize();
                });
            }, 100);
        });
    }

    function aplicarFiltros() {
        state.filteredRecords = BrocaEngine.filterRecords(state.allRecords, state.activeFilters);
        state.currentPage = 1;
        updateAllViews();
    }

    // --- EXPORTAÇÃO EXCEL (.XLSX) VIA SHEETJS ---
    function exportToExcel() {
        const rows = state.filteredRecords.map(r => ({
            "ID": r.id,
            "Data": r.data,
            "Etapa": r.etapa,
            "Fazenda": r.fazenda,
            "Talhão": r.talhao,
            "Local Completo": r.local_orig,
            "Quantidade Brocas": r.machos,
            "Classificação Gravidade": r.faixa_captura,
            "Responsável Lançamento": r.responsavel_display,
            "Status": r.status,
            "Score": r.score,
            "Latitude": r.lat,
            "Longitude": r.lon,
            "Duração (min)": r.duracao_min,
            "Usuário": r.usuario
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Armadilhas Broca");
        XLSX.writeFile(wb, "Monitoramento_Broca_Armadilhas_Pitangueiras_2026.xlsx");
    }

    // --- EXPORTAÇÃO CSV UTF-8 COM BOM ---
    function exportToCSV() {
        const headers = ["ID", "Data", "Etapa", "Fazenda", "Talhao", "Local", "Quantidade_Brocas", "Gravidade", "Responsavel", "Status", "Lat", "Lon"];
        let csvContent = "\uFEFF" + headers.join(";") + "\n";

        state.filteredRecords.forEach(r => {
            const row = [
                r.id,
                `"${r.data}"`,
                `"${r.etapa}"`,
                `"${r.fazenda}"`,
                `"${r.talhao}"`,
                `"${r.local_orig}"`,
                r.machos,
                `"${r.faixa_captura}"`,
                `"${r.responsavel_display}"`,
                `"${r.status}"`,
                r.lat,
                r.lon
            ];
            csvContent += row.join(";") + "\n";
        });

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Monitoramento_Broca_Armadilhas_Pitangueiras_2026.csv";
        link.click();
    }

})();
