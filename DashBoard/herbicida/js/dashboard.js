/**
 * dashboard.js
 * Controlador da Central de Inteligência de Aplicação de Herbicidas
 * Usina Pitangueiras - Safra 2026
 */

(function () {
    'use strict';

    const HerbicidaEngine = window.HerbicidaEngine || {};
    const OpenMeteoService = window.OpenMeteoService || {};

    const state = {
        allRecords: (window.HerbicidaEngine && typeof window.HerbicidaEngine.normalizeRecord === 'function')
            ? (window.HERBICIDA_DATA || []).map(r => window.HerbicidaEngine.normalizeRecord(r))
            : (window.HERBICIDA_DATA || []),
        filteredRecords: [],
        activeFilters: {
            dataInicio: '',
            dataFim: '',
            fazenda: 'TODAS',
            os: 'TODAS',
            operacao: 'TODAS',
            plantaSoca: 'TODAS',
            status: 'TODOS',
            filtroBomba: 'TODOS',
            limpezaBicos: 'TODOS',
            deltaTClasse: 'TODAS',
            equipamento: 'TODOS',
            somenteOcorrencias: false,
            somenteNok: false,
            somenteCoords: true,
            buscaTexto: ''
        },
        mapMode: 'all',
        map: null,
        markersLayer: null,
        charts: {},
        weatherSyncMap: new Map(),
        auditStats: null,
        modalTimelineChart: null,
        timelineMode: 'dia',
        currentPage: 1,
        pageSize: 10
    };
    window.dashboardState = state;
    window.state = state;

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        if (!state.allRecords || state.allRecords.length === 0 || !state.allRecords[0]?.q01) {
            const raw = window.HERBICIDA_DATA || [];
            state.allRecords = (window.HerbicidaEngine && typeof window.HerbicidaEngine.normalizeRecord === 'function')
                ? raw.map(r => window.HerbicidaEngine.normalizeRecord(r))
                : raw;
        }
        state.filteredRecords = [...state.allRecords];
        if (window.OpenMeteoService) {
            state.weatherSyncMap = (typeof window.OpenMeteoService.syncRecordsSync === 'function')
                ? window.OpenMeteoService.syncRecordsSync(state.allRecords)
                : new Map();
            state.auditStats = window.OpenMeteoService.auditDataset(state.allRecords, state.weatherSyncMap);
        }
        initTheme();
        initSafraYear();
        initFilters();
        initMap();
        initCharts();
        updateAllViews();
        bindEvents();
    }

    // --- GERENCIAMENTO DE TEMA (CLARO/ESCURO) ---
    function initTheme() {
        const savedTheme = localStorage.getItem('pitangueiras_theme') || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
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

    // --- IDENTIFICAÇÃO DINÂMICA DE SAFRA E ANO (VIRADA AUTOMÁTICA) ---
    function initSafraYear() {
        const currentYear = new Date().getFullYear();
        const badgeSafra = document.getElementById('badgeSafraAno');
        if (badgeSafra) {
            badgeSafra.innerHTML = `<i class="fa-solid fa-spray-can-sparkles mr-1"></i> Safra ${currentYear}`;
        }
        const mobileScope = document.getElementById('mobileSummaryScopeText');
        if (mobileScope) {
            mobileScope.textContent = `Safra ${currentYear}`;
        }
    }

    // --- INICIALIZAÇÃO DE FILTROS ---
    function initFilters() {
        const fazendas = new Set();
        const ordens = new Set();
        const operacoes = new Set();
        const plantasSocas = new Set();
        const dateCounts = new Map();

        state.allRecords.forEach(r => {
            if (r.fazenda) fazendas.add(r.fazenda);
            if (r.os) ordens.add(r.os);
            if (r.operacao) operacoes.add(r.operacao);
            if (r.planta_soca) plantasSocas.add(r.planta_soca);
            if (r.data_iso) {
                dateCounts.set(r.data_iso, (dateCounts.get(r.data_iso) || 0) + 1);
            }
        });

        // Filtro Global de Datas: Popula dinamicamente SOMENTE datas com relatórios
        const sortedDates = Array.from(dateCounts.keys()).sort();
        populateDateSelect('filterDataInicio', sortedDates, dateCounts, 'Todas as Datas com Relatórios');
        populateDateSelect('filterDataFim', sortedDates, dateCounts, 'Todas as Datas com Relatórios');

        populateSelect('filterFazenda', Array.from(fazendas).sort(), 'Todas as Fazendas');
        populateSelect('filterOS', Array.from(ordens).sort(), 'Todas as OS');
        populateSelect('filterOperacao', Array.from(operacoes).sort(), 'Todas as Operações');
        populateSelect('filterPlantaSoca', Array.from(plantasSocas).sort(), 'Todas');
    }

    function populateDateSelect(id, sortedDates, dateCounts, defaultLabel) {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = `<option value="">${defaultLabel}</option>`;
        sortedDates.forEach(isoDate => {
            const count = dateCounts.get(isoDate) || 0;
            const parts = isoDate.split('-');
            const brDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : isoDate;
            const opt = document.createElement('option');
            opt.value = isoDate;
            opt.textContent = `${brDate} (${count} ${count === 1 ? 'relatório' : 'relatórios'})`;
            sel.appendChild(opt);
        });
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

        // Centralizado na área operacional da Usina Pitangueiras (-21.05, -48.35)
        state.map = L.map('mapContainer', {
            center: [-21.05, -48.35],
            zoom: 11,
            zoomControl: true
        });

        // OpenStreetMap oficial sem necessidade de chave de API ou marcas de água
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

            // Filtro por modo do mapa
            if (state.mapMode === 'ocorrencias' && !r.tem_ocorrencia) return;
            if (state.mapMode === 'nok' && !r.tem_nok_estruturado && !r.is_vazamento && !r.is_problema_bico) return;
            if (state.mapMode === 'clima' && (!r.has_weather || r.delta_t_classe === 'Ideal (2-8°C)')) return;

            bounds.push([r.lat, r.lon]);

            // Determina a cor do pino
            let pinBg = r.pin_color || '#10B981';
            let iconHtml = '<i class="fa-solid fa-check"></i>';
            if (r.is_parada_clima || r.delta_t_classe === 'Crítico (> 10°C)') {
                iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';
            } else if (r.tem_nok_estruturado || r.is_vazamento || r.is_problema_bico) {
                iconHtml = '<i class="fa-solid fa-wrench"></i>';
            } else if (r.delta_t_classe === 'Atenção (8-10°C)') {
                iconHtml = '<i class="fa-solid fa-cloud"></i>';
            }

            const customIcon = L.divIcon({
                className: 'custom-map-icon',
                html: `<div class="custom-pin" style="background-color: ${pinBg};">${iconHtml}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
                popupAnchor: [0, -14]
            });

            const marker = L.marker([r.lat, r.lon], { icon: customIcon });

            // Popup rico com os 6 grupos de informação
            const popupContent = `
                <div class="p-1 space-y-1 text-xs">
                    <div class="flex items-center justify-between gap-2 border-b pb-1 font-bold text-slate-800 dark:text-white">
                        <span>#${r.id} • Fazenda ${r.fazenda}</span>
                        <span class="badge" style="background-color: ${pinBg}20; color: ${pinBg};">${r.delta_t_classe || 'Sem Clima'}</span>
                    </div>
                    <div><b>OS:</b> ${r.os} | <b>Op:</b> ${r.operacao}</div>
                    <div><b>Cultura:</b> ${r.planta_soca} | <b>Data:</b> ${r.data}</div>
                    <div class="pt-1 border-t">
                        <b>Clima:</b> Vento ${r.vento || '-'} km/h | UR ${r.ur || '-'}% | Temp ${r.temp || '-'}°C | <b>ΔT:</b> ${r.delta_t_num ? r.delta_t_num + '°C' : '-'}
                    </div>
                    <div class="pt-1 border-t">
                        <b>Implemento:</b> Espaçamento: ${r.esp_orig} | Vazão: ${r.vazao_orig}
                    </div>
                    <div class="pt-1 border-t">
                        <b>Filtro:</b> ${r.filtro_bomba} | <b>Bicos:</b> ${r.limpeza_bicos} | <b>Mapa/OS:</b> ${r.mapa_os}
                    </div>
                    ${r.obs ? `<div class="pt-1 border-t text-[11px] text-amber-700 dark:text-amber-300"><b>Obs:</b> ${r.obs}</div>` : ''}
                    <div class="pt-1 text-right">
                        <button type="button" onclick="event.stopPropagation(); window.abrirModalInspecao('${r.id}')" class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline">Ver ficha completa →</button>
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

    // Plugin Universal de Rótulos de Dados (Garante valores visíveis em barras e donuts sob qualquer condição)
    const universalDataLabelsPlugin = {
        id: 'universalDataLabelsHerbicida',
        afterDatasetsDraw(chart) {
            const ctx = chart.ctx;
            const chartType = chart.config.type;
            if (chartType !== 'bar' && chartType !== 'doughnut' && chartType !== 'pie') return;

            const isDark = document.documentElement.classList.contains('dark');
            const defaultTextColor = isDark ? '#FFFFFF' : '#0F172A';

            chart.data.datasets.forEach((dataset, datasetIdx) => {
                const meta = chart.getDatasetMeta(datasetIdx);
                if (meta.hidden) return;

                meta.data.forEach((element, index) => {
                    const val = dataset.data ? dataset.data[index] : null;
                    if (val === undefined || val === null || val === 0 || val === '0' || val === '' || isNaN(val)) return;

                    ctx.save();
                    ctx.font = 'bold 11px Inter, sans-serif';

                    if (chartType === 'pie' || chartType === 'doughnut') {
                        const angleSpan = element.endAngle - element.startAngle;
                        if (angleSpan >= 0.18) {
                            const pos = element.tooltipPosition ? element.tooltipPosition() : null;
                            if (pos) {
                                ctx.fillStyle = '#FFFFFF';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.font = 'bold 12px Inter, sans-serif';
                                ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
                                ctx.shadowBlur = 4;
                                ctx.fillText(String(val), pos.x, pos.y);
                            }
                        }
                    } else if (chartType === 'bar' && chart.options.indexAxis === 'y') {
                        ctx.fillStyle = defaultTextColor;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(String(val), element.x + 6, element.y);
                    } else if (chartType === 'bar') {
                        ctx.fillStyle = defaultTextColor;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(String(val), element.x, element.y - 3);
                    }
                    ctx.restore();
                });
            });

            // Totalizador no Centro de Gráficos Doughnut (Ex: Planta, Soca ou Carreador)
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
                        ctx.font = `700 ${fontSizeLabel}px 'Plus Jakarta Sans', sans-serif`;
                        ctx.fillStyle = isDark ? '#E2E8F0' : '#475569';
                        ctx.fillText('TOTAL', centerX, centerY + (fontSizeNum * 0.55));

                        ctx.restore();
                    }
                }
            }
        }
    };

    // --- CONFIGURAÇÃO DE LEGENDA RICA PARA DONUTS (VALOR + PORCENTAGEM) ---
    function createDonutLegendConfig(textColor, position = 'right') {
        const isDark = document.documentElement.classList.contains('dark');
        const activeTextColor = isDark ? '#FFFFFF' : '#0F172A';
        return {
            position: position,
            labels: {
                boxWidth: 12,
                boxHeight: 12,
                color: activeTextColor,
                padding: 10,
                font: { size: 11, weight: '700' },
                generateLabels: function (chart) {
                    const data = chart.data;
                    if (data.labels && data.labels.length && data.datasets && data.datasets.length) {
                        const dataset = data.datasets[0];
                        const total = (dataset.data || []).reduce((acc, v) => acc + (Number(v) || 0), 0);
                        const darkNow = document.documentElement.classList.contains('dark');
                        return data.labels.map((label, i) => {
                            const val = dataset.data && dataset.data[i] !== undefined ? dataset.data[i] : 0;
                            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                            const bg = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[i] : dataset.backgroundColor;
                            const meta = chart.getDatasetMeta(0);
                            const isHidden = meta && meta.data && meta.data[i] ? meta.data[i].hidden : false;
                            return {
                                text: `${label}: ${val} (${pct}%)`,
                                fillStyle: bg,
                                strokeStyle: bg,
                                lineWidth: 0,
                                hidden: isHidden,
                                index: i,
                                fontColor: darkNow ? '#FFFFFF' : '#0F172A'
                            };
                        });
                    }
                    return [];
                }
            }
        };
    }

    // --- GRÁFICOS INTERATIVOS VIA CHART.JS ---
    function initCharts() {
        if (typeof Chart !== 'undefined' && Chart.register) {
            Chart.register(universalDataLabelsPlugin);
        }

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#FFFFFF' : '#0F172A';
        const tickColor = isDark ? '#F1F5F9' : '#1E293B';
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

        // 1. Gráfico Pareado: Delta T Campo vs Modelo ERA5
        const ctxAuditComp = document.getElementById('chartAuditComparison')?.getContext('2d');
        if (ctxAuditComp) {
            state.charts.auditComparison = new Chart(ctxAuditComp, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [
                        { label: 'Delta T Campo (°C)', data: [], backgroundColor: '#10B981', borderRadius: 4 },
                        { label: 'Delta T ERA5 (°C)', data: [], backgroundColor: '#0284C7', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10, weight: '600' }, maxRotation: 45 } },
                        y: {
                            beginAtZero: true,
                            grace: '15%',
                            grid: { color: gridColor },
                            ticks: { color: tickColor, font: { weight: '600' }, precision: 1 },
                            title: { display: true, text: 'Delta T (°C)', color: textColor, font: { weight: '700' } }
                        }
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, color: textColor } },
                        tooltip: {
                            callbacks: {
                                label: ctx => `${ctx.dataset.label}: ${ctx.raw}°C`
                            }
                        }
                    }
                }
            });
        }

        // 2. Gráfico Donut: Distribuição da Auditoria Climática
        const ctxAuditDist = document.getElementById('chartAuditDistribution')?.getContext('2d');
        if (ctxAuditDist) {
            state.charts.auditDistribution = new Chart(ctxAuditDist, {
                type: 'doughnut',
                data: {
                    labels: ['Compatível', 'Divergência Moderada', 'Divergência Elevada', 'Reconstruído (ERA5)'],
                    datasets: [{
                        data: [0, 0, 0, 0],
                        backgroundColor: ['#10B981', '#F59E0B', '#EF4444', '#3B82F6'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: createDonutLegendConfig(textColor, 'right'),
                        tooltip: {
                            callbacks: {
                                label: ctx => {
                                    const total = ctx.dataset.data.reduce((a, b) => a + (Number(b) || 0), 0);
                                    const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                                    return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
                                }
                            }
                        }
                    },
                    cutout: '65%'
                }
            });
        }

        // 3. Classes de Delta T (Donut)
        const ctxDeltaT = document.getElementById('chartDeltaTClasses')?.getContext('2d');
        if (ctxDeltaT) {
            state.charts.deltaT = new Chart(ctxDeltaT, {
                type: 'doughnut',
                data: {
                    labels: ['Ideal (2-8°C)', 'Atenção (8-10°C)', 'Crítico (>10°C)', 'Sem Telemetria'],
                    datasets: [{
                        data: [0, 0, 0, 0],
                        backgroundColor: ['#10B981', '#F59E0B', '#EF4444', '#94A3B8'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: createDonutLegendConfig(textColor, 'right'),
                        tooltip: {
                            callbacks: {
                                label: ctx => {
                                    const total = ctx.dataset.data.reduce((a, b) => a + (Number(b) || 0), 0);
                                    const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                                    return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
                                }
                            }
                        }
                    },
                    cutout: '65%'
                }
            });
        }

        // 4. Matriz de Limpeza
        const ctxLimpeza = document.getElementById('chartLimpezaMatriz')?.getContext('2d');
        if (ctxLimpeza) {
            state.charts.limpeza = new Chart(ctxLimpeza, {
                type: 'bar',
                data: {
                    labels: ['Filtros da Bomba', 'Bicos de Aplicação'],
                    datasets: [
                        { label: 'Conforme (OK)', data: [0, 0], backgroundColor: '#10B981' },
                        { label: 'Irregular (NOK)', data: [0, 0], backgroundColor: '#EF4444' }
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

        // 5. Vazão e Espaçamento
        const ctxVazao = document.getElementById('chartVazaoEspacamento')?.getContext('2d');
        if (ctxVazao) {
            state.charts.vazao = new Chart(ctxVazao, {
                type: 'bar',
                data: {
                    labels: ['200 L/ha', '150 L/ha', '300 L/ha', 'Não Informado'],
                    datasets: [{
                        label: 'Inspeções',
                        data: [0, 0, 0, 0],
                        backgroundColor: ['#0D9488', '#3B82F6', '#8B5CF6', '#CBD5E1'],
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { grid: { display: false }, ticks: { color: textColor } },
                        y: { beginAtZero: true, grace: '12%', grid: { color: gridColor }, ticks: { color: textColor, precision: 0 } }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }

        // 6. Operações
        const ctxOperacoes = document.getElementById('chartOperacoes')?.getContext('2d');
        if (ctxOperacoes) {
            state.charts.operacoes = new Chart(ctxOperacoes, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Inspeções',
                        data: [],
                        backgroundColor: '#10B981',
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

        // 7. Planta ou Soca
        const ctxPlantaSoca = document.getElementById('chartPlantaSoca')?.getContext('2d');
        if (ctxPlantaSoca) {
            state.charts.plantaSoca = new Chart(ctxPlantaSoca, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: ['#10B981', '#06B6D4', '#F59E0B', '#94A3B8'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: createDonutLegendConfig(textColor, 'bottom'),
                        tooltip: {
                            callbacks: {
                                label: ctx => {
                                    const total = ctx.dataset.data.reduce((a, b) => a + (Number(b) || 0), 0);
                                    const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                                    return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
                                }
                            }
                        }
                    },
                    cutout: '60%'
                }
            });
        }

        // 8. Timeline
        const ctxTimeline = document.getElementById('chartTimeline')?.getContext('2d');
        if (ctxTimeline) {
            state.charts.timeline = new Chart(ctxTimeline, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [
                        { label: 'Total Inspeções', data: [], backgroundColor: '#10B981', borderRadius: 4 },
                        { label: 'Ocorrências / Riscos', data: [], backgroundColor: '#EF4444', borderRadius: 4 }
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
        const textColor = isDark ? '#FFFFFF' : '#0F172A';
        const tickColor = isDark ? '#F1F5F9' : '#1E293B';
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

        Object.values(state.charts).forEach(c => {
            if (!c) return;
            if (c.options.scales) {
                if (c.options.scales.x) {
                    if (c.options.scales.x.ticks) c.options.scales.x.ticks.color = tickColor;
                    if (c.options.scales.x.grid) c.options.scales.x.grid.color = gridColor;
                    if (c.options.scales.x.title) c.options.scales.x.title.color = textColor;
                }
                if (c.options.scales.y) {
                    if (c.options.scales.y.ticks) c.options.scales.y.ticks.color = tickColor;
                    if (c.options.scales.y.grid) c.options.scales.y.grid.color = gridColor;
                    if (c.options.scales.y.title) c.options.scales.y.title.color = textColor;
                }
            }
            if (c.options.plugins && c.options.plugins.legend) {
                if (c.options.plugins.legend.labels) {
                    c.options.plugins.legend.labels.color = textColor;
                }
            }
            c.update();
        });
    }

    // --- ATUALIZAÇÃO COMPLETA DAS VISÕES ---
    function updateAllViews() {
        const records = state.filteredRecords;
        const kpis = HerbicidaEngine.computeExecutiveKPIs(records);
        const weather = HerbicidaEngine.computeWeatherStats(records);
        const equipCondition = HerbicidaEngine.computeEquipmentCondition(records);
        const occurrences = HerbicidaEngine.computeOccurrencesIntelligence(records);
        const fleet = HerbicidaEngine.computeEquipmentFleet(records);
        const operations = HerbicidaEngine.computeOperationBreakdown(records);
        const plantSoca = HerbicidaEngine.computePlantaSocaBreakdown(records);
        const farms = HerbicidaEngine.computeFarmRanking(records);
        const duration = HerbicidaEngine.computeDurationStats(records);

        // Atualiza Cards de KPIs
        setText('kpiTotal', kpis.total);
        setText('kpiFechado', kpis.fechados);
        setText('kpiAberto', kpis.abertos);
        setText('kpiComNok', kpis.comNok);
        setText('kpiPercNok', `${kpis.percNok}% da base`);
        setText('kpiComOcorrencia', kpis.comOcorrencia);
        setText('kpiPercOcorrencia', `${kpis.percOcorrencia}% da base`);
        setText('kpiAlertasClima', kpis.alertasClima);
        setText('kpiFazendas', kpis.fazendasCount);
        setText('kpiOS', kpis.osCount);
        setText('kpiHeaderBadge', `${kpis.total} Registros Filtrados`);

        // Atualiza Métricas Meteorológicas
        setText('valVentoAvg', weather.vento.avg.toFixed(1));
        setText('valVentoMin', weather.vento.min.toFixed(1));
        setText('valVentoMax', weather.vento.max.toFixed(1));
        setText('valVentoCount', weather.vento.count);

        setText('valUrAvg', `${weather.ur.avg.toFixed(1)}%`);
        setText('valUrMin', `${weather.ur.min.toFixed(0)}%`);
        setText('valUrMax', `${weather.ur.max.toFixed(0)}%`);
        setText('valUrCount', weather.ur.count);

        setText('valTempAvg', `${weather.temp.avg.toFixed(1)}°C`);
        setText('valTempMin', `${weather.temp.min.toFixed(1)}°C`);
        setText('valTempMax', `${weather.temp.max.toFixed(1)}°C`);
        setText('valTempCount', weather.temp.count);

        setText('valDeltaTAvg', `${weather.deltaT.avg.toFixed(2)}°C`);
        setText('valDeltaTMedio', `${weather.deltaT.avg.toFixed(1)}°C`);
        setText('valDeltaTMin', `${weather.deltaT.min.toFixed(2)}°C`);
        setText('valDeltaTMax', `${weather.deltaT.max.toFixed(2)}°C`);

        const dtClass = HerbicidaEngine.classifyDeltaT(weather.deltaT.avg);
        const badgeDelta = document.getElementById('badgeDeltaTStatus');
        if (badgeDelta) {
            badgeDelta.textContent = dtClass.classe;
            badgeDelta.style.backgroundColor = dtClass.color + '25';
            badgeDelta.style.color = dtClass.color;
            badgeDelta.style.borderColor = dtClass.color + '60';
        }

        setText('countDeltaIdeal', weather.deltaT.classes['Ideal (2-8°C)'] || 0);
        setText('countDeltaAtencao', weather.deltaT.classes['Atenção (8-10°C)'] || 0);
        setText('countDeltaCritico', weather.deltaT.classes['Crítico (> 10°C)'] || 0);
        setText('countDeltaInversao', weather.deltaT.classes['Inversão (< 2°C)'] || 0);
        setText('countDeltaSemDados', weather.semTelemetria);

        const totalClima = weather.totalComClima || 1;
        setBarWidth('barDeltaIdeal', `${((weather.deltaT.classes['Ideal (2-8°C)'] || 0) / totalClima) * 100}%`);
        setBarWidth('barDeltaAtencao', `${((weather.deltaT.classes['Atenção (8-10°C)'] || 0) / totalClima) * 100}%`);
        setBarWidth('barDeltaCritico', `${((weather.deltaT.classes['Crítico (> 10°C)'] || 0) / totalClima) * 100}%`);

        // Atualiza Limpeza & Manutenção
        setText('valAmbosOk', equipCondition.matrizLimpeza.ambosOk);
        setText('valApenasFiltroNok', equipCondition.matrizLimpeza.apenasFiltroNok);
        setText('valApenasBicoNok', equipCondition.matrizLimpeza.apenasBicoNok);
        setText('valAmbosNok', equipCondition.matrizLimpeza.ambosNok);

        renderList('listEspacamentoGrupos', equipCondition.espGrupos);
        renderList('listVazaoGrupos', equipCondition.vazoes);

        // Atualiza Ocorrências
        setText('valParadasClima', occurrences.paradasClima);
        setText('valVazamentosCount', occurrences.vazamentos);
        setText('valProblemasBicoCount', occurrences.problemasBicos);
        setText('valAcoesRegistradas', occurrences.acoesRegistradas);
        setText('badgeOcorrenciasTotal', `${kpis.comOcorrencia} Ocorrências Identificadas`);
        renderOccurrencesFeed(records);

        // Atualiza Frota de Equipamentos
        renderFleetCards(fleet);

        // Ranking Fazendas
        renderFarmRanking(farms);

        // Duração
        setText('valDuracaoAvg', `${duration.avg} min`);
        setText('valDuracaoMediana', `${duration.median} min`);
        setText('valDuracaoMin', `${duration.min} min`);
        setText('valDuracaoMax', `${duration.max} min`);

        // Atualiza Gráficos
        updateChartsData(records, weather, equipCondition, operations, plantSoca);

        // Atualiza Mapa
        updateMapMarkers();

        // Atualiza Tabela Analítica
        renderTable();
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function setBarWidth(id, width) {
        const el = document.getElementById(id);
        if (el) el.style.width = width;
    }

    function renderList(id, obj) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = Object.entries(obj).map(([k, v]) => `
            <li class="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span class="truncate pr-2">${k}</span>
                <span class="font-bold text-slate-800 dark:text-slate-100 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px]">${v}</span>
            </li>
        `).join('');
    }

    function renderOccurrencesFeed(records) {
        const feed = document.getElementById('feedOcorrencias');
        if (!feed) return;

        const ocorrencias = records.filter(r => r.tem_ocorrencia || r.obs);
        if (ocorrencias.length === 0) {
            feed.innerHTML = `
                <div class="p-4 text-center text-xs text-slate-500">
                    Nenhuma ocorrência encontrada com os filtros selecionados.
                </div>
            `;
            return;
        }

        feed.innerHTML = ocorrencias.map(r => {
            const tagsHtml = (r.tags || []).map(t => {
                let badgeClass = 'badge-slate';
                if (t.includes('Clima') || t.includes('Parada')) badgeClass = 'badge-red';
                else if (t.includes('Vazamento') || t.includes('Danificado')) badgeClass = 'badge-amber';
                else if (t.includes('Concluído') || t.includes('Orientado')) badgeClass = 'badge-emerald';
                return `<span class="badge ${badgeClass} text-[10px]">${t}</span>`;
            }).join(' ');

            return `
                <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 transition">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-xs text-slate-800 dark:text-white">#${r.id}</span>
                            <span class="text-[11px] text-slate-500">Fazenda ${r.fazenda} • OS ${r.os}</span>
                        </div>
                        <span class="text-[11px] text-slate-400">${r.data}</span>
                    </div>
                    <p class="text-xs text-slate-700 dark:text-slate-300 mt-1.5 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-800 whitespace-pre-line">
                        ${r.obs || 'Registro com status irregular ou telemetria em alerta.'}
                    </p>
                    <div class="flex items-center justify-between gap-2 mt-2">
                        <div class="flex flex-wrap gap-1">${tagsHtml}</div>
                        <button type="button" onclick="event.stopPropagation(); window.abrirModalInspecao('${r.id}')" class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline">Detalhes →</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderFleetCards(fleet) {
        const cont = document.getElementById('containerFrotaEquipamentos');
        if (!cont) return;

        cont.innerHTML = fleet.frota.map(eq => {
            const hasOcorr = eq.ocorrencias > 0;
            return `
                <div class="p-3 rounded-lg border ${hasOcorr ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-truck-pickup text-emerald-600"></i>
                            <span class="font-bold text-xs text-slate-800 dark:text-slate-100">${eq.nome}</span>
                        </div>
                        <span class="badge ${hasOcorr ? 'badge-amber' : 'badge-emerald'} text-[10px]">
                            ${eq.inspecoes} Inspeções
                        </span>
                    </div>
                    <div class="mt-2 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                        <span>Ocorrências: <b class="${hasOcorr ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}">${eq.ocorrencias}</b></span>
                        <button onclick="window.filtrarPorEquipamento('${eq.nome}')" class="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">Filtrar Ativo</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderFarmRanking(farms) {
        const tbody = document.getElementById('rankingFazendasBody');
        if (!tbody) return;

        tbody.innerHTML = farms.slice(0, 5).map(f => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                <td class="py-2 font-semibold text-slate-800 dark:text-slate-200">Fazenda ${f.fazenda}</td>
                <td class="py-2 text-center text-slate-600 dark:text-slate-400">${f.total}</td>
                <td class="py-2 text-center font-bold ${f.ocorrencias > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}">${f.ocorrencias}</td>
                <td class="py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">${f.taxaOcorrencia}%</td>
            </tr>
        `).join('');
    }

    function updateChartsData(records, weather, equipCondition, operations, plantSoca) {
        // 1. Atualização do Gráfico Pareado (Campo vs ERA5)
        if (state.charts.auditComparison) {
            const sampleRecords = records.slice(0, 15);
            state.charts.auditComparison.data.labels = sampleRecords.map(r => `#${r.id} ${r.fazenda.substring(0, 8)}`);
            const fieldData = sampleRecords.map(r => r.delta_t_num !== null ? r.delta_t_num : 0);
            const era5Data = sampleRecords.map(r => {
                const api = (state.weatherSyncMap && typeof state.weatherSyncMap.get === 'function')
                    ? state.weatherSyncMap.get(r.id) : null;
                return (api && api.deltaT !== null) ? api.deltaT : 0;
            });
            if (!state.charts.auditComparison.data.datasets || state.charts.auditComparison.data.datasets.length < 2) {
                state.charts.auditComparison.data.datasets = [
                    { label: 'Delta T Campo (°C)', data: fieldData, backgroundColor: '#10B981', borderRadius: 4 },
                    { label: 'Delta T ERA5 (°C)', data: era5Data, backgroundColor: '#0284C7', borderRadius: 4 }
                ];
            } else {
                state.charts.auditComparison.data.datasets[0].data = fieldData;
                state.charts.auditComparison.data.datasets[1].data = era5Data;
            }
            state.charts.auditComparison.update();
        }

        // 2. Atualização do Gráfico Donut de Auditoria Climática
        if (state.charts.auditDistribution) {
            const localAudit = (window.OpenMeteoService && state.weatherSyncMap)
                ? window.OpenMeteoService.auditDataset(records, state.weatherSyncMap)
                : state.auditStats;
            if (localAudit) {
                if (!state.charts.auditDistribution.data.datasets || state.charts.auditDistribution.data.datasets.length === 0) {
                    state.charts.auditDistribution.data.datasets = [{ data: [0,0,0,0], backgroundColor: ['#10B981', '#F59E0B', '#EF4444', '#3B82F6'], borderWidth: 0 }];
                }
                state.charts.auditDistribution.data.datasets[0].data = [
                    localAudit.compativeis || 0,
                    localAudit.divModerada || 0,
                    localAudit.divElevada || 0,
                    localAudit.reconstruidos || 0
                ];
                state.charts.auditDistribution.update();
            }
        }

        // 3. Delta T Donut
        if (state.charts.deltaT) {
            const dtC = weather.deltaT.classes;
            if (!state.charts.deltaT.data.datasets || state.charts.deltaT.data.datasets.length === 0) {
                state.charts.deltaT.data.datasets = [{ data: [0,0,0,0] }];
            }
            state.charts.deltaT.data.datasets[0].data = [
                dtC['Ideal (2-8°C)'] || 0,
                dtC['Atenção (8-10°C)'] || 0,
                dtC['Crítico (> 10°C)'] || 0,
                weather.semTelemetria || 0
            ];
            state.charts.deltaT.update();
        }

        // 4. Limpeza
        if (state.charts.limpeza) {
            if (!state.charts.limpeza.data.datasets || state.charts.limpeza.data.datasets.length < 2) {
                state.charts.limpeza.data.datasets = [
                    { label: 'Conforme (OK)', data: [0,0], backgroundColor: '#10B981' },
                    { label: 'Irregular (NOK)', data: [0,0], backgroundColor: '#EF4444' }
                ];
            }
            state.charts.limpeza.data.datasets[0].data = [equipCondition.filtros.ok, equipCondition.bicos.ok];
            state.charts.limpeza.data.datasets[1].data = [equipCondition.filtros.nok, equipCondition.bicos.nok];
            state.charts.limpeza.update();
        }

        // 5. Vazão
        if (state.charts.vazao) {
            const v200 = equipCondition.vazoes['200 L/ha'] || 0;
            const v150 = equipCondition.vazoes['150 L/ha'] || 0;
            const v300 = equipCondition.vazoes['300 L/ha'] || 0;
            const vOutros = equipCondition.vazoes['Não Informado'] || 0;
            if (!state.charts.vazao.data.datasets || state.charts.vazao.data.datasets.length === 0) {
                state.charts.vazao.data.datasets = [{ data: [0,0,0,0] }];
            }
            state.charts.vazao.data.datasets[0].data = [v200, v150, v300, vOutros];
            state.charts.vazao.update();
        }

        // 6. Operações
        if (state.charts.operacoes) {
            state.charts.operacoes.data.labels = operations.map(o => o.nome.substring(0, 22) + (o.nome.length > 22 ? '...' : ''));
            if (!state.charts.operacoes.data.datasets || state.charts.operacoes.data.datasets.length === 0) {
                state.charts.operacoes.data.datasets = [{ data: [] }];
            }
            state.charts.operacoes.data.datasets[0].data = operations.map(o => o.total);
            state.charts.operacoes.update();
        }

        // 7. Planta ou Soca
        if (state.charts.plantaSoca) {
            const sortedPlantaSoca = [...plantSoca].sort((a, b) => b.total - a.total);
            state.charts.plantaSoca.data.labels = sortedPlantaSoca.map(p => p.tipo);
            const colorMap = {
                'Soca': '#10B981',
                'Planta': '#06B6D4',
                'Carreador': '#F59E0B',
                'Não informado': '#94A3B8'
            };
            const bgColors = sortedPlantaSoca.map((p, idx) => colorMap[p.tipo] || ['#10B981', '#06B6D4', '#F59E0B', '#94A3B8', '#8B5CF6'][idx % 5]);
            if (!state.charts.plantaSoca.data.datasets || state.charts.plantaSoca.data.datasets.length === 0) {
                state.charts.plantaSoca.data.datasets = [{ data: [], backgroundColor: bgColors, borderWidth: 0 }];
            }
            state.charts.plantaSoca.data.datasets[0].data = sortedPlantaSoca.map(p => p.total);
            state.charts.plantaSoca.data.datasets[0].backgroundColor = bgColors;
            state.charts.plantaSoca.update();
        }

        // 8. Timeline
        if (state.charts.timeline) {
            const timelineData = (typeof HerbicidaEngine.computeTemporalData === 'function')
                ? HerbicidaEngine.computeTemporalData(records, state.timelineMode)
                : [];
            state.charts.timeline.data.labels = timelineData.map(t => t.label);
            if (!state.charts.timeline.data.datasets || state.charts.timeline.data.datasets.length < 2) {
                state.charts.timeline.data.datasets = [
                    { label: 'Total Inspeções', data: timelineData.map(t => t.total), backgroundColor: '#10B981', borderRadius: 4 },
                    { label: 'Ocorrências / Riscos', data: timelineData.map(t => t.ocorrencias), backgroundColor: '#EF4444', borderRadius: 4 }
                ];
            } else {
                state.charts.timeline.data.datasets[0].data = timelineData.map(t => t.total);
                state.charts.timeline.data.datasets[1].data = timelineData.map(t => t.ocorrencias);
            }
            state.charts.timeline.update();
        }
    }

    // --- TABELA ANALÍTICA COM PAGINAÇÃO ---
    function renderTable() {
        const tbody = document.getElementById('tabelaHerbicida');
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

        if (countLabel) countLabel.textContent = `Mostrando ${total} de ${state.allRecords.length} registros`;
        if (pageInfo) pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
        if (prevBtn) prevBtn.disabled = state.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = state.currentPage >= totalPages;

        const startIdx = (state.currentPage - 1) * state.pageSize;
        const pageRecords = records.slice(startIdx, startIdx + state.pageSize);

        if (pageRecords.length === 0) {
            tbody.innerHTML = `<tr><td colspan="17" class="text-center py-6 text-slate-500">Nenhum registro encontrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = pageRecords.map(r => {
            const dtClass = HerbicidaEngine.classifyDeltaT(r.delta_t_num);
            const dtBadge = r.delta_t_num !== null
                ? `<span class="badge" style="background-color: ${dtClass.color}20; color: ${dtClass.color};">${r.delta_t_num}°C</span>`
                : `<span class="badge badge-slate">N/I</span>`;

            const filtroBadge = r.is_nok_filtro ? `<span class="badge badge-red">NOK</span>` : `<span class="badge badge-emerald">OK</span>`;
            const bicoBadge = r.is_nok_bico ? `<span class="badge badge-red">NOK</span>` : (r.limpeza_bicos === 'N / A' ? `<span class="badge badge-slate">N/A</span>` : `<span class="badge badge-emerald">OK</span>`);

            // Auditoria Climática (Trilha A vs Trilha B)
            const apiData = state.weatherSyncMap ? state.weatherSyncMap.get(r.id) : null;
            const auditComp = (window.OpenMeteoService && apiData) ? window.OpenMeteoService.compareRecord(r, apiData) : null;
            let auditBadge = `<span class="badge badge-slate">Pendente</span>`;
            if (auditComp) {
                let icon = 'fa-check';
                if (auditComp.statusKey === 'divergencia_moderada') icon = 'fa-triangle-exclamation';
                else if (auditComp.statusKey === 'divergencia_elevada') icon = 'fa-circle-xmark';
                else if (auditComp.statusKey === 'reconstruido') icon = 'fa-cloud-arrow-down';
                auditBadge = `<span class="badge ${auditComp.badgeClass}" title="${auditComp.desc}"><i class="fa-solid ${icon} mr-1"></i>${auditComp.status}</span>`;
            }

            // Exibição Lado a Lado: Telemetria de Campo vs Reconstrução ERA5
            const campoVento = (r.vento !== null && r.vento !== undefined)
                ? `<span class="font-bold text-slate-800 dark:text-slate-100">${r.vento} km/h</span>`
                : `<span class="text-slate-400 text-[11px] italic">Sem Telemetria</span>`;
            const era5Vento = (apiData && apiData.vento !== null && apiData.vento !== undefined)
                ? `<span class="text-[11px] text-sky-600 dark:text-sky-300 font-semibold block mt-0.5"><i class="fa-solid fa-cloud-sun mr-0.5 text-[10px]"></i>ERA5: ${apiData.vento} km/h</span>`
                : '';

            const campoUr = (r.ur !== null && r.ur !== undefined)
                ? `<span class="font-bold text-slate-800 dark:text-slate-100">${r.ur}%</span>`
                : `<span class="text-slate-400 text-[11px] italic">Sem Telemetria</span>`;
            const era5Ur = (apiData && apiData.ur !== null && apiData.ur !== undefined)
                ? `<span class="text-[11px] text-sky-600 dark:text-sky-300 font-semibold block mt-0.5"><i class="fa-solid fa-droplet mr-0.5 text-[10px]"></i>ERA5: ${apiData.ur}%</span>`
                : '';

            const campoTemp = (r.temp !== null && r.temp !== undefined)
                ? `<span class="font-bold text-slate-800 dark:text-slate-100">${r.temp}°C</span>`
                : `<span class="text-slate-400 text-[11px] italic">Sem Telemetria</span>`;
            const era5Temp = (apiData && apiData.temp !== null && apiData.temp !== undefined)
                ? `<span class="text-[11px] text-sky-600 dark:text-sky-300 font-semibold block mt-0.5"><i class="fa-solid fa-temperature-half mr-0.5 text-[10px]"></i>ERA5: ${apiData.temp}°C</span>`
                : '';

            const campoDt = r.delta_t_num !== null
                ? dtBadge
                : `<span class="badge badge-slate text-[11px]">Sem Telemetria</span>`;
            const era5Dt = (apiData && apiData.deltaT !== null && apiData.deltaT !== undefined)
                ? `<span class="text-[11px] text-sky-600 dark:text-sky-300 font-bold block mt-0.5"><i class="fa-solid fa-gauge-high mr-0.5 text-[10px]"></i>ERA5: ${apiData.deltaT}°C</span>`
                : '';

            const diffLabel = (auditComp && auditComp.diffDeltaT !== null && auditComp.diffDeltaT !== undefined)
                ? `<span class="text-[11px] text-slate-600 dark:text-slate-300 block font-mono font-bold mt-0.5">Δ = ${auditComp.diffDeltaT > 0 ? '+' : ''}${auditComp.diffDeltaT.toFixed(1)}°C</span>`
                : (auditComp && auditComp.statusKey === 'reconstruido' ? `<span class="text-[10px] text-sky-500 dark:text-sky-400 block font-semibold mt-0.5">Reconstruído ERA5</span>` : '');

            return `
                <tr class="cursor-pointer" onclick="window.abrirModalInspecao('${r.id}')">
                    <td class="font-bold text-emerald-600 dark:text-emerald-400">#${r.id}</td>
                    <td class="whitespace-nowrap">${r.data}</td>
                    <td class="font-semibold">${r.fazenda}</td>
                    <td>${r.os}</td>
                    <td class="max-w-[140px] truncate" title="${r.operacao}">${r.operacao}</td>
                    <td>${r.planta_soca}</td>
                    <td>${campoVento}${era5Vento}</td>
                    <td>${campoUr}${era5Ur}</td>
                    <td>${campoTemp}${era5Temp}</td>
                    <td>${campoDt}${era5Dt}</td>
                    <td>${r.esp_orig}</td>
                    <td>${filtroBadge}</td>
                    <td>${bicoBadge}</td>
                    <td>${r.vazao_orig}</td>
                    <td><span class="badge ${r.status === 'Fechado' ? 'badge-emerald' : 'badge-blue'}">${r.status}</span></td>
                    <td>${auditBadge}${diffLabel}</td>
                    <td class="max-w-[180px] truncate text-[11px] text-slate-600 dark:text-slate-300" title="${r.obs}">
                        ${r.equipamentos_nomes?.length ? `<b>[${r.equipamentos_nomes.join(', ')}]</b> ` : ''}${r.obs || '—'}
                    </td>
                    <td>
                        <button class="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-slate-700 dark:text-slate-200 transition">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // --- GRÁFICO DIURNO DO MODAL (06h às 18h) ---
    let modalTimelineChartInstance = null;

    function renderModalTimelineChart(r, apiData) {
        const canvas = document.getElementById('chartModalTimeline');
        if (!canvas) return;

        if (modalTimelineChartInstance) {
            modalTimelineChartInstance.destroy();
            modalTimelineChartInstance = null;
        }

        // Recupera dados horários do cache ERA5
        let hourly = null;
        if (window.OpenMeteoService && r.lat && r.lon && r.data_iso) {
            const cached = window.OpenMeteoService.getFromCache(r.lat, r.lon, r.data_iso);
            if (cached && cached.hourly) {
                hourly = cached.hourly;
            }
        }

        if (!hourly || !hourly.time || hourly.time.length === 0) {
            canvas.classList.add('hidden');
            return;
        }

        // Filtra janela de aplicação das 06:00 às 18:00
        const labels = [];
        const dataTemp = [];
        const dataUr = [];
        const dataVento = [];
        const dataDeltaT = [];

        for (let i = 0; i < hourly.time.length; i++) {
            const timeStr = hourly.time[i];
            const hourPart = timeStr.includes('T') ? timeStr.split('T')[1].substring(0, 5) : timeStr;
            const hourNum = parseInt(hourPart.split(':')[0], 10);
            if (hourNum >= 6 && hourNum <= 18) {
                labels.push(hourPart);
                const t = hourly.temperature_2m ? hourly.temperature_2m[i] : 0;
                const rh = hourly.relative_humidity_2m ? hourly.relative_humidity_2m[i] : 0;
                const v = hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : 0;
                const dt = (window.HerbicidaEngine && typeof window.HerbicidaEngine.calculateDeltaT === 'function')
                    ? window.HerbicidaEngine.calculateDeltaT(t, rh)
                    : 0;

                dataTemp.push(t);
                dataUr.push(rh);
                dataVento.push(v);
                dataDeltaT.push(dt);
            }
        }

        canvas.classList.remove('hidden');
        const ctx = canvas.getContext('2d');
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94A3B8' : '#64748B';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

        modalTimelineChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Delta T (°C)',
                        data: dataDeltaT,
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2.5,
                        tension: 0.3,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Temperatura (°C)',
                        data: dataTemp,
                        borderColor: '#EF4444',
                        borderWidth: 1.5,
                        borderDash: [4, 4],
                        pointRadius: 2,
                        tension: 0.3,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Vento (km/h)',
                        data: dataVento,
                        borderColor: '#0284C7',
                        borderWidth: 1.5,
                        pointRadius: 2,
                        tension: 0.3,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Umidade Relativa (%)',
                        data: dataUr,
                        borderColor: '#8B5CF6',
                        borderWidth: 1.5,
                        borderDash: [2, 2],
                        pointRadius: 2,
                        tension: 0.3,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { size: 9 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: gridColor },
                        ticks: { color: textColor, font: { size: 9 } },
                        title: { display: true, text: '°C / km/h', color: textColor, font: { size: 9 } }
                    },
                    y1: {
                        position: 'right',
                        beginAtZero: true,
                        max: 100,
                        grid: { display: false },
                        ticks: { color: textColor, font: { size: 9 } },
                        title: { display: true, text: 'UR %', color: textColor, font: { size: 9 } }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 8, font: { size: 9 }, color: textColor }
                    }
                }
            }
        });
    }

    // --- MODAL DE DETALHES ---
    window.abrirModalInspecao = function (id) {
        const strId = String(id).trim();
        let r = (state.allRecords || []).find(x => String(x.id || x.ID || '').trim() === strId);
        if (!r && window.HERBICIDA_DATA) {
            r = window.HERBICIDA_DATA.find(x => String(x.id || x.ID || '').trim() === strId);
        }
        if (!r && state.filteredRecords) {
            r = state.filteredRecords.find(x => String(x.id || x.ID || '').trim() === strId);
        }
        if (!r) {
            console.warn('[Herbicida] Inspeção não encontrada para ID:', id);
            return;
        }

        const modal = document.getElementById('detailModal');
        const title = document.getElementById('modalTitle');
        const subtitle = document.getElementById('modalSubtitle');
        const badge = document.getElementById('modalAuditBadge');
        const body = document.getElementById('modalBody');

        if (!modal || !title || !body) return;

        const regId = r.id || r.ID || id;
        const regFazenda = r.fazenda || r.Fazenda || '-';
        const dataRealizacao = r.data || r.data_fim || r.data_inicio || 'Data N/I';
        const horaRealizacao = r.hora || (dataRealizacao.includes(' ') ? dataRealizacao.split(' ')[1] : '12:00');

        title.textContent = `Dossiê Meteorológico • Inspeção #${regId}`;
        const elDataRealizacao = document.getElementById('modalDataRealizacao');
        if (elDataRealizacao) elDataRealizacao.textContent = dataRealizacao;

        if (subtitle) {
            subtitle.innerHTML = `<span class="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 mr-2"><i class="fa-solid fa-calendar-day"></i> Realização: ${dataRealizacao}</span> • Fazenda ${regFazenda} • OS ${r.os || '-'} • Operação: ${r.operacao || '-'}`;
        }

        // Obtém dados da Trilha B (Open-Meteo ERA5)
        let apiData = state.weatherSyncMap ? state.weatherSyncMap.get(r.id) : null;
        if (!apiData && window.OpenMeteoService && r.lat && r.lon && r.data_iso) {
            const cached = window.OpenMeteoService.getFromCache(r.lat, r.lon, r.data_iso);
            if (cached) {
                apiData = window.OpenMeteoService.extractHourData(cached, r.hora, r.lat, r.lon, r.data_iso, true);
            }
        }

        const auditComp = (window.OpenMeteoService && apiData)
            ? window.OpenMeteoService.compareRecord(r, apiData)
            : { status: 'Pendente', badgeClass: 'badge-slate', desc: 'Dados meteorológicos em sincronização', justificativa: '-', confiabilidade: '-' };

        if (badge) {
            badge.className = `badge ${auditComp.badgeClass} text-xs`;
            badge.innerHTML = `<i class="fa-solid fa-shield-halved mr-1"></i>${auditComp.status}`;
        }

        const dtVal = (r.delta_t_num !== undefined && r.delta_t_num !== null) ? r.delta_t_num : null;
        const dtClass = HerbicidaEngine.classifyDeltaT(dtVal);

        // Gera recomendação por tipo de produto
        const dtRef = dtVal !== null ? dtVal : (apiData ? apiData.deltaT : null);
        const ventoRef = r.vento_num !== null ? r.vento_num : (apiData ? apiData.vento : null);
        const sistRec = HerbicidaEngine.evaluateProductApplication ? HerbicidaEngine.evaluateProductApplication('sistemicos', dtRef, ventoRef) : null;
        const contRec = HerbicidaEngine.evaluateProductApplication ? HerbicidaEngine.evaluateProductApplication('contato', dtRef, ventoRef) : null;
        const soloRec = HerbicidaEngine.evaluateProductApplication ? HerbicidaEngine.evaluateProductApplication('pre_emergentes_solo', dtRef, ventoRef) : null;

        body.innerHTML = `
            <!-- Faixa Oficial de Realização e Identificação Operacional -->
            <div class="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 dark:border-emerald-500/30 flex flex-wrap items-center justify-between gap-3 mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-sm">
                        <i class="fa-solid fa-calendar-check text-lg"></i>
                    </div>
                    <div>
                        <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Data e Hora da Realização</span>
                        <div class="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <span>${dataRealizacao}</span>
                            <span class="text-[11px] font-medium text-slate-500">(${horaRealizacao})</span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-2 text-xs">
                    <div class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span class="text-slate-400 block text-[10px]">Duração</span>
                        <span class="font-bold text-slate-800 dark:text-slate-100">${r.duracao_min || 0} min</span>
                    </div>
                    <div class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span class="text-slate-400 block text-[10px]">Trator / Frota</span>
                        <span class="font-bold text-slate-800 dark:text-slate-100">${r.equipamento_trator || r.trator || 'Não informado'}</span>
                    </div>
                    <div class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span class="text-slate-400 block text-[10px]">Responsável</span>
                        <span class="font-bold text-slate-800 dark:text-slate-100">${r.usuario || r.responsavel || 'Operador'}</span>
                    </div>
                </div>
            </div>

            <!-- Bloco 1: Auditoria Comparativa Lado a Lado (Trilha A vs Trilha B) -->
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                <div class="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-600">
                    <span class="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                        <i class="fa-solid fa-code-compare text-emerald-600 dark:text-emerald-400"></i> Confronto de Telemetria: Campo vs Reanálise Atmosférica
                    </span>
                    <span class="text-[11px] font-mono text-slate-500">Coordenadas: ${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}</span>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-xs text-left">
                        <thead>
                            <tr class="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-600 font-semibold">
                                <th class="pb-2">Variável Meteorológica</th>
                                <th class="pb-2 text-center bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 rounded-t">Trilha A: Campo (MapFy)</th>
                                <th class="pb-2 text-center bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 rounded-t">Trilha B: Open-Meteo ERA5</th>
                                <th class="pb-2 text-center">Divergência (Δ)</th>
                                <th class="pb-2 text-right">Diagnóstico</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-200">
                            <tr>
                                <td class="py-2 font-medium">Temperatura do Ar (°C)</td>
                                <td class="py-2 text-center font-bold bg-emerald-50/30 dark:bg-emerald-950/10">${r.temp !== null ? r.temp + '°C' : '<span class="text-slate-400">Não Medido</span>'}</td>
                                <td class="py-2 text-center font-bold bg-blue-50/30 dark:bg-blue-950/10">${apiData && apiData.temp !== null ? apiData.temp + '°C' : 'N/D'}</td>
                                <td class="py-2 text-center font-mono font-semibold">${auditComp.diffTemp !== null ? (auditComp.diffTemp > 0 ? '+' : '') + auditComp.diffTemp + '°C' : '—'}</td>
                                <td class="py-2 text-right">${Math.abs(auditComp.diffTemp || 0) <= 3.5 ? '<span class="text-emerald-600 font-semibold">Admissível</span>' : '<span class="text-amber-600 font-semibold">Variação Térmica</span>'}</td>
                            </tr>
                            <tr>
                                <td class="py-2 font-medium">Umidade Relativa (UR %)</td>
                                <td class="py-2 text-center font-bold bg-emerald-50/30 dark:bg-emerald-950/10">${r.ur !== null ? r.ur + '%' : '<span class="text-slate-400">Não Medido</span>'}</td>
                                <td class="py-2 text-center font-bold bg-blue-50/30 dark:bg-blue-950/10">${apiData && apiData.ur !== null ? apiData.ur + '%' : 'N/D'}</td>
                                <td class="py-2 text-center font-mono font-semibold">${auditComp.diffUr !== null ? (auditComp.diffUr > 0 ? '+' : '') + auditComp.diffUr + '%' : '—'}</td>
                                <td class="py-2 text-right">${Math.abs(auditComp.diffUr || 0) <= 15 ? '<span class="text-emerald-600 font-semibold">Admissível</span>' : '<span class="text-amber-600 font-semibold">Gradiente de UR</span>'}</td>
                            </tr>
                            <tr>
                                <td class="py-2 font-medium">Velocidade do Vento (km/h)</td>
                                <td class="py-2 text-center font-bold bg-emerald-50/30 dark:bg-emerald-950/10">${r.vento !== null ? r.vento + ' km/h' : '<span class="text-slate-400">Não Medido</span>'}</td>
                                <td class="py-2 text-center font-bold bg-blue-50/30 dark:bg-blue-950/10">${apiData && apiData.vento !== null ? apiData.vento + ' km/h' : 'N/D'} ${apiData && apiData.direcaoVento ? '(' + apiData.direcaoVento + ')' : ''}</td>
                                <td class="py-2 text-center font-mono font-semibold">${auditComp.diffVento !== null ? (auditComp.diffVento > 0 ? '+' : '') + auditComp.diffVento + ' km/h' : '—'}</td>
                                <td class="py-2 text-right">${apiData && apiData.rajadas ? 'Rajadas ' + apiData.rajadas + ' km/h' : '<span class="text-slate-400">Vento Regular</span>'}</td>
                            </tr>
                            <tr>
                                <td class="py-2 font-medium">Bulbo Úmido (Tw °C)</td>
                                <td class="py-2 text-center bg-emerald-50/30 dark:bg-emerald-950/10">${r.tw_num !== null ? r.tw_num + '°C' : '<span class="text-slate-400">Calculado Stull</span>'}</td>
                                <td class="py-2 text-center bg-blue-50/30 dark:bg-blue-950/10">${apiData && apiData.tw !== null ? apiData.tw + '°C' : 'N/D'}</td>
                                <td class="py-2 text-center font-mono font-semibold">—</td>
                                <td class="py-2 text-right text-slate-400">Psicrométrico</td>
                            </tr>
                            <tr class="bg-emerald-500/10 dark:bg-emerald-500/20 font-bold">
                                <td class="py-2.5 text-emerald-800 dark:text-emerald-300">Delta T (°C) • Stull 2011</td>
                                <td class="py-2.5 text-center text-emerald-700 dark:text-emerald-300 text-sm">${r.delta_t_num !== null ? r.delta_t_num + '°C' : '<span class="text-slate-400 text-xs font-normal">Sem Telemetria</span>'}</td>
                                <td class="py-2.5 text-center text-blue-700 dark:text-blue-300 text-sm">${apiData && apiData.deltaT !== null ? apiData.deltaT + '°C' : 'N/D'}</td>
                                <td class="py-2.5 text-center font-mono text-sm">${auditComp.diffDeltaT !== null ? (auditComp.diffDeltaT > 0 ? '+' : '') + auditComp.diffDeltaT + '°C' : '—'}</td>
                                <td class="py-2.5 text-right"><span class="badge ${auditComp.badgeClass}">${auditComp.status}</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Parecer do Auditor -->
                <div class="mt-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-xs leading-relaxed">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <i class="fa-solid fa-signature text-emerald-600"></i> Parecer Técnico de Auditoria:
                        </span>
                        <span class="text-[11px] text-slate-500 font-semibold">Confiabilidade: ${auditComp.confiabilidade}</span>
                    </div>
                    <p class="text-slate-700 dark:text-slate-300 m-0">${auditComp.desc}. ${auditComp.justificativa}</p>
                </div>
            </div>

            <!-- Bloco 2: Linha do Tempo Diurna da Inspeção (06h às 18h) -->
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                <div class="flex items-center justify-between mb-2">
                    <span class="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                        <i class="fa-solid fa-clock-rotate-left text-teal-600 dark:text-teal-400"></i> Evolução Diurna das Condições Atmosféricas (06h às 18h)
                    </span>
                    <span class="text-[11px] text-slate-500">Horário da Inspeção: <b>${r.hora || '12:00'}</b></span>
                </div>
                <div class="h-44 w-full">
                    <canvas id="chartModalTimeline"></canvas>
                </div>
            </div>

            <!-- Bloco 3: Matriz Decisória de Aplicação para Herbicidas -->
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                <span class="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide block mb-2 flex items-center gap-2">
                    <i class="fa-solid fa-spray-can text-emerald-600 dark:text-emerald-400"></i> Avaliação Operacional por Classe de Herbicida
                </span>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div class="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
                        <div class="flex items-center justify-between mb-1">
                            <span class="font-bold text-slate-800 dark:text-slate-100">Sistêmicos</span>
                            <span class="badge ${sistRec ? sistRec.badgeClass : 'badge-emerald'} text-[10px]">${sistRec ? sistRec.status : 'Apto'}</span>
                        </div>
                        <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">${sistRec ? sistRec.justificativa : 'Condições adequadas para absorção lenta.'}</p>
                    </div>

                    <div class="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
                        <div class="flex items-center justify-between mb-1">
                            <span class="font-bold text-slate-800 dark:text-slate-100">Contato</span>
                            <span class="badge ${contRec ? contRec.badgeClass : 'badge-amber'} text-[10px]">${contRec ? contRec.status : 'Alerta'}</span>
                        </div>
                        <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">${contRec ? contRec.justificativa : 'Exige monitoramento contínuo de gotas.'}</p>
                    </div>

                    <div class="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
                        <div class="flex items-center justify-between mb-1">
                            <span class="font-bold text-slate-800 dark:text-slate-100">Pré-emergentes</span>
                            <span class="badge ${soloRec ? soloRec.badgeClass : 'badge-blue'} text-[10px]">${soloRec ? soloRec.status : 'Apto Solo'}</span>
                        </div>
                        <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">${soloRec ? soloRec.justificativa : 'Aplicação em solo tolerante a gotas grossas.'}</p>
                    </div>
                </div>
            </div>

            <!-- Bloco 4: Regulagem do Pulverizador & Observações de Campo -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 space-y-1.5 text-slate-600 dark:text-slate-300">
                    <span class="font-bold text-slate-800 dark:text-slate-100 block uppercase text-[11px] border-b pb-1 mb-2">
                        Regulagem do Implemento
                    </span>
                    <div><b>Espaçamento de Bico:</b> ${r.esp_orig} (${r.esp_grupo})</div>
                    <div><b>Abertura do Leque:</b> ${r.leque}</div>
                    <div><b>Vazão Aplicada:</b> ${r.vazao_orig}</div>
                    <div><b>Limpeza Filtros Bomba:</b> ${r.is_nok_filtro ? '<span class="badge badge-red">NOK (Obstruído)</span>' : '<span class="badge badge-emerald">OK (Limpo)</span>'}</div>
                    <div><b>Limpeza de Bicos:</b> ${r.is_nok_bico ? '<span class="badge badge-red">NOK (Irregular)</span>' : '<span class="badge badge-emerald">OK</span>'}</div>
                    <div><b>Equipamento Citado:</b> ${r.equipamentos_nomes?.length ? r.equipamentos_nomes.join(', ') : 'Nenhum identificado'}</div>
                </div>

                <div class="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <span class="font-bold text-amber-800 dark:text-amber-300 block uppercase text-[11px] border-b border-amber-200 dark:border-amber-800 pb-1 mb-2">
                        Observações e Ocorrências de Campo
                    </span>
                    <p class="text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed m-0 text-xs">
                        ${r.obs || 'Nenhuma ocorrência ou anotação operacional textual registrada para este apontamento.'}
                    </p>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';

        // Renderiza gráfico da Linha do Tempo no Modal
        setTimeout(() => {
            renderModalTimelineChart(r, apiData);
        }, 100);
    };

    window.filtrarPorEquipamento = function (nome) {
        const sel = document.getElementById('filterEquipamento');
        if (sel) {
            sel.value = nome;
            state.activeFilters.equipamento = nome;
            aplicarFiltros();
        }
    };

    // --- EXPANSÃO UNIVERSAL DE GRÁFICOS EM TELA CHEIA ---
    window.toggleCardFullscreen = function (triggerEl) {
        if (!triggerEl) return;
        const card = (typeof triggerEl.closest === 'function') ? triggerEl.closest('.chart-card, .app-card') : (triggerEl.parentElement || triggerEl);
        if (!card) return;
        const canvas = card.querySelector ? card.querySelector('canvas') : null;
        const isFs = card.classList.toggle('chart-fullscreen-active');
        if (document.body) document.body.style.overflow = isFs ? 'hidden' : '';
        const btn = card.querySelector ? card.querySelector('.btn-chart-fullscreen') : null;
        if (btn) {
            btn.innerHTML = isFs
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
            btn.title = isFs ? 'Restaurar Tamanho Original' : 'Visualizar Gráfico em Tela Cheia';
        }
        if (canvas && typeof Chart !== 'undefined' && typeof Chart.getChart === 'function') {
            const chart = Chart.getChart(canvas);
            if (chart) {
                setTimeout(() => chart.resize(), 60);
            }
        }
    };

    // --- EVENTOS E REATIVIDADE ---
    function bindEvents() {
        // Filtros de seleção
        ['filterFazenda', 'filterOS', 'filterOperacao', 'filterPlantaSoca', 'filterStatus', 'filterFiltroBomba', 'filterLimpezaBicos', 'filterDeltaT', 'filterEquipamento'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    const keyMap = {
                        filterFazenda: 'fazenda',
                        filterOS: 'os',
                        filterOperacao: 'operacao',
                        filterPlantaSoca: 'plantaSoca',
                        filterStatus: 'status',
                        filterFiltroBomba: 'filtroBomba',
                        filterLimpezaBicos: 'limpezaBicos',
                        filterDeltaT: 'deltaTClasse',
                        filterEquipamento: 'equipamento'
                    };
                    state.activeFilters[keyMap[id]] = el.value;
                    aplicarFiltros();
                });
            }
        });

        // Datas
        const dtIni = document.getElementById('filterDataInicio');
        const dtFim = document.getElementById('filterDataFim');
        if (dtIni) dtIni.addEventListener('change', () => { state.activeFilters.dataInicio = dtIni.value; aplicarFiltros(); });
        if (dtFim) dtFim.addEventListener('change', () => { state.activeFilters.dataFim = dtFim.value; aplicarFiltros(); });

        // Checkboxes
        const chkOcorr = document.getElementById('chkSomenteOcorrencias');
        const chkNok = document.getElementById('chkSomenteNok');
        const chkCoords = document.getElementById('chkSomenteCoords');
        if (chkOcorr) chkOcorr.addEventListener('change', () => { state.activeFilters.somenteOcorrencias = chkOcorr.checked; aplicarFiltros(); });
        if (chkNok) chkNok.addEventListener('change', () => { state.activeFilters.somenteNok = chkNok.checked; aplicarFiltros(); });
        if (chkCoords) chkCoords.addEventListener('change', () => { state.activeFilters.somenteCoords = chkCoords.checked; aplicarFiltros(); });

        // Busca
        const search = document.getElementById('searchInput');
        if (search) {
            search.addEventListener('input', () => {
                state.activeFilters.buscaTexto = search.value.trim();
                aplicarFiltros();
            });
        }

        // Limpar filtros
        const resetBtn = document.getElementById('btnResetFilters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                document.querySelectorAll('select').forEach(s => s.value = s.options[0].value);
                if (dtIni) dtIni.value = '';
                if (dtFim) dtFim.value = '';
                if (search) search.value = '';
                if (chkOcorr) chkOcorr.checked = false;
                if (chkNok) chkNok.checked = false;
                if (chkCoords) chkCoords.checked = true;

                state.activeFilters = {
                    dataInicio: '', dataFim: '', fazenda: 'TODAS', os: 'TODAS',
                    operacao: 'TODAS', plantaSoca: 'TODAS', status: 'TODOS',
                    filtroBomba: 'TODOS', limpezaBicos: 'TODOS', deltaTClasse: 'TODAS',
                    equipamento: 'TODOS', somenteOcorrencias: false, somenteNok: false,
                    somenteCoords: true, buscaTexto: ''
                };
                aplicarFiltros();
            });
        }

        // Modos do Mapa
        const mapBtns = [
            { id: 'btnMapAll', mode: 'all' },
            { id: 'btnMapOcorrencias', mode: 'ocorrencias' },
            { id: 'btnMapNok', mode: 'nok' },
            { id: 'btnMapClima', mode: 'clima' }
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

        // Timeline toggle
        const btnDia = document.getElementById('btnTimelineDia');
        const btnMes = document.getElementById('btnTimelineMes');
        if (btnDia && btnMes) {
            btnDia.addEventListener('click', () => {
                state.timelineMode = 'dia';
                btnDia.className = 'px-2 py-0.5 rounded font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300';
                btnMes.className = 'px-2 py-0.5 rounded font-semibold text-slate-500 hover:text-slate-800';
                updateChartsData(state.filteredRecords, HerbicidaEngine.computeWeatherStats(state.filteredRecords), HerbicidaEngine.computeEquipmentCondition(state.filteredRecords), HerbicidaEngine.computeOperationBreakdown(state.filteredRecords), HerbicidaEngine.computePlantaSocaBreakdown(state.filteredRecords));
            });
            btnMes.addEventListener('click', () => {
                state.timelineMode = 'mes';
                btnMes.className = 'px-2 py-0.5 rounded font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300';
                btnDia.className = 'px-2 py-0.5 rounded font-semibold text-slate-500 hover:text-slate-800';
                updateChartsData(state.filteredRecords, HerbicidaEngine.computeWeatherStats(state.filteredRecords), HerbicidaEngine.computeEquipmentCondition(state.filteredRecords), HerbicidaEngine.computeOperationBreakdown(state.filteredRecords), HerbicidaEngine.computePlantaSocaBreakdown(state.filteredRecords));
            });
        }

        // Paginação
        const prevPage = document.getElementById('prevPage');
        const nextPage = document.getElementById('nextPage');
        if (prevPage) prevPage.addEventListener('click', () => { state.currentPage--; renderTable(); });
        if (nextPage) nextPage.addEventListener('click', () => { state.currentPage++; renderTable(); });

        // Modal close
        const closeBtn = document.getElementById('modalCloseBtn');
        const closeBottomBtn = document.getElementById('modalCloseBottomBtn');
        const modal = document.getElementById('detailModal');
        const closeModal = () => {
            if (!modal) return;
            modal.classList.add('hidden');
            modal.style.display = 'none';
        };
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (closeBottomBtn) closeBottomBtn.addEventListener('click', closeModal);
        if (modal) {
            modal.addEventListener('click', e => {
                if (e.target === modal) closeModal();
            });
        }
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
                closeModal();
            }
        });

        // Exportações
        const btnExcel = document.getElementById('btnExportExcel');
        const btnCsv = document.getElementById('btnExportCSV');
        if (btnExcel) btnExcel.addEventListener('click', exportToExcel);
        if (btnCsv) btnCsv.addEventListener('click', exportToCSV);
    }

    function aplicarFiltros() {
        state.filteredRecords = HerbicidaEngine.filterRecords(state.allRecords, state.activeFilters);
        state.currentPage = 1;
        updateAllViews();
    }

    // --- EXPORTAÇÃO EXCEL (.XLSX) VIA SHEETJS ---
    function exportToExcel() {
        const rows = state.filteredRecords.map(r => ({
            "ID": r.id,
            "Data": r.data,
            "Fazenda": r.fazenda,
            "Ordem de Serviço": r.os,
            "Operação": r.operacao,
            "Planta ou Soca": r.planta_soca,
            "Status": r.status,
            "Score": r.score,
            "Vento (km/h)": r.vento,
            "Umidade Relativa (%)": r.ur,
            "Temperatura (°C)": r.temp,
            "Delta T (°C)": r.delta_t_num,
            "Classificação Delta T": r.delta_t_classe,
            "Espaçamento de Bico": r.esp_orig,
            "Abertura do Leque": r.leque,
            "Limpeza Filtros Bomba": r.filtro_bomba,
            "Limpeza de Bicos": r.limpeza_bicos,
            "Vazão (L/ha)": r.vazao_orig,
            "Avaliação Prévia": r.aval_previa,
            "OS e Mapa Disponíveis": r.mapa_os,
            "Equipamentos Citados": (r.equipamentos_nomes || []).join(', '),
            "Observações": r.obs,
            "Latitude": r.lat,
            "Longitude": r.lon,
            "Usuário": r.usuario
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Herbicidas MapFy");
        XLSX.writeFile(wb, "Central_Inteligencia_Herbicidas_Pitangueiras_2026.xlsx");
    }

    // --- EXPORTAÇÃO CSV UTF-8 COM BOM ---
    function exportToCSV() {
        const headers = ["ID", "Data", "Fazenda", "OS", "Operacao", "Planta_Soca", "Status", "Vento_kmh", "UR_perc", "Temp_C", "Delta_T_C", "Espacamento", "Filtro_Bomba", "Limpeza_Bicos", "Vazao", "Equipamento", "Observacoes"];
        let csvContent = "\uFEFF" + headers.join(";") + "\n";

        state.filteredRecords.forEach(r => {
            const row = [
                r.id,
                `"${r.data}"`,
                `"${r.fazenda}"`,
                `"${r.os}"`,
                `"${r.operacao}"`,
                `"${r.planta_soca}"`,
                `"${r.status}"`,
                `"${r.vento || ''}"`,
                `"${r.ur || ''}"`,
                `"${r.temp || ''}"`,
                `"${r.delta_t_num || ''}"`,
                `"${r.esp_orig || ''}"`,
                `"${r.filtro_bomba || ''}"`,
                `"${r.limpeza_bicos || ''}"`,
                `"${r.vazao_orig || ''}"`,
                `"${(r.equipamentos_nomes || []).join(', ')}"`,
                `"${(r.obs || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
            ];
            csvContent += row.join(";") + "\n";
        });

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Central_Inteligencia_Herbicidas_Pitangueiras_2026.csv";
        link.click();
    }

})();
