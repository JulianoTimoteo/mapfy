/**
 * qualidade_cana_engine.js
 * ========================
 * Motor Analítico, Estatístico e de Auditoria para Qualidade da Cana no Plantio
 * Usina Pitangueiras • Safra 2026
 */

(function (window) {
    'use strict';

    const QualidadeCanaEngine = {};

    /**
     * Normaliza registro bruto do MapFy para a estrutura analítica padrão
     */
    QualidadeCanaEngine.normalizeRecord = function (r) {
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

        const qtdCanaOrig = String(r['Quantidade de Cana'] || r.quantidade_cana || 'BOM').trim();
        const qtdCanaNorm = qtdCanaOrig.toUpperCase();
        const isBom = qtdCanaNorm === 'BOM';
        const obs = String(r['Observações '] || r['Observações'] || r.observacoes || '').trim();
        const hasObsRelevante = obs.length > 0 && !['bom', 'ok', 'conforme', '-'].includes(obs.toLowerCase());
        const scoreDivergente = isBom && scoreNum < 1.0;
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
            score_perc: r['Score perc.'] || '100',
            score_perc_num: scorePercNum,
            score_desc: r['Score desc.'] || 'Bom',
            local: r['Local (Fazenda - Talhão)'] || r.local || '',
            os: String(r['OS'] || r.os || ''),
            frente: r['Frente'] || r.frente || '',
            responsavel: r['Responsável'] || r.responsavel || '',
            quantidade_cana_orig: qtdCanaOrig,
            quantidade_cana_norm: qtdCanaNorm,
            is_bom: isBom,
            observacoes: obs,
            has_obs_relevante: hasObsRelevante,
            score_divergente: scoreDivergente,
            duracao_min: 1,
            lat: hasCoords ? lat : null,
            lng: hasCoords ? lon : null,
            lon: hasCoords ? lon : null,
            has_valid_coords: hasCoords,
            _raw: r
        };
    };


    /**
     * Calcula métricas agregadas e KPIs operacionais
     */
    QualidadeCanaEngine.calculateMetrics = function (records) {
        if (!records || records.length === 0) {
            return {
                totalAvaliacoes: 0,
                avaliacoesBom: 0,
                percAvaliacoesBom: 0.0,
                avaliacoesOutros: 0,
                percAvaliacoesOutros: 0.0,
                avaliacoesSemClassificacao: 0,
                avaliacoesComObsRelevantes: 0,
                avaliacoesScoreDivergente: 0,
                talhoesAvaliados: 0,
                frentesAvaliadas: 0,
                osAvaliadas: 0,
                responsaveisCount: 0,
                georefCount: 0,
                percGeoref: 0.0,
                duracaoMediaMin: 0.0,
                duracaoMedianaMin: 0.0
            };
        }

        const total = records.length;
        let bomCount = 0;
        let outrosCount = 0;
        let semClassCount = 0;
        let obsRelevantesCount = 0;
        let scoreDivergenteCount = 0;
        let georefCount = 0;
        let sumDuracao = 0;

        const duracoes = [];
        const locaisSet = new Set();
        const frentesSet = new Set();
        const osSet = new Set();
        const respsSet = new Set();

        for (let i = 0; i < total; i++) {
            const r = records[i];

            if (r.is_bom) bomCount++;
            else if (!r.quantidade_cana_norm || r.quantidade_cana_norm === 'NÃO INFORMADO') semClassCount++;
            else outrosCount++;

            if (r.has_obs_relevante) obsRelevantesCount++;
            if (r.score_divergente) scoreDivergenteCount++;
            if (r.has_valid_coords) georefCount++;

            if (r.local) locaisSet.add(r.local);
            if (r.frente) frentesSet.add(r.frente);
            if (r.os) osSet.add(r.os);
            if (r.responsavel) respsSet.add(r.responsavel);

            const d = r.duracao_min || 0;
            sumDuracao += d;
            duracoes.push(d);
        }

        duracoes.sort((a, b) => a - b);
        const mid = Math.floor(duracoes.length / 2);
        const duracaoMedianaMin = duracoes.length % 2 === 0
            ? (duracoes[mid - 1] + duracoes[mid]) / 2
            : duracoes[mid];

        return {
            totalAvaliacoes: total,
            avaliacoesBom: bomCount,
            percAvaliacoesBom: total > 0 ? (bomCount / total) * 100 : 0.0,
            avaliacoesOutros: outrosCount,
            percAvaliacoesOutros: total > 0 ? (outrosCount / total) * 100 : 0.0,
            avaliacoesSemClassificacao: semClassCount,
            avaliacoesComObsRelevantes: obsRelevantesCount,
            avaliacoesScoreDivergente: scoreDivergenteCount,
            talhoesAvaliados: locaisSet.size,
            frentesAvaliadas: frentesSet.size,
            osAvaliadas: osSet.size,
            responsaveisCount: respsSet.size,
            georefCount,
            percGeoref: total > 0 ? (georefCount / total) * 100 : 0.0,
            duracaoMediaMin: total > 0 ? sumDuracao / total : 0.0,
            duracaoMedianaMin
        };
    };

    /**
     * Evolução temporal diária
     */
    QualidadeCanaEngine.calculateTemporalEvolution = function (records) {
        if (!records || records.length === 0) {
            return { dates: [], total: [], bom: [], outros: [], divergentes: [] };
        }

        const map = new Map();
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const d = r.data_dia || 'Sem Data';
            if (!map.has(d)) {
                map.set(d, {
                    date: d,
                    iso: r.data_iso ? r.data_iso.substring(0, 10) : '',
                    total: 0,
                    bom: 0,
                    outros: 0,
                    divergentes: 0
                });
            }
            const item = map.get(d);
            item.total++;
            if (r.is_bom) item.bom++;
            else item.outros++;
            if (r.score_divergente) item.divergentes++;
        }

        const sorted = Array.from(map.values()).sort((a, b) => a.iso.localeCompare(b.iso));

        return {
            dates: sorted.map(s => s.date),
            total: sorted.map(s => s.total),
            bom: sorted.map(s => s.bom),
            outros: sorted.map(s => s.outros),
            divergentes: sorted.map(s => s.divergentes)
        };
    };

    /**
     * Distribuição por horário do dia (06:00 às 18:00)
     */
    QualidadeCanaEngine.calculateHourlyDistribution = function (records) {
        const hoursMap = {};
        for (let h = 5; h <= 19; h++) {
            const label = `${String(h).padStart(2, '0')}:00`;
            hoursMap[label] = 0;
        }

        for (let i = 0; i < (records || []).length; i++) {
            const r = records[i];
            const h = r.hora;
            if (h >= 5 && h <= 19) {
                const label = `${String(h).padStart(2, '0')}:00`;
                hoursMap[label] = (hoursMap[label] || 0) + 1;
            }
        }

        return {
            labels: Object.keys(hoursMap),
            counts: Object.values(hoursMap)
        };
    };

    /**
     * Comparativo por Frente
     */
    QualidadeCanaEngine.calculateFrenteBreakdown = function (records) {
        if (!records || records.length === 0) return [];

        const map = new Map();
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const f = r.frente || 'Não Informada';
            if (!map.has(f)) {
                map.set(f, {
                    frente: f,
                    total: 0,
                    bom: 0,
                    outros: 0,
                    divergentes: 0,
                    obsRelevantes: 0
                });
            }
            const item = map.get(f);
            item.total++;
            if (r.is_bom) item.bom++;
            else item.outros++;
            if (r.score_divergente) item.divergentes++;
            if (r.has_obs_relevante) item.obsRelevantes++;
        }

        const result = Array.from(map.values()).map(item => ({
            ...item,
            percBom: item.total > 0 ? (item.bom / item.total) * 100 : 0
        }));

        result.sort((a, b) => b.total - a.total);
        return result;
    };

    /**
     * Comparativo por Ordem de Serviço (OS)
     */
    QualidadeCanaEngine.calculateOSBreakdown = function (records) {
        if (!records || records.length === 0) return [];

        const map = new Map();
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const os = r.os || 'Sem OS';
            if (!map.has(os)) {
                map.set(os, {
                    os,
                    frente: r.frente,
                    local: r.local,
                    total: 0,
                    bom: 0,
                    outros: 0,
                    divergentes: 0
                });
            }
            const item = map.get(os);
            item.total++;
            if (r.is_bom) item.bom++;
            else item.outros++;
            if (r.score_divergente) item.divergentes++;
        }

        const result = Array.from(map.values()).map(item => ({
            ...item,
            percBom: item.total > 0 ? (item.bom / item.total) * 100 : 0
        }));

        result.sort((a, b) => b.total - a.total);
        return result;
    };

    /**
     * Comparativo por Local / Talhão
     */
    QualidadeCanaEngine.calculateLocalBreakdown = function (records) {
        if (!records || records.length === 0) return [];

        const map = new Map();
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const loc = r.local || 'Sem Local';
            if (!map.has(loc)) {
                map.set(loc, {
                    local: loc,
                    frente: r.frente,
                    total: 0,
                    bom: 0,
                    outros: 0,
                    divergentes: 0
                });
            }
            const item = map.get(loc);
            item.total++;
            if (r.is_bom) item.bom++;
            else item.outros++;
            if (r.score_divergente) item.divergentes++;
        }

        const result = Array.from(map.values()).map(item => ({
            ...item,
            percBom: item.total > 0 ? (item.bom / item.total) * 100 : 0
        }));

        result.sort((a, b) => b.total - a.total);
        return result;
    };

    /**
     * Comparativo por Responsável
     */
    QualidadeCanaEngine.calculateResponsavelBreakdown = function (records) {
        if (!records || records.length === 0) return [];

        const map = new Map();
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const resp = r.responsavel || 'Não Informado';
            if (!map.has(resp)) {
                map.set(resp, {
                    responsavel: resp,
                    total: 0,
                    bom: 0,
                    outros: 0,
                    divergentes: 0,
                    obsRelevantes: 0
                });
            }
            const item = map.get(resp);
            item.total++;
            if (r.is_bom) item.bom++;
            else item.outros++;
            if (r.score_divergente) item.divergentes++;
            if (r.has_obs_relevante) item.obsRelevantes++;
        }

        const result = Array.from(map.values()).map(item => ({
            ...item,
            percBom: item.total > 0 ? (item.bom / item.total) * 100 : 0
        }));

        result.sort((a, b) => b.total - a.total);
        return result;
    };

    /**
     * Categorização das Observações Textuais
     */
    QualidadeCanaEngine.calculateObservationCategories = function (records) {
        const counts = {
            'Sem Observação (Vazio)': 0,
            'Padrão ("Bom" / "Boa")': 0,
            'Ponto Isolado (".")': 0,
            'Descritiva / Informativa': 0
        };

        for (let i = 0; i < (records || []).length; i++) {
            const r = records[i];
            const t = r.observacoes_tipo;
            if (t === 'VAZIO') counts['Sem Observação (Vazio)']++;
            else if (t === 'PADRAO') counts['Padrão ("Bom" / "Boa")']++;
            else if (t === 'PONTO') counts['Ponto Isolado (".")']++;
            else counts['Descritiva / Informativa']++;
        }

        return {
            labels: Object.keys(counts),
            counts: Object.values(counts)
        };
    };

    /**
     * Resumo da Qualidade e Confiabilidade dos Dados
     */
    QualidadeCanaEngine.calculateQualitySummary = function (records) {
        if (!records || records.length === 0) {
            return {
                totalRecords: 0,
                duplicateIds: 0,
                semClassificacao: 0,
                invalidCoords: 0,
                invalidDates: 0,
                scoreDivergente: 0,
                obsPonto: 0,
                obsDescritiva: 0,
                completudePerc: 100.0
            };
        }

        let semClassificacao = 0;
        let invalidCoords = 0;
        let scoreDivergente = 0;
        let obsPonto = 0;
        let obsDescritiva = 0;

        const ids = new Set();
        let duplicateIds = 0;

        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            if (ids.has(r.id)) duplicateIds++;
            else ids.add(r.id);

            if (!r.quantidade_cana_norm || r.quantidade_cana_norm === 'NÃO INFORMADO') semClassificacao++;
            if (!r.has_valid_coords) invalidCoords++;
            if (r.score_divergente) scoreDivergente++;
            if (r.observacoes_tipo === 'PONTO') obsPonto++;
            if (r.observacoes_tipo === 'DESCRITIVO') obsDescritiva++;
        }

        return {
            totalRecords: records.length,
            duplicateIds,
            semClassificacao,
            invalidCoords,
            invalidDates: 0,
            scoreDivergente,
            obsPonto,
            obsDescritiva,
            completudePerc: 100.0
        };
    };

    /**
     * Filtra a base de registros conforme os critérios da interface
     */
    QualidadeCanaEngine.filterRecords = function (records, filters) {
        if (!records) return [];
        if (!filters) return records;

        return records.filter(r => {
            // Data início e fim
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

            // Data específica única
            if (filters.specificDate && r.data_dia !== filters.specificDate) {
                return false;
            }

            // Frente
            if (filters.frente && filters.frente !== 'TODOS' && r.frente !== filters.frente) {
                return false;
            }

            // OS
            if (filters.os && filters.os !== 'TODOS' && r.os !== filters.os) {
                return false;
            }

            // Local
            if (filters.local && filters.local !== 'TODOS' && r.local !== filters.local) {
                return false;
            }

            // Responsável
            if (filters.responsavel && filters.responsavel !== 'TODOS' && r.responsavel !== filters.responsavel) {
                return false;
            }

            // Usuário
            if (filters.usuario && filters.usuario !== 'TODOS' && r.usuario !== filters.usuario) {
                return false;
            }

            // Status
            if (filters.status && filters.status !== 'TODOS' && r.status !== filters.status) {
                return false;
            }

            // Classificação (BOM / OUTROS)
            if (filters.classificacaoFilter && filters.classificacaoFilter !== 'TODOS') {
                if (filters.classificacaoFilter === 'BOM' && !r.is_bom) return false;
                if (filters.classificacaoFilter === 'OUTROS' && r.is_bom) return false;
            }

            // Filtro de Observações
            if (filters.obsFilter && filters.obsFilter !== 'TODOS') {
                if (filters.obsFilter === 'DESCRITIVO' && r.observacoes_tipo !== 'DESCRITIVO') return false;
                if (filters.obsFilter === 'PONTO' && r.observacoes_tipo !== 'PONTO') return false;
                if (filters.obsFilter === 'PADRAO' && r.observacoes_tipo !== 'PADRAO') return false;
                if (filters.obsFilter === 'VAZIO' && r.observacoes_tipo !== 'VAZIO') return false;
                if (filters.obsFilter === 'COM_OBS' && r.observacoes_tipo === 'VAZIO') return false;
            }

            // Filtro de Divergência de Score
            if (filters.scoreDivergenteFilter && filters.scoreDivergenteFilter !== 'TODOS') {
                if (filters.scoreDivergenteFilter === 'DIVERGENTE' && !r.score_divergente) return false;
            }

            // Filtro de Coordenadas GPS
            if (filters.coordsFilter && filters.coordsFilter !== 'TODOS') {
                if (filters.coordsFilter === 'COM_GPS' && !r.has_valid_coords) return false;
                if (filters.coordsFilter === 'SEM_GPS' && r.has_valid_coords) return false;
            }

            // Busca textual global
            if (filters.search && filters.search.trim()) {
                const q = filters.search.toLowerCase().trim();
                const idStr = r.id.toString();
                const frente = (r.frente || '').toLowerCase();
                const os = (r.os || '').toLowerCase();
                const local = (r.local || '').toLowerCase();
                const resp = (r.responsavel || '').toLowerCase();
                const obs = (r.observacoes_raw || '').toLowerCase();
                const qtd = (r.quantidade_cana_raw || '').toLowerCase();
                if (!idStr.includes(q) && !frente.includes(q) && !os.includes(q) && !local.includes(q) && !resp.includes(q) && !obs.includes(q) && !qtd.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    };

    window.QualidadeCanaEngine = QualidadeCanaEngine;

})(window);
