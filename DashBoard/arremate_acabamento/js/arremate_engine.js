/**
 * arremate_engine.js
 * Motor analítico de cálculo estatístico e operacional para
 * Plantio - 13 - Arremate e Acabamento
 * Usina Pitangueiras - Safra 2026
 */

(function (window) {
    'use strict';

    const ArremateEngine = {
        /**
         * Formata número para o padrão brasileiro
         */
        formatNumberBR: function (val, decimals = 1) {
            if (val === null || val === undefined || isNaN(val)) return 'N/D';
            return Number(val).toLocaleString('pt-BR', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        },

        /**
         * Calcula todas as métricas consolidadas dos KPIs e estatísticas
         */
        calculateMetrics: function (records) {
            const totalRecords = records.length;
            if (totalRecords === 0) {
                return {
                    totalRecords: 0,
                    uniqueIds: 0,
                    duplicateIdsCount: 0,
                    bomCount: 0,
                    outrasCount: 0,
                    semClassificacaoCount: 0,
                    conformidadePerc: 0,
                    scoreMedia: 0,
                    scorePercMedia: 0,
                    scoreAtivoCount: 0,
                    scoreDivergenteCount: 0,
                    uniqueLocais: 0,
                    uniqueOS: 0,
                    uniqueFrentes: 0,
                    uniqueResponsaveis: 0,
                    georefCount: 0,
                    georefPerc: 0,
                    pendentesCount: 0,
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

            let bomCount = 0;
            let outrasCount = 0;
            let semClassificacaoCount = 0;
            let scoreSum = 0;
            let scorePercSum = 0;
            let scoreAtivoCount = 0;
            let scoreDivergenteCount = 0;
            let georefCount = 0;
            let pendentesCount = 0;

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

                if (!r.arremate_orig) {
                    semClassificacaoCount++;
                } else if (r.is_bom) {
                    bomCount++;
                } else {
                    outrasCount++;
                }

                if (r.score_num !== null && !isNaN(r.score_num)) {
                    scoreSum += r.score_num;
                    if (r.score_num >= 10.0) scoreAtivoCount++;
                }

                if (r.score_perc_num !== null && !isNaN(r.score_perc_num)) {
                    scorePercSum += r.score_perc_num;
                }

                if (r.is_score_divergente) scoreDivergenteCount++;
            });

            const totalClassificados = bomCount + outrasCount;
            const conformidadePerc = totalClassificados > 0 ? (bomCount / totalClassificados) * 100 : 0;
            const scoreMedia = totalRecords > 0 ? scoreSum / totalRecords : 0;
            const scorePercMedia = totalRecords > 0 ? scorePercSum / totalRecords : 0;

            return {
                totalRecords,
                uniqueIds: idMap.size,
                duplicateIdsCount,
                bomCount,
                outrasCount,
                semClassificacaoCount,
                conformidadePerc: Number(conformidadePerc.toFixed(1)),
                scoreMedia: Number(scoreMedia.toFixed(2)),
                scorePercMedia: Number(scorePercMedia.toFixed(1)),
                scoreAtivoCount,
                scoreDivergenteCount,
                uniqueLocais: locaisSet.size,
                uniqueOS: osSet.size,
                uniqueFrentes: frentesSet.size,
                uniqueResponsaveis: respSet.size,
                georefCount,
                georefPerc: totalRecords > 0 ? (georefCount / totalRecords) * 100 : 0,
                pendentesCount,
                latestDate: records[0]?.data || 'N/D',
                oldestDate: records[records.length - 1]?.data || 'N/D'
            };
        },

        /**
         * Distribuição de classificações reais
         */
        calculateClassificacaoDistribution: function (records) {
            const counts = {};
            let total = 0;

            records.forEach(r => {
                const cat = r.arremate_norm || 'SEM CLASSIFICAÇÃO';
                counts[cat] = (counts[cat] || 0) + 1;
                total++;
            });

            const items = Object.entries(counts).map(([cat, count]) => {
                const perc = total > 0 ? (count / total) * 100 : 0;
                let color = '#10b981'; // Padrão BOM
                if (cat !== 'BOM') color = '#3b82f6';
                if (cat === 'SEM CLASSIFICAÇÃO') color = '#94a3b8';

                return {
                    categoria: cat,
                    count,
                    perc: Number(perc.toFixed(1)),
                    color
                };
            }).sort((a, b) => b.count - a.count);

            return { items, total };
        },

        /**
         * Distribuição por Fase do Score (Ativo a partir de Agosto vs Pré-ativação)
         */
        calculateScorePhaseDistribution: function (records) {
            let ativo = 0;
            let pre = 0;
            records.forEach(r => {
                if (r.score_num >= 10.0) ativo++;
                else pre++;
            });
            const total = records.length;
            return {
                ativoCount: ativo,
                ativoPerc: total > 0 ? Number(((ativo / total) * 100).toFixed(1)) : 0,
                preCount: pre,
                prePerc: total > 0 ? Number(((pre / total) * 100).toFixed(1)) : 0
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

                let key = datePart;
                let displayLabel = r.data_dia;

                if (periodMode === 'semanal') {
                    const dt = new Date(datePart + 'T12:00:00Z');
                    const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
                    const dayNum = d.getUTCDay() || 7;
                    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
                    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
                    key = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
                    displayLabel = `Sem ${weekNo}/${d.getUTCFullYear()}`;
                } else if (periodMode === 'mensal') {
                    key = datePart.substring(0, 7);
                    const [yyyy, mm] = key.split('-');
                    displayLabel = `${mm}/${yyyy}`;
                }

                if (!periodMap.has(key)) {
                    periodMap.set(key, {
                        key,
                        label: displayLabel,
                        total: 0,
                        bomCount: 0,
                        scoreSum: 0,
                        scorePercSum: 0
                    });
                }

                const entry = periodMap.get(key);
                entry.total++;
                if (r.is_bom) entry.bomCount++;
                if (r.score_num !== null) entry.scoreSum += r.score_num;
                if (r.score_perc_num !== null) entry.scorePercSum += r.score_perc_num;
            });

            const timeline = Array.from(periodMap.values()).map(d => {
                const confPerc = d.total > 0 ? (d.bomCount / d.total) * 100 : 0;
                const scoreMedia = d.total > 0 ? d.scoreSum / d.total : 0;
                const scorePercMedia = d.total > 0 ? d.scorePercSum / d.total : 0;

                return {
                    key: d.key,
                    label: d.label,
                    count: d.total,
                    bomCount: d.bomCount,
                    conformidadePerc: Number(confPerc.toFixed(1)),
                    scoreMedia: Number(scoreMedia.toFixed(2)),
                    scorePercMedia: Number(scorePercMedia.toFixed(1))
                };
            });

            timeline.sort((a, b) => a.key.localeCompare(b.key));
            return timeline;
        },

        /**
         * Desempenho por Frente
         */
        calculateFrentesBreakdown: function (records) {
            const frenteMap = new Map();

            records.forEach(r => {
                const f = r.frente || 'Não informada';
                if (!frenteMap.has(f)) {
                    frenteMap.set(f, {
                        frente: f,
                        total: 0,
                        bomCount: 0,
                        scoreSum: 0,
                        locais: new Set(),
                        osSet: new Set(),
                        respSet: new Set()
                    });
                }
                const entry = frenteMap.get(f);
                entry.total++;
                if (r.is_bom) entry.bomCount++;
                if (r.score_num !== null) entry.scoreSum += r.score_num;
                if (r.local) entry.locais.add(r.local);
                if (r.os) entry.osSet.add(r.os);
                if (r.responsavel) entry.respSet.add(r.responsavel);
            });

            const result = Array.from(frenteMap.values()).map(item => {
                const confPerc = item.total > 0 ? (item.bomCount / item.total) * 100 : 0;
                const scoreMedia = item.total > 0 ? item.scoreSum / item.total : 0;

                return {
                    frente: item.frente,
                    count: item.total,
                    bomCount: item.bomCount,
                    outrasCount: item.total - item.bomCount,
                    conformidadePerc: Number(confPerc.toFixed(1)),
                    scoreMedia: Number(scoreMedia.toFixed(2)),
                    totalLocais: item.locais.size,
                    totalOS: item.osSet.size,
                    totalResponsaveis: item.respSet.size
                };
            });

            return result.sort((a, b) => b.count - a.count);
        },

        /**
         * Comparativo por OS
         */
        calculateOSBreakdown: function (records, limit = 15) {
            const osMap = new Map();

            records.forEach(r => {
                const osKey = r.os || 'Sem OS';
                if (!osMap.has(osKey)) {
                    osMap.set(osKey, {
                        os: osKey,
                        frente: r.frente || 'N/D',
                        total: 0,
                        bomCount: 0,
                        scoreSum: 0,
                        locais: new Set()
                    });
                }
                const entry = osMap.get(osKey);
                entry.total++;
                if (r.is_bom) entry.bomCount++;
                if (r.score_num !== null) entry.scoreSum += r.score_num;
                if (r.local) entry.locais.add(r.local);
            });

            const result = Array.from(osMap.values()).map(item => {
                const confPerc = item.total > 0 ? (item.bomCount / item.total) * 100 : 0;
                const scoreMedia = item.total > 0 ? item.scoreSum / item.total : 0;

                return {
                    os: item.os,
                    frente: item.frente,
                    count: item.total,
                    bomCount: item.bomCount,
                    conformidadePerc: Number(confPerc.toFixed(1)),
                    scoreMedia: Number(scoreMedia.toFixed(2)),
                    locaisCount: item.locais.size
                };
            });

            result.sort((a, b) => b.count - a.count);
            return limit ? result.slice(0, limit) : result;
        },

        /**
         * Comparativo por Talhão / Local
         */
        calculateLocaisBreakdown: function (records, limit = 15) {
            const localMap = new Map();

            records.forEach(r => {
                const loc = r.local || 'Sem Local';
                if (!localMap.has(loc)) {
                    localMap.set(loc, {
                        local: loc,
                        frente: r.frente || 'N/D',
                        total: 0,
                        bomCount: 0,
                        scoreSum: 0,
                        latestDate: r.data
                    });
                }
                const entry = localMap.get(loc);
                entry.total++;
                if (r.is_bom) entry.bomCount++;
                if (r.score_num !== null) entry.scoreSum += r.score_num;
            });

            const result = Array.from(localMap.values()).map(item => {
                const confPerc = item.total > 0 ? (item.bomCount / item.total) * 100 : 0;
                const scoreMedia = item.total > 0 ? item.scoreSum / item.total : 0;

                return {
                    local: item.local,
                    frente: item.frente,
                    count: item.total,
                    bomCount: item.bomCount,
                    conformidadePerc: Number(confPerc.toFixed(1)),
                    scoreMedia: Number(scoreMedia.toFixed(2)),
                    latestDate: item.latestDate
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
                        total: 0,
                        bomCount: 0,
                        scoreSum: 0,
                        frentes: new Set()
                    });
                }
                const entry = respMap.get(resp);
                entry.total++;
                if (r.is_bom) entry.bomCount++;
                if (r.score_num !== null) entry.scoreSum += r.score_num;
                if (r.frente) entry.frentes.add(r.frente);
            });

            const result = Array.from(respMap.values()).map(item => {
                const confPerc = item.total > 0 ? (item.bomCount / item.total) * 100 : 0;
                const scoreMedia = item.total > 0 ? item.scoreSum / item.total : 0;

                return {
                    responsavel: item.responsavel,
                    frentes: Array.from(item.frentes).join(', '),
                    count: item.total,
                    bomCount: item.bomCount,
                    conformidadePerc: Number(confPerc.toFixed(1)),
                    scoreMedia: Number(scoreMedia.toFixed(2))
                };
            });

            result.sort((a, b) => b.count - a.count);
            return limit ? result.slice(0, limit) : result;
        },

        /**
         * Ritmo horário de avaliações (07h às 18h)
         */
        calculateHourlyDistribution: function (records) {
            const hours = Array.from({ length: 12 }, (_, i) => i + 7);
            const hourData = {};
            hours.forEach(h => {
                hourData[h] = { hour: `${String(h).padStart(2, '0')}:00`, count: 0, bomCount: 0 };
            });

            records.forEach(r => {
                const h = r.hora !== undefined && r.hora !== null ? r.hora : 12;
                if (hourData[h]) {
                    hourData[h].count++;
                    if (r.is_bom) hourData[h].bomCount++;
                }
            });

            return hours.map(h => {
                const item = hourData[h];
                const perc = item.count > 0 ? (item.bomCount / item.count) * 100 : 0;
                return {
                    hour: item.hour,
                    count: item.count,
                    bomCount: item.bomCount,
                    conformidadePerc: Number(perc.toFixed(1))
                };
            });
        },

        /**
         * Aplicação de filtros combináveis
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
                if (filters.classificacao && filters.classificacao !== 'all' && r.arremate_norm !== filters.classificacao) {
                    return false;
                }
                if (filters.faseScore === 'ativo' && r.score_num < 10.0) {
                    return false;
                }
                if (filters.faseScore === 'pre' && r.score_num >= 10.0) {
                    return false;
                }
                if (filters.status && filters.status !== 'all' && r.status !== filters.status) {
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
                        (r.arremate_orig && r.arremate_orig.toLowerCase().includes(q)) ||
                        (r.score_desc && r.score_desc.toLowerCase().includes(q));
                    if (!match) return false;
                }
                return true;
            });
        }
    };

    window.ArremateEngine = ArremateEngine;
})(window);
