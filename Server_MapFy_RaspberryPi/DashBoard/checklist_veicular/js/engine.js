/**
 * engine.js
 * =========
 * Motor de Inteligência Analítica para Gestão de Frota, Inspeção Veicular e Avarias
 * Usina Pitangueiras • Safra 2026
 */

const ChecklistEngine = (function () {
    'use strict';

    /**
     * Categorias oficiais de componentes
     */
    const COMPONENT_CATEGORIES = {
        "Luz de Placa": "Iluminação e Sinalização",
        "Luz Baixa": "Iluminação e Sinalização",
        "Lanterna": "Iluminação e Sinalização",
        "Luz de Ré": "Iluminação e Sinalização",
        "Luz de Freio": "Iluminação e Sinalização",
        "Luz Alta": "Iluminação e Sinalização",
        "Para-choque Dianteiro": "Carroceria e Estrutura",
        "Para-choque Traseiro": "Carroceria e Estrutura",
        "Portas": "Carroceria e Estrutura",
        "Esguicho": "Visibilidade e Vidros",
        "Limpador de Para-brisa": "Visibilidade e Vidros",
        "Acionador de Vidros": "Visibilidade e Vidros",
        "Ar-Condicionado": "Climatização e Conforto",
        "Estado dos Bancos": "Climatização e Conforto",
        "Macaco /Chave de Roda": "Segurança e Emergência",
        "Macaco / Chave de Roda": "Segurança e Emergência",
        "Triângulo": "Segurança e Emergência",
        "Sistema de Suspensão": "Segurança e Emergência"
    };

    /**
     * 1. Cálculo dos 10 KPIs Executivos Principais
     */
    function calculateKPIs(records) {
        const total = records.length;
        if (total === 0) {
            return {
                totalInspecoes: 0,
                veiculosDistintos: 0,
                condutoresDistintos: 0,
                gestoresDistintos: 0,
                mediaInspecoesPorVeiculo: 0,
                criticidadeLeve: 0,
                percLeve: 0,
                criticidadeModerado: 0,
                percModerado: 0,
                criticidadeOutros: 0,
                inspecoesComAvarias: 0,
                percComAvarias: 0,
                inspecoesSemAvarias: 0,
                totalComponentesDanificados: 0,
                videotelemetriaSim: 0,
                percVideoSim: 0,
                videotelemetriaNao: 0,
                abrirOsSim: 0,
                percOsSim: 0,
                comNumeroOs: 0,
                semNumeroOs: 0,
                frotasVaziasOuObs: 0,
                inconsistenciasCount: 0
            };
        }

        const veiculosSet = new Set();
        const condutoresSet = new Set();
        const gestoresSet = new Set();

        let leveCount = 0;
        let modCount = 0;
        let outrosCritCount = 0;
        let comAvariaCount = 0;
        let semAvariaCount = 0;
        let totalComps = 0;
        let videoSimCount = 0;
        let videoNaoCount = 0;
        let abrirOsCount = 0;
        let comNumOsCount = 0;
        let semNumOsCount = 0;
        let frotasObsCount = 0;
        let inconsCount = 0;

        records.forEach(r => {
            if (r.frota_codigo && r.frota_codigo !== "NÃO_IDENTIFICADA") {
                veiculosSet.add(r.frota_codigo);
            }
            if (r.condutor && r.condutor !== "NÃO INFORMADO") {
                condutoresSet.add(r.condutor.trim());
            }
            if (r.gestor && r.gestor !== "NÃO INFORMADO") {
                gestoresSet.add(r.gestor.trim());
            }

            if (r.criticidade === "Leve") leveCount++;
            else if (r.criticidade === "Moderado") modCount++;
            else outrosCritCount++;

            if (r.tem_avaria) comAvariaCount++;
            else semAvariaCount++;

            totalComps += (r.qtd_componentes || 0);

            if (r.videotelemetria === "SIM") videoSimCount++;
            else videoNaoCount++;

            if (r.abrir_os === "SIM") {
                abrirOsCount++;
                if (r.os_numero) comNumOsCount++;
                else semNumOsCount++;
            } else if (r.os_numero) {
                comNumOsCount++;
            }

            if (r.frota_identificacao_obs) frotasObsCount++;
            if (r.tem_inconsistencia) inconsCount++;
        });

        const vDist = veiculosSet.size || 1;

        return {
            totalInspecoes: total,
            veiculosDistintos: veiculosSet.size,
            condutoresDistintos: condutoresSet.size,
            gestoresDistintos: gestoresSet.size,
            mediaInspecoesPorVeiculo: parseFloat((total / vDist).toFixed(1)),
            criticidadeLeve: leveCount,
            percLeve: parseFloat(((leveCount / total) * 100).toFixed(1)),
            criticidadeModerado: modCount,
            percModerado: parseFloat(((modCount / total) * 100).toFixed(1)),
            criticidadeOutros: outrosCritCount,
            inspecoesComAvarias: comAvariaCount,
            percComAvarias: parseFloat(((comAvariaCount / total) * 100).toFixed(1)),
            inspecoesSemAvarias: semAvariaCount,
            totalComponentesDanificados: totalComps,
            videotelemetriaSim: videoSimCount,
            percVideoSim: parseFloat(((videoSimCount / total) * 100).toFixed(1)),
            videotelemetriaNao: videoNaoCount,
            abrirOsSim: abrirOsCount,
            percOsSim: parseFloat(((abrirOsCount / total) * 100).toFixed(1)),
            comNumeroOs: comNumOsCount,
            semNumeroOs: semNumOsCount,
            frotasVaziasOuObs: frotasObsCount,
            inconsistenciasCount: inconsCount
        };
    }

    /**
     * 2. Distribuição da Criticidade Veicular
     */
    function buildCriticidadeDistribution(records) {
        const groups = {
            "Leve (Liberado)": { total: 0, veiculos: new Set(), comAvaria: 0 },
            "Moderado (Condutor notificado)": { total: 0, veiculos: new Set(), comAvaria: 0 },
            "Não Classificado": { total: 0, veiculos: new Set(), comAvaria: 0 }
        };

        records.forEach(r => {
            let key = "Não Classificado";
            if (r.criticidade === "Leve") key = "Leve (Liberado)";
            else if (r.criticidade === "Moderado") key = "Moderado (Condutor notificado)";

            groups[key].total++;
            if (r.frota_codigo) groups[key].veiculos.add(r.frota_codigo);
            if (r.tem_avaria) groups[key].comAvaria++;
        });

        return Object.entries(groups).map(([label, data]) => ({
            label,
            total: data.total,
            perc: records.length > 0 ? parseFloat(((data.total / records.length) * 100).toFixed(1)) : 0,
            veiculosDistintos: data.veiculos.size,
            comAvaria: data.comAvaria
        }));
    }

    /**
     * 3. Ranking de Componentes Danificados e Agrupamento por Categoria
     */
    function buildComponentesRanking(records) {
        const compMap = {};
        const catMap = {
            "Iluminação e Sinalização": { total: 0, comps: 0 },
            "Carroceria e Estrutura": { total: 0, comps: 0 },
            "Visibilidade e Vidros": { total: 0, comps: 0 },
            "Climatização e Conforto": { total: 0, comps: 0 },
            "Segurança e Emergência": { total: 0, comps: 0 },
            "Outros Componentes": { total: 0, comps: 0 }
        };

        records.forEach(r => {
            if (Array.isArray(r.componentes)) {
                r.componentes.forEach(c => {
                    const nome = c.nome || "Não Especificado";
                    const codigo = c.codigo || "";
                    const categoria = c.categoria || COMPONENT_CATEGORIES[nome] || "Outros Componentes";

                    if (!compMap[nome]) {
                        compMap[nome] = {
                            nome,
                            codigo,
                            categoria,
                            totalOcorrencias: 0,
                            veiculos: new Set(),
                            gestores: new Set(),
                            condutores: new Set(),
                            comOS: 0,
                            semOS: 0,
                            criticidadeLeve: 0,
                            criticidadeModerado: 0
                        };
                    }

                    const item = compMap[nome];
                    item.totalOcorrencias++;
                    if (r.frota_codigo) item.veiculos.add(r.frota_codigo);
                    if (r.gestor) item.gestores.add(r.gestor);
                    if (r.condutor) item.condutores.add(r.condutor);
                    if (r.os_numero) item.comOS++;
                    else item.semOS++;

                    if (r.criticidade === "Leve") item.criticidadeLeve++;
                    else if (r.criticidade === "Moderado") item.criticidadeModerado++;

                    if (!catMap[categoria]) {
                        catMap[categoria] = { total: 0, comps: 0 };
                    }
                    catMap[categoria].total++;
                });
            }
        });

        const rankingList = Object.values(compMap).map(c => ({
            nome: c.nome,
            codigo: c.codigo,
            categoria: c.categoria,
            totalOcorrencias: c.totalOcorrencias,
            veiculosCount: c.veiculos.size,
            gestoresCount: c.gestores.size,
            condutoresCount: c.condutores.size,
            comOS: c.comOS,
            semOS: c.semOS,
            criticidadeLeve: c.criticidadeLeve,
            criticidadeModerado: c.criticidadeModerado
        })).sort((a, b) => b.totalOcorrencias - a.totalOcorrencias);

        // Contar quantos componentes distintos em cada categoria
        rankingList.forEach(r => {
            if (catMap[r.categoria]) catMap[r.categoria].comps++;
        });

        const categoriesList = Object.entries(catMap).map(([nome, data]) => ({
            categoria: nome,
            totalOcorrencias: data.total,
            componentesDistintos: data.comps
        })).sort((a, b) => b.totalOcorrencias - a.totalOcorrencias);

        return {
            ranking: rankingList,
            categorias: categoriesList
        };
    }

    /**
     * 4. Ficha Digital / Prontuário Individual do Veículo (Diferencial 1)
     */
    function buildProntuarioVeiculo(records, frotaCodigo) {
        if (!frotaCodigo) return null;

        const vRecords = records.filter(r => r.frota_codigo === frotaCodigo);
        if (vRecords.length === 0) return null;

        // Ordenar cronologicamente decrescente (mais recente primeiro)
        vRecords.sort((a, b) => {
            const dA = a.data_iso || "";
            const dB = b.data_iso || "";
            return dB.localeCompare(dA);
        });

        const maisRecente = vRecords[0];
        const maisAntiga = vRecords[vRecords.length - 1];

        // Mapear componentes danificados e datas
        const compHistorico = {};
        const condutoresHistorico = new Set();
        const gestoresHistorico = new Set();
        const osList = [];
        let totalComps = 0;
        let totalMod = 0;
        let totalLeve = 0;

        vRecords.forEach(r => {
            if (r.condutor && r.condutor !== "NÃO INFORMADO") condutoresHistorico.add(r.condutor);
            if (r.gestor && r.gestor !== "NÃO INFORMADO") gestoresHistorico.add(r.gestor);
            if (r.os_numero && !osList.includes(r.os_numero)) osList.push(r.os_numero);

            if (r.criticidade === "Moderado") totalMod++;
            else if (r.criticidade === "Leve") totalLeve++;

            if (Array.isArray(r.componentes)) {
                r.componentes.forEach(c => {
                    totalComps++;
                    if (!compHistorico[c.nome]) {
                        compHistorico[c.nome] = {
                            nome: c.nome,
                            codigo: c.codigo,
                            categoria: c.categoria,
                            ocorrencias: 0,
                            datas: []
                        };
                    }
                    compHistorico[c.nome].ocorrencias++;
                    compHistorico[c.nome].datas.push(r.data_dia || r.data);
                });
            }
        });

        // Identificar reincidências no veículo (mesmo componente em datas distintas)
        const reincidencias = [];
        Object.values(compHistorico).forEach(c => {
            const datasUnicas = [...new Set(c.datas)];
            if (c.ocorrencias > 1 && datasUnicas.length > 1) {
                reincidencias.push({
                    componente: c.nome,
                    codigo: c.codigo,
                    ocorrencias: c.ocorrencias,
                    datas: datasUnicas
                });
            }
        });

        return {
            codigo: frotaCodigo,
            modelo: maisRecente.frota_modelo,
            placa: maisRecente.frota_placa || "NÃO IDENTIFICADA",
            tipo: maisRecente.frota_tipo,
            totalInspecoes: vRecords.length,
            inspecoesComAvaria: vRecords.filter(r => r.tem_avaria).length,
            inspecoesSemAvaria: vRecords.filter(r => !r.tem_avaria).length,
            totalComponentes: totalComps,
            totalModerado: totalMod,
            totalLeve: totalLeve,
            ultimaData: maisRecente.data,
            ultimaDataDia: maisRecente.data_dia,
            ultimoStatusCriticidade: maisRecente.criticidade,
            ultimaObs: maisRecente.observacoes,
            ultimaOS: maisRecente.os_numero,
            primeiraData: maisAntiga.data,
            gestorMaisRecente: maisRecente.gestor,
            condutorMaisRecente: maisRecente.condutor,
            todosGestores: [...gestoresHistorico],
            todosCondutores: [...condutoresHistorico],
            todasOS: osList,
            componentesRanking: Object.values(compHistorico).sort((a, b) => b.ocorrencias - a.ocorrencias),
            reincidencias: reincidencias,
            possuiReincidencia: reincidencias.length > 0,
            historicoInspecoes: vRecords
        };
    }

    /**
     * 5. Motor de Inteligência de Reincidência da Frota (Diferencial 2)
     */
    function buildReincidenciaIntelligence(records) {
        // Agrupar inspeções por frota_codigo
        const frotaMap = {};
        records.forEach(r => {
            const f = r.frota_codigo;
            if (!f || f === "NÃO_IDENTIFICADA") return;
            if (!frotaMap[f]) frotaMap[f] = [];
            frotaMap[f].push(r);
        });

        const veiculosReincidentes = [];
        const componentesReincidentesMap = {};

        Object.entries(frotaMap).forEach(([codigo, inspList]) => {
            const prontuario = buildProntuarioVeiculo(inspList, codigo);
            if (prontuario && prontuario.possuiReincidencia) {
                veiculosReincidentes.push({
                    codigo: prontuario.codigo,
                    modelo: prontuario.modelo,
                    placa: prontuario.placa,
                    tipo: prontuario.tipo,
                    totalInspecoes: prontuario.totalInspecoes,
                    totalComponentes: prontuario.totalComponentes,
                    reincidencias: prontuario.reincidencias,
                    totalReincidencias: prontuario.reincidencias.length,
                    ultimaData: prontuario.ultimaData,
                    ultimaCriticidade: prontuario.ultimoStatusCriticidade,
                    gestor: prontuario.gestorMaisRecente
                });

                prontuario.reincidencias.forEach(rc => {
                    if (!componentesReincidentesMap[rc.componente]) {
                        componentesReincidentesMap[rc.componente] = {
                            componente: rc.componente,
                            codigo: rc.codigo,
                            veiculosCount: 0,
                            totalCasos: 0
                        };
                    }
                    componentesReincidentesMap[rc.componente].veiculosCount++;
                    componentesReincidentesMap[rc.componente].totalCasos += rc.ocorrencias;
                });
            }
        });

        // Ordenar veículos por maior número de itens reincidentes
        veiculosReincidentes.sort((a, b) => b.totalReincidencias - a.totalReincidencias || b.totalComponentes - a.totalComponentes);

        const componentesRanking = Object.values(componentesReincidentesMap).sort((a, b) => b.veiculosCount - a.veiculosCount);

        return {
            totalVeiculosReincidentes: veiculosReincidentes.length,
            veiculos: veiculosReincidentes,
            componentesRanking: componentesRanking
        };
    }

    /**
     * 6. Matriz de Videotelemetria x Avarias (Diferencial 3)
     */
    function buildVideotelemetriaMatrix(records) {
        let simComAvaria = 0;
        let simSemAvaria = 0;
        let naoComAvaria = 0;
        let naoSemAvaria = 0;

        const porTipo = {
            "ALUGADO": { sim: 0, nao: 0 },
            "PRÓPRIO": { sim: 0, nao: 0 },
            "OUTRO": { sim: 0, nao: 0 }
        };

        records.forEach(r => {
            const isSim = r.videotelemetria === "SIM";
            const temAvaria = r.tem_avaria;

            if (isSim && temAvaria) simComAvaria++;
            else if (isSim && !temAvaria) simSemAvaria++;
            else if (!isSim && temAvaria) naoComAvaria++;
            else naoSemAvaria++;

            const tp = r.frota_tipo === "ALUGADO" ? "ALUGADO" : (r.frota_tipo === "PRÓPRIO" ? "PRÓPRIO" : "OUTRO");
            if (isSim) porTipo[tp].sim++;
            else porTipo[tp].nao++;
        });

        const total = records.length || 1;

        return {
            total,
            simComAvaria,
            simSemAvaria,
            naoComAvaria,
            naoSemAvaria,
            percSimComAvaria: parseFloat(((simComAvaria / total) * 100).toFixed(1)),
            percSimSemAvaria: parseFloat(((simSemAvaria / total) * 100).toFixed(1)),
            percNaoComAvaria: parseFloat(((naoComAvaria / total) * 100).toFixed(1)),
            percNaoSemAvaria: parseFloat(((naoSemAvaria / total) * 100).toFixed(1)),
            porTipo
        };
    }

    /**
     * 7. Análise de Ordens de Serviço (Manutenção x Avarias)
     */
    function buildManutencaoAnalysis(records) {
        let comNumero = 0;
        let solicitadaSemNumero = 0;
        let semSolicitacao = 0;
        let diretaComNumero = 0;

        const osCadastradas = {};

        records.forEach(r => {
            if (r.abrir_os === "SIM" && r.os_numero) comNumero++;
            else if (r.abrir_os === "SIM" && !r.os_numero) solicitadaSemNumero++;
            else if (r.abrir_os === "NÃO" && r.os_numero) diretaComNumero++;
            else semSolicitacao++;

            if (r.os_numero) {
                if (!osCadastradas[r.os_numero]) {
                    osCadastradas[r.os_numero] = {
                        numero: r.os_numero,
                        veiculo: r.frota_codigo,
                        modelo: r.frota_modelo,
                        gestor: r.gestor,
                        condutor: r.condutor,
                        data: r.data_dia || r.data,
                        criticidade: r.criticidade,
                        componentes: (r.componentes || []).map(c => c.nome).join(", ") || "Sem item listado",
                        obs: r.observacoes,
                        inspecoesCount: 0
                    };
                }
                osCadastradas[r.os_numero].inspecoesCount++;
            }
        });

        return {
            comNumero,
            solicitadaSemNumero,
            semSolicitacao,
            diretaComNumero,
            totalOSUnicas: Object.keys(osCadastradas).length,
            listaOS: Object.values(osCadastradas).sort((a, b) => b.numero.localeCompare(a.numero))
        };
    }

    /**
     * 8. Análise de Gestores
     */
    function buildGestoresAnalysis(records) {
        const gestoresMap = {};

        records.forEach(r => {
            const g = r.gestor || "NÃO INFORMADO";
            if (!gestoresMap[g]) {
                gestoresMap[g] = {
                    gestor: g,
                    inspecoes: 0,
                    veiculos: new Set(),
                    comAvaria: 0,
                    componentesDanificados: 0,
                    moderados: 0,
                    comOS: 0,
                    videoSim: 0
                };
            }

            const item = gestoresMap[g];
            item.inspecoes++;
            if (r.frota_codigo) item.veiculos.add(r.frota_codigo);
            if (r.tem_avaria) item.comAvaria++;
            item.componentesDanificados += (r.qtd_componentes || 0);
            if (r.criticidade === "Moderado") item.moderados++;
            if (r.os_numero) item.comOS++;
            if (r.videotelemetria === "SIM") item.videoSim++;
        });

        return Object.values(gestoresMap).map(g => ({
            gestor: g.gestor,
            inspecoes: g.inspecoes,
            veiculosCount: g.veiculos.size,
            comAvaria: g.comAvaria,
            taxaAvaria: g.inspecoes > 0 ? parseFloat(((g.comAvaria / g.inspecoes) * 100).toFixed(1)) : 0,
            componentesDanificados: g.componentesDanificados,
            moderados: g.moderados,
            comOS: g.comOS,
            videoSim: g.videoSim
        })).sort((a, b) => b.inspecoes - a.inspecoes);
    }

    /**
     * 9. Análise de Condutores (Objetiva, sem juízo de valor)
     */
    function buildCondutoresAnalysis(records) {
        const condutoresMap = {};

        records.forEach(r => {
            const c = r.condutor || "NÃO INFORMADO";
            if (!condutoresMap[c]) {
                condutoresMap[c] = {
                    condutor: c,
                    inspecoes: 0,
                    veiculos: new Set(),
                    comAvaria: 0,
                    moderados: 0,
                    videoSim: 0,
                    ultimaInspecao: r.data_dia || r.data
                };
            }

            const item = condutoresMap[c];
            item.inspecoes++;
            if (r.frota_codigo) item.veiculos.add(r.frota_codigo);
            if (r.tem_avaria) item.comAvaria++;
            if (r.criticidade === "Moderado") item.moderados++;
            if (r.videotelemetria === "SIM") item.videoSim++;
        });

        return Object.values(condutoresMap).map(c => ({
            condutor: c.condutor,
            inspecoes: c.inspecoes,
            veiculosCount: c.veiculos.size,
            comAvaria: c.comAvaria,
            taxaAvaria: c.inspecoes > 0 ? parseFloat(((c.comAvaria / c.inspecoes) * 100).toFixed(1)) : 0,
            moderados: c.moderados,
            videoSim: c.videoSim,
            ultimaInspecao: c.ultimaInspecao
        })).sort((a, b) => b.inspecoes - a.inspecoes);
    }

    /**
     * 10. Série Temporal (Evolução Diária com Filtros Rápidos: Todos, 15D, 7D)
     */
    function buildTimeSeries(records, range = 'ALL') {
        const daysMap = {};

        records.forEach(r => {
            const d = r.data_dia;
            if (!d) return;

            if (!daysMap[d]) {
                daysMap[d] = {
                    dataDia: d,
                    total: 0,
                    leve: 0,
                    moderado: 0,
                    comAvaria: 0,
                    comps: 0
                };
            }

            const item = daysMap[d];
            item.total++;
            if (r.criticidade === "Leve") item.leve++;
            else if (r.criticidade === "Moderado") item.moderado++;
            if (r.tem_avaria) item.comAvaria++;
            item.comps += (r.qtd_componentes || 0);
        });

        // Converter DD/MM/AAAA para chave ordenável
        let list = Object.values(daysMap).sort((a, b) => {
            const pA = a.dataDia.split('/');
            const pB = b.dataDia.split('/');
            if (pA.length === 3 && pB.length === 3) {
                const dateA = new Date(pA[2], pA[1] - 1, pA[0]);
                const dateB = new Date(pB[2], pB[1] - 1, pB[0]);
                return dateA - dateB;
            }
            return a.dataDia.localeCompare(b.dataDia);
        });

        if (range === '7D' && list.length > 7) {
            list = list.slice(-7);
        } else if (range === '15D' && list.length > 15) {
            list = list.slice(-15);
        }

        return {
            labels: list.map(d => d.dataDia),
            totais: list.map(d => d.total),
            leves: list.map(d => d.leve),
            moderados: list.map(d => d.moderado),
            comAvarias: list.map(d => d.comAvaria),
            componentes: list.map(d => d.comps)
        };
    }

    /**
     * 11. Lista dos Veículos que Demandam Atenção Prioritária
     */
    function buildVeiculosAtencaoPrioritaria(records) {
        const fMap = {};
        records.forEach(r => {
            const f = r.frota_codigo;
            if (!f || f === "NÃO_IDENTIFICADA") return;
            if (!fMap[f]) {
                fMap[f] = {
                    codigo: f,
                    modelo: r.frota_modelo,
                    placa: r.frota_placa,
                    tipo: r.frota_tipo,
                    gestor: r.gestor,
                    inspecoes: 0,
                    moderados: 0,
                    leves: 0,
                    comAvaria: 0,
                    compsDanificados: 0,
                    comOS: 0,
                    semOS: 0,
                    ultimaData: r.data
                };
            }

            const item = fMap[f];
            item.inspecoes++;
            if (r.criticidade === "Moderado") item.moderados++;
            else item.leves++;
            if (r.tem_avaria) item.comAvaria++;
            item.compsDanificados += (r.qtd_componentes || 0);
            if (r.os_numero) item.comOS++;
            else if (r.abrir_os === "SIM") item.semOS++;
        });

        // Filtrar veículos que possuem ao menos 1 ocorrência moderada OU componentes danificados
        return Object.values(fMap)
            .filter(v => v.moderados > 0 || v.compsDanificados > 0)
            .sort((a, b) => b.moderados - a.moderados || b.compsDanificados - a.compsDanificados);
    }

    /**
     * Normaliza registro bruto do MapFy para a estrutura analítica padrão da frota
     */
    function normalizeRecord(r) {
        if (!r) return null;
        const lat = parseFloat(String(r['Latitude'] || r.lat || '').replace(',', '.'));
        const lon = parseFloat(String(r['Longitude'] || r.lon || r.lng || '').replace(',', '.'));
        const dataStr = String(r['Data'] || r['Date'] || r.data || r.date || '').trim();
        const dataDia = dataStr.includes(' ') ? dataStr.split(' ')[0] : dataStr;

        // Parse frota
        const frotaRaw = String(r['Frota'] || r.frota || '').trim();
        let frotaCodigo = 'NÃO_IDENTIFICADA';
        let frotaModelo = frotaRaw;
        let frotaPlaca = '';

        if (frotaRaw.includes('-')) {
            const parts = frotaRaw.split('-');
            frotaCodigo = parts[0].trim();
            frotaModelo = parts.slice(1).join('-').trim();
        }
        const placaMatch = frotaRaw.match(/\(([^)]+)\)/);
        if (placaMatch) {
            frotaPlaca = placaMatch[1].trim();
        }

        // Criticidade
        const critRaw = String(r['Estado de Criticidade Veículo'] || r.criticidade || '').trim();
        let criticidade = 'Outros';
        if (critRaw.toLowerCase().startsWith('leve')) criticidade = 'Leve';
        else if (critRaw.toLowerCase().startsWith('moderado')) criticidade = 'Moderado';

        // Videotelemetria
        const videoRaw = String(r['VIDEOTELEMTRIA'] || r.videotelemetria || '').trim().toUpperCase();
        const videotelemetria = videoRaw === 'SIM' ? 'SIM' : 'NÃO';

        // Abrir OS
        const abrirOsRaw = String(r['Abrir Os '] || r['Abrir Os'] || r.abrir_os || '').trim().toUpperCase();
        const abrirOs = abrirOsRaw === 'SIM' ? 'SIM' : 'NÃO';
        const osNumero = r['Os'] || r.os_numero || '';

        // Itens Danificados
        const itensDanificadosRaw = r['Itens Danificados'] || r.itens_danificados || '';
        let componentes = [];
        if (itensDanificadosRaw && itensDanificadosRaw !== '-' && itensDanificadosRaw.trim() !== '') {
            const parts = itensDanificadosRaw.split(/[;,]/).map(c => c.trim()).filter(Boolean);
            componentes = parts.map(p => {
                let nome = p;
                let codigo = '';
                const match = p.match(/^([^(]+)(?:\(([^)]+)\))?/);
                if (match) {
                    nome = match[1].trim();
                    codigo = match[2] ? match[2].trim() : '';
                }
                const nomeSemNum = nome.replace(/^\d+[\.\-\s]\s*/, '').trim();
                const categoria = COMPONENT_CATEGORIES[nomeSemNum] || COMPONENT_CATEGORIES[nome] || "Outros Componentes";
                return {
                    nome: nomeSemNum || nome,
                    nomeOriginal: p,
                    codigo: codigo,
                    categoria: categoria
                };
            });
        }
        const temAvaria = componentes.length > 0;

        return {
            id: String(r['ID'] || r['\ufeffID'] || r['Id'] || r.id || ''),
            usuario: r['Usuário'] || r['User'] || r.usuario || '',
            data: dataStr,
            data_dia: dataDia,
            data_inicio: r['Data início'] || r['Start date'] || r.data_inicio || '',
            data_fim: r['Data Fim'] || r['End date'] || r.data_fim || '',
            status: r['Status'] || r.status || 'Aberto',
            score: r['Score'] || r.score || '0,00',
            frota_raw: frotaRaw,
            frota_codigo: frotaCodigo,
            frota_modelo: frotaModelo,
            frota_placa: frotaPlaca,
            gestor: String(r['GESTORES'] || r.gestor || 'NÃO INFORMADO').trim(),
            condutor: String(r['Condutor'] || r.condutor || 'NÃO INFORMADO').trim(),
            criticidade: criticidade,
            criticidade_raw: critRaw,
            videotelemetria: videotelemetria,
            abrir_os: abrirOs,
            os_numero: osNumero,
            itens_danificados: itensDanificadosRaw,
            componentes: componentes,
            qtd_componentes: componentes.length,
            tem_avaria: temAvaria,
            observacoes: r['Observacoes'] || r.observacoes || '',
            id_colaborador: r['ID COLABORADOR'] || '',
            id_avaliador: r['ID DO AVALIADOR(A)'] || '',
            lat: isNaN(lat) ? null : lat,
            lon: isNaN(lon) ? null : lon,
            has_coords: !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0,
            _raw: r
        };
    }

    return {
        COMPONENT_CATEGORIES,
        calculateKPIs,
        buildCriticidadeDistribution,
        buildComponentesRanking,
        buildProntuarioVeiculo,
        buildReincidenciaIntelligence,
        buildVideotelemetriaMatrix,
        buildManutencaoAnalysis,
        buildGestoresAnalysis,
        buildCondutoresAnalysis,
        buildTimeSeries,
        buildVeiculosAtencaoPrioritaria,
        normalizeRecord
    };
})();

if (typeof window !== 'undefined') {
    window.ChecklistEngine = ChecklistEngine;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChecklistEngine;
}
