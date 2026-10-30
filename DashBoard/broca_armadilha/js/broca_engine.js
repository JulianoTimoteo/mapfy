/**
 * broca_engine.js
 * Motor de Inteligência Agronômica e Entomológica para Monitoramento de Broca por Armadilha
 * Usina Pitangueiras - Safra 2026
 */

(function (window) {
    'use strict';

    const BrocaEngine = {
        /**
         * Calcula todos os KPIs executivos da base filtrada
         */
        computeExecutiveKPIs: function (records) {
            const total = records.length;
            if (total === 0) {
                return {
                    totalLancamentos: 0,
                    totalMachos: 0,
                    instalacoesCount: 0,
                    recolhimentosCount: 0,
                    mediaPorLancamento: 0,
                    mediaPorRecolhimento: 0,
                    positivosCount: 0,
                    mediaPositivos: 0,
                    zeradosTotal: 0,
                    zeradosRecolhimento: 0,
                    percZerados: 0,
                    maiorQuantidade: 0,
                    fazendasCount: 0,
                    talhoesLocaisCount: 0,
                    responsaveisCount: 0,
                    ultimoLancamento: '—',
                    georrefPerc: 100
                };
            }

            let totalMachos = 0;
            let instalacoesCount = 0;
            let recolhimentosCount = 0;
            let positivosCount = 0;
            let zeradosTotal = 0;
            let zeradosRecolhimento = 0;
            let maiorQuantidade = 0;
            const fazendasSet = new Set();
            const locaisSet = new Set();
            const responsaveisSet = new Set();
            let comCoords = 0;

            records.forEach(r => {
                const m = r.machos || 0;
                totalMachos += m;
                if (m > maiorQuantidade) maiorQuantidade = m;

                if (r.is_instalacao) instalacoesCount++;
                if (r.is_recolhimento) {
                    recolhimentosCount++;
                    if (m === 0) zeradosRecolhimento++;
                }

                if (m === 0) zeradosTotal++;
                if (m > 0) positivosCount++;

                if (r.fazenda) fazendasSet.add(r.fazenda);
                if (r.local_orig) locaisSet.add(r.local_orig);
                if (r.responsavel_nome) responsaveisSet.add(r.responsavel_nome);
                if (r.has_coords) comCoords++;
            });

            const mediaPorLancamento = Math.round((totalMachos / total) * 100) / 100;
            const mediaPorRecolhimento = recolhimentosCount > 0
                ? Math.round((totalMachos / recolhimentosCount) * 100) / 100
                : 0;
            const mediaPositivos = positivosCount > 0
                ? Math.round((totalMachos / positivosCount) * 100) / 100
                : 0;
            const percZerados = Math.round((zeradosTotal / total) * 1000) / 10;

            return {
                totalLancamentos: total,
                totalMachos: totalMachos,
                totalCapturas: totalMachos,
                totalBrocas: totalMachos,
                instalacoesCount: instalacoesCount,
                recolhimentosCount: recolhimentosCount,
                mediaPorLancamento: mediaPorLancamento,
                mediaPorRecolhimento: mediaPorRecolhimento,
                positivosCount: positivosCount,
                mediaPositivos: mediaPositivos,
                zeradosTotal: zeradosTotal,
                zeradosRecolhimento: zeradosRecolhimento,
                percZerados: percZerados,
                maiorQuantidade: maiorQuantidade,
                maiorCaptura: maiorQuantidade,
                fazendasCount: fazendasSet.size,
                talhoesLocaisCount: locaisSet.size,
                responsaveisCount: responsaveisSet.size,
                ultimoLancamento: records[0] ? records[0].data : '—',
                georrefPerc: Math.round((comCoords / total) * 1000) / 10
            };
        },

        /**
         * Ranking Agrícola por Fazenda
         */
        computeFarmRanking: function (records) {
            const map = {};
            let totalMachosGeral = 0;

            records.forEach(r => {
                const faz = r.fazenda || 'N/I';
                const m = r.machos || 0;
                totalMachosGeral += m;

                if (!map[faz]) {
                    map[faz] = {
                        fazenda: faz,
                        totalMachos: 0,
                        totalLancamentos: 0,
                        instalacoes: 0,
                        recolhimentos: 0,
                        zerados: 0,
                        positivos: 0,
                        talhoes: new Set(),
                        ultimaData: r.data
                    };
                }
                const entry = map[faz];
                entry.totalMachos += m;
                entry.totalLancamentos++;
                if (r.is_instalacao) entry.instalacoes++;
                if (r.is_recolhimento) entry.recolhimentos++;
                if (m === 0) entry.zerados++;
                if (m > 0) entry.positivos++;
                if (r.talhao) entry.talhoes.add(r.talhao);
            });

            return Object.values(map).map(e => ({
                ...e,
                totalCapturas: e.totalMachos,
                totalBrocas: e.totalMachos,
                talhoesCount: e.talhoes.size,
                mediaPorRecolhimento: e.recolhimentos > 0
                    ? Math.round((e.totalMachos / e.recolhimentos) * 10) / 10
                    : 0,
                participacaoPerc: totalMachosGeral > 0
                    ? Math.round((e.totalMachos / totalMachosGeral) * 1000) / 10
                    : 0
            })).sort((a, b) => b.totalMachos - a.totalMachos || b.totalLancamentos - a.totalLancamentos);
        },

        /**
         * Ranking Agrícola por Talhão (Local: Fazenda > Talhão)
         */
        computeTalhaoRanking: function (records) {
            const map = {};

            records.forEach(r => {
                const loc = r.local_orig || 'N/I';
                const m = r.machos || 0;

                if (!map[loc]) {
                    map[loc] = {
                        local: loc,
                        fazenda: r.fazenda,
                        talhao: r.talhao,
                        totalMachos: 0,
                        totalCapturas: 0,
                        totalBrocas: 0,
                        totalLancamentos: 0,
                        instalacoes: 0,
                        recolhimentos: 0,
                        zerados: 0,
                        positivos: 0,
                        maxMachos: 0,
                        maxCapturas: 0,
                        maxBrocas: 0,
                        ultimaData: r.data
                    };
                }
                const entry = map[loc];
                entry.totalMachos += m;
                entry.totalCapturas += m;
                entry.totalBrocas += m;
                entry.totalLancamentos++;
                if (m > entry.maxMachos) {
                    entry.maxMachos = m;
                    entry.maxCapturas = m;
                    entry.maxBrocas = m;
                }
                if (r.is_instalacao) entry.instalacoes++;
                if (r.is_recolhimento) entry.recolhimentos++;
                if (m === 0) entry.zerados++;
                if (m > 0) entry.positivos++;
            });

            return Object.values(map).map(e => {
                const mediaRecolh = e.recolhimentos > 0
                    ? Math.round((e.totalMachos / e.recolhimentos) * 10) / 10
                    : 0;

                let nivelRisco = "Sem Recolhimento";
                let badgeClass = "badge-slate";

                if (e.recolhimentos > 0) {
                    if (e.totalMachos === 0) {
                        nivelRisco = "Negativo (Zero)";
                        badgeClass = "badge-emerald";
                    } else if (e.maxMachos <= 10) {
                        nivelRisco = "Baixo (1-10)";
                        badgeClass = "badge-blue";
                    } else if (e.maxMachos <= 25) {
                        nivelRisco = "Médio (11-25)";
                        badgeClass = "badge-amber";
                    } else {
                        nivelRisco = "Foco Crítico (>25)";
                        badgeClass = "badge-red";
                    }
                }

                return {
                    ...e,
                    mediaRecolh: mediaRecolh,
                    nivelRisco: nivelRisco,
                    badgeClass: badgeClass
                };
            }).sort((a, b) => b.totalMachos - a.totalMachos || b.maxMachos - a.maxMachos);
        },

        /**
         * Estatísticas por Responsável Técnico
         */
        computeResponsibleStats: function (records) {
            const map = {};

            records.forEach(r => {
                const nome = r.responsavel_nome || 'N/I';
                const m = r.machos || 0;

                if (!map[nome]) {
                    map[nome] = {
                        nome: nome,
                        display: r.responsavel_display,
                        totalMachos: 0,
                        totalLancamentos: 0,
                        instalacoes: 0,
                        recolhimentos: 0,
                        zerados: 0,
                        positivos: 0,
                        talhoes: new Set()
                    };
                }
                const entry = map[nome];
                entry.totalMachos += m;
                entry.totalLancamentos++;
                if (r.is_instalacao) entry.instalacoes++;
                if (r.is_recolhimento) entry.recolhimentos++;
                if (m === 0) entry.zerados++;
                if (m > 0) entry.positivos++;
                if (r.local_orig) entry.talhoes.add(r.local_orig);
            });

            return Object.values(map).map(e => ({
                ...e,
                talhoesCount: e.talhoes.size,
                mediaPorRecolhimento: e.recolhimentos > 0
                    ? Math.round((e.totalMachos / e.recolhimentos) * 10) / 10
                    : 0
            })).sort((a, b) => b.totalLancamentos - a.totalLancamentos);
        },

        /**
         * Evolução Temporal (Diária / Semanal / Mensal)
         */
        computeTemporalAnalytics: function (records, mode) {
            const map = {};

            records.forEach(r => {
                let key;
                if (mode === 'mes') {
                    key = r.data_iso ? r.data_iso.substring(0, 7) : '2026-09';
                } else if (mode === 'semana') {
                    key = r.data_dia ? r.data_dia.substring(3) : 'Semana';
                } else {
                    key = r.data_dia ? r.data_dia.substring(0, 5) : 'Dia';
                }

                if (!map[key]) {
                    map[key] = {
                        label: key,
                        totalLancamentos: 0,
                        totalMachos: 0,
                        instalacoes: 0,
                        recolhimentos: 0,
                        positivos: 0
                    };
                }
                const entry = map[key];
                entry.totalLancamentos++;
                entry.totalMachos += (r.machos || 0);
                if (r.is_instalacao) entry.instalacoes++;
                if (r.is_recolhimento) entry.recolhimentos++;
                if (r.machos > 0) entry.positivos++;
            });

            return Object.values(map);
        },

        /**
         * Distribuição por Faixas de Gravidade de Captura
         */
        computeSeverityDistribution: function (records) {
            const classes = {
                "Instalação (Ciclo Iniciado)": 0,
                "Zero Capturas (Negativo)": 0,
                "Baixa Captura (1-10)": 0,
                "Média Captura (11-25)": 0,
                "Foco Crítico (> 25)": 0
            };

            records.forEach(r => {
                if (r.is_instalacao) {
                    classes["Instalação (Ciclo Iniciado)"]++;
                } else {
                    const m = r.machos || 0;
                    if (m === 0) classes["Zero Capturas (Negativo)"]++;
                    else if (m <= 10) classes["Baixa Captura (1-10)"]++;
                    else if (m <= 25) classes["Média Captura (11-25)"]++;
                    else classes["Foco Crítico (> 25)"]++;
                }
            });

            return classes;
        },

        /**
         * Filtragem Reativa Multidimensional
         */
        filterRecords: function (records, filters) {
            return records.filter(r => {
                if (filters.dataInicio) {
                    if (r.data_iso && r.data_iso.substring(0, 10) < filters.dataInicio) return false;
                }
                if (filters.dataFim) {
                    if (r.data_iso && r.data_iso.substring(0, 10) > filters.dataFim) return false;
                }
                if (filters.fazenda && filters.fazenda !== 'TODAS') {
                    if (r.fazenda !== filters.fazenda) return false;
                }
                if (filters.talhao && filters.talhao !== 'TODOS') {
                    if (r.talhao !== filters.talhao) return false;
                }
                if (filters.etapa && filters.etapa !== 'TODAS') {
                    if (r.etapa !== filters.etapa) return false;
                }
                if (filters.responsavel && filters.responsavel !== 'TODOS') {
                    if (r.responsavel_nome !== filters.responsavel) return false;
                }
                if (filters.faixaGravidade && filters.faixaGravidade !== 'TODAS') {
                    if (filters.faixaGravidade === 'ZERO' && r.machos !== 0) return false;
                    if (filters.faixaGravidade === 'POSITIVO' && r.machos <= 0) return false;
                    if (filters.faixaGravidade === 'CRITICO' && r.machos <= 25) return false;
                }
                if (filters.somentePositivos) {
                    if (r.machos <= 0) return false;
                }
                if (filters.somenteRecolhimento) {
                    if (!r.is_recolhimento) return false;
                }
                if (filters.somenteCoords) {
                    if (!r.has_coords) return false;
                }
                if (filters.buscaTexto) {
                    const q = filters.buscaTexto.toLowerCase();
                    const match = String(r.id).includes(q) ||
                        (r.fazenda && r.fazenda.toLowerCase().includes(q)) ||
                        (r.talhao && r.talhao.toLowerCase().includes(q)) ||
                        (r.local_orig && r.local_orig.toLowerCase().includes(q)) ||
                        (r.responsavel_nome && r.responsavel_nome.toLowerCase().includes(q)) ||
                        (r.etapa && r.etapa.toLowerCase().includes(q)) ||
                        (r.usuario && r.usuario.toLowerCase().includes(q));
                    if (!match) return false;
                }
                return true;
            });
        }
    };

    window.BrocaEngine = BrocaEngine;
})(window);
