/**
 * qualidade_muda_engine.js
 * ========================
 * Motor Analítico e Estatístico para Qualidade da Muda no Plantio
 * Usina Pitangueiras • Safra 2026
 */

(function (window) {
    'use strict';

    const QualidadeMudaEngine = {};

    /**
     * Normaliza registro bruto do MapFy para a estrutura analítica padrão
     */
    QualidadeMudaEngine.normalizeRecord = function (r) {
        if (!r) return null;
        const lat = parseFloat(String(r['Latitude'] || r.lat || '').replace(',', '.'));
        const lon = parseFloat(String(r['Longitude'] || r.lon || r.lng || '').replace(',', '.'));
        const scoreNum = parseFloat(String(r['Score'] || r.score || '').replace(',', '.')) || 0;
        const scorePercNum = parseFloat(String(r['Score perc.'] || r.score_perc || '').replace(',', '.')) || 0;
        const dataStr = String(r['Data'] || r.data || '').trim();
        const dataDia = dataStr.includes(' ') ? dataStr.split(' ')[0] : dataStr;

        let dataIso = '';
        if (dataDia.includes('/')) {
            const parts = dataDia.split('/');
            if (parts.length === 3) dataIso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }

        const qualMudaOrig = String(r['Qualidade da Muda'] || r.qualidade_muda || 'BOM').trim();
        const qualMudaNorm = qualMudaOrig.toUpperCase();
        const isBom = qualMudaNorm === 'BOM';
        const isRuim = qualMudaNorm === 'RUIM';
        const obs = String(r['Observações '] || r['Observações'] || r.observacoes || '').trim();
        const obsLower = obs.toLowerCase();
        const hasBroca = obsLower.includes('broca');

        let brocaQtd = null;
        let brocaTipo = null;
        if (hasBroca) {
            brocaTipo = obsLower.includes('plano') ? 'Plano de Ação (Broca)' : 'Broca Identificada';
            const numMatch = obs.match(/\b(\d+)\b/);
            if (numMatch) brocaQtd = parseInt(numMatch[1], 10);
        }

        const isDivergenteScore = (isBom && scorePercNum === 0) || (isRuim && scorePercNum === 100);
        const hasCoords = !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;

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
            score_num: scoreNum,
            score_perc: scorePercNum,
            score_desc: r['Score desc.'] || (scorePercNum >= 100 ? 'Bom' : 'Baixo'),
            local: r['Local (Fazenda - Talhão)'] || r.local || '',
            os: String(r['OS'] || r.os || ''),
            frente: r['Frente'] || r.frente || '',
            responsavel: r['Responsável'] || r.responsavel || '',
            qualidade_muda: qualMudaNorm,
            qualidade_muda_orig: qualMudaOrig,
            is_bom: isBom,
            is_ruim: isRuim,
            observacoes: obs,
            has_broca: hasBroca,
            broca_qtd: brocaQtd,
            broca_tipo: brocaTipo,
            is_divergente_score: isDivergenteScore,
            duracao_min: 1,
            lat: hasCoords ? lat : 0,
            lon: hasCoords ? lon : 0,
            lng: hasCoords ? lon : 0,
            has_coords: hasCoords,
            has_valid_coords: hasCoords,
            _raw: r
        };
    };


    /**
     * Calcula métricas executivas globais para o conjunto filtrado
     */
    QualidadeMudaEngine.calculateMetrics = function (records) {
        if (!records || records.length === 0) {
            return {
                total: 0,
                bomCount: 0,
                percBom: 0.0,
                ruimCount: 0,
                percRuim: 0.0,
                scoreMedioPerc: 0.0,
                score100Count: 0,
                score0Count: 0,
                brocaTotal: 0,
                percBroca: 0.0,
                brocaComQtd: 0,
                brocaSomaInformada: 0,
                brocaMediaPorInspecao: 0.0,
                brocaPlanoAcao: 0,
                brocaBomCount: 0,
                brocaRuimCount: 0,
                divergenciasScore: 0,
                frentesCount: 0,
                osCount: 0,
                locaisCount: 0,
                georefCount: 0,
                percGeoref: 0.0,
                duracaoMediaMin: 0.0,
                duracaoMedianaMin: 0.0,
                statusCount: { aberto: 0, fechado: 0, validado: 0 }
            };
        }

        const total = records.length;
        let bomCount = 0;
        let ruimCount = 0;
        let sumScorePerc = 0;
        let score100Count = 0;
        let score0Count = 0;
        let brocaTotal = 0;
        let brocaComQtd = 0;
        let brocaSomaInformada = 0;
        let brocaPlanoAcao = 0;
        let brocaBomCount = 0;
        let brocaRuimCount = 0;
        let divergenciasScore = 0;
        let georefCount = 0;
        let sumDuracao = 0;
        const duracoes = [];

        const frentesSet = new Set();
        const osSet = new Set();
        const locaisSet = new Set();
        const statusMap = { aberto: 0, fechado: 0, validado: 0 };

        for (let i = 0; i < total; i++) {
            const r = records[i];

            // Qualidade da Muda
            if (r.qualidade_muda === 'BOM') {
                bomCount++;
            } else if (r.qualidade_muda === 'RUIM') {
                ruimCount++;
            }

            // Score de Origem
            sumScorePerc += (r.score_perc || 0);
            if (r.score_perc >= 100) {
                score100Count++;
            } else {
                score0Count++;
            }

            // Brocas
            if (r.has_broca) {
                brocaTotal++;
                if (r.qualidade_muda === 'BOM') brocaBomCount++;
                if (r.qualidade_muda === 'RUIM') brocaRuimCount++;

                if (r.broca_qtd !== null && r.broca_qtd !== undefined) {
                    brocaComQtd++;
                    brocaSomaInformada += r.broca_qtd;
                }
                if (r.broca_tipo === 'Plano de Ação (Broca)') {
                    brocaPlanoAcao++;
                }
            }

            // Divergência de Score (BOM com 0% ou RUIM com 100%)
            if (r.is_divergente_score) {
                divergenciasScore++;
            }

            // Georreferenciamento
            if (r.lat !== 0 && r.lon !== 0) {
                georefCount++;
            }

            // Dimensões operacionais
            if (r.frente) frentesSet.add(r.frente);
            if (r.os) osSet.add(r.os);
            if (r.local) locaisSet.add(r.local);

            // Status
            const st = (r.status || 'aberto').toLowerCase();
            if (statusMap[st] !== undefined) {
                statusMap[st]++;
            } else {
                statusMap.aberto++;
            }

            // Duração
            const d = r.duracao_min || 0;
            sumDuracao += d;
            duracoes.push(d);
        }

        duracoes.sort((a, b) => a - b);
        const mid = Math.floor(duracoes.length / 2);
        const duracaoMedianaMin = duracoes.length % 2 === 0
            ? (duracoes[mid - 1] + duracoes[mid]) / 2
            : duracoes[mid];

        const percBom = (bomCount / total) * 100;
        const percRuim = (ruimCount / total) * 100;
        const percBroca = (brocaTotal / total) * 100;
        const percGeoref = (georefCount / total) * 100;
        const scoreMedioPerc = sumScorePerc / total;
        const brocaMediaPorInspecao = brocaComQtd > 0 ? (brocaSomaInformada / brocaComQtd) : 0.0;
        const duracaoMediaMin = sumDuracao / total;

        return {
            total,
            bomCount,
            percBom,
            ruimCount,
            percRuim,
            scoreMedioPerc,
            score100Count,
            score0Count,
            brocaTotal,
            percBroca,
            brocaComQtd,
            brocaSomaInformada,
            brocaMediaPorInspecao,
            brocaPlanoAcao,
            brocaBomCount,
            brocaRuimCount,
            divergenciasScore,
            frentesCount: frentesSet.size,
            osCount: osSet.size,
            locaisCount: locaisSet.size,
            georefCount,
            percGeoref,
            duracaoMediaMin,
            duracaoMedianaMin,
            statusCount: statusMap
        };
    };

    /**
     * Evolução temporal diária com separação BOM e RUIM e percentuais
     */
    QualidadeMudaEngine.calculateTemporalEvolution = function (records) {
        if (!records || records.length === 0) {
            return { dates: [], total: [], bom: [], ruim: [], percBom: [], brocas: [] };
        }

        const map = new Map();
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const d = r.data_dia || 'Sem Data';
            if (!map.has(d)) {
                map.set(d, { date: d, iso: r.data_iso ? r.data_iso.substring(0, 10) : '', total: 0, bom: 0, ruim: 0, brocas: 0 });
            }
            const item = map.get(d);
            item.total++;
            if (r.qualidade_muda === 'BOM') item.bom++;
            if (r.qualidade_muda === 'RUIM') item.ruim++;
            if (r.has_broca) item.brocas++;
        }

        // Ordenar cronologicamente pela data ISO
        const sorted = Array.from(map.values()).sort((a, b) => a.iso.localeCompare(b.iso));

        return {
            dates: sorted.map(s => s.date),
            total: sorted.map(s => s.total),
            bom: sorted.map(s => s.bom),
            ruim: sorted.map(s => s.ruim),
            percBom: sorted.map(s => s.total > 0 ? (s.bom / s.total) * 100 : 0),
            percRuim: sorted.map(s => s.total > 0 ? (s.ruim / s.total) * 100 : 0),
            brocas: sorted.map(s => s.brocas)
        };
    };

    /**
     * Comparativo operacional por Frente
     */
    QualidadeMudaEngine.calculateFrenteBreakdown = function (records) {
        if (!records || records.length === 0) return [];

        const map = new Map();
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const f = r.frente || 'Não Informada';
            if (!map.has(f)) {
                map.set(f, { frente: f, total: 0, bom: 0, ruim: 0, brocas: 0, divergencias: 0 });
            }
            const item = map.get(f);
            item.total++;
            if (r.qualidade_muda === 'BOM') item.bom++;
            if (r.qualidade_muda === 'RUIM') item.ruim++;
            if (r.has_broca) item.brocas++;
            if (r.is_divergente_score) item.divergencias++;
        }

        const result = Array.from(map.values()).map(item => ({
            ...item,
            percBom: item.total > 0 ? (item.bom / item.total) * 100 : 0,
            percRuim: item.total > 0 ? (item.ruim / item.total) * 100 : 0,
            percBrocas: item.total > 0 ? (item.brocas / item.total) * 100 : 0
        }));

        // Padrão: ordenar por volume decrescente
        result.sort((a, b) => b.total - a.total);
        return result;
    };

    /**
     * Comparativo operacional por Ordem de Serviço (OS)
     */
    QualidadeMudaEngine.calculateOSBreakdown = function (records) {
        if (!records || records.length === 0) return [];

        const map = new Map();
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const os = r.os || 'Sem OS';
            if (!map.has(os)) {
                map.set(os, { os, frente: r.frente, local: r.local, total: 0, bom: 0, ruim: 0, brocas: 0 });
            }
            const item = map.get(os);
            item.total++;
            if (r.qualidade_muda === 'BOM') item.bom++;
            if (r.qualidade_muda === 'RUIM') item.ruim++;
            if (r.has_broca) item.brocas++;
        }

        const result = Array.from(map.values()).map(item => ({
            ...item,
            percBom: item.total > 0 ? (item.bom / item.total) * 100 : 0,
            percRuim: item.total > 0 ? (item.ruim / item.total) * 100 : 0
        }));

        result.sort((a, b) => b.total - a.total);
        return result;
    };

    /**
     * Distribuição analítica das menções de brocas
     */
    QualidadeMudaEngine.calculateBrocaDistribution = function (records) {
        if (!records || records.length === 0) {
            return { labels: [], counts: [], details: [] };
        }

        const counts = {
            '1 Broca': 0,
            '2 Brocas': 0,
            '3 Brocas': 0,
            '4 Brocas': 0,
            '5 Brocas': 0,
            '6 Brocas': 0,
            'Plano de Ação': 0,
            'Menção Sem Qtd': 0
        };

        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            if (!r.has_broca) continue;

            if (r.broca_qtd === 1) counts['1 Broca']++;
            else if (r.broca_qtd === 2) counts['2 Brocas']++;
            else if (r.broca_qtd === 3) counts['3 Brocas']++;
            else if (r.broca_qtd === 4) counts['4 Brocas']++;
            else if (r.broca_qtd === 5) counts['5 Brocas']++;
            else if (r.broca_qtd === 6) counts['6 Brocas']++;
            else if (r.broca_tipo === 'Plano de Ação (Broca)') counts['Plano de Ação']++;
            else counts['Menção Sem Qtd']++;
        }

        const labels = Object.keys(counts);
        const values = Object.values(counts);

        return {
            labels,
            counts: values,
            totalBrocasRecords: labels.reduce((acc, k) => acc + counts[k], 0)
        };
    };

    /**
     * Matriz de Coerência: Qualidade da Muda vs Score de Origem
     */
    QualidadeMudaEngine.calculateScoreMatrix = function (records) {
        const matrix = {
            bom_score100: 0,
            bom_score0: 0,
            ruim_score100: 0,
            ruim_score0: 0
        };

        for (let i = 0; i < (records || []).length; i++) {
            const r = records[i];
            const is100 = (r.score_perc >= 100);
            if (r.qualidade_muda === 'BOM') {
                if (is100) matrix.bom_score100++;
                else matrix.bom_score0++;
            } else if (r.qualidade_muda === 'RUIM') {
                if (is100) matrix.ruim_score100++;
                else matrix.ruim_score0++;
            }
        }
        return matrix;
    };

    /**
     * Filtra a base de dados de acordo com os critérios ativos
     */
    QualidadeMudaEngine.filterRecords = function (records, filters) {
        if (!records) return [];
        if (!filters) return records;

        return records.filter(r => {
            // 1. Data inicial e final
            if (filters.startDate && r.data_dia) {
                const parts = r.data_dia.split('/');
                const rIso = `${parts[2]}-${parts[1]}-${parts[0]}`;
                if (rIso < filters.startDate) return false;
            }
            if (filters.endDate && r.data_dia) {
                const parts = r.data_dia.split('/');
                const rIso = `${parts[2]}-${parts[1]}-${parts[0]}`;
                if (rIso > filters.endDate) return false;
            }

            // 2. Data específica única (se selecionada)
            if (filters.specificDate && r.data_dia !== filters.specificDate) {
                return false;
            }

            // 3. Frente
            if (filters.frente && filters.frente !== 'TODOS' && r.frente !== filters.frente) {
                return false;
            }

            // 4. OS
            if (filters.os && filters.os !== 'TODOS' && r.os !== filters.os) {
                return false;
            }

            // 5. Local (Fazenda - Talhão)
            if (filters.local && filters.local !== 'TODOS' && r.local !== filters.local) {
                return false;
            }

            // 6. Qualidade da Muda (BOM / RUIM)
            if (filters.qualidade && filters.qualidade !== 'TODOS') {
                if (r.qualidade_muda !== filters.qualidade) return false;
            }

            // 7. Filtro de Broca
            if (filters.brocaFilter && filters.brocaFilter !== 'TODOS') {
                if (filters.brocaFilter === 'COM_BROCA' && !r.has_broca) return false;
                if (filters.brocaFilter === 'SEM_BROCA' && r.has_broca) return false;
                if (filters.brocaFilter === 'PLANO_ACAO' && r.broca_tipo !== 'Plano de Ação (Broca)') return false;
                if (filters.brocaFilter === 'COM_QTD' && (r.broca_qtd === null || r.broca_qtd === undefined)) return false;
            }

            // 8. Responsável
            if (filters.responsavel && filters.responsavel !== 'TODOS' && r.responsavel !== filters.responsavel) {
                return false;
            }

            // 9. Status
            if (filters.status && filters.status !== 'TODOS' && r.status !== filters.status) {
                return false;
            }

            // 10. Divergência de Score (Auditoria)
            if (filters.onlyDivergencias && !r.is_divergente_score) {
                return false;
            }

            // 11. Busca textual global nas observações
            if (filters.searchObs && filters.searchObs.trim()) {
                const q = filters.searchObs.toLowerCase().trim();
                const obs = (r.observacoes || '').toLowerCase();
                const frente = (r.frente || '').toLowerCase();
                const os = (r.os || '').toLowerCase();
                const local = (r.local || '').toLowerCase();
                const resp = (r.responsavel || '').toLowerCase();
                if (!obs.includes(q) && !frente.includes(q) && !os.includes(q) && !local.includes(q) && !resp.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    };

    /**
     * Retorna os registros com apontamentos para auditoria
     */
    QualidadeMudaEngine.getAuditRecords = function (records) {
        if (!records) return [];
        return records.filter(r => r.is_divergente_score || r.qualidade_muda === 'RUIM' || (r.observacoes && r.observacoes.trim() === '.'));
    };

    window.QualidadeMudaEngine = QualidadeMudaEngine;

})(window);
