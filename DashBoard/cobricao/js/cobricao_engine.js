/**
 * cobricao_engine.js
 * Motor analítico de cálculo estatístico e operacional para
 * Plantio - 12 - Cobrição (Profundidade de Cobrição)
 * Usina Pitangueiras - Safra 2026
 */

(function (window) {
    'use strict';

    const CobricaoEngine = {
        /**
         * Normaliza registro bruto do MapFy para a estrutura analítica padrão
         */
        normalizeRecord: function (r) {
            if (!r) return null;
            const lat = parseFloat(String(r['Latitude'] || r.lat || '').replace(',', '.'));
            const lon = parseFloat(String(r['Longitude'] || r.lon || r.lng || '').replace(',', '.'));
            const dataStr = String(r['Data'] || r.data || '').trim();
            const dataDia = dataStr.includes(' ') ? dataStr.split(' ')[0] : dataStr;

            let dataIso = '';
            if (dataDia.includes('/')) {
                const parts = dataDia.split('/');
                if (parts.length === 3) dataIso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }

            const profOrig = String(r['Profundidade de Cobrição'] || r.profundidade_orig || r.profundidade || '').trim();
            const profNum = parseFloat(profOrig.replace(',', '.'));
            const isValidProf = !isNaN(profNum) && profNum > 0;

            let catAnalitica = 'Padrão (8cm)';
            if (isValidProf) {
                if (profNum < 8) catAnalitica = 'Rasa (< 8cm)';
                else if (profNum > 8) catAnalitica = 'Profunda (> 8cm)';
            }

            return {
                id: String(r['ID'] || r.id || ''),
                usuario: r['Usuário'] || r.usuario || '',
                data: dataStr,
                data_dia: dataDia,
                data_iso: dataIso,
                data_inicio: r['Data início'] || r.data_inicio || '',
                data_fim: r['Data Fim'] || r.data_fim || '',
                status: r['Status'] || r.status || 'Aberto',
                score: r['Score'] || r.score || '0,00',
                local: r['Local (Fazenda - Talhão)'] || r.local || '',
                os: String(r['OS'] || r.os || ''),
                frente: r['Frente'] || r.frente || '',
                responsavel: r['Responsável'] || r.responsavel || '',
                profundidade_orig: profOrig,
                profundidade_num: isValidProf ? profNum : null,
                is_valid_prof: isValidProf,
                is_outlier: isValidProf && (profNum < 4 || profNum > 12),
                categoria_analitica: catAnalitica,
                lat: isNaN(lat) ? null : lat,
                lon: isNaN(lon) ? null : lon,
                has_coords: !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0,
                _raw: r
            };
        },

        /**
         * Formata número para o padrão brasileiro (ex: 8,04 ou 2.020)
         */
        formatNumberBR: function (val, decimals = 2) {
            if (val === null || val === undefined || isNaN(val)) return 'N/D';
            return Number(val).toLocaleString('pt-BR', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        },

        /**
         * Mapeia cor oficial por profundidade
         */
        getDepthColor: function (val) {
            if (val === null || val === undefined || isNaN(val)) return '#94a3b8';
            const v = Math.round(Number(val));
            switch (v) {
                case 6: return '#3b82f6'; // Azul
                case 7: return '#06b6d4'; // Ciano
                case 8: return '#10b981'; // Esmeralda (mediana/moda)
                case 9: return '#8b5cf6'; // Roxo
                case 10: return '#f59e0b'; // Âmbar/Laranja
                default:
                    return v > 10 ? '#ef4444' : '#64748b'; // Vermelho para >10 (atípicos) ou cinza
            }
        },

        /**
         * Calcula percentil em uma série ordenada
         */
        percentile: function (arr, p) {
            if (!arr || arr.length === 0) return null;
            if (arr.length === 1) return arr[0];
            const index = (p / 100) * (arr.length - 1);
            const lower = Math.floor(index);
            const upper = Math.ceil(index);
            const weight = index - lower;
            if (lower === upper) return arr[lower];
            return arr[lower] * (1 - weight) + arr[upper] * weight;
        },

        /**
         * Calcula a mediana de um array numérico
         */
        median: function (arr) {
            if (!arr || arr.length === 0) return null;
            const sorted = [...arr].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            if (sorted.length % 2 !== 0) {
                return sorted[mid];
            }
            return (sorted[mid - 1] + sorted[mid]) / 2;
        },

        /**
         * Calcula o desvio-padrão amostral
         */
        standardDeviation: function (arr, meanVal) {
            if (!arr || arr.length < 2) return 0;
            const mean = meanVal !== undefined ? meanVal : arr.reduce((a, b) => a + b, 0) / arr.length;
            const sumSquareDiffs = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
            return Math.sqrt(sumSquareDiffs / (arr.length - 1));
        },

        /**
         * Calcula todas as métricas consolidadas dos KPIs e estatísticas
         */
        calculateMetrics: function (records, excludeOutliers = false) {
            const totalRecords = records.length;
            if (totalRecords === 0) {
                return {
                    totalRecords: 0,
                    uniqueIds: 0,
                    duplicateIdsCount: 0,
                    validProfCount: 0,
                    media: null,
                    mediana: null,
                    min: null,
                    max: null,
                    amplitude: null,
                    desvioPadrao: null,
                    q1: null,
                    q3: null,
                    iqr: null,
                    lowerFence: null,
                    upperFence: null,
                    outliersCount: 0,
                    outliersPerc: 0,
                    dataIssuesCount: 0,
                    pendentesCount: 0,
                    uniqueLocais: 0,
                    uniqueOS: 0,
                    uniqueFrentes: 0,
                    uniqueResponsaveis: 0,
                    georefCount: 0,
                    georefPerc: 0,
                    latestDate: 'N/D',
                    oldestDate: 'N/D'
                };
            }

            const idMap = new Map();
            let duplicateIdsCount = 0;
            records.forEach(r => {
                const count = (idMap.get(r.id) || 0) + 1;
                idMap.set(r.id, count);
                if (count > 1) duplicateIdsCount++;
            });

            let values = [];
            let outliersCount = 0;
            let dataIssuesCount = 0;
            let pendentesCount = 0;
            let georefCount = 0;

            const locaisSet = new Set();
            const osSet = new Set();
            const frentesSet = new Set();
            const respSet = new Set();

            records.forEach(r => {
                if (r.has_coords) georefCount++;
                if (r.local) locaisSet.add(r.local);
                if (r.os) osSet.add(r.os);
                if (r.frente) frentesSet.add(r.frente);
                if (r.responsavel) respSet.add(r.responsavel);

                if (r.status === 'Aberto') pendentesCount++;
                if (r.is_outlier) outliersCount++;

                if (!r.is_valid_prof || r.profundidade_num === null || isNaN(r.profundidade_num) || r.profundidade_num <= 0) {
                    dataIssuesCount++;
                }

                if (r.is_valid_prof && r.profundidade_num !== null && !isNaN(r.profundidade_num)) {
                    if (!excludeOutliers || !r.is_outlier) {
                        values.push(r.profundidade_num);
                    }
                }
            });

            const validProfCount = values.length;
            let media = null;
            let mediana = null;
            let min = null;
            let max = null;
            let amplitude = null;
            let desvioPadrao = null;
            let q1 = null;
            let q3 = null;
            let iqr = null;
            let lowerFence = null;
            let upperFence = null;

            if (validProfCount > 0) {
                values.sort((a, b) => a - b);
                const sum = values.reduce((acc, val) => acc + val, 0);
                media = sum / validProfCount;
                mediana = this.median(values);
                min = values[0];
                max = values[values.length - 1];
                amplitude = max - min;
                desvioPadrao = this.standardDeviation(values, media);

                q1 = this.percentile(values, 25);
                q3 = this.percentile(values, 75);
                iqr = q3 - q1;
                lowerFence = q1 - 1.5 * iqr;
                upperFence = q3 + 1.5 * iqr;
            }

            return {
                totalRecords,
                uniqueIds: idMap.size,
                duplicateIdsCount,
                validProfCount,
                media,
                mediana,
                min,
                max,
                amplitude,
                desvioPadrao,
                q1,
                q3,
                iqr,
                lowerFence,
                upperFence,
                outliersCount,
                outliersPerc: totalRecords > 0 ? (outliersCount / totalRecords) * 100 : 0,
                dataIssuesCount,
                pendentesCount,
                uniqueLocais: locaisSet.size,
                uniqueOS: osSet.size,
                uniqueFrentes: frentesSet.size,
                uniqueResponsaveis: respSet.size,
                georefCount,
                georefPerc: totalRecords > 0 ? (georefCount / totalRecords) * 100 : 0,
                latestDate: records[0]?.data || 'N/D',
                oldestDate: records[records.length - 1]?.data || 'N/D'
            };
        },

        /**
         * Distribuição de profundidades (frequência absoluta, relativa e acumulada)
         */
        calculateDepthDistribution: function (records) {
            const counts = {};
            let totalValid = 0;

            records.forEach(r => {
                if (r.profundidade_num !== null && !isNaN(r.profundidade_num)) {
                    const val = r.profundidade_orig || String(Math.round(r.profundidade_num));
                    counts[val] = (counts[val] || 0) + 1;
                    totalValid++;
                }
            });

            // Ordenar por valor numérico crescente
            const sortedKeys = Object.keys(counts).sort((a, b) => Number(a) - Number(b));

            let cumulative = 0;
            const items = sortedKeys.map(k => {
                const count = counts[k];
                cumulative += count;
                const perc = totalValid > 0 ? (count / totalValid) * 100 : 0;
                const cumPerc = totalValid > 0 ? (cumulative / totalValid) * 100 : 0;
                const numVal = Number(k);

                return {
                    depth: k,
                    depthNum: numVal,
                    count,
                    perc: Number(perc.toFixed(2)),
                    cumulative,
                    cumPerc: Number(cumPerc.toFixed(2)),
                    color: CobricaoEngine.getDepthColor(numVal)
                };
            });

            return {
                items,
                totalValid
            };
        },

        /**
         * Evolução temporal (Diária, Semanal, Mensal)
         */
        calculateTemporalEvolution: function (records, periodMode = 'diario') {
            const periodMap = new Map();

            records.forEach(r => {
                if (!r.data_iso) return;
                const [datePart] = r.data_iso.split(' ');
                if (!datePart) return;

                let key = datePart; // 'YYYY-MM-DD'
                let displayLabel = r.data_dia;

                if (periodMode === 'semanal') {
                    // Agrupar por semana ISO
                    const dt = new Date(datePart + 'T12:00:00Z');
                    const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
                    const dayNum = d.getUTCDay() || 7;
                    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
                    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
                    key = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
                    displayLabel = `Sem ${weekNo}/${d.getUTCFullYear()}`;
                } else if (periodMode === 'mensal') {
                    key = datePart.substring(0, 7); // 'YYYY-MM'
                    const [yyyy, mm] = key.split('-');
                    displayLabel = `${mm}/${yyyy}`;
                }

                if (!periodMap.has(key)) {
                    periodMap.set(key, {
                        key,
                        label: displayLabel,
                        values: [],
                        outliersCount: 0
                    });
                }

                const entry = periodMap.get(key);
                if (r.profundidade_num !== null && !isNaN(r.profundidade_num)) {
                    entry.values.push(r.profundidade_num);
                }
                if (r.is_outlier) entry.outliersCount++;
            });

            const timeline = Array.from(periodMap.values()).map(d => {
                d.values.sort((a, b) => a - b);
                const count = d.values.length;
                const sum = d.values.reduce((acc, v) => acc + v, 0);
                const media = count > 0 ? sum / count : null;
                const mediana = count > 0 ? CobricaoEngine.median(d.values) : null;
                const min = count > 0 ? d.values[0] : null;
                const max = count > 0 ? d.values[d.values.length - 1] : null;

                return {
                    key: d.key,
                    label: d.label,
                    count,
                    media: media !== null ? Number(media.toFixed(2)) : null,
                    mediana: mediana !== null ? Number(mediana.toFixed(2)) : null,
                    min: min !== null ? Number(min.toFixed(2)) : null,
                    max: max !== null ? Number(max.toFixed(2)) : null,
                    outliersCount: d.outliersCount
                };
            });

            // Ordenar por chave cronológica crescente
            timeline.sort((a, b) => a.key.localeCompare(b.key));
            return timeline;
        },

        /**
         * Comparativo agrupado por Frente
         */
        calculateFrentesBreakdown: function (records) {
            const frenteMap = new Map();

            records.forEach(r => {
                const f = r.frente || 'Não informada';
                if (!frenteMap.has(f)) {
                    frenteMap.set(f, {
                        frente: f,
                        values: [],
                        outliersCount: 0,
                        locais: new Set(),
                        osSet: new Set(),
                        respSet: new Set()
                    });
                }
                const entry = frenteMap.get(f);
                if (r.profundidade_num !== null && !isNaN(r.profundidade_num)) {
                    entry.values.push(r.profundidade_num);
                }
                if (r.is_outlier) entry.outliersCount++;
                if (r.local) entry.locais.add(r.local);
                if (r.os) entry.osSet.add(r.os);
                if (r.responsavel) entry.respSet.add(r.responsavel);
            });

            const result = Array.from(frenteMap.values()).map(item => {
                item.values.sort((a, b) => a - b);
                const count = item.values.length;
                const sum = item.values.reduce((a, b) => a + b, 0);
                const media = count > 0 ? sum / count : 0;
                const mediana = count > 0 ? CobricaoEngine.median(item.values) : 0;
                const min = count > 0 ? item.values[0] : 0;
                const max = count > 0 ? item.values[item.values.length - 1] : 0;
                const desvio = CobricaoEngine.standardDeviation(item.values, media);

                return {
                    frente: item.frente,
                    count,
                    media: Number(media.toFixed(2)),
                    mediana: Number(mediana.toFixed(2)),
                    min: Number(min.toFixed(2)),
                    max: Number(max.toFixed(2)),
                    amplitude: Number((max - min).toFixed(2)),
                    desvio: Number(desvio.toFixed(2)),
                    outliersCount: item.outliersCount,
                    totalLocais: item.locais.size,
                    totalOS: item.osSet.size,
                    totalResponsaveis: item.respSet.size
                };
            });

            return result.sort((a, b) => b.count - a.count);
        },

        /**
         * Comparativo agrupado por OS
         */
        calculateOSBreakdown: function (records, limit = 15) {
            const osMap = new Map();

            records.forEach(r => {
                const osKey = r.os || 'Sem OS';
                if (!osMap.has(osKey)) {
                    osMap.set(osKey, {
                        os: osKey,
                        frente: r.frente || 'N/D',
                        values: [],
                        outliersCount: 0,
                        locais: new Set()
                    });
                }
                const entry = osMap.get(osKey);
                if (r.profundidade_num !== null && !isNaN(r.profundidade_num)) {
                    entry.values.push(r.profundidade_num);
                }
                if (r.is_outlier) entry.outliersCount++;
                if (r.local) entry.locais.add(r.local);
            });

            const result = Array.from(osMap.values()).map(item => {
                item.values.sort((a, b) => a - b);
                const count = item.values.length;
                const sum = item.values.reduce((a, b) => a + b, 0);
                const media = count > 0 ? sum / count : 0;
                const mediana = count > 0 ? CobricaoEngine.median(item.values) : 0;
                const min = count > 0 ? item.values[0] : 0;
                const max = count > 0 ? item.values[item.values.length - 1] : 0;

                return {
                    os: item.os,
                    frente: item.frente,
                    count,
                    media: Number(media.toFixed(2)),
                    mediana: Number(mediana.toFixed(2)),
                    min: Number(min.toFixed(2)),
                    max: Number(max.toFixed(2)),
                    amplitude: Number((max - min).toFixed(2)),
                    outliersCount: item.outliersCount,
                    locaisCount: item.locais.size
                };
            });

            result.sort((a, b) => b.count - a.count);
            return limit ? result.slice(0, limit) : result;
        },

        /**
         * Comparativo agrupado por Talhão / Local
         */
        calculateLocaisBreakdown: function (records, limit = 15) {
            const localMap = new Map();

            records.forEach(r => {
                const loc = r.local || 'Sem Local';
                if (!localMap.has(loc)) {
                    localMap.set(loc, {
                        local: loc,
                        frente: r.frente || 'N/D',
                        values: [],
                        outliersCount: 0
                    });
                }
                const entry = localMap.get(loc);
                if (r.profundidade_num !== null && !isNaN(r.profundidade_num)) {
                    entry.values.push(r.profundidade_num);
                }
                if (r.is_outlier) entry.outliersCount++;
            });

            const result = Array.from(localMap.values()).map(item => {
                item.values.sort((a, b) => a - b);
                const count = item.values.length;
                const sum = item.values.reduce((a, b) => a + b, 0);
                const media = count > 0 ? sum / count : 0;
                const mediana = count > 0 ? CobricaoEngine.median(item.values) : 0;
                const min = count > 0 ? item.values[0] : 0;
                const max = count > 0 ? item.values[item.values.length - 1] : 0;

                return {
                    local: item.local,
                    frente: item.frente,
                    count,
                    media: Number(media.toFixed(2)),
                    mediana: Number(mediana.toFixed(2)),
                    min: Number(min.toFixed(2)),
                    max: Number(max.toFixed(2)),
                    amplitude: Number((max - min).toFixed(2)),
                    outliersCount: item.outliersCount
                };
            });

            result.sort((a, b) => b.count - a.count);
            return limit ? result.slice(0, limit) : result;
        },

        /**
         * Análise por Responsável
         */
        calculateResponsaveisBreakdown: function (records, limit = 15) {
            const respMap = new Map();

            records.forEach(r => {
                const resp = r.responsavel || 'Sem Responsável';
                if (!respMap.has(resp)) {
                    respMap.set(resp, {
                        responsavel: resp,
                        values: [],
                        outliersCount: 0,
                        frentes: new Set(),
                        abertoCount: 0
                    });
                }
                const entry = respMap.get(resp);
                if (r.profundidade_num !== null && !isNaN(r.profundidade_num)) {
                    entry.values.push(r.profundidade_num);
                }
                if (r.is_outlier) entry.outliersCount++;
                if (r.frente) entry.frentes.add(r.frente);
                if (r.status === 'Aberto') entry.abertoCount++;
            });

            const result = Array.from(respMap.values()).map(item => {
                item.values.sort((a, b) => a - b);
                const count = item.values.length;
                const sum = item.values.reduce((a, b) => a + b, 0);
                const media = count > 0 ? sum / count : 0;
                const mediana = count > 0 ? CobricaoEngine.median(item.values) : 0;

                return {
                    responsavel: item.responsavel,
                    frentes: Array.from(item.frentes).join(', '),
                    count,
                    media: Number(media.toFixed(2)),
                    mediana: Number(mediana.toFixed(2)),
                    min: count > 0 ? Number(item.values[0].toFixed(2)) : 0,
                    max: count > 0 ? Number(item.values[item.values.length - 1].toFixed(2)) : 0,
                    amplitude: count > 0 ? Number((item.values[item.values.length - 1] - item.values[0]).toFixed(2)) : 0,
                    outliersCount: item.outliersCount,
                    abertoCount: item.abertoCount
                };
            });

            result.sort((a, b) => b.count - a.count);
            return limit ? result.slice(0, limit) : result;
        },

        /**
         * Dados de dispersão individual para Scatter Plot
         */
        calculateScatterData: function (records) {
            return records
                .filter(r => r.profundidade_num !== null && !isNaN(r.profundidade_num))
                .map((r, idx) => ({
                    x: idx + 1,
                    y: r.profundidade_num,
                    id: r.id,
                    data: r.data,
                    frente: r.frente,
                    os: r.os,
                    local: r.local,
                    resp: r.responsavel,
                    color: r.cor_profundidade,
                    is_outlier: r.is_outlier,
                    diff_mediana: r.diff_mediana
                }));
        },

        /**
         * Ritmo horário de medições (07h às 18h)
         */
        calculateHourlyDistribution: function (records) {
            const hours = Array.from({ length: 12 }, (_, i) => i + 7);
            const hourData = {};
            hours.forEach(h => {
                hourData[h] = { hour: `${String(h).padStart(2, '0')}:00`, count: 0, values: [] };
            });

            records.forEach(r => {
                const h = r.hora !== undefined && r.hora !== null ? r.hora : 12;
                if (hourData[h]) {
                    hourData[h].count++;
                    if (r.profundidade_num !== null && !isNaN(r.profundidade_num)) {
                        hourData[h].values.push(r.profundidade_num);
                    }
                }
            });

            return hours.map(h => {
                const item = hourData[h];
                const sum = item.values.reduce((a, b) => a + b, 0);
                const media = item.values.length > 0 ? sum / item.values.length : 0;
                return {
                    hour: item.hour,
                    count: item.count,
                    media: Number(media.toFixed(2))
                };
            });
        },

        /**
         * Filtros reativos combináveis
         */
        filterRecords: function (records, filters = {}) {
            return records.filter(r => {
                if (filters.dateExact && r.data_dia !== filters.dateExact) {
                    return false;
                }
                if (filters.dateStart) {
                    const rDate = r.data_iso ? r.data_iso.split(' ')[0] : '';
                    if (rDate && rDate < filters.dateStart) return false;
                }
                if (filters.dateEnd) {
                    const rDate = r.data_iso ? r.data_iso.split(' ')[0] : '';
                    if (rDate && rDate > filters.dateEnd) return false;
                }
                if (filters.frente && filters.frente !== 'all' && r.frente !== filters.frente) {
                    return false;
                }
                if (filters.os && filters.os !== 'all' && String(r.os) !== String(filters.os)) {
                    return false;
                }
                if (filters.local && filters.local !== 'all' && r.local !== filters.local) {
                    return false;
                }
                if (filters.responsavel && filters.responsavel !== 'all' && r.responsavel !== filters.responsavel) {
                    return false;
                }
                if (filters.profundidade && filters.profundidade !== 'all') {
                    if (String(Math.round(r.profundidade_num)) !== String(filters.profundidade)) {
                        return false;
                    }
                }
                if (filters.profMin !== undefined && filters.profMin !== null && filters.profMin !== '') {
                    if (r.profundidade_num === null || isNaN(r.profundidade_num) || r.profundidade_num < Number(filters.profMin)) {
                        return false;
                    }
                }
                if (filters.profMax !== undefined && filters.profMax !== null && filters.profMax !== '') {
                    if (r.profundidade_num === null || isNaN(r.profundidade_num) || r.profundidade_num > Number(filters.profMax)) {
                        return false;
                    }
                }
                if (filters.status && filters.status !== 'all' && r.status !== filters.status) {
                    return false;
                }
                if (filters.usuario && filters.usuario !== 'all' && r.usuario !== filters.usuario) {
                    return false;
                }
                if (filters.onlyOutliers && !r.is_outlier) {
                    return false;
                }
                if (filters.onlyCoords && !r.has_coords) {
                    return false;
                }
                if (filters.searchQuery) {
                    const q = filters.searchQuery.toLowerCase().trim();
                    const match =
                        String(r.id).includes(q) ||
                        (r.data && r.data.toLowerCase().includes(q)) ||
                        (r.frente && r.frente.toLowerCase().includes(q)) ||
                        (r.os && String(r.os).toLowerCase().includes(q)) ||
                        (r.local && r.local.toLowerCase().includes(q)) ||
                        (r.responsavel && r.responsavel.toLowerCase().includes(q)) ||
                        (r.profundidade_orig && r.profundidade_orig.toLowerCase().includes(q)) ||
                        (r.categoria_analitica && r.categoria_analitica.toLowerCase().includes(q));
                    if (!match) return false;
                }
                return true;
            });
        }
    };

    window.CobricaoEngine = CobricaoEngine;
})(window);
