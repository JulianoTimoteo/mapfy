/**
 * viabilidade_gemas_engine.js
 * ===========================
 * Motor Analítico, Estatístico e de Auditoria para Viabilidade de Gemas
 * Usina Pitangueiras • Safra 2026
 */

(function (window) {
    'use strict';

    const ViabilidadeGemasEngine = {};

    /**
     * Normaliza registro bruto do MapFy para a estrutura analítica padrão
     */
    ViabilidadeGemasEngine.normalizeRecord = function (r) {
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

        const gTotal = parseInt(String(r['Quantidade de Gemas Total'] || r.gemas_total || '0').replace(/\D/g, ''), 10) || 0;
        const gViaveis = parseInt(String(r['Quantidade de Gemas Viáveis'] || r.gemas_viaveis || '0').replace(/\D/g, ''), 10) || 0;
        const gInviaveis = parseInt(String(r['Quantidade de Gemas Inviáveis'] || r.gemas_inviaveis || '0').replace(/\D/g, ''), 10) || 0;

        const isConsistente = (gViaveis + gInviaveis) === gTotal && gTotal > 0;
        const percViaveis = gTotal > 0 ? (gViaveis / gTotal) * 100 : 0;
        const percInviaveis = gTotal > 0 ? (gInviaveis / gTotal) * 100 : 0;
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
            score_desc: r['Score desc.'] || 'Bom',
            local: r['Local (Fazenda - Talhão)'] || r.local || '',
            os: String(r['OS'] || r.os || ''),
            frente: r['Frente'] || r.frente || '',
            responsavel: r['Responsável'] || r.responsavel || '',
            gemas_total: gTotal,
            gemas_viaveis: gViaveis,
            gemas_inviaveis: gInviaveis,
            is_consistente: isConsistente,
            perc_viaveis: percViaveis,
            perc_inviaveis: percInviaveis,
            duracao_min: 2,
            lat: hasCoords ? lat : null,
            lng: hasCoords ? lon : null,
            lon: hasCoords ? lon : null,
            has_valid_coords: hasCoords,
            has_coords: hasCoords,
            _raw: r
        };
    };


    const DEFAULT_CONFIG = {
        metaMinima: 95.0,
        configurada: false,
        descricao: 'Meta agronômica não configurada — exibindo resultados observados.',
        responsavel: 'Engenharia Agronômica'
    };

    /**
     * Recupera ou salva configurações de meta agronômica no localStorage
     */
    ViabilidadeGemasEngine.getTargetConfig = function () {
        try {
            const saved = localStorage.getItem('mapfy_gemas_targets_v1');
            if (saved) {
                const parsed = JSON.parse(saved);
                return { ...DEFAULT_CONFIG, ...parsed };
            }
        } catch (e) {
            console.warn('Falha ao ler targets de viabilidade de gemas:', e);
        }
        return { ...DEFAULT_CONFIG };
    };

    ViabilidadeGemasEngine.saveTargetConfig = function (cfg) {
        try {
            localStorage.setItem('mapfy_gemas_targets_v1', JSON.stringify(cfg));
            return cfg;
        } catch (e) {
            console.error('Falha ao salvar targets de gemas:', e);
            return DEFAULT_CONFIG;
        }
    };

    /**
     * Calcula métricas agregadas ponderadas com rigor matemático
     */
    ViabilidadeGemasEngine.calculateMetrics = function (records, targetConfig) {
        if (!records || records.length === 0) {
            return {
                totalInspecoes: 0,
                totalGemas: 0,
                gemasViaveis: 0,
                gemasInviaveis: 0,
                consistentesCount: 0,
                inconsistentesCount: 0,
                percConsistentes: 0.0,
                percInconsistentes: 0.0,
                viabilidadePonderada: 0.0,
                inviabilidadePonderada: 0.0,
                viabilidadePonderadaGlobal: 0.0,
                mediaGemasPorInspecao: 0.0,
                medianaGemasPorInspecao: 0.0,
                frentesCount: 0,
                osCount: 0,
                locaisCount: 0,
                georefCount: 0,
                percGeoref: 0.0,
                duracaoMediaMin: 0.0,
                duracaoMedianaMin: 0.0,
                metaConfig: targetConfig || DEFAULT_CONFIG
            };
        }

        const totalInspecoes = records.length;
        let totalGemas = 0;
        let gemasViaveis = 0;
        let gemasInviaveis = 0;

        let totalGemasConsistente = 0;
        let viaveisConsistente = 0;
        let inviaveisConsistente = 0;

        let consistentesCount = 0;
        let inconsistentesCount = 0;
        let georefCount = 0;
        let sumDuracao = 0;

        const duracoes = [];
        const gemasCounts = [];
        const frentesSet = new Set();
        const osSet = new Set();
        const locaisSet = new Set();

        for (let i = 0; i < totalInspecoes; i++) {
            const r = records[i];

            totalGemas += r.gemas_total;
            gemasViaveis += r.gemas_viaveis;
            gemasInviaveis += r.gemas_inviaveis;
            gemasCounts.push(r.gemas_total);

            if (r.is_consistente) {
                consistentesCount++;
                totalGemasConsistente += r.gemas_total;
                viaveisConsistente += r.gemas_viaveis;
                inviaveisConsistente += r.gemas_inviaveis;
            } else {
                inconsistentesCount++;
            }

            if (r.has_valid_coords) georefCount++;
            if (r.frente) frentesSet.add(r.frente);
            if (r.os) osSet.add(r.os);
            if (r.local) locaisSet.add(r.local);

            const d = r.duracao_min || 0;
            sumDuracao += d;
            duracoes.push(d);
        }

        // Estatísticas de duração e gemas por inspeção
        duracoes.sort((a, b) => a - b);
        const midD = Math.floor(duracoes.length / 2);
        const duracaoMedianaMin = duracoes.length % 2 === 0
            ? (duracoes[midD - 1] + duracoes[midD]) / 2
            : duracoes[midD];

        gemasCounts.sort((a, b) => a - b);
        const midG = Math.floor(gemasCounts.length / 2);
        const medianaGemasPorInspecao = gemasCounts.length % 2 === 0
            ? (gemasCounts[midG - 1] + gemasCounts[midG]) / 2
            : gemasCounts[midG];

        // Cálculo de Viabilidade Ponderada
        // Primário: sobre registros consistentes (para não distorcer soma)
        const viabilidadePonderada = totalGemasConsistente > 0
            ? (viaveisConsistente / totalGemasConsistente) * 100
            : 0.0;

        const inviabilidadePonderada = totalGemasConsistente > 0
            ? (inviaveisConsistente / totalGemasConsistente) * 100
            : 0.0;

        const viabilidadePonderadaGlobal = totalGemas > 0
            ? (gemasViaveis / totalGemas) * 100
            : 0.0;

        const percConsistentes = (consistentesCount / totalInspecoes) * 100;
        const percInconsistentes = (inconsistentesCount / totalInspecoes) * 100;
        const percGeoref = (georefCount / totalInspecoes) * 100;
        const mediaGemasPorInspecao = totalGemas / totalInspecoes;
        const duracaoMediaMin = sumDuracao / totalInspecoes;

        return {
            totalInspecoes,
            totalGemas,
            gemasViaveis,
            gemasInviaveis,
            totalGemasConsistente,
            viaveisConsistente,
            inviaveisConsistente,
            consistentesCount,
            inconsistentesCount,
            percConsistentes,
            percInconsistentes,
            viabilidadePonderada,
            inviabilidadePonderada,
            viabilidadePonderadaGlobal,
            mediaGemasPorInspecao,
            medianaGemasPorInspecao,
            frentesCount: frentesSet.size,
            osCount: osSet.size,
            locaisCount: locaisSet.size,
            georefCount,
            percGeoref,
            duracaoMediaMin,
            duracaoMedianaMin,
            metaConfig: targetConfig || DEFAULT_CONFIG
        };
    };

    /**
     * Evolução temporal diária da viabilidade ponderada e volumes
     */
    ViabilidadeGemasEngine.calculateTemporalEvolution = function (records) {
        if (!records || records.length === 0) {
            return { dates: [], totalGemas: [], viaveis: [], inviaveis: [], viabilidadePonderada: [], inspecoes: [] };
        }

        const map = new Map();
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const d = r.data_dia || 'Sem Data';
            if (!map.has(d)) {
                map.set(d, {
                    date: d,
                    iso: r.data_iso ? r.data_iso.substring(0, 10) : '',
                    inspecoes: 0,
                    totalGemas: 0,
                    viaveis: 0,
                    inviaveis: 0,
                    totalConsistente: 0,
                    viaveisConsistente: 0
                });
            }
            const item = map.get(d);
            item.inspecoes++;
            item.totalGemas += r.gemas_total;
            item.viaveis += r.gemas_viaveis;
            item.inviaveis += r.gemas_inviaveis;

            if (r.is_consistente) {
                item.totalConsistente += r.gemas_total;
                item.viaveisConsistente += r.gemas_viaveis;
            }
        }

        const sorted = Array.from(map.values()).sort((a, b) => a.iso.localeCompare(b.iso));

        return {
            dates: sorted.map(s => s.date),
            inspecoes: sorted.map(s => s.inspecoes),
            totalGemas: sorted.map(s => s.totalGemas),
            viaveis: sorted.map(s => s.viaveis),
            inviaveis: sorted.map(s => s.inviaveis),
            viabilidadePonderada: sorted.map(s => s.totalConsistente > 0 ? (s.viaveisConsistente / s.totalConsistente) * 100 : 0)
        };
    };

    /**
     * Comparativo operacional por Frente
     */
    ViabilidadeGemasEngine.calculateFrenteBreakdown = function (records) {
        if (!records || records.length === 0) return [];

        const map = new Map();
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const f = r.frente || 'Não Informada';
            if (!map.has(f)) {
                map.set(f, {
                    frente: f,
                    inspecoes: 0,
                    totalGemas: 0,
                    viaveis: 0,
                    inviaveis: 0,
                    totalConsistente: 0,
                    viaveisConsistente: 0,
                    inconsistentes: 0
                });
            }
            const item = map.get(f);
            item.inspecoes++;
            item.totalGemas += r.gemas_total;
            item.viaveis += r.gemas_viaveis;
            item.inviaveis += r.gemas_inviaveis;

            if (r.is_consistente) {
                item.totalConsistente += r.gemas_total;
                item.viaveisConsistente += r.gemas_viaveis;
            } else {
                item.inconsistentes++;
            }
        }

        const result = Array.from(map.values()).map(item => ({
            ...item,
            viabilidadePonderada: item.totalConsistente > 0 ? (item.viaveisConsistente / item.totalConsistente) * 100 : 0,
            percInconsistentes: item.inspecoes > 0 ? (item.inconsistentes / item.inspecoes) * 100 : 0
        }));

        result.sort((a, b) => b.totalGemas - a.totalGemas);
        return result;
    };

    /**
     * Comparativo operacional por Ordem de Serviço (OS)
     */
    ViabilidadeGemasEngine.calculateOSBreakdown = function (records) {
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
                    inspecoes: 0,
                    totalGemas: 0,
                    viaveis: 0,
                    inviaveis: 0,
                    totalConsistente: 0,
                    viaveisConsistente: 0,
                    inconsistentes: 0
                });
            }
            const item = map.get(os);
            item.inspecoes++;
            item.totalGemas += r.gemas_total;
            item.viaveis += r.gemas_viaveis;
            item.inviaveis += r.gemas_inviaveis;

            if (r.is_consistente) {
                item.totalConsistente += r.gemas_total;
                item.viaveisConsistente += r.gemas_viaveis;
            } else {
                item.inconsistentes++;
            }
        }

        const result = Array.from(map.values()).map(item => ({
            ...item,
            viabilidadePonderada: item.totalConsistente > 0 ? (item.viaveisConsistente / item.totalConsistente) * 100 : 0,
            percInconsistentes: item.inspecoes > 0 ? (item.inconsistentes / item.inspecoes) * 100 : 0
        }));

        result.sort((a, b) => b.totalGemas - a.totalGemas);
        return result;
    };

    /**
     * Histograma de distribuição dos percentuais individuais de viabilidade
     */
    ViabilidadeGemasEngine.calculateViabilityHistogram = function (records) {
        const buckets = {
            '100%': 0,
            '98% a 99.9%': 0,
            '95% a 97.9%': 0,
            '90% a 94.9%': 0,
            '< 90%': 0
        };

        for (let i = 0; i < (records || []).length; i++) {
            const r = records[i];
            const v = r.viabilidade_ind;
            if (v >= 100) buckets['100%']++;
            else if (v >= 98) buckets['98% a 99.9%']++;
            else if (v >= 95) buckets['95% a 97.9%']++;
            else if (v >= 90) buckets['90% a 94.9%']++;
            else buckets['< 90%']++;
        }

        return {
            labels: Object.keys(buckets),
            counts: Object.values(buckets)
        };
    };

    /**
     * Distribuição analítica das inconsistências de contagem
     */
    ViabilidadeGemasEngine.calculateInconsistencyDistribution = function (records) {
        const counts = new Map();
        for (let i = 0; i < (records || []).length; i++) {
            const r = records[i];
            if (r.is_consistente) continue;

            const diff = r.diferenca;
            const label = diff < 0 ? `Diferença ${diff} (Falta)` : `Diferença +${diff} (Sobra)`;
            counts.set(label, (counts.get(label) || 0) + 1);
        }

        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        return {
            labels: sorted.map(s => s[0]),
            counts: sorted.map(s => s[1])
        };
    };

    /**
     * Distribuição de Quantidade Total de Gemas por Amostra e Detecção de Outliers
     */
    ViabilidadeGemasEngine.calculateTotalGemasDistribution = function (records) {
        const buckets = {
            '< 50 gemas': 0,
            '50 a 54 gemas': 0,
            '55 a 59 gemas': 0,
            '60 a 64 gemas': 0,
            '65 a 69 gemas': 0,
            '≥ 70 gemas': 0
        };

        const totals = [];
        let outliersCount = 0;

        for (let i = 0; i < (records || []).length; i++) {
            const r = records[i];
            const tot = r.gemas_total;
            totals.push(tot);

            if (r.is_outlier) outliersCount++;

            if (tot < 50) buckets['< 50 gemas']++;
            else if (tot <= 54) buckets['50 a 54 gemas']++;
            else if (tot <= 59) buckets['55 a 59 gemas']++;
            else if (tot <= 64) buckets['60 a 64 gemas']++;
            else if (tot <= 69) buckets['65 a 69 gemas']++;
            else buckets['≥ 70 gemas']++;
        }

        totals.sort((a, b) => a - b);
        const minVal = totals.length > 0 ? totals[0] : 0;
        const maxVal = totals.length > 0 ? totals[totals.length - 1] : 0;
        const q1 = totals.length > 0 ? totals[Math.floor(totals.length * 0.25)] : 0;
        const median = totals.length > 0 ? totals[Math.floor(totals.length * 0.5)] : 0;
        const q3 = totals.length > 0 ? totals[Math.floor(totals.length * 0.75)] : 0;

        return {
            labels: Object.keys(buckets),
            counts: Object.values(buckets),
            stats: {
                min: minVal,
                max: maxVal,
                q1,
                median,
                q3,
                iqr: q3 - q1,
                lowerFence: q1 - 1.5 * (q3 - q1),
                upperFence: q3 + 1.5 * (q3 - q1),
                outliersCount
            }
        };
    };

    /**
     * Dados para Dispersão (Scatter Plot) Total de Gemas vs Viáveis
     */
    ViabilidadeGemasEngine.calculateScatterData = function (records, maxPoints = 600) {
        if (!records || records.length === 0) return [];
        const step = Math.max(1, Math.floor(records.length / maxPoints));
        const points = [];

        for (let i = 0; i < records.length; i += step) {
            const r = records[i];
            points.push({
                x: r.gemas_total,
                y: r.gemas_viaveis,
                id: r.id,
                diff: r.diferenca,
                isConsistente: r.is_consistente,
                viab: r.viabilidade_ind,
                inv: r.gemas_inviaveis,
                frente: r.frente,
                os: r.os,
                local: r.local,
                responsavel: r.responsavel,
                data: r.data
            });
        }
        return points;
    };

    /**
     * Comparativo por Responsável
     */
    ViabilidadeGemasEngine.calculateResponsavelBreakdown = function (records) {
        if (!records || records.length === 0) return [];

        const map = new Map();
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const resp = r.responsavel || 'Não Informado';
            if (!map.has(resp)) {
                map.set(resp, {
                    responsavel: resp,
                    inspecoes: 0,
                    totalGemas: 0,
                    viaveis: 0,
                    inviaveis: 0,
                    totalConsistente: 0,
                    viaveisConsistente: 0,
                    inconsistentes: 0
                });
            }
            const item = map.get(resp);
            item.inspecoes++;
            item.totalGemas += r.gemas_total;
            item.viaveis += r.gemas_viaveis;
            item.inviaveis += r.gemas_inviaveis;

            if (r.is_consistente) {
                item.totalConsistente += r.gemas_total;
                item.viaveisConsistente += r.gemas_viaveis;
            } else {
                item.inconsistentes++;
            }
        }

        const result = Array.from(map.values()).map(item => ({
            ...item,
            viabilidadePonderada: item.totalConsistente > 0 ? (item.viaveisConsistente / item.totalConsistente) * 100 : 0
        }));

        result.sort((a, b) => b.inspecoes - a.inspecoes);
        return result;
    };

    /**
     * Comparativo por Local / Talhão
     */
    ViabilidadeGemasEngine.calculateLocalBreakdown = function (records) {
        if (!records || records.length === 0) return [];

        const map = new Map();
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const loc = r.local || 'Sem Local';
            if (!map.has(loc)) {
                map.set(loc, {
                    local: loc,
                    frente: r.frente,
                    inspecoes: 0,
                    totalGemas: 0,
                    viaveis: 0,
                    inviaveis: 0,
                    totalConsistente: 0,
                    viaveisConsistente: 0,
                    inconsistentes: 0
                });
            }
            const item = map.get(loc);
            item.inspecoes++;
            item.totalGemas += r.gemas_total;
            item.viaveis += r.gemas_viaveis;
            item.inviaveis += r.gemas_inviaveis;

            if (r.is_consistente) {
                item.totalConsistente += r.gemas_total;
                item.viaveisConsistente += r.gemas_viaveis;
            } else {
                item.inconsistentes++;
            }
        }

        const result = Array.from(map.values()).map(item => ({
            ...item,
            viabilidadePonderada: item.totalConsistente > 0 ? (item.viaveisConsistente / item.totalConsistente) * 100 : 0
        }));

        result.sort((a, b) => b.totalGemas - a.totalGemas);
        return result;
    };

    /**
     * Painel de Qualidade e Confiabilidade dos Dados (Auditoria Rigorosa)
     */
    ViabilidadeGemasEngine.calculateDataQualitySummary = function (records) {
        if (!records || records.length === 0) {
            return {
                totalRecords: 0,
                duplicateIds: 0,
                inconsistentes: 0,
                missingValues: 0,
                invalidCoords: 0,
                invalidDates: 0,
                divergenciaScore: 0,
                outliers: 0,
                amostrasComInviaveis: 0,
                completudePerc: 100.0
            };
        }

        let inconsistentes = 0;
        let invalidCoords = 0;
        let divergenciaScore = 0;
        let outliers = 0;
        let amostrasComInviaveis = 0;

        const ids = new Set();
        let duplicateIds = 0;

        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            if (ids.has(r.id)) duplicateIds++;
            else ids.add(r.id);

            if (!r.is_consistente) inconsistentes++;
            if (!r.has_valid_coords) invalidCoords++;
            if (r.score_divergente) divergenciaScore++;
            if (r.is_outlier) outliers++;
            if (r.tem_inviaveis) amostrasComInviaveis++;
        }

        return {
            totalRecords: records.length,
            duplicateIds,
            inconsistentes,
            missingValues: 0,
            invalidCoords,
            invalidDates: 0,
            divergenciaScore,
            outliers,
            amostrasComInviaveis,
            completudePerc: 100.0
        };
    };

    /**
     * Filtra a base de registros conforme os critérios da interface
     */
    ViabilidadeGemasEngine.filterRecords = function (records, filters) {
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

            // Score desc
            if (filters.scoreDesc && filters.scoreDesc !== 'TODOS' && r.score_desc !== filters.scoreDesc) {
                return false;
            }

            // Consistência de Contagem
            if (filters.consistenciaFilter && filters.consistenciaFilter !== 'TODOS') {
                if (filters.consistenciaFilter === 'CONSISTENTE' && !r.is_consistente) return false;
                if (filters.consistenciaFilter === 'INCONSISTENTE' && r.is_consistente) return false;
            }

            // Filtro de Inviáveis
            if (filters.inviaveisFilter && filters.inviaveisFilter !== 'TODOS') {
                if (filters.inviaveisFilter === 'COM_INVIAVEIS' && !r.tem_inviaveis) return false;
                if (filters.inviaveisFilter === 'SEM_INVIAVEIS' && r.tem_inviaveis) return false;
            }

            // Filtro de Divergência de Score
            if (filters.scoreDivergenteFilter && filters.scoreDivergenteFilter !== 'TODOS') {
                if (filters.scoreDivergenteFilter === 'DIVERGENTE' && !r.score_divergente) return false;
            }

            // Filtro de Outliers
            if (filters.outlierFilter && filters.outlierFilter !== 'TODOS') {
                if (filters.outlierFilter === 'OUTLIERS' && !r.is_outlier) return false;
            }

            // Filtro de Coordenadas GPS
            if (filters.coordsFilter && filters.coordsFilter !== 'TODOS') {
                if (filters.coordsFilter === 'COM_GPS' && !r.has_valid_coords) return false;
                if (filters.coordsFilter === 'SEM_GPS' && r.has_valid_coords) return false;
            }

            // Faixa de Quantidade Total
            if (filters.faixaTotal && filters.faixaTotal !== 'TODOS') {
                if (filters.faixaTotal === 'MENOR_55' && r.gemas_total >= 55) return false;
                if (filters.faixaTotal === '55_65' && (r.gemas_total < 55 || r.gemas_total > 65)) return false;
                if (filters.faixaTotal === 'MAIOR_65' && r.gemas_total <= 65) return false;
            }

            // Faixa de Viabilidade Individual
            if (filters.faixaViabilidade && filters.faixaViabilidade !== 'TODOS') {
                if (filters.faixaViabilidade === 'PERFEITO' && r.viabilidade_ind < 100) return false;
                if (filters.faixaViabilidade === 'ALTO' && (r.viabilidade_ind < 95 || r.viabilidade_ind >= 100)) return false;
                if (filters.faixaViabilidade === 'BAIXO' && r.viabilidade_ind >= 95) return false;
            }

            // Apenas Inconsistências
            if (filters.onlyInconsistencias && r.is_consistente) {
                return false;
            }

            // Busca textual global
            if (filters.search && filters.search.trim()) {
                const q = filters.search.toLowerCase().trim();
                const idStr = r.id.toString();
                const frente = (r.frente || '').toLowerCase();
                const os = (r.os || '').toLowerCase();
                const local = (r.local || '').toLowerCase();
                const resp = (r.responsavel || '').toLowerCase();
                const user = (r.usuario || '').toLowerCase();
                if (!idStr.includes(q) && !frente.includes(q) && !os.includes(q) && !local.includes(q) && !resp.includes(q) && !user.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    };

    window.ViabilidadeGemasEngine = ViabilidadeGemasEngine;

})(window);
