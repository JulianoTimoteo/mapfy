/**
 * broca_engine.js
 * Motor de Inteligência Agronômica e Entomológica para Monitoramento de Broca por Armadilha
 * Usina Pitangueiras - Safra 2026
 * 
 * Em conformidade estrita com o MANUAL TÉCNICO AGRONÔMICO (Página 61 & 62):
 * - Regra para Cana-Soca: Presença de 6 adultos em 30% das armadilhas amostradas.
 * - Distinção entre Instalação (início do ciclo) e Recolhimento (amostragem efetiva).
 * - Exclusão de instalações do denominador de infestação.
 * - Auditoria e rastreabilidade total (fórmula, numerador, denominador e exclusões).
 */

(function (window) {
    'use strict';

    const CRITERIA_CONFIG = {
        ADULTOS_POR_ARMADILHA_MINIMO: 6,             // Presença mínima de 6 adultos para armadilha positiva
        PERCENTUAL_ARMADILHAS_CRITERIO_MINIMO: 30.0, // Limite de 30% das armadilhas amostradas
        HECTARES_POR_ARMADILHA_NOMINAL: 50,          // Mínimo de 1 armadilha a cada 50 ha (Pág. 61)
        DIAS_CAMPO_IDEAL_MIN: 3,                     // Armadilha no campo de 3 a 4 dias (Pág. 62)
        DIAS_CAMPO_IDEAL_MAX: 4
    };

    const BrocaEngine = {
        CRITERIA_CONFIG: CRITERIA_CONFIG,

        /**
         * Normaliza qualquer formato de data (BR DD/MM/YYYY ou US MM/DD/YYYY AM/PM)
         */
        parseDateSmart: function (raw) {
            if (!raw) return { dataStr: '', dataDia: '', dataIso: '' };
            const s = String(raw).trim();
            const isAmPm = /am|pm/i.test(s);
            const datePart = s.split(' ')[0];
            if (!datePart.includes('/')) {
                if (datePart.includes('-') && datePart.length === 10) {
                    const p = datePart.split('-');
                    return { dataStr: s, dataDia: `${p[2]}/${p[1]}/${p[0]}`, dataIso: datePart };
                }
                return { dataStr: s, dataDia: datePart, dataIso: '' };
            }
            const parts = datePart.split('/');
            if (parts.length !== 3) return { dataStr: s, dataDia: datePart, dataIso: '' };
            let d, m, y;
            if (parts[2].length === 4) {
                y = parts[2];
                const p0 = parseInt(parts[0], 10);
                const p1 = parseInt(parts[1], 10);
                if (p0 > 12) {
                    d = String(p0).padStart(2, '0');
                    m = String(p1).padStart(2, '0');
                } else if (p1 > 12 || isAmPm) {
                    m = String(p0).padStart(2, '0');
                    d = String(p1).padStart(2, '0');
                } else {
                    d = String(p0).padStart(2, '0');
                    m = String(p1).padStart(2, '0');
                }
            } else {
                d = parts[0].padStart(2, '0');
                m = parts[1].padStart(2, '0');
                y = parts[2];
            }
            const dataIso = `${y}-${m}-${d}`;
            const dataDia = `${d}/${m}/${y}`;
            const timePart = s.includes(' ') ? s.substring(datePart.length).trim() : '';
            const dataStr = timePart ? `${dataDia} ${timePart}` : dataDia;
            return { dataStr, dataDia, dataIso };
        },

        /**
         * Normaliza registro bruto do MapFy para a estrutura analítica padrão
         */
        normalizeRecord: function (r) {
            if (!r) return null;
            const lat = parseFloat(String(r['Latitude'] || r.lat || '').replace(',', '.'));
            const lon = parseFloat(String(r['Longitude'] || r.lon || r.lng || '').replace(',', '.'));
            const scoreNum = parseFloat(String(r['Score'] || r.score || '').replace(',', '.')) || 0;

            const rawDate = (r['Data'] !== undefined && r['Data'] !== null && String(r['Data']).trim() !== '')
                ? r['Data']
                : (r.data || r['Date'] || r.date || r['Data início'] || r['Start date'] || r['Data Fim'] || r['End date'] || '');
            const parsedDate = (this && typeof this.parseDateSmart === 'function')
                ? this.parseDateSmart(rawDate)
                : BrocaEngine.parseDateSmart(rawDate);
            const dataStr = parsedDate.dataStr;
            const dataDia = parsedDate.dataDia;
            const dataIso = parsedDate.dataIso;

            const etapaRaw = String(r['Etapa'] || r.etapa || '').trim().toUpperCase();
            const isInstalacao = etapaRaw.includes('INSTAL') || etapaRaw.includes('INSTALAÇÃO');
            const isRecolhimento = etapaRaw.includes('RECOLH') || etapaRaw.includes('RECOLHIMENTO');

            // Validação estrita de machos: se ausente ou nulo, é dado incompleto (não zero)
            let machosNum = null;
            let dadoIncompleto = false;
            const rawMachos = r['Quantidade Machos'] !== undefined ? r['Quantidade Machos'] : r.machos;
            if (rawMachos === null || rawMachos === undefined || String(rawMachos).trim() === '') {
                dadoIncompleto = true;
                machosNum = null;
            } else {
                const parsed = parseInt(String(rawMachos).replace(/\D/g, ''), 10);
                if (isNaN(parsed)) {
                    dadoIncompleto = true;
                    machosNum = null;
                } else {
                    machosNum = parsed;
                }
            }

            const localOrig = String(r['Fazenda - Talhão'] || r.local_orig || r.local || '').trim();
            let fazenda = String(r['Fazenda'] || r.fazenda || '').trim();
            let talhao = String(r['Talhão'] || r['Talhao'] || r.talhao || '').trim();
            if (!fazenda || !talhao) {
                if (localOrig.includes('>')) {
                    const parts = localOrig.split('>');
                    if (!fazenda) fazenda = parts[0].trim();
                    if (!talhao) talhao = parts.slice(1).join('>').trim();
                } else if (localOrig.includes('-')) {
                    const parts = localOrig.split('-');
                    if (!fazenda) fazenda = parts[0].trim();
                    if (!talhao) talhao = parts.slice(1).join('-').trim();
                }
            }

            const respNome = String(r['Responsável Lançamento'] || r.responsavel_nome || r.responsavel || 'NÃO INFORMADO').trim();
            const hasCoords = !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;

            const atingeCriterioIndividual = isRecolhimento && !dadoIncompleto && machosNum !== null && machosNum >= CRITERIA_CONFIG.ADULTOS_POR_ARMADILHA_MINIMO;

            return {
                id: String(r['ID'] || r.id || ''),
                usuario: r['Usuário'] || r.usuario || '',
                data: dataStr,
                data_dia: dataDia,
                data_iso: dataIso,
                dataBR: dataDia,
                data_inicio: r['Data início'] || r.data_inicio || '',
                data_fim: r['Data Fim'] || r.data_fim || '',
                status: r['Status'] || r.status || 'Aberto',
                score: r['Score'] || r.score || '0,00',
                score_num: scoreNum,
                responsavel_nome: respNome,
                etapa: etapaRaw,
                is_instalacao: isInstalacao,
                is_recolhimento: isRecolhimento,
                dado_incompleto: dadoIncompleto,
                local_orig: localOrig || `${fazenda} > ${talhao}`,
                fazenda: fazenda,
                talhao: talhao,
                machos: machosNum !== null ? machosNum : 0,
                machos_raw: machosNum,
                atingiu_criterio_individual: atingeCriterioIndividual,
                lat: hasCoords ? lat : null,
                lon: hasCoords ? lon : null,
                has_coords: hasCoords,
                _raw: r
            };
        },

        /**
         * Motor Central de Inteligência Agronômica (Manual Pág. 61)
         */
        computeAgronomicIntelligence: function (records, shapesGeoJson) {
            const norm = (records || []).map(r => r._raw ? r : BrocaEngine.normalizeRecord(r)).filter(Boolean);

            const instalacoes = [];
            const recolhimentos = [];
            const excluidos = [];

            norm.forEach(r => {
                if (r.is_instalacao) {
                    instalacoes.push(r);
                    excluidos.push({
                        registro: r,
                        motivo: 'Etapa de Instalação (início do ciclo, não representa leitura de amostragem)'
                    });
                } else if (r.is_recolhimento) {
                    if (r.dado_incompleto || r.machos_raw === null) {
                        excluidos.push({
                            registro: r,
                            motivo: 'Dado Incompleto (recolhimento sem quantidade de capturas válida)'
                        });
                    } else {
                        recolhimentos.push(r);
                    }
                } else {
                    excluidos.push({
                        registro: r,
                        motivo: 'Etapa não reconhecida no monitoramento'
                    });
                }
            });

            // Deduplicação de recolhimentos
            const vistos = new Set();
            const recolhimentosValidos = [];
            recolhimentos.forEach(r => {
                const chave = `${r.id}_${r.data}_${r.fazenda}_${r.talhao}`;
                if (!vistos.has(chave)) {
                    vistos.add(chave);
                    recolhimentosValidos.push(r);
                } else {
                    excluidos.push({
                        registro: r,
                        motivo: 'Registro Duplicado (mesmo ID, data, fazenda e talhão)'
                    });
                }
            });

            const armadilhasNoCriterio = recolhimentosValidos.filter(r => r.machos >= CRITERIA_CONFIG.ADULTOS_POR_ARMADILHA_MINIMO);
            const armadilhasAbaixoCriterio = recolhimentosValidos.filter(r => r.machos < CRITERIA_CONFIG.ADULTOS_POR_ARMADILHA_MINIMO);

            const totalValidas = recolhimentosValidos.length;
            const totalPositivas = armadilhasNoCriterio.length;
            const percentualNoCriterio = totalValidas > 0 ? (totalPositivas / totalValidas) * 100 : 0;
            const criterioAtingido = percentualNoCriterio >= CRITERIA_CONFIG.PERCENTUAL_ARMADILHAS_CRITERIO_MINIMO;

            const totalBrocas = recolhimentosValidos.reduce((acc, r) => acc + (r.machos || 0), 0);
            const mediaBrocasPorArmadilha = totalValidas > 0 ? totalBrocas / totalValidas : 0;

            // Pareamento de Ciclos: Instalação -> Recolhimento
            const instMap = new Map();
            instalacoes.forEach(inst => {
                const key = `${inst.fazenda}_${inst.talhao}`;
                if (!instMap.has(key)) instMap.set(key, []);
                instMap.get(key).push(inst);
            });

            const ciclosPareados = [];
            const recolhimentosOrfaos = [];
            recolhimentosValidos.forEach(rec => {
                const key = `${rec.fazenda}_${rec.talhao}`;
                const candidates = instMap.get(key);
                if (candidates && candidates.length > 0) {
                    const inst = candidates.shift();
                    ciclosPareados.push({ instalacao: inst, recolhimento: rec, key: key });
                } else {
                    recolhimentosOrfaos.push(rec);
                }
            });

            const instalacoesPendentes = [];
            instMap.forEach((list) => {
                list.forEach(inst => instalacoesPendentes.push(inst));
            });

            // Cruzamento Territorial com Shapes do GeoJSON
            let areaTalhoesMonitoradosHa = 0;
            let areaTalhoesNoCriterioHa = 0;
            const talhoesMap = new Map();

            if (shapesGeoJson && shapesGeoJson.features) {
                const shapesIndex = new Map();
                shapesGeoJson.features.forEach(f => {
                    const p = f.properties;
                    const key = `${String(p.fazenda).trim()}_${String(p.talhao).trim()}`;
                    shapesIndex.set(key, p);
                });

                recolhimentosValidos.forEach(r => {
                    const key = `${String(r.fazenda).trim()}_${String(r.talhao).trim()}`;
                    if (!talhoesMap.has(key)) {
                        const shape = shapesIndex.get(key);
                        const area = shape ? (parseFloat(shape.area) || 0) : 0;
                        talhoesMap.set(key, {
                            fazenda: r.fazenda,
                            talhao: r.talhao,
                            area: area,
                            machosMax: r.machos,
                            atingiu: r.machos >= CRITERIA_CONFIG.ADULTOS_POR_ARMADILHA_MINIMO
                        });
                    } else {
                        const entry = talhoesMap.get(key);
                        if (r.machos > entry.machosMax) entry.machosMax = r.machos;
                        if (r.machos >= CRITERIA_CONFIG.ADULTOS_POR_ARMADILHA_MINIMO) entry.atingiu = true;
                    }
                });

                talhoesMap.forEach(t => {
                    areaTalhoesMonitoradosHa += t.area;
                    if (t.atingiu) areaTalhoesNoCriterioHa += t.area;
                });
            }

            const coberturaNominalHa = totalValidas * CRITERIA_CONFIG.HECTARES_POR_ARMADILHA_NOMINAL;

            return {
                totalLancamentos: norm.length,
                instalacoesCount: instalacoes.length,
                recolhimentosValidosCount: totalValidas,
                armadilhasNoCriterioCount: totalPositivas,
                armadilhasAbaixoCriterioCount: armadilhasAbaixoCriterio.length,
                percentualNoCriterio: Math.round(percentualNoCriterio * 100) / 100,
                percentualFormatado: (Math.round(percentualNoCriterio * 100) / 100).toFixed(2) + '%',
                limiteReferencia: CRITERIA_CONFIG.PERCENTUAL_ARMADILHAS_CRITERIO_MINIMO,
                criterioAtingido: criterioAtingido,
                statusControle: criterioAtingido ? 'CRITÉRIO ATINGIDO (MANEJO RECOMENDADO)' : 'ABAIXO DO NÍVEL DE CONTROLE',
                totalBrocasCapturadas: totalBrocas,
                mediaBrocasPorArmadilha: Math.round(mediaBrocasPorArmadilha * 100) / 100,
                areaTalhoesMonitoradosHa: Math.round(areaTalhoesMonitoradosHa * 100) / 100,
                areaTalhoesNoCriterioHa: Math.round(areaTalhoesNoCriterioHa * 100) / 100,
                coberturaNominalHa: coberturaNominalHa,
                talhoesMonitoradosCount: talhoesMap.size,
                ciclosPareadosCount: ciclosPareados.length,
                instalacoesPendentesCount: instalacoesPendentes.length,
                recolhimentosOrfaosCount: recolhimentosOrfaos.length,
                excluidosCount: excluidos.length,
                listaNumerador: armadilhasNoCriterio,
                listaDenominador: recolhimentosValidos,
                listaExcluidos: excluidos,
                auditoria: {
                    formula: "(Armadilhas com >= 6 adultos / Total de armadilhas recolhidas válidas) × 100",
                    numerador: totalPositivas,
                    denominador: totalValidas,
                    percentual: Math.round(percentualNoCriterio * 100) / 100,
                    limite: CRITERIA_CONFIG.PERCENTUAL_ARMADILHAS_CRITERIO_MINIMO,
                    explicacao: `${totalPositivas} de ${totalValidas} armadilhas válidas apresentaram 6 ou mais adultos. Resultado: ${(Math.round(percentualNoCriterio * 100) / 100).toFixed(2)}%. O critério de 30% foi ${criterioAtingido ? 'atingido' : 'não atingido'}.`
                }
            };
        },

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
         * Ranking Agrícola por Fazenda com Aplicação do Critério do Manual
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
                        noCriterioCount: 0,
                        talhoes: new Set(),
                        ultimaData: r.data
                    };
                }
                const entry = map[faz];
                entry.totalMachos += m;
                entry.totalLancamentos++;
                if (r.is_instalacao) entry.instalacoes++;
                if (r.is_recolhimento) {
                    entry.recolhimentos++;
                    if (m === 0) entry.zerados++;
                    if (m > 0) entry.positivos++;
                    if (m >= CRITERIA_CONFIG.ADULTOS_POR_ARMADILHA_MINIMO) entry.noCriterioCount++;
                }
                if (r.talhao) entry.talhoes.add(r.talhao);
            });

            return Object.values(map).map(e => {
                const percCriterio = e.recolhimentos > 0
                    ? Math.round((e.noCriterioCount / e.recolhimentos) * 1000) / 10
                    : 0;
                const atingiu = percCriterio >= CRITERIA_CONFIG.PERCENTUAL_ARMADILHAS_CRITERIO_MINIMO;

                return {
                    ...e,
                    totalCapturas: e.totalMachos,
                    totalBrocas: e.totalMachos,
                    talhoesCount: e.talhoes.size,
                    mediaPorRecolhimento: e.recolhimentos > 0
                        ? Math.round((e.totalMachos / e.recolhimentos) * 10) / 10
                        : 0,
                    participacaoPerc: totalMachosGeral > 0
                        ? Math.round((e.totalMachos / totalMachosGeral) * 1000) / 10
                        : 0,
                    percCriterio: percCriterio,
                    criterioAtingido: atingiu,
                    statusAgronomico: atingiu ? 'Critério Atingido' : 'Abaixo do Limite'
                };
            }).sort((a, b) => b.totalMachos - a.totalMachos || b.totalLancamentos - a.totalLancamentos);
        },

        /**
         * Ranking Agrícola por Talhão com Critério do Manual
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
                        noCriterioCount: 0,
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
                if (r.is_recolhimento) {
                    entry.recolhimentos++;
                    if (m === 0) entry.zerados++;
                    if (m > 0) entry.positivos++;
                    if (m >= CRITERIA_CONFIG.ADULTOS_POR_ARMADILHA_MINIMO) entry.noCriterioCount++;
                }
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
                    } else if (e.maxMachos < CRITERIA_CONFIG.ADULTOS_POR_ARMADILHA_MINIMO) {
                        nivelRisco = `Abaixo Limite (${e.maxMachos})`;
                        badgeClass = "badge-blue";
                    } else if (e.maxMachos <= 25) {
                        nivelRisco = `No Critério (${e.maxMachos})`;
                        badgeClass = "badge-amber";
                    } else {
                        nivelRisco = `Foco Crítico (${e.maxMachos})`;
                        badgeClass = "badge-red";
                    }
                }

                return {
                    ...e,
                    mediaRecolh: mediaRecolh,
                    nivelRisco: nivelRisco,
                    badgeClass: badgeClass,
                    atingiuCriterio: e.noCriterioCount > 0
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
                let sortKey;
                if (mode === 'mes') {
                    // Mês: '09/2026' ou '2026-09'
                    key = r.data_dia && r.data_dia.includes('/') ? r.data_dia.substring(3) : (r.data_iso ? r.data_iso.substring(0, 7) : '09/2026');
                    sortKey = r.data_iso ? r.data_iso.substring(0, 7) : '2026-09';
                } else if (mode === 'semana') {
                    key = r.data_dia ? r.data_dia.substring(3) : 'Semana';
                    sortKey = r.data_iso || '2026-09';
                } else {
                    // Dia: 'DD/MM' (ex: '21/09', '01/10')
                    key = r.data_dia ? r.data_dia.substring(0, 5) : (r.data ? String(r.data).substring(0, 5) : 'Dia');
                    sortKey = r.data_iso || '2026-09-01';
                }

                if (!map[key]) {
                    map[key] = {
                        label: key,
                        sortKey: sortKey,
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

            // Ordena cronologicamente (da data mais antiga para a mais recente)
            return Object.values(map).sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || ''));
        },

        /**
         * Distribuição por Faixas de Gravidade de Captura
         */
        computeSeverityDistribution: function (records) {
            const classes = {
                "Instalação (Ciclo Iniciado)": 0,
                "Zero Capturas (Negativo)": 0,
                "Baixa Captura (1-5)": 0,
                "No Critério (6-25)": 0,
                "Foco Crítico (> 25)": 0
            };

            records.forEach(r => {
                if (r.is_instalacao) {
                    classes["Instalação (Ciclo Iniciado)"]++;
                } else {
                    const m = r.machos || 0;
                    if (m === 0) classes["Zero Capturas (Negativo)"]++;
                    else if (m < CRITERIA_CONFIG.ADULTOS_POR_ARMADILHA_MINIMO) classes["Baixa Captura (1-5)"]++;
                    else if (m <= 25) classes["No Critério (6-25)"]++;
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
                    if (filters.faixaGravidade === 'CRITERIO' && (r.machos < CRITERIA_CONFIG.ADULTOS_POR_ARMADILHA_MINIMO || !r.is_recolhimento)) return false;
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
})(typeof window !== 'undefined' ? window : globalThis);
