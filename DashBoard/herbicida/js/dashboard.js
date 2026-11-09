/**
 * dashboard.js
 * Controlador da Central de Inteligência de Aplicação de Herbicidas
 * Usina Pitangueiras - Safra 2026
 */

(function () {
    'use strict';

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
        const ordens = new Set();
        const operacoes = new Set();
        const plantasSocas = new Set();

        state.allRecords.forEach(r => {
            if (r.fazenda) fazendas.add(r.fazenda);
            if (r.os) ordens.add(r.os);
            if (r.operacao) operacoes.add(r.operacao);
            if (r.planta_soca) plantasSocas.add(r.planta_soca);
        });

        populateSelect('filterFazenda', Array.from(fazendas).sort(), 'Todas as Fazendas');
        populateSelect('filterOS', Array.from(ordens).sort(), 'Todas as OS');
        populateSelect('filterOperacao', Array.from(operacoes).sort(), 'Todas as Operações');
        populateSelect('filterPlantaSoca', Array.from(plantasSocas).sort(), 'Todas');
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
            const defaultTextColor = isDark ? '#F1F5F9' : '#1E293B';

            chart.data.datasets.forEach((dataset, datasetIdx) => {
                const meta = chart.getDatasetMeta(datasetIdx);
                if (meta.hidden) return;

                meta.data.forEach((element, index) => {
                    const val = dataset.data ? dataset.data[index] : null;
                    if (val === undefined || val === null || val === 0 || val === '0' || val === '' || isNaN(val)) return;

                    ctx.save();
                    ctx.font = 'bold 11px Inter, sans-serif';

                    if (chartType === 'pie') { // Em Doughnut, valores ficam no centro e não abaixo na fatia
                        const pos = element.tooltipPosition ? element.tooltipPosition() : null;
                        if (pos) {
                            ctx.fillStyle = '#FFFFFF';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                            ctx.shadowBlur = 4;
                            ctx.fillText(String(val), pos.x, pos.y);
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
                        ctx.font = `600 ${fontSizeLabel}px 'Plus Jakarta Sans', sans-serif`;
                        ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
                        ctx.fillText('TOTAL', centerX, centerY + (fontSizeNum * 0.55));

                        ctx.restore();
                    }
                }
            }
        }
    };

    // --- GRÁFICOS INTERATIVOS VIA CHART.JS ---
    function initCharts() {
        if (typeof Chart !== 'undefined' && Chart.register) {
            Chart.register(universalDataLabelsPlugin);
        }

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94A3B8' : '#64748B';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

        // 1. Scatter: Temp x UR
        const ctxTempUr = document.getElementById('chartTempUrScatter')?.getContext('2d');
        if (ctxTempUr) {
            state.charts.tempUr = new Chart(ctxTempUr, {
                type: 'scatter',
                data: { datasets: [] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            title: { display: true, text: 'Temperatura (°C)', color: textColor },
                            grid: { color: gridColor },
                            ticks: { color: textColor }
                        },
                        y: {
                            title: { display: true, text: 'Umidade Relativa (%)', color: textColor },
                            grid: { color: gridColor },
                            ticks: { color: textColor }
                        }
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, color: textColor } },
                        tooltip: {
                            callbacks: {
                                label: ctx => `ID #${ctx.raw.id}: ${ctx.raw.x}°C, ${ctx.raw.y}% UR (ΔT: ${ctx.raw.dt}°C)`
                            }
                        }
                    }
                }
            });
        }

        // 2. Scatter: Vento x UR
        const ctxVentoUr = document.getElementById('chartVentoUrScatter')?.getContext('2d');
        if (ctxVentoUr) {
            state.charts.ventoUr = new Chart(ctxVentoUr, {
                type: 'scatter',
                data: { datasets: [] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            title: { display: true, text: 'Vento (km/h)', color: textColor },
                            grid: { color: gridColor },
                            ticks: { color: textColor }
                        },
                        y: {
                            title: { display: true, text: 'Umidade Relativa (%)', color: textColor },
                            grid: { color: gridColor },
                            ticks: { color: textColor }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => `ID #${ctx.raw.id}: Vento ${ctx.raw.x} km/h, UR ${ctx.raw.y}%`
                            }
                        }
                    }
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
                        legend: { position: 'right', labels: { boxWidth: 10, color: textColor } }
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
                        legend: { position: 'bottom', labels: { boxWidth: 10, color: textColor } }
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
        const textColor = isDark ? '#94A3B8' : '#64748B';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

        Object.values(state.charts).forEach(c => {
            if (!c) return;
            if (c.options.scales) {
                if (c.options.scales.x) {
                    if (c.options.scales.x.ticks) c.options.scales.x.ticks.color = textColor;
                    if (c.options.scales.x.grid) c.options.scales.x.grid.color = gridColor;
                    if (c.options.scales.x.title) c.options.scales.x.title.color = textColor;
                }
                if (c.options.scales.y) {
                    if (c.options.scales.y.ticks) c.options.scales.y.ticks.color = textColor;
                    if (c.options.scales.y.grid) c.options.scales.y.grid.color = gridColor;
                    if (c.options.scales.y.title) c.options.scales.y.title.color = textColor;
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
        // 1. Temp x UR Scatter
        if (state.charts.tempUr) {
            const idealPts = [];
            const atencaoPts = [];
            const criticoPts = [];

            records.forEach(r => {
                if (!r.has_weather || r.temp_num === null || r.ur_num === null) return;
                const pt = { x: r.temp_num, y: r.ur_num, id: r.id, dt: r.delta_t_num };
                if (r.delta_t_classe === 'Ideal (2-8°C)') idealPts.push(pt);
                else if (r.delta_t_classe === 'Atenção (8-10°C)') atencaoPts.push(pt);
                else criticoPts.push(pt);
            });

            state.charts.tempUr.data.datasets = [
                { label: 'Ideal (2-8°C)', data: idealPts, backgroundColor: '#10B981', pointRadius: 5 },
                { label: 'Atenção (8-10°C)', data: atencaoPts, backgroundColor: '#F59E0B', pointRadius: 6 },
                { label: 'Crítico (>10°C)', data: criticoPts, backgroundColor: '#EF4444', pointRadius: 6 }
            ];
            state.charts.tempUr.update();
        }

        // 2. Vento x UR Scatter
        if (state.charts.ventoUr) {
            const ventoPts = records.filter(r => r.has_weather && r.vento_num !== null && r.ur_num !== null)
                .map(r => ({ x: r.vento_num, y: r.ur_num, id: r.id }));
            state.charts.ventoUr.data.datasets = [{
                data: ventoPts,
                backgroundColor: '#0D9488',
                pointRadius: 5
            }];
            state.charts.ventoUr.update();
        }

        // 3. Delta T Donut
        if (state.charts.deltaT) {
            const dtC = weather.deltaT.classes;
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
            state.charts.vazao.data.datasets[0].data = [v200, v150, v300, vOutros];
            state.charts.vazao.update();
        }

        // 6. Operações
        if (state.charts.operacoes) {
            state.charts.operacoes.data.labels = operations.map(o => o.nome.substring(0, 22) + (o.nome.length > 22 ? '...' : ''));
            state.charts.operacoes.data.datasets[0].data = operations.map(o => o.total);
            state.charts.operacoes.update();
        }

        // 7. Planta ou Soca
        if (state.charts.plantaSoca) {
            state.charts.plantaSoca.data.labels = plantSoca.map(p => p.tipo);
            state.charts.plantaSoca.data.datasets[0].data = plantSoca.map(p => p.total);
            state.charts.plantaSoca.update();
        }

        // 8. Timeline
        if (state.charts.timeline) {
            const timelineData = HerbicidaEngine.computeTemporalData(records, state.timelineMode);
            state.charts.timeline.data.labels = timelineData.map(t => t.label);
            state.charts.timeline.data.datasets[0].data = timelineData.map(t => t.total);
            state.charts.timeline.data.datasets[1].data = timelineData.map(t => t.ocorrencias);
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

            return `
                <tr class="cursor-pointer" onclick="window.abrirModalInspecao('${r.id}')">
                    <td class="font-bold text-emerald-600 dark:text-emerald-400">#${r.id}</td>
                    <td class="whitespace-nowrap">${r.data}</td>
                    <td class="font-semibold">${r.fazenda}</td>
                    <td>${r.os}</td>
                    <td class="max-w-[140px] truncate" title="${r.operacao}">${r.operacao}</td>
                    <td>${r.planta_soca}</td>
                    <td>${r.vento ? r.vento + ' km/h' : '-'}</td>
                    <td>${r.ur ? r.ur + '%' : '-'}</td>
                    <td>${r.temp ? r.temp + '°C' : '-'}</td>
                    <td>${dtBadge}</td>
                    <td>${r.esp_orig}</td>
                    <td>${filtroBadge}</td>
                    <td>${bicoBadge}</td>
                    <td>${r.vazao_orig}</td>
                    <td><span class="badge ${r.status === 'Fechado' ? 'badge-emerald' : 'badge-blue'}">${r.status}</span></td>
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
        const body = document.getElementById('modalBody');

        if (!modal || !title || !body) return;

        const regId = r.id || r.ID || id;
        const regFazenda = r.fazenda || r.Fazenda || '-';
        title.textContent = `Inspeção #${regId} • Fazenda ${regFazenda}`;

        const dtVal = (r.delta_t_num !== undefined && r.delta_t_num !== null) ? r.delta_t_num : null;
        const dtClass = HerbicidaEngine.classifyDeltaT(dtVal);

        body.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <!-- Grupo 1: Identificação Operacional -->
                <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                    <span class="font-bold text-slate-700 dark:text-slate-200 block border-b pb-1 mb-2 uppercase text-[11px]">
                        1. Identificação Operacional
                    </span>
                    <div class="space-y-1 text-slate-600 dark:text-slate-300">
                        <div><b>Fazenda:</b> ${r.fazenda}</div>
                        <div><b>Ordem de Serviço:</b> ${r.os}</div>
                        <div><b>Operação:</b> ${r.operacao}</div>
                        <div><b>Planta / Soca:</b> ${r.planta_soca}</div>
                        <div><b>Data Inspeção:</b> ${r.data}</div>
                        <div><b>Status:</b> ${r.status} | <b>Score:</b> ${r.score}</div>
                        <div><b>Usuário:</b> ${r.usuario}</div>
                    </div>
                </div>

                <!-- Grupo 2: Condições Meteorológicas -->
                <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                    <span class="font-bold text-slate-700 dark:text-slate-200 block border-b pb-1 mb-2 uppercase text-[11px]">
                        2. Condições Meteorológicas
                    </span>
                    <div class="space-y-1 text-slate-600 dark:text-slate-300">
                        <div><b>Vento:</b> ${r.vento ? r.vento + ' km/h' : 'Não Informado'}</div>
                        <div><b>Umidade Relativa:</b> ${r.ur ? r.ur + '%' : 'Não Informada'}</div>
                        <div><b>Temperatura Ar:</b> ${r.temp ? r.temp + '°C' : 'Não Informada'}</div>
                        <div><b>Bulbo Úmido (Tw):</b> ${r.tw_num ? r.tw_num + '°C' : 'N/I'}</div>
                        <div class="pt-1"><b>Delta T:</b> <span class="badge" style="background-color: ${dtClass.color}20; color: ${dtClass.color}; font-weight: bold;">${r.delta_t_num ? r.delta_t_num + '°C' : 'N/I'} • ${dtClass.classe}</span></div>
                    </div>
                </div>

                <!-- Grupo 3: Regulagem do Implemento -->
                <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                    <span class="font-bold text-slate-700 dark:text-slate-200 block border-b pb-1 mb-2 uppercase text-[11px]">
                        3. Regulagem do Pulverizador
                    </span>
                    <div class="space-y-1 text-slate-600 dark:text-slate-300">
                        <div><b>Espaçamento de Bico:</b> ${r.esp_orig} (${r.esp_grupo})</div>
                        <div><b>Abertura do Leque:</b> ${r.leque}</div>
                        <div><b>Vazão Aplicada:</b> ${r.vazao_orig}</div>
                    </div>
                </div>

                <!-- Grupo 4 & 5: Conservação & Procedimentos -->
                <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                    <span class="font-bold text-slate-700 dark:text-slate-200 block border-b pb-1 mb-2 uppercase text-[11px]">
                        4 & 5. Conservação e Procedimentos
                    </span>
                    <div class="space-y-1 text-slate-600 dark:text-slate-300">
                        <div><b>Limpeza Filtros Bomba:</b> ${r.filtro_bomba}</div>
                        <div><b>Limpeza de Bicos:</b> ${r.limpeza_bicos}</div>
                        <div><b>Avaliação Prévia:</b> ${r.aval_previa}</div>
                        <div><b>Ordem e Mapa Disponíveis:</b> ${r.mapa_os}</div>
                    </div>
                </div>
            </div>

            <!-- Grupo 6: Observações e Planos de Ação -->
            <div class="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <span class="font-bold text-amber-800 dark:text-amber-300 block mb-1 uppercase text-[11px]">
                    6. Observações Operacionais e Planos de Ação Registrados
                </span>
                <p class="text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                    ${r.obs || 'Nenhuma observação textual registrada para este apontamento.'}
                </p>
                ${r.equipamentos_nomes?.length ? `
                    <div class="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800 text-[11px]">
                        <b>Equipamento(s) Mencionados:</b> ${r.equipamentos_nomes.join(', ')}
                    </div>
                ` : ''}
            </div>
        `;

        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    };

    window.filtrarPorEquipamento = function (nome) {
        const sel = document.getElementById('filterEquipamento');
        if (sel) {
            sel.value = nome;
            state.activeFilters.equipamento = nome;
            aplicarFiltros();
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
