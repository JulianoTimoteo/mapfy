/**
 * map_shapes_layer.js
 * ====================
 * Camada Universal de Shapes e Talhões Agrícolas da Usina Pitangueiras.
 * Otimizada para Ultra-Alta Performance (60 FPS, Canvas Leve, Zoom Buttery-Smooth)
 * com Cruzamento Dinâmico de Amostragens e Coletas de Dados em Tempo Real.
 * 
 * Funcionalidades Principais:
 * 1. Integração Automática com Leaflet Map (state.map / dashboardState.map) em todos os 17 Dashboards.
 * 2. Cruzamento Dinâmico de Coletas: Compara os registros de campo/inspeção ativos com os shapes da pasta Maps.
 * 3. Diferenciação Visual Automática:
 *    - Talhões COM DADOS COLETADOS: Cor de destaque vibrante esmeralda (#059669 / #10b981), preenchimento
 *      translúcido (#10b981, 22%), borda de 2px e badge de medições auditadas no tooltip.
 *    - Talhões SEM DADOS COLETADOS: Traço cadastral neutro ultra-suave (#64748b, 0.18 opacidade, sem preenchimento),
 *      garantindo que não poluam o mapa nem disputem a atenção com os dados reais.
 * 4. Indexação Espacial em Grade (Grid 40x40) + Index Alfanumérico (Fazenda > Talhão):
 *    Cruza milhares de pontos com 6.469 polígonos em menos de 4ms.
 * 5. Reatividade aos Filtros: Atualiza a coloração dos talhões instantaneamente quando o usuário filtra
 *    por Data, Frente, OS ou Responsável no Dashboard.
 * 6. Tooltip Compartilhado Sob Demanda (Zero permanent tooltips): elimina consumo de RAM e travamentos de zoom.
 * 7. Controle Flutuante no Mapa '🌾 Talhões' com menu de configuração de intensidade, paleta e legenda de auditoria.
 * 
 * Usina Pitangueiras — Safra 2026
 */

