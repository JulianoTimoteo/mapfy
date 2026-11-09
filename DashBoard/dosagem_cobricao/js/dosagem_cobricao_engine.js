/**
 * dosagem_cobricao_engine.js
 * Motor analítico de cálculo estatístico e operacional para
 * Plantio - 11 - Dosagem de Produto - Cobrição
 * Usina Pitangueiras - Safra 2026
 */

(function (window) {
    'use strict';

    const DosagemCobricaoEngine = {
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

            const dosagemOrig = String(r['Dosagem de Produto - Cobrição'] || r.dosagem_orig || r.dosagem || '').trim();
            const dosagemNum = parseFloat(dosagemOrig.replace(',', '.'));
            const isValidDos = !isNaN(dosagemNum) && dosagemNum > 0;

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
                dosagem_orig: dosagemOrig,
                dosagem_num: isValidDos ? dosagemNum : null,
                is_valid_dos: isValidDos,
                is_outlier: isValidDos && (dosagemNum < 0.975 || dosagemNum > 1.175),
                lat: isNaN(lat) ? null : lat,
                lon: isNaN(lon) ? null : lon,
                has_coords: !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0,
                _raw: r
            };
        },

        /**
         * Formata número para o padrão brasileiro (ex: 1,10 ou 1.234)
         */
        formatNumberBR: function (val, decimals = 2) {
            if (val === null || val === undefined || isNaN(val)) return 'N/D';
            return Number(val).toLocaleString('pt-BR', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
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
                    validDosagemCount: 0,
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

            // Duplicidade de IDs
            const idMap = new Map();
            let duplicateIdsCount = 0;
            records.forEach(r => {
                const count = (idMap.get(r.id) || 0) + 1;
                idMap.set(r.id, count);
                if (count > 1) duplicateIdsCount++;
            });

            // Extrair valores válidos para análise estatística
            let values = [];
            let outliersCount = 0;
            let dataIssuesCount = 0;
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

                if (r.is_outlier) outliersCount++;

                // Problemas de integridade de dados (ausente, não numérico, negativo)
                if (!r.is_valid_dos || r.dosagem_num === null || isNaN(r.dosagem_num) || r.dosagem_num < 0) {
                    dataIssuesCount++;
                }

                if (r.is_valid_dos && r.dosagem_num !== null && !isNaN(r.dosagem_num)) {
                    if (!excludeOutliers || !r.is_outlier) {
                        values.push(r.dosagem_num);
                    }
                }
            });

            const validDosagemCount = values.length;
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

            if (validDosagemCount > 0) {
                values.sort((a, b) => a - b);
                const sum = values.reduce((acc, val) => acc + val, 0);
                media = sum / validDosagemCount;
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
                validDosagemCount,
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
         * Frequência por faixas de dosagem para Histograma e Frequência Exata
         */
        calculateDistribution: function (records) {
            const bins = [
                { label: '< 0,90 (Extremos Baixos)', min: -Infinity, max: 0.8999, count: 0, color: '#ef4444' },
                { label: '0,90 - 0,99 (Abaixo Padrão)', min: 0.90, max: 0.9999, count: 0, color: '#f59e0b' },
                { label: '1,00 - 1,04 (Faixa Operacional)', min: 1.00, max: 1.0499, count: 0, color: '#3b82f6' },
                { label: '1,05 - 1,09 (Faixa Operacional)', min: 1.05, max: 1.0999, count: 0, color: '#10b981' },
                { label: '1,10 - 1,14 (Faixa Operacional)', min: 1.10, max: 1.1499, count: 0, color: '#059669' },
                { label: '1,15 - 1,19 (Faixa Operacional)', min: 1.15, max: 1.1999, count: 0, color: '#6366f1' },
                { label: '≥ 1,20 (Extremos Altos)', min: 1.20, max: Infinity, count: 0, color: '#dc2626' }
            ];

            const exactCounts = {};

            records.forEach(r => {
                if (r.dosagem_num !== null && !isNaN(r.dosagem_num)) {
                    const val = r.dosagem_num;
                    for (const b of bins) {
                        if (val >= b.min && val <= b.max) {
                            b.count++;
                            break;
                        }
                    }
                    const strVal = r.dosagem_orig || val.toFixed(2);
                    exactCounts[strVal] = (exactCounts[strVal] || 0) + 1;
                }
            });

            // Ordenar contagens exatas decrescente
            const sortedExact = Object.entries(exactCounts)
                .map(([val, count]) => ({ val, count }))
                .sort((a, b) => b.count - a.count);

            return {
                bins,
                sortedExact
            };
        },

        /**
         * Série temporal diária (evolução da média, mediana e contagem)
         */
        calculateTemporalEvolution: function (records) {
            const dayMap = new Map();

            records.forEach(r => {
                const day = r.data_dia || 'Sem Data';
                if (!dayMap.has(day)) {
                    dayMap.set(day, {
                        date: day,
                        dateIso: r.data_iso ? r.data_iso.split(' ')[0] : '9999-99-99',
                        values: [],
                        outliersCount: 0
                    });
                }
                const entry = dayMap.get(day);
                if (r.dosagem_num !== null && !isNaN(r.dosagem_num)) {
                    entry.values.push(r.dosagem_num);
                }
                if (r.is_outlier) entry.outliersCount++;
            });

            const timeline = Array.from(dayMap.values()).map(d => {
                d.values.sort((a, b) => a - b);
                const count = d.values.length;
                const sum = d.values.reduce((acc, v) => acc + v, 0);
                const media = count > 0 ? sum / count : null;
                const mediana = count > 0 ? this.median(d.values) : null;
                const min = count > 0 ? d.values[0] : null;
                const max = count > 0 ? d.values[d.values.length - 1] : null;

                return {
                    date: d.date,
                    dateIso: d.dateIso,
                    count,
                    media: media !== null ? Number(media.toFixed(3)) : null,
                    mediana: mediana !== null ? Number(mediana.toFixed(3)) : null,
                    min: min !== null ? Number(min.toFixed(3)) : null,
                    max: max !== null ? Number(max.toFixed(3)) : null,
                    outliersCount: d.outliersCount
                };
            });

            // Ordenar por data cronológica crescente para os gráficos
            timeline.sort((a, b) => a.dateIso.localeCompare(b.dateIso));

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
                        osSet: new Set()
                    });
                }
                const entry = frenteMap.get(f);
                if (r.dosagem_num !== null && !isNaN(r.dosagem_num)) {
                    entry.values.push(r.dosagem_num);
                }
                if (r.is_outlier) entry.outliersCount++;
                if (r.local) entry.locais.add(r.local);
                if (r.os) entry.osSet.add(r.os);
            });

            const result = Array.from(frenteMap.values()).map(item => {
                item.values.sort((a, b) => a - b);
                const count = item.values.length;
                const sum = item.values.reduce((a, b) => a + b, 0);
                const media = count > 0 ? sum / count : 0;
                const mediana = count > 0 ? this.median(item.values) : 0;
                const min = count > 0 ? item.values[0] : 0;
                const max = count > 0 ? item.values[item.values.length - 1] : 0;
                const desvio = this.standardDeviation(item.values, media);

                return {
                    frente: item.frente,
                    count,
                    media: Number(media.toFixed(3)),
                    mediana: Number(mediana.toFixed(3)),
                    min: Number(min.toFixed(3)),
                    max: Number(max.toFixed(3)),
                    amplitude: Number((max - min).toFixed(3)),
                    desvio: Number(desvio.toFixed(3)),
                    outliersCount: item.outliersCount,
                    totalLocais: item.locais.size,
                    totalOS: item.osSet.size
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
                if (r.dosagem_num !== null && !isNaN(r.dosagem_num)) {
                    entry.values.push(r.dosagem_num);
                }
                if (r.is_outlier) entry.outliersCount++;
                if (r.local) entry.locais.add(r.local);
            });

            const result = Array.from(osMap.values()).map(item => {
                item.values.sort((a, b) => a - b);
                const count = item.values.length;
                const sum = item.values.reduce((a, b) => a + b, 0);
                const media = count > 0 ? sum / count : 0;
                const mediana = count > 0 ? this.median(item.values) : 0;
                const min = count > 0 ? item.values[0] : 0;
                const max = count > 0 ? item.values[item.values.length - 1] : 0;

                return {
                    os: item.os,
                    frente: item.frente,
                    count,
                    media: Number(media.toFixed(3)),
                    mediana: Number(mediana.toFixed(3)),
                    min: Number(min.toFixed(3)),
                    max: Number(max.toFixed(3)),
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
                if (r.dosagem_num !== null && !isNaN(r.dosagem_num)) {
                    entry.values.push(r.dosagem_num);
                }
                if (r.is_outlier) entry.outliersCount++;
            });

            const result = Array.from(localMap.values()).map(item => {
                item.values.sort((a, b) => a - b);
                const count = item.values.length;
                const sum = item.values.reduce((a, b) => a + b, 0);
                const media = count > 0 ? sum / count : 0;
                const mediana = count > 0 ? this.median(item.values) : 0;

                return {
                    local: item.local,
                    frente: item.frente,
                    count,
                    media: Number(media.toFixed(3)),
                    mediana: Number(mediana.toFixed(3)),
                    min: count > 0 ? Number(item.values[0].toFixed(3)) : 0,
                    max: count > 0 ? Number(item.values[item.values.length - 1].toFixed(3)) : 0,
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
                        frentes: new Set()
                    });
                }
                const entry = respMap.get(resp);
                if (r.dosagem_num !== null && !isNaN(r.dosagem_num)) {
                    entry.values.push(r.dosagem_num);
                }
                if (r.is_outlier) entry.outliersCount++;
                if (r.frente) entry.frentes.add(r.frente);
            });

            const result = Array.from(respMap.values()).map(item => {
                item.values.sort((a, b) => a - b);
                const count = item.values.length;
                const sum = item.values.reduce((a, b) => a + b, 0);
                const media = count > 0 ? sum / count : 0;
                const mediana = count > 0 ? this.median(item.values) : 0;

                return {
                    responsavel: item.responsavel,
                    frentes: Array.from(item.frentes).join(', '),
                    count,
                    media: Number(media.toFixed(3)),
                    mediana: Number(mediana.toFixed(3)),
                    min: count > 0 ? Number(item.values[0].toFixed(3)) : 0,
                    max: count > 0 ? Number(item.values[item.values.length - 1].toFixed(3)) : 0,
                    outliersCount: item.outliersCount
                };
            });

            result.sort((a, b) => b.count - a.count);
            return limit ? result.slice(0, limit) : result;
        },

        /**
         * Ritmo horário de inspeções (07h às 18h)
         */
        calculateHourlyDistribution: function (records) {
            const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7 a 18
            const hourData = {};
            hours.forEach(h => {
                hourData[h] = { hour: `${String(h).padStart(2, '0')}:00`, count: 0, values: [] };
            });

            records.forEach(r => {
                const h = r.hora !== undefined && r.hora !== null ? r.hora : 12;
                if (hourData[h]) {
                    hourData[h].count++;
                    if (r.dosagem_num !== null && !isNaN(r.dosagem_num)) {
                        hourData[h].values.push(r.dosagem_num);
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
                    media: Number(media.toFixed(3))
                };
            });
        },

        /**
         * Dados para gráfico de dispersão (Scatter Plot)
         */
        calculateScatterData: function (records) {
            return records
                .filter(r => r.dosagem_num !== null && !isNaN(r.dosagem_num))
                .map((r, idx) => ({
                    x: idx + 1,
                    y: r.dosagem_num,
                    id: r.id,
                    data: r.data,
                    frente: r.frente,
                    os: r.os,
                    local: r.local,
                    resp: r.responsavel,
                    is_outlier: r.is_outlier,
                    diff_mediana: r.diff_mediana
                }));
        },

        /**
         * Aplicação combinada de filtros reativos
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
                if (filters.usuario && filters.usuario !== 'all' && r.usuario !== filters.usuario) {
                    return false;
                }
                if (filters.status && filters.status !== 'all' && r.status !== filters.status) {
                    return false;
                }
                if (filters.dosagemMin !== undefined && filters.dosagemMin !== null && filters.dosagemMin !== '') {
                    if (r.dosagem_num === null || isNaN(r.dosagem_num) || r.dosagem_num < Number(filters.dosagemMin)) {
                        return false;
                    }
                }
                if (filters.dosagemMax !== undefined && filters.dosagemMax !== null && filters.dosagemMax !== '') {
                    if (r.dosagem_num === null || isNaN(r.dosagem_num) || r.dosagem_num > Number(filters.dosagemMax)) {
                        return false;
                    }
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
                        (r.dosagem_orig && r.dosagem_orig.toLowerCase().includes(q)) ||
                        (r.categoria_analitica && r.categoria_analitica.toLowerCase().includes(q));
                    if (!match) return false;
                }
                return true;
            });
        }
    };

    window.DosagemCobricaoEngine = DosagemCobricaoEngine;
})(window);