(function () {
    'use strict';

    if (window.PitangueirasMapShapes) {
        return; // Evita dupla instanciação
    }

    const CONFIG = {
        manifestUrl: '../Maps/manifest.json',
        shapesUrl: '../Maps/pitangueiras_shapes.geojson',
        apiManifestUrl: 'http://127.0.0.1:8000/api/v1/maps/manifest',
        apiShapesUrl: 'http://127.0.0.1:8000/api/v1/maps/shapes',
        storageKey: 'pitangueiras_show_talhoes',
        themeKey: 'pitangueiras_shapes_theme',
        intensityKey: 'pitangueiras_shapes_intensity',
        highlightAuditedKey: 'pitangueiras_highlight_audited',
        cacheKey: '_pitangueiras_shapes_cache'
    };

    // Paletas de Cor Cadastrais Agronômicas Suaves (Anti-Saturação)
    const THEMES = {
        branco: {
            name: 'Branco Translúcido (Padrão Satélite)',
            color: 'rgba(255, 255, 255, 0.75)',    // Borda branca suave
            fillColor: '#ffffff'                   // Branco translúcido no satélite
        },
        esmeralda: {
            name: 'Esmeralda Suave',
            color: '#059669',
            fillColor: '#10b981'
        },
        neutro: {
            name: 'Ardósia Neutro',
            color: '#334155',
            fillColor: '#64748b'
        }
    };

    // Níveis de Intensidade e Visibilidade da Malha Cadastral
    const INTENSITIES = {
        suave: {
            borderOpacity: 0.75,
            fillOpacity: 0.14,
            baseWeight: 1.25,
            label: 'Suave (Padrão)'
        },
        media: {
            borderOpacity: 0.88,
            fillOpacity: 0.22,
            baseWeight: 1.65,
            label: 'Média'
        },
        forte: {
            borderOpacity: 0.98,
            fillOpacity: 0.32,
            baseWeight: 2.10,
            label: 'Forte'
        }
    };

    const MapShapes = {
        manifest: null,
        geojsonData: null,
        isLoading: false,
        activeLayers: new Map(),          // mapInstance -> geojsonLayer
        activeRenderers: new Map(),       // mapInstance -> canvasRenderer
        sharedTooltips: new Map(),        // mapInstance -> L.tooltip
        activeControls: new Map(),        // mapInstance -> HTMLElement wrap do controle
        auditedTalhoesByMap: new Map(),   // mapInstance -> Map<featureIndex, { count, records, firstRecord, lastRecord }>
        lastRecordsCache: new Map(),      // mapInstance -> { hash, count }
        currentTheme: localStorage.getItem(CONFIG.themeKey) || 'branco',
        currentIntensity: localStorage.getItem(CONFIG.intensityKey) || 'suave',
        highlightAudited: localStorage.getItem(CONFIG.highlightAuditedKey) !== 'false',

        // Índices de alta performance
        spatialGrid: null,
        shapesCodeIndex: null,

        async init() {
            this.injectStyles();
            this.hookLeaflet();
            this.observeMaps();
        },

        injectStyles() {
            if (document.getElementById('pitangueiras-shapes-style')) return;
            const style = document.createElement('style');
            style.id = 'pitangueiras-shapes-style';
            style.textContent = `
                .pitangueiras-talhao-tooltip {
                    background: rgba(255, 255, 255, 0.97) !important;
                    backdrop-filter: blur(10px) !important;
                    -webkit-backdrop-filter: blur(10px) !important;
                    border: 1px solid #cbd5e1 !important;
                    border-radius: 9px !important;
                    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15) !important;
                    padding: 0 !important;
                    color: #1e293b !important;
                }
                .pitangueiras-talhao-tooltip::before {
                    border-top-color: #cbd5e1 !important;
                }
                .talhoes-badge-audited {
                    background: #059669 !important;
                    box-shadow: 0 0 6px rgba(16, 185, 129, 0.4) !important;
                }
            `;
            if (document.head) {
                document.head.appendChild(style);
            } else {
                document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
            }
        },

        hookLeaflet() {
            if (typeof L !== 'undefined' && L.Map) {
                const self = this;
                L.Map.addInitHook(function () {
                    const mapInstance = this;
                    setTimeout(() => {
                        self.attachToMap(mapInstance);
                    }, 100);
                });
            }
        },

        observeMaps() {
            const checkMaps = () => {
                if (window.state && window.state.map) {
                    this.attachToMap(window.state.map);
                }
                if (window.dashboardState && window.dashboardState.map) {
                    this.attachToMap(window.dashboardState.map);
                }
                const containers = document.querySelectorAll('.leaflet-container');
                containers.forEach(c => {
                    if (c._leaflet_map) {
                        this.attachToMap(c._leaflet_map);
                    }
                });
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', checkMaps);
            } else {
                checkMaps();
            }

            setTimeout(checkMaps, 400);
            setTimeout(checkMaps, 1200);
            setTimeout(checkMaps, 2500);

            // Observador de ciclo contínuo para detectar mudanças de filtros nos dashboards
            setInterval(() => {
                this.activeLayers.forEach((layer, map) => {
                    this.syncWithDashboard(map);
                    this.ensureDataMarkersVisible(map);
                });
            }, 1200);
        },

        /**
         * Extrai coordenadas e identificadores (fazenda/talhão) de qualquer formato de registro Mapfy
         */
        parseRecordLocation(r) {
            if (!r) return null;
            let lat = null;
            let lon = null;

            // Extrai Latitude (suporta vírgula portuguesa ou ponto)
            const rawLat = r.lat !== undefined ? r.lat : (r.Latitude !== undefined ? r.Latitude : (r.latitude !== undefined ? r.latitude : null));
            const rawLon = r.lon !== undefined ? r.lon : (r.lng !== undefined ? r.lng : (r.Longitude !== undefined ? r.Longitude : (r.longitude !== undefined ? r.longitude : null)));

            if (rawLat !== null && rawLat !== undefined && rawLat !== '') {
                lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat).replace(',', '.'));
            }
            if (rawLon !== null && rawLon !== undefined && rawLon !== '') {
                lon = typeof rawLon === 'number' ? rawLon : parseFloat(String(rawLon).replace(',', '.'));
            }
            if (isNaN(lat)) lat = null;
            if (isNaN(lon)) lon = null;

            // Extrai Fazenda e Talhão
            let fazenda = null;
            let talhao = null;

            if (r.fazenda !== undefined && r.fazenda !== null) fazenda = String(r.fazenda).trim();
            if (r.talhao !== undefined && r.talhao !== null) {
                const tNum = parseInt(String(r.talhao).trim(), 10);
                if (!isNaN(tNum)) talhao = tNum;
            }

            const rawLocal = r.local || r['Local (Fazenda - Talhão)'] || r.localidadeTalhao || r.Local || r.localidade || '';
            if (typeof rawLocal === 'string' && rawLocal.includes('>')) {
                const parts = rawLocal.split('>');
                if (parts[0]) fazenda = parts[0].trim();
                if (parts[1]) {
                    const tNum = parseInt(parts[1].trim(), 10);
                    if (!isNaN(tNum)) talhao = tNum;
                }
            } else if (typeof rawLocal === 'string' && rawLocal.trim().length > 0 && !fazenda) {
                fazenda = rawLocal.trim();
            }

            return { lat, lon, fazenda, talhao, record: r };
        },

        /**
         * Constrói Grade Espacial 40x40 e Índice Alfanumérico dos 6.469 talhões
         */
        buildIndexes(geojsonData) {
            if (this.shapesCodeIndex) return;
            const features = geojsonData.features || [];
            this.shapesCodeIndex = new Map();

            const bbox = (this.manifest && this.manifest.bbox) || [-48.86, -21.53, -47.41, -20.51];
            const cols = 40, rows = 40;
            const dLon = (bbox[2] - bbox[0]) / cols;
            const dLat = (bbox[3] - bbox[1]) / rows;
            const grid = Array.from({ length: cols * rows }, () => []);

            for (let i = 0; i < features.length; i++) {
                const feat = features[i];
                const p = feat.properties || {};
                const b = feat.bbox;

                // Indexação alfanumérica por fazenda + talhão
                if (p.fazenda !== undefined && p.talhao !== undefined) {
                    const k = String(p.fazenda).trim() + '_' + parseInt(p.talhao, 10);
                    this.shapesCodeIndex.set(k, i);
                }

                // Indexação espacial na grade
                if (b && b.length >= 4) {
                    const minC = Math.max(0, Math.floor((b[0] - bbox[0]) / dLon));
                    const maxC = Math.min(cols - 1, Math.floor((b[2] - bbox[0]) / dLon));
                    const minR = Math.max(0, Math.floor((b[1] - bbox[1]) / dLat));
                    const maxR = Math.min(rows - 1, Math.floor((b[3] - bbox[1]) / dLat));
                    for (let r = minR; r <= maxR; r++) {
                        for (let c = minC; c <= maxC; c++) {
                            grid[r * cols + c].push(i);
                        }
                    }
                }
            }

            this.spatialGrid = { grid, cols, rows, dLon, dLat, bbox };
        },

        /**
         * Cruza registros de campo com os talhões da pasta Maps em alta velocidade (~3ms)
         */
        matchRecordsToShapes(records) {
            if (!this.geojsonData || !records || records.length === 0) {
                return new Map();
            }
            this.buildIndexes(this.geojsonData);

            const matchedMap = new Map(); // featureIndex -> { count, records, firstRecord, lastRecord }
            const features = this.geojsonData.features || [];
            const { grid, cols, rows, dLon, dLat, bbox } = this.spatialGrid;

            // Função interna otimizada de Point-in-Polygon (Ray Casting 2D)
            const isPointInsidePolygon = (pt, geom) => {
                if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) return false;
                const coordsList = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
                for (let polyIdx = 0; polyIdx < coordsList.length; polyIdx++) {
                    const ring = coordsList[polyIdx][0];
                    if (ring && ring.length > 2) {
                        const x = pt[0], y = pt[1];
                        let inside = false;
                        for (let pi = 0, pj = ring.length - 1; pi < ring.length; pj = pi++) {
                            const xi = ring[pi][0], yi = ring[pi][1];
                            const xj = ring[pj][0], yj = ring[pj][1];
                            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                            if (intersect) inside = !inside;
                        }
                        if (inside) return true;
                    }
                }
                return false;
            };

            for (let k = 0; k < records.length; k++) {
                const rec = records[k];
                const loc = this.parseRecordLocation(rec);
                if (!loc) continue;

                let matchedIdx = null;
                let matchType = 'none';

                // PRIORIDADE 1: GPS REAL COM POINT-IN-POLYGON (A Verdade Geográfica em Campo)
                // Se o trator/operador estava fisicamente dentro do contorno do talhão, o shape onde os pontos estão deve ser auditado
                if (loc.lat !== null && loc.lon !== null) {
                    const c = Math.floor((loc.lon - bbox[0]) / dLon);
                    const r = Math.floor((loc.lat - bbox[1]) / dLat);
                    if (c >= 0 && c < cols && r >= 0 && r < rows) {
                        const cell = grid[r * cols + c];
                        for (let i = 0; i < cell.length; i++) {
                            const featIdx = cell[i];
                            const feat = features[featIdx];
                            const b = feat.bbox;
                            if (b && loc.lon >= b[0] && loc.lat >= b[1] && loc.lon <= b[2] && loc.lat <= b[3]) {
                                if (isPointInsidePolygon([loc.lon, loc.lat], feat.geometry)) {
                                    matchedIdx = featIdx;
                                    matchType = 'gps';
                                    break;
                                }
                            }
                        }
                    }
                }

                // PRIORIDADE 2: Fallback Alfanumérico Direto (caso o registro não tenha GPS ou caiu fora de malha)
                if (matchedIdx === null && loc.fazenda && loc.talhao !== null) {
                    const codeKey = loc.fazenda + '_' + loc.talhao;
                    if (this.shapesCodeIndex.has(codeKey)) {
                        matchedIdx = this.shapesCodeIndex.get(codeKey);
                        matchType = 'code';
                    }
                }

                // Auditoria de Divergência de Cadastro:
                // Detecta quando o fiscal apontou uma fazenda no formulário mas estava fisicamente em outra
                if (matchedIdx !== null && matchType === 'gps' && loc.fazenda && loc.talhao !== null) {
                    const featProps = features[matchedIdx].properties || {};
                    const declaredKey = loc.fazenda + '_' + loc.talhao;
                    const realKey = String(featProps.fazenda).trim() + '_' + parseInt(featProps.talhao, 10);
                    if (declaredKey !== realKey) {
                        rec._divergenciaCadastro = {
                            declarado: `Fazenda ${loc.fazenda} > Talhão ${loc.talhao}`,
                            real: `Fazenda ${featProps.fazenda} (${featProps.nome_faz || ''}) > Talhão ${featProps.talhao}`
                        };
                    }
                }

                if (matchedIdx !== null) {
                    if (!matchedMap.has(matchedIdx)) {
                        matchedMap.set(matchedIdx, {
                            count: 0,
                            records: [],
                            allRecords: [],
                            depthValues: [],
                            firstRecord: rec,
                            lastRecord: rec
                        });
                    }
                    const entry = matchedMap.get(matchedIdx);
                    entry.count++;
                    if (entry.allRecords.length < 100) {
                        entry.allRecords.push(rec);
                    }
                    if (entry.records.length < 6) {
                        entry.records.push(rec);
                    }
                    entry.lastRecord = rec;

                    // Extrai medição de profundidade de subsolagem (dados do usuário)
                    let pVal = null;
                    if (rec.profundidade !== undefined && rec.profundidade !== null) {
                        pVal = typeof rec.profundidade === 'number' ? rec.profundidade : parseFloat(String(rec.profundidade).replace(',', '.'));
                    } else if (rec.Subsolagem !== undefined && rec.Subsolagem !== null) {
                        pVal = typeof rec.Subsolagem === 'number' ? rec.Subsolagem : parseFloat(String(rec.Subsolagem).replace(',', '.'));
                    }
                    if (pVal !== null && !isNaN(pVal) && pVal > 0) {
                        entry.depthValues.push(pVal);
                    }
                }
            }

            // Semáforo Agronômico de Qualidade Reativo às Metas Reais do Dashboard
            matchedMap.forEach((entry) => {
                const recs = entry.allRecords && entry.allRecords.length > 0 ? entry.allRecords : (entry.records || []);
                if (recs.length === 0 && entry.firstRecord) recs.push(entry.firstRecord);

                let countBom = 0;
                let countMedio = 0;
                let countRuim = 0;

                recs.forEach(rec => {
                    const q = this.getRecordQuality(rec);
                    if (q === 'RUIM') countRuim++;
                    else if (q === 'MEDIO') countMedio++;
                    else countBom++;
                });

                const total = recs.length;
                if (total > 0 && (countRuim / total) >= 0.5) {
                    entry.semaforo = {
                        status: 'RUIM',
                        label: 'Crítico / Ruim',
                        color: '#ef4444',
                        stroke: '#dc2626',
                        badgeBg: '#fef2f2',
                        badgeText: '#b91c1c',
                        icon: '🔴'
                    };
                } else if (total > 0 && ((countMedio + countRuim) / total) >= 0.35) {
                    entry.semaforo = {
                        status: 'MEDIO',
                        label: 'Atenção / Médio',
                        color: '#f59e0b',
                        stroke: '#d97706',
                        badgeBg: '#fffbeb',
                        badgeText: '#b45309',
                        icon: '🟡'
                    };
                } else {
                    entry.semaforo = {
                        status: 'BOM',
                        label: 'Conforme / Na Meta',
                        color: '#10b981',
                        stroke: '#059669',
                        badgeBg: '#ecfdf5',
                        badgeText: '#047857',
                        icon: '🟢'
                    };
                }
            });

            return matchedMap;
        },

        /**
         * Obtém os registros atualmente ativos e filtrados no dashboard
         */
        
        /**
         * Determina a qualidade técnica de um registro de campo respeitando o motor
         * e regras do dashboard ativo (Paralelismo, Canteirização, Sulcação, etc.).
         */
        getRecordQuality(rec) {
            if (!rec) return 'BOM';

            // 1. Tenta usar o Engine agronômico ativo da página
            const activeEngine = window.ParalelismoEngine || window.CanteirizacaoEngine || window.SulcacaoEngine || window.AberturaAsaEngine || window.CobricaoEngine || window.SubsolagemEngine;
            const targetConfig = (window.state && window.state.targetConfig) || (activeEngine && typeof activeEngine.getTargetConfig === 'function' && activeEngine.getTargetConfig());

            if (activeEngine && typeof activeEngine.classifyDepth === 'function' && targetConfig) {
                let v = rec.profundidade !== undefined && rec.profundidade !== null ? rec.profundidade : (rec.valor || rec.Medicao || rec.medicao);
                if (v !== null && v !== undefined && !isNaN(Number(v))) {
                    const cls = activeEngine.classifyDepth(Number(v), targetConfig);
                    if (cls) {
                        if (cls.status === 'DENTRO' || cls.status === 'CONFORME' || cls.color === '#10b981') return 'BOM';
                        if (cls.status === 'ABAIXO' || cls.status === 'MEDIO' || cls.color === '#f59e0b') return 'MEDIO';
                        if (cls.status === 'ACIMA' || cls.color === '#a855f7' || cls.color === '#8b5cf6') return 'MEDIO';
                        if (cls.status === 'RUIM' || cls.status === 'INVÁLIDO' || cls.color === '#ef4444') return 'RUIM';
                    }
                }
            }

            // 2. Indicadores explícitos de problema / NOK
            if (rec.isNok || rec.temNok || rec.hasNok || rec.temProblema) return 'RUIM';
            if (rec.statusConformidade === 'NOK' || rec.conformidade === 'NOK') return 'RUIM';
            if (rec.statusConformidade === 'OK' || rec.conformidade === 'OK') return 'BOM';

            // 3. Fallback agronômico subsolagem específica (quando operando de 30 a 70 cm)
            let pVal = rec.profundidade !== undefined ? rec.profundidade : rec.Subsolagem;
            if (pVal !== undefined && pVal !== null && !isNaN(Number(pVal))) {
                const num = Number(pVal);
                if (num >= 30 && num <= 70) {
                    if (num >= 45 && num <= 55) return 'BOM';
                    if ((num >= 40 && num < 45) || (num > 55 && num <= 60)) return 'MEDIO';
                    return 'RUIM';
                }
            }

            return 'BOM';
        },

        filterRecordsByDays(records, days) {
            if (!Array.isArray(records) || records.length === 0 || !days) return records;
            let maxTs = 0;
            for (let i = 0; i < records.length; i++) {
                const r = records[i];
                let ts = null;
                const dStr = r.dataIso || r.Data || r.data || r.DataLancamento || r.dataLancamento || r.dataStr;
                if (dStr) {
                    if (typeof dStr === 'number') ts = dStr;
                    else if (dStr.includes('/')) {
                        const parts = dStr.split(' ')[0].split('/');
                        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
                    } else {
                        const parsed = Date.parse(dStr);
                        if (!isNaN(parsed)) ts = parsed;
                    }
                }
                if (ts && ts > maxTs) maxTs = ts;
            }
            if (maxTs <= 0) return records;
            const minTs = maxTs - (days * 86400000);
            return records.filter(r => {
                let ts = null;
                const dStr = r.dataIso || r.Data || r.data || r.DataLancamento || r.dataLancamento || r.dataStr;
                if (dStr) {
                    if (typeof dStr === 'number') ts = dStr;
                    else if (dStr.includes('/')) {
                        const parts = dStr.split(' ')[0].split('/');
                        if (parts.length === 3) ts = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
                    } else {
                        const parsed = Date.parse(dStr);
                        if (!isNaN(parsed)) ts = parsed;
                    }
                }
                return ts && ts >= minTs && ts <= maxTs;
            });
        },

        getDashboardRecords() {
            const st = window.state || window.dashboardState;
            if (st) {
                // REGRA CRÍTICA: Se o mapa estiver em modo autônomo (não sincronizado com filtro global),
                // os talhões DEVEM obedecer estritamente ao período do mapa (7D, 15D, etc.)
                if (st.mapSyncWithGlobal === false && st.mapRange) {
                    const baseRecs = Array.isArray(st.filteredRecords) && st.filteredRecords.length > 0
                                   ? st.filteredRecords
                                   : (st.allRecords || []);
                    if (st.mapRange !== 'ALL') {
                        if (typeof window.getRecordsForDateRange === 'function') {
                            return window.getRecordsForDateRange(baseRecs, st.mapRange);
                        }
                        const days = st.mapRange === '7D' ? 7 : (st.mapRange === '15D' ? 15 : 30);
                        return this.filterRecordsByDays(baseRecs, days);
                    }
                    return baseRecs;
                }

                // Se houver registros específicos filtrados e plotados no mapa
                if (Array.isArray(st.mapRecords) && st.mapRecords.length > 0) {
                    return st.mapRecords;
                }

                if (Array.isArray(st.filteredRecords) && st.filteredRecords.length > 0) {
                    return st.filteredRecords;
                }
                if (Array.isArray(st.allRecords) && st.allRecords.length > 0) {
                    return st.allRecords;
                }
                if (Array.isArray(st.rawRecords) && st.rawRecords.length > 0) {
                    return st.rawRecords;
                }
            }

            // Fallback para datasets globais conhecidos
            const globals = [
                'COBRICAO_DATA', 'ABERTURA_ASA_RAW_DATA', 'SUBSOLAGEM_DATA',
                'PARALELISMO_DATA', 'PARALELISMO_RAW_DATA', 'CANTEIRIZACAO_DATA', 'QUALIDADE_CANA_DATA',
                'DOSAGEM_SULCO_DATA', 'DOSAGEM_COBRICAO_DATA', 'HERBICIDA_DATA',
                'BROCA_ARMADILHA_DATA', 'QUALIDADE_MUDA_DATA', 'AREA_VIVENCIA_DATA',
                'CHECKLIST_VEICULAR_DATA', 'ARREMATE_ACABAMENTO_DATA',
                'VIABILIDADE_GEMAS_DATA', 'TPL_5S_DATA'
            ];

            for (const g of globals) {
                if (Array.isArray(window[g]) && window[g].length > 0) {
                    return window[g];
                }
            }

            return [];
        },

        /**
         * Sincroniza o cruzamento de dados com o mapa e atualiza as cores reativamente
         */
        syncWithDashboard(map) {
            if (!map || !this.activeLayers.has(map)) return;
            const records = this.getDashboardRecords();
            const cache = this.lastRecordsCache.get(map);

            // Verifica se houve alteração na quantidade ou referência dos registros
            const recLen = records.length;
            const firstId = recLen > 0 ? (records[0].id || records[0].ID || records[0].Medicao || '') : '';
            const recHash = `${recLen}_${firstId}`;

            if (cache && cache.hash === recHash) {
                return; // Já sincronizado com este conjunto de dados
            }

            this.lastRecordsCache.set(map, { hash: recHash, count: recLen });

            // Executa o cruzamento de alta performance
            const matchedMap = this.matchRecordsToShapes(records);
            this.auditedTalhoesByMap.set(map, matchedMap);

            // Atualiza o estilo de todos os talhões no mapa
            this.updateAllLayersStyle(map);

            // Atualiza o badge do botão flutuante e contadores da legenda
            this.updateControlBadge(map);
            if (typeof window.updateMapTalhoesLegend === 'function') {
                window.updateMapTalhoesLegend();
            }
        },

        /**
         * Localiza dinamicamente a camada de marcadores / apontamentos de campo do mapa
         */
        getDataMarkersLayer(map) {
            if (!map) return null;
            if (map._pitangueirasDataMarkersLayer && typeof map._pitangueirasDataMarkersLayer.clearLayers === 'function') {
                return map._pitangueirasDataMarkersLayer;
            }
            const st = window.state || window.dashboardState || {};
            if (st.map === map) {
                if (st.markersLayer) {
                    map._pitangueirasDataMarkersLayer = st.markersLayer;
                    return st.markersLayer;
                }
                if (st.markerCluster) {
                    map._pitangueirasDataMarkersLayer = st.markerCluster;
                    return st.markerCluster;
                }
            }
            if (window.state && (window.state.markersLayer || window.state.markerCluster)) {
                const ml = window.state.markersLayer || window.state.markerCluster;
                map._pitangueirasDataMarkersLayer = ml;
                return ml;
            }
            if (window.dashboardState && (window.dashboardState.markersLayer || window.dashboardState.markerCluster)) {
                const ml = window.dashboardState.markersLayer || window.dashboardState.markerCluster;
                map._pitangueirasDataMarkersLayer = ml;
                return ml;
            }
            // Varredura defensiva entre as camadas ativas do mapa
            if (map._layers) {
                for (const k in map._layers) {
                    const l = map._layers[k];
                    if (l && l !== this.activeLayers.get(map) && !l._url && typeof l.clearLayers === 'function' && typeof l.addLayer === 'function') {
                        map._pitangueirasDataMarkersLayer = l;
                        return l;
                    }
                }
            }
            return null;
        },

        /**
         * Garante que os apontamentos e marcadores de dados estejam SEMPRE visíveis no mapa
         */
        ensureDataMarkersVisible(map) {
            if (!map) return;
            const dataLayer = this.getDataMarkersLayer(map);
            if (dataLayer && !map.hasLayer(dataLayer)) {
                map.addLayer(dataLayer);
            }
        },

        updateControlBadge(map) {
            const wrap = this.activeControls.get(map);
            if (!wrap) return;
            const badge = wrap.querySelector('.talhoes-badge');
            const btn = wrap.querySelector('.talhoes-main-btn');
            if (!badge) return;

            const isVisible = map._pitangueirasTalhoesVisible !== false &&
                              this.activeLayers.has(map) &&
                              map.hasLayer(this.activeLayers.get(map));
            const auditedMap = this.auditedTalhoesByMap.get(map);
            const auditedCount = auditedMap ? auditedMap.size : 0;

            if (auditedCount > 0 && this.highlightAudited) {
                badge.innerText = `${auditedCount} com coleta`;
                badge.title = `${auditedCount} talhões contêm dados de campo coletados no período filtrado.`;
            } else {
                badge.innerText = '6.4k';
                badge.title = '6.469 talhões cadastrados na Usina Pitangueiras.';
            }

            // O estilo do botão e do badge reflete EXCLUSIVAMENTE a visibilidade dos talhões (canvas)
            if (isVisible) {
                badge.classList.add('talhoes-badge-audited');
                badge.style.background = '#059669';
                badge.style.color = '#ffffff';
                if (btn) {
                    btn.style.color = '#047857';
                    btn.style.background = 'rgba(16, 185, 129, 0.10)';
                    btn.title = 'Clique para ocultar os talhões do mapa';
                }
            } else {
                badge.classList.remove('talhoes-badge-audited');
                badge.style.background = '#94a3b8';
                badge.style.color = '#ffffff';
                if (btn) {
                    btn.style.color = '#64748b';
                    btn.style.background = 'transparent';
                    btn.title = 'Clique para exibir os talhões no mapa';
                }
            }
        },

        /**
         * Estilização dos Talhões Agrícolas:
         * Formato dinâmico reativo às opções do usuário (Tema, Intensidade e Destaque com Coleta).
         * Garante visibilidade nítida da terra, carreadores, relevo e curvas de nível.
         */
        getFeatureStyle(feature, featureIndex, map, zoom = 11) {
            const auditedMap = this.auditedTalhoesByMap.get(map);
            const isAudited = Boolean(this.highlightAudited && auditedMap && auditedMap.has(featureIndex));

            // Resgata o tema e intensidade dinâmicos configurados pelo usuário
            const theme = THEMES[this.currentTheme] || THEMES.branco;
            const intensity = INTENSITIES[this.currentIntensity] || INTENSITIES.suave;

            let zoomBonus = zoom <= 11 ? 0 : (zoom <= 14 ? 0.35 : 0.65);
            let weight = (intensity.baseWeight || 1.1) + zoomBonus;

            // Hook de customização agronômica específica por dashboard (se houver)
            if (typeof this.customFeatureStyler === 'function') {
                try {
                    const customStyle = this.customFeatureStyler(feature, featureIndex, map, zoom, isAudited);
                    if (customStyle) return customStyle;
                } catch (errStyler) {}
            }

            if (isAudited) {
                // TALHÃO COM COLETA NO PERÍODO FILTRADO: Semáforo dinâmico (Verde Bom, Amarelo Médio, Vermelho Ruim)
                const auditEntry = auditedMap ? auditedMap.get(featureIndex) : null;
                const sem = auditEntry && auditEntry.semaforo ? auditEntry.semaforo : { color: '#10b981', stroke: '#059669' };

                let fillOp = 0.50;
                if (this.currentIntensity === 'suave') fillOp = 0.40;
                else if (this.currentIntensity === 'media') fillOp = 0.60;
                else if (this.currentIntensity === 'forte') fillOp = 0.80;

                return {
                    color: sem.stroke,
                    weight: weight + 1.0,
                    opacity: 1.0,
                    fillColor: sem.color,
                    fillOpacity: fillOp,
                    dashArray: null
                };
            } else {
                // TALHÃO SEM COLETA NO PERÍODO FILTRADO:
                // REGRA ESTRITA: ZERO PREENCHIMENTO VERDE! Fica 100% transparente com traço cadastral neutro fino
                return {
                    color: '#94a3b8',
                    weight: Math.max(0.65, weight - 0.45),
                    opacity: 0.35,
                    fillColor: 'transparent',
                    fillOpacity: 0.0,
                    dashArray: null
                };
            }
        },

        async fetchManifest() {
            if (this.manifest) return this.manifest;

            const urls = [
                CONFIG.manifestUrl + '?t=' + Date.now(),
                CONFIG.apiManifestUrl
            ];

            for (const u of urls) {
                try {
                    const resp = await fetch(u, { cache: 'no-cache' });
                    if (resp.ok) {
                        this.manifest = await resp.json();
                        return this.manifest;
                    }
                } catch (e) {}
            }
            return null;
        },

        async loadShapesData() {
            // 1. Checagem imediata em memória global (Script pitangueiras_shapes_data.js)
            if (window.PITANGUEIRAS_SHAPES_DATA) {
                this.geojsonData = window.PITANGUEIRAS_SHAPES_DATA;
                if (this.geojsonData && Array.isArray(this.geojsonData.features)) {
                    for (let i = 0; i < this.geojsonData.features.length; i++) {
                        this.geojsonData.features[i]._pitangueirasIndex = i;
                    }
                }
                window[CONFIG.cacheKey] = this.geojsonData;
                console.info(`[MapShapes] ${this.geojsonData.features.length} talhões carregados via dados embarcados locais (Zero CORS).`);
                return this.geojsonData;
            }

            if (window[CONFIG.cacheKey]) {
                this.geojsonData = window[CONFIG.cacheKey];
                return this.geojsonData;
            }

            // 2. Tentar injeção dinâmica síncrona do script JS local
            if (typeof document !== 'undefined') {
                try {
                    await new Promise((resolve) => {
                        const s = document.createElement('script');
                        s.src = '../Maps/pitangueiras_shapes_data.js';
                        s.onload = () => resolve();
                        s.onerror = () => resolve();
                        document.head.appendChild(s);
                    });
                    if (window.PITANGUEIRAS_SHAPES_DATA) {
                        this.geojsonData = window.PITANGUEIRAS_SHAPES_DATA;
                if (this.geojsonData && Array.isArray(this.geojsonData.features)) {
                    for (let i = 0; i < this.geojsonData.features.length; i++) {
                        this.geojsonData.features[i]._pitangueirasIndex = i;
                    }
                }
                        window[CONFIG.cacheKey] = this.geojsonData;
                        console.info(`[MapShapes] Injetado pitangueiras_shapes_data.js (${this.geojsonData.features.length} talhões).`);
                        return this.geojsonData;
                    }
                } catch (e) {}
            }

            // 3. Fallback via fetch se estiver sob servidor HTTP
            if (this.isLoading) {
                while (this.isLoading) {
                    await new Promise(r => setTimeout(r, 80));
                }
                return this.geojsonData;
            }

            this.isLoading = true;
            try {
                const urls = [CONFIG.shapesUrl, CONFIG.apiShapesUrl];
                for (const u of urls) {
                    try {
                        const resp = await fetch(u);
                        if (resp.ok) {
                            const data = await resp.json();
                            if (data && data.features && data.features.length > 0) {
                                this.geojsonData = data;
                                window[CONFIG.cacheKey] = data;
                                console.info(`[MapShapes] Carregados ${data.features.length} talhões via fetch.`);
                                return this.geojsonData;
                            }
                        }
                    } catch (err) {}
                }
            } catch (err) {
                console.warn('[MapShapes] Falha ao carregar shapes via fetch:', err);
            } finally {
                this.isLoading = false;
            }

            return null;
        },

        attachToMap(map) {
            if (!map || typeof map.addLayer !== 'function') return;
            if (this.activeLayers.has(map)) return;

            const container = map.getContainer ? map.getContainer() : null;
            if (!container) return;
            container._leaflet_map = map;

            // Cria Pane customizado para os talhões (Z-Index 350: acima dos tiles, abaixo dos marcadores)
            let pane = map.getPane('agriculturalShapesPane');
            if (!pane) {
                pane = map.createPane('agriculturalShapesPane');
                pane.style.zIndex = '350';
                pane.style.pointerEvents = 'auto';
            }

            // Garante que os apontamentos de campo estão visíveis
            this.ensureDataMarkersVisible(map);

            // Cria o controle flutuante no mapa
            this.initMapControlsListener();
            this.createMapControl(map);

            // O mapa inicia com os talhões ativados por padrão
            // A menos que o usuário tenha explicitamente desligado no localStorage
            const isEnabled = localStorage.getItem(CONFIG.storageKey) !== 'false';
            map._pitangueirasTalhoesVisible = isEnabled;
            if (pane) {
                pane.style.display = isEnabled ? 'block' : 'none';
            }
            if (isEnabled) {
                this.enableLayerForMap(map);
            } else {
                this.preloadShapesInBackground(map);
            }
            this.updateControlBadge(map);
        },

        preloadShapesInBackground(map) {
            const schedule = window.requestIdleCallback || ((cb) => setTimeout(cb, 600));
            schedule(async () => {
                try {
                    const data = await this.loadShapesData();
                    if (data && map) {
                        this.buildIndexes(data);
                        const records = this.getDashboardRecords();
                        const matchedMap = this.matchRecordsToShapes(records);
                        this.auditedTalhoesByMap.set(map, matchedMap);
                        this.updateControlBadge(map);
                    }
                } catch (e) {
                    console.warn('[MapShapes] Pré-aquecimento em segundo plano:', e);
                }
            });
        },

        
        // Listener universal reativo aos botões de período do mapa em qualquer dashboard
        initMapControlsListener() {
            if (this._controlsListenerAttached) return;
            this._controlsListenerAttached = true;
            const self = this;
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-map-filter, #btnToggleMapSyncFilter, [data-map-range]');
                if (btn) {
                    const range = btn.getAttribute('data-map-range') || 'Filtro';
                    // Aciona feedback visual amigável (Skeleton / Overlay)
                    self.activeLayers.forEach((layer, map) => {
                        const container = map.getContainer ? map.getContainer() : null;
                        if (container && typeof window.showMapProcessingOverlay === 'function') {
                            window.showMapProcessingOverlay(container, `Atualizando talhões agronômicos (${range})...`);
                        }
                    });

                    setTimeout(() => {
                        if (self.activeLayers) {
                            self.activeLayers.forEach((layer, map) => {
                                self.lastRecordsCache.delete(map);
                                self.syncWithDashboard(map);
                                const container = map.getContainer ? map.getContainer() : null;
                                if (container && typeof window.hideMapProcessingOverlay === 'function') {
                                    window.hideMapProcessingOverlay(container);
                                }
                            });
                        }
                    }, 140);
                }
            });
        },

        createMapControl(map) {
            const self = this;
            const container = map.getContainer();
            if (container.querySelector('.leaflet-control-talhoes-container')) return;

            const TalhoesControl = L.Control.extend({
                options: { position: 'topright' },

                onAdd: function () {
                    const wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-talhoes-container');
                    wrap.style.cssText = `
                        background: rgba(255, 255, 255, 0.95);
                        backdrop-filter: blur(10px);
                        -webkit-backdrop-filter: blur(10px);
                        border: 1px solid #cbd5e1;
                        border-radius: 10px;
                        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.10);
                        display: flex;
                        align-items: center;
                        position: relative;
                        padding: 2px;
                        font-family: Inter, system-ui, -apple-system, sans-serif;
                    `;

                    self.activeControls.set(map, wrap);

                    const isEnabled = localStorage.getItem(CONFIG.storageKey) !== 'false';

                    // Botão Principal Liga / Desliga
                    const btn = document.createElement('button');
                    btn.className = 'talhoes-main-btn';
                    btn.type = 'button';
                    btn.style.cssText = `
                        background: ${isEnabled ? 'rgba(16, 185, 129, 0.10)' : 'transparent'};
                        border: none;
                        outline: none;
                        padding: 4px 8px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        font-size: 11.5px;
                        font-weight: 700;
                        color: ${isEnabled ? '#047857' : '#64748b'};
                        transition: all 0.2s ease;
                        user-select: none;
                        border-radius: 8px;
                    `;
                    btn.title = isEnabled ? 'Clique para ocultar os talhões do mapa' : 'Clique para exibir os talhões no mapa';

                    btn.innerHTML = `
                        <span style="font-size: 13px; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.1));">🌾</span>
                        <span>Talhões</span>
                        <span class="talhoes-badge" style="
                            font-size: 9.5px;
                            padding: 1px 6px;
                            border-radius: 9999px;
                            background: ${isEnabled ? '#059669' : '#94a3b8'};
                            color: #ffffff;
                            font-weight: 800;
                            letter-spacing: 0.3px;
                            transition: all 0.2s ease;
                        ">6.4k</span>
                    `;

                    // Botão de Ajuste Rápido de Estilo/Intensidade
                    const cfgBtn = document.createElement('button');
                    cfgBtn.className = 'talhoes-settings-btn';
                    cfgBtn.type = 'button';
                    cfgBtn.style.cssText = `
                        background: transparent;
                        border: none;
                        border-left: 1px solid #e2e8f0;
                        outline: none;
                        padding: 4px 6px;
                        cursor: pointer;
                        font-size: 12px;
                        color: #64748b;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 0 8px 8px 0;
                        transition: all 0.2s ease;
                    `;
                    cfgBtn.title = 'Ajustar visualização e realce de talhões com coleta';
                    cfgBtn.innerHTML = '⚙️';

                    // Painel Flutuante de Configurações
                    const menu = document.createElement('div');
                    menu.className = 'talhoes-settings-menu';
                    menu.style.cssText = `
                        display: none;
                        position: absolute;
                        top: calc(100% + 6px);
                        right: 0;
                        background: rgba(255, 255, 255, 0.98);
                        backdrop-filter: blur(12px);
                        border: 1px solid #cbd5e1;
                        border-radius: 10px;
                        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
                        padding: 10px 12px;
                        width: 235px;
                        z-index: 1000;
                        font-size: 11px;
                        color: #1e293b;
                    `;

                    const renderMenuContent = () => {
                        const curTheme = self.currentTheme;
                        const curInt = self.currentIntensity;
                        const isHigh = self.highlightAudited;
                        const auditedMap = self.auditedTalhoesByMap.get(map);
                        const count = auditedMap ? auditedMap.size : 0;

                        menu.innerHTML = `
                            <div style="font-weight: 800; font-size: 11.5px; color: #047857; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                                <span>Aparência dos Talhões</span>
                                <span style="font-size: 9.5px; color: #64748b; font-weight: 600;">60 FPS</span>
                            </div>

                            <!-- Alternador de Destaque por Coleta -->
                            <div style="margin-bottom: 9px; padding: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 7px;">
                                <label style="display: flex; align-items: center; gap: 7px; cursor: pointer;">
                                    <input type="checkbox" id="chkHighlightAudited" ${isHigh ? 'checked' : ''} style="accent-color: #059669; cursor: pointer;">
                                    <span style="font-weight: 700; color: #047857; font-size: 11px;">Destacar com Coleta</span>
                                </label>
                                <div style="font-size: 9.5px; color: #64748b; margin-top: 3px; line-height: 1.3;">
                                    Realça talhões que contêm medições e atenua os demais.
                                </div>
                            </div>

                            <div style="font-size: 10px; color: #64748b; margin-bottom: 4px; font-weight: 700; text-transform: uppercase;">Intensidade da Cor:</div>
                            <div style="display: flex; gap: 4px; margin-bottom: 8px;">
                                <button type="button" data-intensity="suave" style="flex: 1; padding: 3px 4px; font-size: 10.5px; border-radius: 6px; border: 1px solid ${curInt === 'suave' ? '#059669' : '#e2e8f0'}; background: ${curInt === 'suave' ? '#ecfdf5' : '#f8fafc'}; color: ${curInt === 'suave' ? '#065f46' : '#475569'}; font-weight: 700; cursor: pointer;">Suave</button>
                                <button type="button" data-intensity="media" style="flex: 1; padding: 3px 4px; font-size: 10.5px; border-radius: 6px; border: 1px solid ${curInt === 'media' ? '#059669' : '#e2e8f0'}; background: ${curInt === 'media' ? '#ecfdf5' : '#f8fafc'}; color: ${curInt === 'media' ? '#065f46' : '#475569'}; font-weight: 700; cursor: pointer;">Média</button>
                                <button type="button" data-intensity="forte" style="flex: 1; padding: 3px 4px; font-size: 10.5px; border-radius: 6px; border: 1px solid ${curInt === 'forte' ? '#059669' : '#e2e8f0'}; background: ${curInt === 'forte' ? '#ecfdf5' : '#f8fafc'}; color: ${curInt === 'forte' ? '#065f46' : '#475569'}; font-weight: 700; cursor: pointer;">Forte</button>
                            </div>

                            <div style="font-size: 10px; color: #64748b; margin-bottom: 4px; font-weight: 700; text-transform: uppercase;">Paleta de Cor Base:</div>
                            <div style="display: flex; flex-direction: column; gap: 3px; margin-bottom: 8px;">
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 1px 0;">
                                    <input type="radio" name="pit_theme" value="esmeralda" ${curTheme === 'esmeralda' ? 'checked' : ''} style="accent-color: #059669;">
                                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: #059669;"></span>
                                    <span style="font-weight: 600;">Esmeralda Suave</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 1px 0;">
                                    <input type="radio" name="pit_theme" value="neutro" ${curTheme === 'neutro' ? 'checked' : ''} style="accent-color: #334155;">
                                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: #334155;"></span>
                                    <span style="font-weight: 600;">Ardósia Neutro</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 1px 0;">
                                    <input type="radio" name="pit_theme" value="branco" ${curTheme === 'branco' ? 'checked' : ''} style="accent-color: #94a3b8;">
                                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: #ffffff; border: 1px solid #cbd5e1;"></span>
                                    <span style="font-weight: 600;">Branco Satélite</span>
                                </label>
                            </div>

                            <!-- Legenda de Auditoria -->
                            <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 10px; color: #475569;">
                                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
                                    <span style="display: inline-block; width: 12px; height: 8px; border-radius: 2px; background: rgba(16, 185, 129, 0.4); border: 1.5px solid #059669;"></span>
                                    <span><b>${count}</b> talhões com coleta ativa</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="display: inline-block; width: 12px; height: 8px; border-radius: 2px; background: transparent; border: 1px solid #94a3b8;"></span>
                                    <span>Demais talhões sem coleta</span>
                                </div>
                            </div>
                        `;

                        // Eventos dentro do menu
                        const chk = menu.querySelector('#chkHighlightAudited');
                        if (chk) {
                            chk.addEventListener('change', (ev) => {
                                ev.stopPropagation();
                                self.highlightAudited = chk.checked;
                                localStorage.setItem(CONFIG.highlightAuditedKey, String(chk.checked));
                                self.updateAllLayersStyle(map);
                                self.updateControlBadge(map);
                                renderMenuContent();
                            });
                        }

                        menu.querySelectorAll('button[data-intensity]').forEach(b => {
                            b.addEventListener('click', (ev) => {
                                ev.stopPropagation();
                                self.setIntensity(b.getAttribute('data-intensity'), map);
                                renderMenuContent();
                            });
                        });

                        menu.querySelectorAll('input[name="pit_theme"]').forEach(r => {
                            r.addEventListener('change', (ev) => {
                                ev.stopPropagation();
                                self.setTheme(r.value, map);
                                renderMenuContent();
                            });
                        });
                    };

                    renderMenuContent();

                    L.DomEvent.disableClickPropagation(wrap);
                    L.DomEvent.disableScrollPropagation(wrap);

                    cfgBtn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                    });

                    document.addEventListener('click', (ev) => {
                        if (!wrap.contains(ev.target)) {
                            menu.style.display = 'none';
                        }
                    });

                    btn.addEventListener('click', async (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();

                        const currentlyActive = map._pitangueirasTalhoesVisible !== false &&
                                                self.activeLayers.has(map) &&
                                                map.hasLayer(self.activeLayers.get(map));
                        if (currentlyActive) {
                            // AO CLICAR DESATIVA: OCULTA APENAS OS SHAPES DOS TALHÕES (CANVAS)
                            // OS MARCADORES / CLUSTERS PERMANECEM NO MAPA
                            self.disableLayerForMap(map);
                            localStorage.setItem(CONFIG.storageKey, 'false');
                            self.updateControlBadge(map);
                        } else {
                            // AO CLICAR ATIVA: MOSTRA OS SHAPES DOS TALHÕES (CANVAS)
                            const badge = btn.querySelector('.talhoes-badge');
                            if (badge && !self.geojsonData) {
                                badge.innerText = 'Carregando...';
                                badge.style.background = '#0284c7';
                            }
                            await self.enableLayerForMap(map);
                            localStorage.setItem(CONFIG.storageKey, 'true');
                            self.updateControlBadge(map);
                        }
                    });

                    wrap.appendChild(btn);
                    wrap.appendChild(cfgBtn);
                    wrap.appendChild(menu);
                    return wrap;
                }
            });

            map.addControl(new TalhoesControl());
        },

        setTheme(themeName, map) {
            if (THEMES[themeName]) {
                this.currentTheme = themeName;
                localStorage.setItem(CONFIG.themeKey, themeName);
                this.updateAllLayersStyle(map);
            }
        },

        setIntensity(intensityName, map) {
            if (INTENSITIES[intensityName]) {
                this.currentIntensity = intensityName;
                localStorage.setItem(CONFIG.intensityKey, intensityName);
                this.updateAllLayersStyle(map);
            }
        },

        updateAllLayersStyle(targetMap) {
            const self = this;
            const apply = (layer, map) => {
                if (map && map.hasLayer(layer)) {
                    const zoom = map.getZoom ? map.getZoom() : 11;
                    const features = self.geojsonData && self.geojsonData.features ? self.geojsonData.features : [];

                    layer.eachLayer((subLayer) => {
                        const idx = subLayer._pitangueirasFeatureIndex;
                        const feat = features[idx] || (subLayer.feature || {});
                        const st = self.getFeatureStyle(feat, idx, map, zoom);
                        subLayer.setStyle(st);
                    });

                    // Força a renderização imediata do Canvas do Leaflet
                    if (self.activeRenderers.has(map)) {
                        const rend = self.activeRenderers.get(map);
                        if (rend && typeof rend._redraw === 'function') {
                            rend._redraw(true);
                        } else if (rend && typeof rend.requestRedraw === 'function') {
                            rend.requestRedraw();
                        }
                    }
                    if (typeof layer.redraw === 'function') {
                        layer.redraw();
                    }
                }
            };

            if (targetMap && this.activeLayers.has(targetMap)) {
                apply(this.activeLayers.get(targetMap), targetMap);
            } else {
                this.activeLayers.forEach((layer, map) => {
                    apply(layer, map);
                });
            }
        },

        /**
         * Permite que filtros de período externos (7D, 15D, 30D, Todos) atualizem
         * diretamente os talhões coloridos no mapa.
         */
        filterByRecords(targetMap, filteredRecords) {
            const records = Array.isArray(filteredRecords) ? filteredRecords : this.getDashboardRecords();
            const applyMap = (map) => {
                if (!map || !this.activeLayers.has(map)) return;
                const matchedMap = this.matchRecordsToShapes(records);
                this.auditedTalhoesByMap.set(map, matchedMap);
                this.lastRecordsCache.set(map, { hash: `custom_${records.length}_${Date.now()}`, count: records.length });

                // Redesenha os estilos dos talhões
                this.updateAllLayersStyle(map);
                this.updateControlBadge(map);
                if (typeof window.updateMapTalhoesLegend === 'function') {
                    window.updateMapTalhoesLegend();
                }
            };

            if (targetMap) {
                applyMap(targetMap);
            } else {
                this.activeLayers.forEach((layer, map) => applyMap(map));
            }
        },

        async enableLayerForMap(map) {
            if (!map) return;
            map._pitangueirasTalhoesVisible = true;
            const pane = map.getPane('agriculturalShapesPane');
            if (pane) pane.style.display = 'block';

            // Marcadores de dados de campo permanecem SEMPRE no mapa
            this.ensureDataMarkersVisible(map);

            if (this.activeLayers.has(map)) {
                const existing = this.activeLayers.get(map);
                if (!map.hasLayer(existing)) {
                    map.addLayer(existing);
                    this.syncWithDashboard(map);
                }
                const renderer = this.activeRenderers.get(map);
                if (renderer && renderer._container) {
                    renderer._container.style.display = '';
                }
                this.updateControlBadge(map);
                return;
            }

            const data = await this.loadShapesData();
            if (!data) return;

            const self = this;

            // Renderer dedicado Canvas de Alta Performance com buffer enxuto (padding 0.08)
            const canvasRenderer = L.canvas({
                pane: 'agriculturalShapesPane',
                padding: 0.08,
                tolerance: 3
            });
            this.activeRenderers.set(map, canvasRenderer);

            // Tooltip Único Compartilhado Sob Demanda (Zero permanent tooltips na memória)
            const sharedTooltip = L.tooltip({
                sticky: true,
                direction: 'top',
                className: 'pitangueiras-talhao-tooltip',
                opacity: 0.98
            });
            this.sharedTooltips.set(map, sharedTooltip);

            // Cruzamento inicial dos registros ativos
            this.buildIndexes(data);
            const initialRecords = this.getDashboardRecords();
            const matchedMap = this.matchRecordsToShapes(initialRecords);
            this.auditedTalhoesByMap.set(map, matchedMap);
            if (typeof window.updateMapTalhoesLegend === 'function') {
                window.updateMapTalhoesLegend();
            }

            let featIdxCounter = 0;

            const geoLayer = L.geoJSON(data, {
                pane: 'agriculturalShapesPane',
                renderer: canvasRenderer,
                style: function (feature) {
                    const fIdx = feature._pitangueirasIndex !== undefined ? feature._pitangueirasIndex : (feature.properties ? feature.properties._pitangueirasIndex : 0);
                    return self.getFeatureStyle(feature, fIdx, map, map.getZoom ? map.getZoom() : 11);
                },
                onEachFeature: function (feature, layer) {
                    const currentIndex = feature._pitangueirasIndex !== undefined ? feature._pitangueirasIndex : (feature.properties ? feature.properties._pitangueirasIndex : 0);
                    layer._pitangueirasFeatureIndex = currentIndex;
                    const props = feature.properties || {};

                    layer.on({
                        mouseover: function (e) {
                            const l = e.target;
                            const auditedMap = self.auditedTalhoesByMap.get(map);
                            const auditInfo = self.highlightAudited && auditedMap ? auditedMap.get(currentIndex) : null;
                            const isAudited = Boolean(auditInfo && auditInfo.count > 0);

                            // Borda escura destacada no hover (conforme solicitado pelo usuário)
                            l.setStyle({
                                color: '#0f172a',       // Borda escura nítida
                                weight: 3.2,
                                opacity: 1.0,
                                fillColor: '#ffffff',
                                fillOpacity: 0.32       // Levemente translúcido
                            });

                            // Hook de Tooltip Customizado Agronômico
                            if (typeof self.customTooltipFormatter === 'function') {
                                try {
                                    const customHtml = self.customTooltipFormatter(feature, l, map, auditInfo, isAudited);
                                    if (customHtml) {
                                        sharedTooltip.setContent(customHtml);
                                        l.bindTooltip(sharedTooltip).openTooltip(e.latlng);
                                        return;
                                    }
                                } catch (errTooltip) {
                                    console.warn('[MapShapes] Erro no customTooltipFormatter:', errTooltip);
                                }
                            }

                            const areaVal = Number(props.area || 0).toFixed(2);
                            const nomeFaz = props.nome_faz || ('Fazenda ' + (props.fazenda || ''));

                            let auditBadgeHtml = '';
                            let extraDetailsHtml = '';

                            if (isAudited) {
                                const sem = auditInfo.semaforo || { label: 'Com Coleta', color: '#10b981', icon: '🟢', badgeBg: '#ecfdf5', badgeText: '#047857' };
                                const profStr = auditInfo.avgProf ? `• Profundidade: <b>${auditInfo.avgProf.toFixed(1)} cm</b>` : '';
                                
                                auditBadgeHtml = `
                                    <span style="background: ${sem.badgeBg}; color: ${sem.badgeText}; border: 1px solid ${sem.color}60; font-size: 9.5px; font-weight: 800; padding: 1px 7px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 3px;">
                                        <span>${sem.icon}</span> <span>${sem.label}</span>
                                    </span>
                                `;

                                const lastRec = auditInfo.lastRecord || auditInfo.firstRecord || {};
                                const osVal = lastRec.os || lastRec.OS || '-';
                                const frenteVal = lastRec.frente || lastRec.Frente || '';
                                const dataVal = lastRec.data || lastRec.Data || lastRec.data_lancamento || lastRec['Data Lançamento'] || '';

                                extraDetailsHtml = `
                                    <div style="border-top: 1px dashed #cbd5e1; margin-top: 5px; padding-top: 4px; font-size: 10px; color: #334155;">
                                        <div style="display: flex; justify-content: space-between; gap: 8px;">
                                            <span>Amostras: <b>${auditInfo.count} coletas</b></span>
                                            <span style="color: ${sem.color}; font-weight: 800;">${profStr}</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; gap: 8px; margin-top: 2px;">
                                            <span>OS: <b>${osVal}</b></span>
                                            <span>${frenteVal ? 'Frente: <b>' + frenteVal.split('-')[0].trim() + '</b>' : ''}</span>
                                        </div>
                                        ${dataVal ? `<div style="margin-top: 1px; color: #64748b; font-size: 9.5px;">Última medição: <b>${dataVal}</b></div>` : ''}
                                        <div style="margin-top: 4px; padding-top: 3px; border-top: 1px solid #e2e8f0; color: #0284c7; font-size: 9px; font-weight: 700; text-align: center;">
                                            👆 Clique para abrir o Raio-X do Talhão
                                        </div>
                                    </div>
                                `;
                            } else {
                                auditBadgeHtml = `
                                    <span style="background: #f1f5f9; color: #64748b; font-size: 9.5px; font-weight: 600; padding: 1px 6px; border-radius: 9999px;">
                                        Sem Coleta
                                    </span>
                                `;
                            }

                            const fazCompleta = (props.fazenda ? props.fazenda + ' - ' : '') + nomeFaz;
                            const tooltipHtml = `
                                <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; min-width: 220px; padding: 9px 12px; background: #ffffff; color: #0f172a; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.25); border: 1px solid #cbd5e1;">
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0;">
                                        <div style="font-weight: 800; font-size: 12px; color: #0f172a; display: flex; align-items: center; gap: 5px;">
                                            <span>🌱</span>
                                            <span>Informações do Talhão</span>
                                        </div>
                                        ${auditBadgeHtml}
                                    </div>
                                    <div style="margin-bottom: 4px;">
                                        <span style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Fazenda</span>
                                        <div style="font-size: 11px; font-weight: 800; color: #0f172a; line-height: 1.2;">${fazCompleta}</div>
                                    </div>
                                    <div style="display: flex; gap: 12px; margin-bottom: 4px; margin-top: 5px;">
                                        <div>
                                            <span style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Zona</span>
                                            <div style="font-size: 11.5px; font-weight: 800; color: #0f172a;">${props.zona || 1}</div>
                                        </div>
                                        <div>
                                            <span style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Talhão</span>
                                            <div style="font-size: 11.5px; font-weight: 800; color: #0f172a;">${props.talhao || '-'}</div>
                                        </div>
                                        <div>
                                            <span style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Área Total</span>
                                            <div style="font-size: 11.5px; font-weight: 800; color: #0f172a;">${areaVal} ha</div>
                                        </div>
                                    </div>
                                    ${extraDetailsHtml}
                                </div>
                            `;

                            sharedTooltip.setContent(tooltipHtml);
                            l.bindTooltip(sharedTooltip).openTooltip(e.latlng);
                        },
                        mouseout: function (e) {
                            const l = e.target;
                            const st = self.getFeatureStyle(feature, currentIndex, map, map.getZoom ? map.getZoom() : 11);
                            l.setStyle(st);
                            if (l.getTooltip()) {
                                l.unbindTooltip();
                            }
                        },
                        click: function (e) {
                            const l = e.target;
                            l.setStyle({
                                color: '#0f172a',
                                weight: 3.4,
                                opacity: 1.0,
                                fillColor: '#ffffff',
                                fillOpacity: 0.38
                            });

                            // Hook de Clique Customizado Agronômico & Raio-X do Talhão
                            if (typeof window.subsolagemOpenTalhaoModal === 'function' && auditInfo && auditInfo.count > 0) {
                                window.subsolagemOpenTalhaoModal({
                                    feature: feature,
                                    auditInfo: auditInfo,
                                    layer: l
                                });
                            }

                            if (typeof self.customFeatureClick === 'function') {
                                try {
                                    const handled = self.customFeatureClick(feature, l, map, e);
                                    if (handled) return;
                                } catch (errClick) {
                                    console.warn('[MapShapes] Erro no customFeatureClick:', errClick);
                                }
                            }

                            const bounds = l.getBounds();
                            if (bounds && bounds.isValid()) {
                                map.fitBounds(bounds, {
                                    padding: [60, 60],
                                    maxZoom: 16
                                });
                            }
                        }
                    });
                }
            });

            // Ajusta o estilo dinâmico de traço ao finalizar o zoom
            let zoomTimeout = null;
            map.on('zoomend', () => {
                if (zoomTimeout) clearTimeout(zoomTimeout);
                zoomTimeout = setTimeout(() => {
                    if (map.hasLayer(geoLayer)) {
                        self.updateAllLayersStyle(map);
                    }
                }, 100);
            });

            this.activeLayers.set(map, geoLayer);
            map.addLayer(geoLayer);
            this.updateControlBadge(map);
        },

        disableLayerForMap(map) {
            if (!map) return;
            map._pitangueirasTalhoesVisible = false;

            // Oculta exclusivamente os shapes dos talhões agrícolas (canvas)
            if (this.activeLayers.has(map)) {
                const layer = this.activeLayers.get(map);
                if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            }
            const renderer = this.activeRenderers.get(map);
            if (renderer && renderer._container) {
                renderer._container.style.display = 'none';
            }
            const pane = map.getPane('agriculturalShapesPane');
            if (pane) {
                pane.style.display = 'none';
            }

            // Marcadores e clusters de dados NUNCA são removidos:
            this.ensureDataMarkersVisible(map);

            this.updateControlBadge(map);
        },

        reloadAll() {
            window[CONFIG.cacheKey] = null;
            this.geojsonData = null;
            this.manifest = null;
            this.shapesCodeIndex = null;
            this.spatialGrid = null;
            this.lastRecordsCache.clear();
            this.activeLayers.forEach((layer, map) => {
                if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            });
            this.activeLayers.clear();
            this.activeRenderers.clear();
            this.sharedTooltips.clear();
            this.observeMaps();
        },

        // API Pública para Customização e Inteligência Agronômica
        setCustomStyler(fn) {
            this.customFeatureStyler = typeof fn === 'function' ? fn : null;
            this.updateAllLayersStyle();
        },

        setCustomClickHandler(fn) {
            this.customFeatureClick = typeof fn === 'function' ? fn : null;
        },

        setCustomTooltipFormatter(fn) {
            this.customTooltipFormatter = typeof fn === 'function' ? fn : null;
        },

        reapplyStyles(targetMap) {
            this.updateAllLayersStyle(targetMap);
        }
    };

    window.PitangueirasMapShapes = MapShapes;
    MapShapes.init();

})();
