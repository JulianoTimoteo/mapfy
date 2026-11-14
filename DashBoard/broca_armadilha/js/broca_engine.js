/**
 * broca_engine.js
 * Motor de Inteligência Agronômica e Entomológica para Monitoramento de Broca por Armadilha
 * Usina Pitangueiras - Safra 2026
 * 
 * Em conformidade estrita com o MANUAL TÉCNICO AGRONÔMICO (Páginas 61 & 62):
 * - Regra para Cana-Soca: Presença de 6 adultos em 30% das armadilhas amostradas.
 * - Regra para Plantio: Mínimo de 1 armadilha a cada 50 ha; liberação de Trichogramma acima de 6 mariposas/armadilha (iniciando 7 dias após amostragem).
 * - Permanência da armadilha no campo: 3 a 4 dias (pág. 62); reinstalação em 7 dias se sem evidências.
 * - Inteligência em 3 Níveis:
 *    Nível 1: Armadilha (resultado pontual individual da coleta)
 *    Nível 2: Talhão (proporção de armadilhas positivas vs amostradas na unidade territorial)
 *    Nível 3: Fazenda (consolidação ponderada com denominadores e áreas reais)
 * - Integração estrita com AgronomicTerritory (área real em hectares, sem extrapolações fictícias).
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./agronomic_territory'], factory);
    } else if (typeof module === 'object' && module.exports) {
        let Territory = null;
        try {
            Territory = require('../../common/js/agronomic_territory.js');
        } catch (e) {
            try {
                Territory = require('../common/js/agronomic_territory.js');
            } catch (e2) {}
        }
        module.exports = factory(Territory);
    } else {
        root.BrocaEngine = factory(root.AgronomicTerritory);
    }
}(typeof self !== 'undefined' ? self : this, function (AgronomicTerritory) {
    'use strict';

    const DEFAULT_PARAMS = {
        manejo: 'soca',                          // 'soca' ou 'plantio'
        limite_oficial_pct: 30.0,                // Limite oficial Manual Técnico Pág. 61 (30% das armadilhas)
        limite_simulacao_pct: 30.0,              // Limite customizável para modo simulação
        is_modo_simulacao: false,                // Flag de modo simulação
        min_adultos_soca: 6,                     // Mínimo de 6 adultos para armadilha positiva em Cana Soca
        min_adultos_plantio: 7,                  // Mais de 6 adultos (>6) para liberação de Trichogramma no Plantio
        ha_por_armadilha_plantio: 50,            // 1 armadilha a cada 50 ha no Plantio
        dias_campo_min: 3,                       // 3 a 4 dias no campo
        dias_campo_max: 4,
        dias_reinstalacao: 7,                    // Reinstalar deltas 7 dias depois se negativo
        visao_mapa: 'talhao',                    // 'talhao' ou 'fazenda'
        metrica_mapa: 'tpa',                     // 'tpa' (Taxa Positividade %), 'densidade_ha', 'total_machos'
        faixas: {
            tpa: [
                { min: 0, max: 0, rotulo: 'Zerado (0%)', cor: '#10b981', fill: '#10b981', fillOpacity: 0.28 },
                { min: 0.01, max: 14.99, rotulo: 'Baixa Positividade (1-15%)', cor: '#eab308', fill: '#facc15', fillOpacity: 0.32 },
                { min: 15.0, max: 29.99, rotulo: 'Média Positividade (15-30%)', cor: '#f97316', fill: '#fb923c', fillOpacity: 0.36 },
                { min: 30.0, max: 100.0, rotulo: 'No Critério Oficial (≥ 30%)', cor: '#ef4444', fill: '#f87171', fillOpacity: 0.42 }
            ],
            densidade_ha: [
                { min: 0, max: 0, rotulo: '0 brocas/ha', cor: '#10b981', fill: '#10b981', fillOpacity: 0.28 },
                { min: 0.01, max: 0.5, rotulo: 'Até 0,5 brocas/ha', cor: '#eab308', fill: '#facc15', fillOpacity: 0.32 },
                { min: 0.51, max: 2.0, rotulo: '0,5 a 2 brocas/ha', cor: '#f97316', fill: '#fb923c', fillOpacity: 0.36 },
                { min: 2.01, max: 9999, rotulo: '> 2 brocas/ha (Crítico)', cor: '#ef4444', fill: '#f87171', fillOpacity: 0.42 }
            ]
        }
    };

    let _params = JSON.parse(JSON.stringify(DEFAULT_PARAMS));

    const BrocaEngine = {
        CRITERIA_CONFIG: {
            ADULTOS_POR_ARMADILHA_MINIMO: 6,
            PERCENTUAL_ARMADILHAS_CRITERIO_MINIMO: 30.0,
            HECTARES_POR_ARMADILHA_NOMINAL: 50,
            DIAS_CAMPO_IDEAL_MIN: 3,
            DIAS_CAMPO_IDEAL_MAX: 4
        },

        getTerritory: function () {
            if (typeof window !== 'undefined' && window.AgronomicTerritory) {
                return window.AgronomicTerritory;
            }
            return AgronomicTerritory;
        },

        getParams: function () {
            return JSON.parse(JSON.stringify(_params));
        },

        setParams: function (newParams) {
            if (!newParams) return;
            Object.assign(_params, newParams);
            if (newParams.faixas) {
                _params.faixas = Object.assign({}, _params.faixas, newParams.faixas);
            }
            if (_params.manejo === 'plantio') {
                this.CRITERIA_CONFIG.ADULTOS_POR_ARMADILHA_MINIMO = _params.min_adultos_plantio;
            } else {
                this.CRITERIA_CONFIG.ADULTOS_POR_ARMADILHA_MINIMO = _params.min_adultos_soca;
            }
            this.CRITERIA_CONFIG.PERCENTUAL_ARMADILHAS_CRITERIO_MINIMO = _params.is_modo_simulacao 
                ? _params.limite_simulacao_pct 
                : _params.limite_oficial_pct;
            return this.getParams();
        },

        resetParams: function () {
            _params = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
            this.CRITERIA_CONFIG.ADULTOS_POR_ARMADILHA_MINIMO = 6;
            this.CRITERIA_CONFIG.PERCENTUAL_ARMADILHAS_CRITERIO_MINIMO = 30.0;
            return this.getParams();
        },

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
         * Normaliza registro bruto do MapFy para a estrutura analítica padrão (NÍVEL 1)
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

            // Critério Oficial: Cana Soca >= 6; Plantio > 6
            const threshold = _params.manejo === 'plantio' ? _params.min_adultos_plantio : _params.min_adultos_soca;
            const atingeCriterioIndividual = isRecolhimento && !dadoIncompleto && machosNum !== null && (
                _params.manejo === 'plantio' ? machosNum >= threshold : machosNum >= threshold
            );

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
         * AUDITORIA E INTELIGÊNCIA GERAL (Em conformidade com Páginas 61-62)
         */
        computeAgronomicIntelligence: function (records, shapesGeoJson) {
            const norm = (records || []).map(r => r._raw ? r : BrocaEngine.normalizeRecord(r)).filter(Boolean);
            const territory = this.getTerritory();

            const instalacoes = [];
            const recolhimentos = [];
            const excluidos = [];

            norm.forEach(r => {
                if (r.is_instalacao) {
                    instalacoes.push(r);
                    excluidos.push({
                        registro: r,
                        motivo: 'Etapa de Instalação (início do ciclo, armadilha posta em campo; não representa leitura)'
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
                        motivo: 'Etapa não reconhecida no monitoramento de armadilha'
                    });
                }
            });

            // Deduplicação estrita de recolhimentos por armadilha e data
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

            const threshold = _params.manejo === 'plantio' ? _params.min_adultos_plantio : _params.min_adultos_soca;
            const armadilhasNoCriterio = recolhimentosValidos.filter(r => r.machos >= threshold);
            const armadilhasAbaixoCriterio = recolhimentosValidos.filter(r => r.machos < threshold);

            const totalValidas = recolhimentosValidos.length;
            const totalPositivas = armadilhasNoCriterio.length;
            const percentualNoCriterio = totalValidas > 0 ? (totalPositivas / totalValidas) * 100 : 0;
            const limiteOficial = _params.is_modo_simulacao ? _params.limite_simulacao_pct : _params.limite_oficial_pct;
            const criterioAtingido = percentualNoCriterio >= limiteOficial;

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

            // Fallback para shapesGeoJson se fornecido
            if (shapesGeoJson && shapesGeoJson.features && territory && typeof territory.loadShapesFallback === 'function') {
                territory.loadShapesFallback(shapesGeoJson.features);
            }

            // Cruzamento Territorial com Shapes e Cadastro
            let areaTalhoesMonitoradosHa = 0;
            let areaTalhoesNoCriterioHa = 0;
            let talhoesNoCriterioCount = 0;
            const talhoesMap = new Map();

            // Mapa de fallback direto de shapesGeoJson se territory não estiver ativo
            const shapesIndex = new Map();
            if (shapesGeoJson && shapesGeoJson.features) {
                shapesGeoJson.features.forEach(f => {
                    const p = f.properties || {};
                    const faz = String(p.fazenda || p.FAZENDA || '').trim();
                    const tal = String(p.talhao !== undefined ? p.talhao : (p.TALHAO !== undefined ? p.TALHAO : '')).trim();
                    if (faz && tal) shapesIndex.set(`${faz}_${tal}`, p);
                });
            }

            recolhimentosValidos.forEach(r => {
                const key = `${String(r.fazenda).trim()}_${String(r.talhao).trim()}`;
                if (!talhoesMap.has(key)) {
                    let area = 0;
                    if (territory && typeof territory.getTalhaoArea === 'function') {
                        area = territory.getTalhaoArea(r.fazenda, r.talhao);
                    }
                    if (!area && shapesIndex.has(key)) {
                        const shp = shapesIndex.get(key);
                        area = parseFloat(shp.area || shp.AREA_TOTAL || 0) || 0;
                    }

                    talhoesMap.set(key, {
                        fazenda: r.fazenda,
                        talhao: r.talhao,
                        area: area,
                        machosMax: r.machos,
                        atingiu: r.machos >= threshold
                    });
                } else {
                    const entry = talhoesMap.get(key);
                    if (r.machos > entry.machosMax) entry.machosMax = r.machos;
                    if (r.machos >= threshold) entry.atingiu = true;
                }
            });

            talhoesMap.forEach(t => {
                areaTalhoesMonitoradosHa += t.area;
                if (t.atingiu) {
                    areaTalhoesNoCriterioHa += t.area;
                    talhoesNoCriterioCount++;
                }
            });

            // Inteligência Territorial por Talhão e Fazenda
            const talhoesIntel = this.computeTalhaoLevelIntelligence(recolhimentosValidos);
            const fazendasIntel = this.computeFarmLevelIntelligence(recolhimentosValidos);

            const coberturaNominalHa = totalValidas * _params.ha_por_armadilha_plantio;

            return {
                manejo: _params.manejo,
                totalLancamentos: norm.length,
                instalacoesCount: instalacoes.length,
                recolhimentosValidosCount: totalValidas,
                armadilhasNoCriterioCount: totalPositivas,
                armadilhasAbaixoCriterioCount: armadilhasAbaixoCriterio.length,
                percentualNoCriterio: Math.round(percentualNoCriterio * 100) / 100,
                percentualFormatado: (Math.round(percentualNoCriterio * 100) / 100).toFixed(2) + '%',
                limiteReferencia: limiteOficial,
                criterioAtingido: criterioAtingido,
                statusControle: criterioAtingido ? 'CRITÉRIO ATINGIDO (MANEJO RECOMENDADO)' : 'ABAIXO DO NÍVEL DE CONTROLE',
                totalBrocasCapturadas: totalBrocas,
                mediaBrocasPorArmadilha: Math.round(mediaBrocasPorArmadilha * 100) / 100,
                areaTalhoesMonitoradosHa: Math.round(areaTalhoesMonitoradosHa * 100) / 100,
                areaTalhoesNoCriterioHa: Math.round(areaTalhoesNoCriterioHa * 100) / 100,
                coberturaNominalHa: coberturaNominalHa,
                talhoesMonitoradosCount: Object.keys(talhoesIntel).length,
                talhoesNoCriterioCount: talhoesNoCriterioCount,
                fazendasMonitoradasCount: Object.keys(fazendasIntel).length,
                ciclosPareadosCount: ciclosPareados.length,
                instalacoesPendentesCount: instalacoesPendentes.length,
                recolhimentosOrfaosCount: recolhimentosOrfaos.length,
                excluidosCount: excluidos.length,
                listaNumerador: armadilhasNoCriterio,
                listaDenominador: recolhimentosValidos,
                listaExcluidos: excluidos,
                talhoesIntel: talhoesIntel,
                fazendasIntel: fazendasIntel,
                auditoria: {
                    formula: _params.manejo === 'plantio' 
                        ? "(Armadilhas com > 6 mariposas / Total de armadilhas recolhidas válidas) × 100 [Mínimo: 1 armadilha/50 ha]"
                        : "(Armadilhas com ≥ 6 adultos / Total de armadilhas recolhidas válidas) × 100",
                    numerador: totalPositivas,
                    denominador: totalValidas,
                    percentual: Math.round(percentualNoCriterio * 100) / 100,
                    limite: limiteOficial,
                    is_simulacao: _params.is_modo_simulacao,
                    explicacao: `${totalPositivas} de ${totalValidas} armadilhas válidas apresentaram ${threshold} ou mais adultos. Resultado: ${(Math.round(percentualNoCriterio * 100) / 100).toFixed(2)}%. O critério técnico de ${limiteOficial}% foi ${criterioAtingido ? 'atingido' : 'não atingido'}.`
                }
            };
        },

        /**
         * INTELIGÊNCIA DE NÍVEL 2: TALHÃO
         * Calcula indicadores territoriais para cada talhão (proporção, área real, densidade por ha)
         */
        computeTalhaoLevelIntelligence: function (validRecords) {
            const territory = this.getTerritory();
            const groups = new Map();
            const threshold = _params.manejo === 'plantio' ? _params.min_adultos_plantio : _params.min_adultos_soca;
            const limiteOficial = _params.is_modo_simulacao ? _params.limite_simulacao_pct : _params.limite_oficial_pct;

            (validRecords || []).forEach(r => {
                const faz = String(r.fazenda || '').trim();
                const tal = String(r.talhao || '').trim();
                if (!faz || !tal) return;
                const key = `${faz}_${tal}`;
                if (!groups.has(key)) {
                    groups.set(key, {
                        fazenda: faz,
                        talhao: tal,
                        registros: []
                    });
                }
                groups.get(key).registros.push(r);
            });

            const result = {};

            groups.forEach((item, key) => {
                const recs = item.registros;
                const totalValidas = recs.length;
                const positivas = recs.filter(r => r.machos >= threshold);
                const totalPositivas = positivas.length;
                const pctPositivas = totalValidas > 0 ? (totalPositivas / totalValidas) * 100 : null;
                const criterioAtingido = pctPositivas !== null && pctPositivas >= limiteOficial;

                const areaRealHa = territory ? territory.getTalhaoArea(item.fazenda, item.talhao) : 0;
                const summary = territory ? territory.getTalhaoSummary(item.fazenda, item.talhao) : null;
                const nomeFaz = (summary && summary.nome_faz) || `FAZENDA ${item.fazenda}`;
                const zona = (summary && summary.zona) || 1;

                const totalMachos = recs.reduce((acc, r) => acc + (r.machos || 0), 0);
                const densidadeHa = areaRealHa > 0 ? Math.round((totalMachos / areaRealHa) * 100) / 100 : null;
                const mediaMachosAmostra = totalValidas > 0 ? Math.round((totalMachos / totalValidas) * 100) / 100 : 0;
                const armadilhasMinimasRequeridas = Math.ceil((areaRealHa || 50) / 50);

                // Classificação Visual de Cor
                let classificacao = 'SEM_AMOSTRAGEM';
                let cor = '#94a3b8';
                let fill = '#ffffff';
                let fillOpacity = 0.14;

                if (totalValidas === 0) {
                    classificacao = 'SEM_AMOSTRAGEM';
                } else if (totalPositivas === 0) {
                    classificacao = 'ZERADO';
                    cor = '#10b981';
                    fill = '#10b981';
                    fillOpacity = 0.28;
                } else if (pctPositivas < 15.0) {
                    classificacao = 'BAIXA';
                    cor = '#eab308';
                    fill = '#facc15';
                    fillOpacity = 0.32;
                } else if (pctPositivas < limiteOficial) {
                    classificacao = 'MEDIA';
                    cor = '#f97316';
                    fill = '#fb923c';
                    fillOpacity = 0.36;
                } else {
                    classificacao = 'CRITICO';
                    cor = '#ef4444';
                    fill = '#f87171';
                    fillOpacity = 0.44;
                }

                result[key] = {
                    key: key,
                    fazenda: item.fazenda,
                    nome_faz: nomeFaz,
                    zona: zona,
                    talhao: item.talhao,
                    area_ha: areaRealHa,
                    total_parcelas: summary ? summary.total_parcelas : 1,
                    parcelas: summary ? summary.parcelas : [],
                    total_validas: totalValidas,
                    total_positivas: totalPositivas,
                    percentual_positivas: pctPositivas !== null ? Math.round(pctPositivas * 100) / 100 : null,
                    criterio_atingido: criterioAtingido,
                    limite_oficial: limiteOficial,
                    total_machos: totalMachos,
                    densidade_ha: densidadeHa,
                    media_machos_amostra: mediaMachosAmostra,
                    armadilhas_minimas: armadilhasMinimasRequeridas,
                    cobertura_amostral_pct: Math.round((totalValidas / armadilhasMinimasRequeridas) * 100),
                    classificacao: classificacao,
                    cor: cor,
                    fill: fill,
                    fillOpacity: fillOpacity,
                    amostras: recs.map(r => ({ id: r.id, data: r.data, machos: r.machos, responsavel: r.responsavel_nome }))
                };
            });

            return result;
        },

        /**
         * INTELIGÊNCIA DE NÍVEL 3: FAZENDA
         * Consolidação dos talhões e ponderação territorial (evita contaminação geral enganosa)
         */
        computeFarmLevelIntelligence: function (validRecords) {
            const territory = this.getTerritory();
            const groups = new Map();
            const threshold = _params.manejo === 'plantio' ? _params.min_adultos_plantio : _params.min_adultos_soca;
            const limiteOficial = _params.is_modo_simulacao ? _params.limite_simulacao_pct : _params.limite_oficial_pct;

            (validRecords || []).forEach(r => {
                const faz = String(r.fazenda || '').trim();
                if (!faz) return;
                if (!groups.has(faz)) {
                    groups.set(faz, []);
                }
                groups.get(faz).push(r);
            });

            const result = {};

            groups.forEach((recs, faz) => {
                const totalValidas = recs.length;
                const positivas = recs.filter(r => r.machos >= threshold);
                const totalPositivas = positivas.length;
                const pctPositivas = totalValidas > 0 ? (totalPositivas / totalValidas) * 100 : null;

                const summary = territory ? territory.getFazendaSummary(faz) : null;
                const areaTotalHa = summary ? summary.area_total_ha : 0;
                const totalTalhoesCadastrados = summary ? summary.total_talhoes : 0;
                const nomeFaz = (summary && summary.nome_faz) || `FAZENDA ${faz}`;
                const zonaPrincipal = (summary && summary.zona_principal) || 1;

                // Mapear talhões amostrados nesta fazenda
                const talhoesAmostradosSet = new Set(recs.map(r => String(r.talhao)));
                const talhoesIntel = this.computeTalhaoLevelIntelligence(recs);

                let areaAmostradaHa = 0;
                let areaCriticaHa = 0;
                let talhoesCriticosCount = 0;

                Object.values(talhoesIntel).forEach(t => {
                    areaAmostradaHa += t.area_ha;
                    if (t.criterio_atingido) {
                        areaCriticaHa += t.area_ha;
                        talhoesCriticosCount++;
                    }
                });

                const coberturaTerritorialPct = areaTotalHa > 0 
                    ? Math.round((areaAmostradaHa / areaTotalHa) * 1000) / 10 
                    : 0;

                const criterioAtingido = pctPositivas !== null && pctPositivas >= limiteOficial;
                const totalMachos = recs.reduce((acc, r) => acc + (r.machos || 0), 0);
                const densidadeGeralHa = areaTotalHa > 0 ? Math.round((totalMachos / areaTotalHa) * 100) / 100 : null;

                // Classificação da Fazenda
                let classificacao = 'SEM_AMOSTRAGEM';
                let cor = '#94a3b8';
                let fill = '#ffffff';
                let fillOpacity = 0.14;

                if (totalValidas === 0) {
                    classificacao = 'SEM_AMOSTRAGEM';
                } else if (totalPositivas === 0) {
                    classificacao = 'ZERADO';
                    cor = '#10b981';
                    fill = '#10b981';
                    fillOpacity = 0.28;
                } else if (pctPositivas < 15.0) {
                    classificacao = 'BAIXA';
                    cor = '#eab308';
                    fill = '#facc15';
                    fillOpacity = 0.32;
                } else if (pctPositivas < limiteOficial) {
                    classificacao = 'MEDIA';
                    cor = '#f97316';
                    fill = '#fb923c';
                    fillOpacity = 0.36;
                } else {
                    classificacao = 'CRITICO';
                    cor = '#ef4444';
                    fill = '#f87171';
                    fillOpacity = 0.44;
                }

                result[faz] = {
                    fazenda: faz,
                    nome_faz: nomeFaz,
                    zona_principal: zonaPrincipal,
                    area_total_ha: areaTotalHa,
                    total_talhoes_cadastrados: totalTalhoesCadastrados,
                    talhoes_amostrados_count: talhoesAmostradosSet.size,
                    cobertura_territorial_pct: coberturaTerritorialPct,
                    area_amostrada_ha: Math.round(areaAmostradaHa * 100) / 100,
                    total_validas: totalValidas,
                    total_positivas: totalPositivas,
                    percentual_positivas: pctPositivas !== null ? Math.round(pctPositivas * 100) / 100 : null,
                    criterio_atingido: criterioAtingido,
                    limite_oficial: limiteOficial,
                    talhoes_criticos_count: talhoesCriticosCount,
                    area_talhoes_criticos_ha: Math.round(areaCriticaHa * 100) / 100,
                    total_machos: totalMachos,
                    densidade_ha: densidadeGeralHa,
                    classificacao: classificacao,
                    cor: cor,
                    fill: fill,
                    fillOpacity: fillOpacity
                };
            });

            return result;
        },

        /**
         * Retorna estilo visual do Shape para o Leaflet conforme Visão (Talhão vs Fazenda) e Métrica
         */
        getShapeStyle: function (feature, visao = _params.visao_mapa, metrica = _params.metrica_mapa, intelData = null) {
            const props = feature ? (feature.properties || {}) : {};
            const faz = String(props.fazenda || props.FAZENDA || '').trim();
            const tal = String(props.talhao !== undefined ? props.talhao : (props.TALHAO !== undefined ? props.TALHAO : '')).trim();

            if (!faz || !tal) {
                return {
                    color: 'rgba(255, 255, 255, 0.65)',
                    weight: 1.1,
                    fillColor: '#ffffff',
                    fillOpacity: 0.10
                };
            }

            const talhoesIntel = (intelData && intelData.talhoesIntel) || {};
            const fazendasIntel = (intelData && intelData.fazendasIntel) || {};

            if (visao === 'fazenda') {
                const fazData = fazendasIntel[faz];
                if (!fazData || fazData.total_validas === 0) {
                    return {
                        color: 'rgba(255, 255, 255, 0.65)',
                        weight: 1.1,
                        fillColor: '#ffffff',
                        fillOpacity: 0.10
                    };
                }
                return {
                    color: fazData.cor,
                    weight: 1.8,
                    fillColor: fazData.fill,
                    fillOpacity: fazData.fillOpacity
                };
            }

            // Visão por Talhão (Padrão)
            const key = `${faz}_${tal}`;
            const talData = talhoesIntel[key];
            if (!talData || talData.total_validas === 0) {
                return {
                    color: 'rgba(255, 255, 255, 0.65)',
                    weight: 1.1,
                    fillColor: '#ffffff',
                    fillOpacity: 0.10
                };
            }

            return {
                color: talData.cor,
                weight: talData.criterio_atingido ? 2.4 : 1.6,
                fillColor: talData.fill,
                fillOpacity: talData.fillOpacity
            };
        },

        /**
         * Retorna Tooltip HTML formatado para o Shape do Talhão ou Fazenda
         */
        getShapeTooltipHtml: function (feature, visao = _params.visao_mapa, intelData = null) {
            const props = feature.properties || {};
            const faz = String(props.fazenda || props.FAZENDA || '').trim();
            const tal = String(props.talhao !== undefined ? props.talhao : (props.TALHAO !== undefined ? props.TALHAO : '')).trim();
            const nomeFaz = props.nome_faz || props.NOME_FAZ || `Fazenda ${faz}`;
            const zona = props.zona || props.ZONA || 1;

            const talhoesIntel = (intelData && intelData.talhoesIntel) || {};
            const fazendasIntel = (intelData && intelData.fazendasIntel) || {};

            if (visao === 'fazenda') {
                const fazData = fazendasIntel[faz];
                const areaFaz = fazData ? fazData.area_total_ha : (Number(props.area || 0));
                const statusBadge = fazData && fazData.total_validas > 0
                    ? `<span style="background: ${fazData.criterio_atingido ? '#fee2e2' : '#ecfdf5'}; color: ${fazData.criterio_atingido ? '#991b1b' : '#065f46'}; font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 9999px;">
                        ${fazData.criterio_atingido ? '⚠️ LIMITE OFICIAL ATINGIDO' : '✓ ABAIXO DO LIMITE'} (${fazData.percentual_positivas}%)
                       </span>`
                    : `<span style="background: #f1f5f9; color: #64748b; font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 9999px;">Sem Amostragem</span>`;

                return `
                    <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; min-width: 250px; padding: 10px 14px; background: #ffffff; color: #0f172a; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.25); border: 1px solid #cbd5e1;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0;">
                            <div style="font-weight: 800; font-size: 12px; color: #0f172a; display: flex; align-items: center; gap: 5px;">
                                <span>🏛️</span>
                                <span>Visão por Fazenda</span>
                            </div>
                            ${statusBadge}
                        </div>
                        <div style="margin-bottom: 5px;">
                            <span style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Fazenda</span>
                            <div style="font-size: 11.5px; font-weight: 800; color: #0f172a;">${faz} - ${nomeFaz}</div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 6px 0; padding: 6px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div>
                                <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Área Total</span>
                                <div style="font-size: 11px; font-weight: 800; color: #0f172a;">${areaFaz.toFixed(2)} ha</div>
                            </div>
                            <div>
                                <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Amostradas</span>
                                <div style="font-size: 11px; font-weight: 800; color: #0f172a;">${fazData ? fazData.total_validas : 0}</div>
                            </div>
                            <div>
                                <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Positivas (≥6)</span>
                                <div style="font-size: 11px; font-weight: 800; color: ${fazData && fazData.total_positivas > 0 ? '#b91c1c' : '#059669'};">${fazData ? fazData.total_positivas : 0}</div>
                            </div>
                        </div>
                        ${fazData ? `<div style="font-size: 9.5px; color: #475569;">Talhões no Limite: <b>${fazData.talhoes_criticos_count}</b> (${fazData.area_talhoes_criticos_ha} ha)</div>` : ''}
                    </div>
                `;
            }

            // Visão por Talhão
            const key = `${faz}_${tal}`;
            const talData = talhoesIntel[key];
            const areaTal = talData ? talData.area_ha : Number(props.area || 0);

            const statusBadge = talData && talData.total_validas > 0
                ? `<span style="background: ${talData.criterio_atingido ? '#fee2e2' : '#ecfdf5'}; color: ${talData.criterio_atingido ? '#991b1b' : '#065f46'}; font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 9999px;">
                    ${talData.criterio_atingido ? '⚠️ NO CRITÉRIO' : '✓ ABAIXO'} (${talData.percentual_positivas}%)
                   </span>`
                : `<span style="background: #f1f5f9; color: #64748b; font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 9999px;">Sem Amostragem</span>`;

            return `
                <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; min-width: 250px; padding: 10px 14px; background: #ffffff; color: #0f172a; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.25); border: 1px solid #cbd5e1;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0;">
                        <div style="font-weight: 800; font-size: 12px; color: #0f172a; display: flex; align-items: center; gap: 5px;">
                            <span>🌾</span>
                            <span>Talhão ${tal}</span>
                        </div>
                        ${statusBadge}
                    </div>
                    <div style="margin-bottom: 5px;">
                        <span style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Fazenda</span>
                        <div style="font-size: 11.5px; font-weight: 800; color: #0f172a;">${faz} - ${nomeFaz}</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 6px 0; padding: 6px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <div>
                            <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Área Real</span>
                            <div style="font-size: 11px; font-weight: 800; color: #0f172a;">${areaTal.toFixed(2)} ha</div>
                        </div>
                        <div>
                            <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Amostradas</span>
                            <div style="font-size: 11px; font-weight: 800; color: #0f172a;">${talData ? talData.total_validas : 0}</div>
                        </div>
                        <div>
                            <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Positivas (≥6)</span>
                            <div style="font-size: 11px; font-weight: 800; color: ${talData && talData.total_positivas > 0 ? '#b91c1c' : '#059669'};">${talData ? talData.total_positivas : 0}</div>
                        </div>
                    </div>
                    ${talData && talData.densidade_ha !== null ? `<div style="font-size: 9.5px; color: #475569; display: flex; justify-content: space-between;"><span>Densidade: <b>${talData.densidade_ha} brocas/ha</b></span><span>Total Brocas: <b>${talData.total_machos}</b></span></div>` : ''}
                </div>
            `;
        },

        /**
         * Retorna Popup Completo ao Clicar no Shape com Memória de Cálculo e Histórico
         */
        getShapePopupHtml: function (feature, visao = _params.visao_mapa, intelData = null) {
            const props = feature.properties || {};
            const faz = String(props.fazenda || props.FAZENDA || '').trim();
            const tal = String(props.talhao !== undefined ? props.talhao : (props.TALHAO !== undefined ? props.TALHAO : '')).trim();
            const nomeFaz = props.nome_faz || props.NOME_FAZ || `Fazenda ${faz}`;
            const zona = props.zona || props.ZONA || 1;

            const talhoesIntel = (intelData && intelData.talhoesIntel) || {};
            const fazendasIntel = (intelData && intelData.fazendasIntel) || {};

            if (visao === 'fazenda') {
                const fazData = fazendasIntel[faz] || {};
                const area = fazData.area_total_ha || Number(props.area || 0);
                return `
                    <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; min-width: 280px; max-width: 320px; padding: 4px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
                            <h4 style="margin: 0; font-size: 13px; font-weight: 800; color: #0f172a;">🏛️ ${faz} — ${nomeFaz}</h4>
                            <span style="background: #e2e8f0; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px;">Zona ${zona}</span>
                        </div>
                        <div style="background: #f8fafc; border-radius: 8px; padding: 8px; border: 1px solid #e2e8f0; margin-bottom: 8px;">
                            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Consolidação Territorial</div>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 4px;">
                                <div>Área Total: <b>${area.toFixed(2)} ha</b></div>
                                <div>Talhões: <b>${fazData.total_talhoes_cadastrados || 0}</b></div>
                                <div>Amostrados: <b>${fazData.talhoes_amostrados_count || 0}</b></div>
                                <div>Cobertura: <b>${fazData.cobertura_territorial_pct || 0}%</b></div>
                            </div>
                        </div>
                        <div style="background: ${fazData.criterio_atingido ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${fazData.criterio_atingido ? '#fecaca' : '#bbf7d0'}; border-radius: 8px; padding: 8px; margin-bottom: 8px;">
                            <div style="font-size: 11px; font-weight: 800; color: ${fazData.criterio_atingido ? '#991b1b' : '#166534'};">
                                ${fazData.criterio_atingido ? '⚠️ Atingiu Limite Oficial de 30%' : '✓ Abaixo do Nível de Controle'}
                            </div>
                            <div style="font-size: 10px; color: #334155; margin-top: 3px;">
                                Armadilhas Válidas: <b>${fazData.total_validas || 0}</b> • Positivas (≥6): <b>${fazData.total_positivas || 0}</b>
                            </div>
                            <div style="font-size: 10px; color: #334155; margin-top: 2px;">
                                Positividade da Fazenda: <b>${fazData.percentual_positivas !== null ? fazData.percentual_positivas + '%' : 'Sem Amostragem'}</b>
                            </div>
                        </div>
                        <div style="font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 5px;">
                            Talhões no Limite: <b>${fazData.talhoes_criticos_count || 0}</b> (${fazData.area_talhoes_criticos_ha || 0} ha territoriais associados).
                        </div>
                    </div>
                `;
            }

            // Visão por Talhão
            const key = `${faz}_${tal}`;
            const talData = talhoesIntel[key] || {};
            const area = talData.area_ha || Number(props.area || 0);

            const amostrasRows = (talData.amostras || []).map(a => `
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 9.5px;">
                    <td style="padding: 3px 4px;">${a.data ? a.data.split(' ')[0] : '-'}</td>
                    <td style="padding: 3px 4px; font-weight: 800; color: ${a.machos >= 6 ? '#b91c1c' : '#059669'};">${a.machos}</td>
                    <td style="padding: 3px 4px; color: #64748b;">${a.responsavel ? a.responsavel.split(' ')[0] : '-'}</td>
                </tr>
            `).join('');

            return `
                <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; min-width: 290px; max-width: 330px; padding: 4px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
                        <h4 style="margin: 0; font-size: 13px; font-weight: 800; color: #0f172a;">🌾 Talhão ${tal}</h4>
                        <span style="background: #e2e8f0; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px;">${faz}</span>
                    </div>
                    <div style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 6px;">${nomeFaz} — Zona ${zona}</div>
                    
                    <div style="background: #f8fafc; border-radius: 8px; padding: 8px; border: 1px solid #e2e8f0; margin-bottom: 8px;">
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 10px;">
                            <div>Área Real: <b>${area.toFixed(2)} ha</b></div>
                            <div>Parcelas: <b>${talData.total_parcelas || 1}</b></div>
                            <div>Amostragens: <b>${talData.total_validas || 0}</b></div>
                            <div>Positivas: <b>${talData.total_positivas || 0}</b></div>
                            <div>Positividade: <b style="color: ${talData.criterio_atingido ? '#b91c1c' : '#059669'};">${talData.percentual_positivas !== null ? talData.percentual_positivas + '%' : 'Sem Amostragem'}</b></div>
                            <div>Densidade: <b>${talData.densidade_ha !== null ? talData.densidade_ha + ' b/ha' : '-'}</b></div>
                        </div>
                    </div>

                    <div style="background: ${talData.criterio_atingido ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${talData.criterio_atingido ? '#fecaca' : '#bbf7d0'}; border-radius: 8px; padding: 6px 8px; margin-bottom: 8px; font-size: 10px;">
                        <b>Regra Técnica (Pág. 61):</b> Limite Oficial 30%.<br>
                        <b>Situação:</b> ${talData.total_validas > 0 ? (talData.criterio_atingido ? '⚠️ Atingiu critério de manejo' : '✓ Abaixo do nível de controle') : 'Sem medições de campo'}.
                    </div>

                    ${amostrasRows ? `
                        <div style="max-height: 110px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 6px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                                <thead style="background: #f1f5f9; font-size: 9px; color: #475569;">
                                    <tr><th style="padding: 2px 4px;">Data</th><th style="padding: 2px 4px;">Machos</th><th style="padding: 2px 4px;">Resp.</th></tr>
                                </thead>
                                <tbody>${amostrasRows}</tbody>
                            </table>
                        </div>
                    ` : ''}

                    <div style="font-size: 9px; color: #94a3b8; text-align: center;">Usina Pitangueiras • Safra 2026</div>
                </div>
            `;
        },

        /**
         * Calcula todos os KPIs executivos da base filtrada
         */
        computeExecutiveKPIs: function (records) {
            const total = (records || []).length;
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
         * Ranking por Fazenda com Integração de Área Real e Positividade do Manual
         */
        computeFarmRanking: function (records) {
            const territory = this.getTerritory();
            const map = {};
            const threshold = _params.manejo === 'plantio' ? _params.min_adultos_plantio : _params.min_adultos_soca;
            const limiteOficial = _params.is_modo_simulacao ? _params.limite_simulacao_pct : _params.limite_oficial_pct;

            records.forEach(r => {
                const faz = r.fazenda || 'NÃO INFORMADA';
                if (!map[faz]) {
                    const sum = territory ? territory.getFazendaSummary(faz) : null;
                    map[faz] = {
                        fazenda: faz,
                        nome_faz: (sum && sum.nome_faz) || `FAZENDA ${faz}`,
                        area_total_ha: sum ? sum.area_total_ha : 0,
                        totalLancamentos: 0,
                        totalMachos: 0,
                        instalacoes: 0,
                        recolhimentos: 0,
                        positivos: 0,
                        criticos: 0,
                        noCriterioCount: 0,
                        talhoesSet: new Set()
                    };
                }
                const entry = map[faz];
                entry.totalLancamentos++;
                entry.totalMachos += (r.machos || 0);
                if (r.talhao) entry.talhoesSet.add(r.talhao);
                if (r.is_instalacao) entry.instalacoes++;
                if (r.is_recolhimento) {
                    entry.recolhimentos++;
                    if (r.machos > 0) entry.positivos++;
                    if (r.machos > 25) entry.criticos++;
                    if (r.machos >= threshold) entry.noCriterioCount++;
                }
            });

            return Object.values(map).map(entry => {
                const pctPositivas = entry.recolhimentos > 0 ? (entry.noCriterioCount / entry.recolhimentos) * 100 : 0;
                const criterioAtingido = pctPositivas >= limiteOficial;
                return {
                    fazenda: entry.fazenda,
                    nome_faz: entry.nome_faz,
                    area_total_ha: entry.area_total_ha,
                    totalLancamentos: entry.totalLancamentos,
                    totalMachos: entry.totalMachos,
                    totalBrocas: entry.totalMachos,
                    instalacoes: entry.instalacoes,
                    recolhimentos: entry.recolhimentos,
                    positivos: entry.positivos,
                    criticos: entry.criticos,
                    noCriterioCount: entry.noCriterioCount,
                    percentualNoCriterio: Math.round(pctPositivas * 10) / 10,
                    criterioAtingido: criterioAtingido,
                    talhoesCount: entry.talhoesSet.size,
                    densidadeHa: entry.area_total_ha > 0 ? Math.round((entry.totalMachos / entry.area_total_ha) * 100) / 100 : null,
                    mediaPorRecolhimento: entry.recolhimentos > 0
                        ? Math.round((entry.totalMachos / entry.recolhimentos) * 10) / 10
                        : 0
                };
            }).sort((a, b) => b.totalMachos - a.totalMachos);
        },

        /**
         * Ranking por Talhão
         */
        computeTalhaoRanking: function (records) {
            const territory = this.getTerritory();
            const map = {};
            const threshold = _params.manejo === 'plantio' ? _params.min_adultos_plantio : _params.min_adultos_soca;
            const limiteOficial = _params.is_modo_simulacao ? _params.limite_simulacao_pct : _params.limite_oficial_pct;

            records.forEach(r => {
                const key = r.local_orig || `${r.fazenda} > ${r.talhao}`;
                if (!map[key]) {
                    const area = territory ? territory.getTalhaoArea(r.fazenda, r.talhao) : 0;
                    map[key] = {
                        local: key,
                        fazenda: r.fazenda,
                        talhao: r.talhao,
                        area_ha: area,
                        totalLancamentos: 0,
                        totalMachos: 0,
                        recolhimentos: 0,
                        positivos: 0,
                        noCriterioCount: 0,
                        maxMachos: 0
                    };
                }
                const entry = map[key];
                entry.totalLancamentos++;
                entry.totalMachos += (r.machos || 0);
                if (r.machos > entry.maxMachos) entry.maxMachos = r.machos;
                if (r.is_recolhimento) {
                    entry.recolhimentos++;
                    if (r.machos > 0) entry.positivos++;
                    if (r.machos >= threshold) entry.noCriterioCount++;
                }
            });

            return Object.values(map).map(entry => {
                const pctPositivas = entry.recolhimentos > 0 ? (entry.noCriterioCount / entry.recolhimentos) * 100 : 0;
                return {
                    local: entry.local,
                    fazenda: entry.fazenda,
                    talhao: entry.talhao,
                    area_ha: entry.area_ha,
                    totalLancamentos: entry.totalLancamentos,
                    totalMachos: entry.totalMachos,
                    totalBrocas: entry.totalMachos,
                    recolhimentos: entry.recolhimentos,
                    positivos: entry.positivos,
                    noCriterioCount: entry.noCriterioCount,
                    percentualNoCriterio: Math.round(pctPositivas * 10) / 10,
                    criterioAtingido: pctPositivas >= limiteOficial,
                    maxMachos: entry.maxMachos,
                    densidadeHa: entry.area_ha > 0 ? Math.round((entry.totalMachos / entry.area_ha) * 100) / 100 : null
                };
            }).sort((a, b) => b.totalMachos - a.totalMachos);
        },

        /**
         * Estatísticas por Responsável Técnico
         */
        computeResponsibleStats: function (records) {
            const map = {};
            records.forEach(r => {
                const resp = r.responsavel_nome || 'NÃO INFORMADO';
                if (!map[resp]) {
                    map[resp] = {
                        nome: resp,
                        totalLancamentos: 0,
                        totalMachos: 0,
                        instalacoes: 0,
                        recolhimentos: 0,
                        positivos: 0,
                        zerados: 0,
                        criticos: 0
                    };
                }
                const entry = map[resp];
                entry.totalLancamentos++;
                entry.totalMachos += (r.machos || 0);
                if (r.is_instalacao) entry.instalacoes++;
                if (r.is_recolhimento) {
                    entry.recolhimentos++;
                    if (r.machos === 0) entry.zerados++;
                    if (r.machos > 0) entry.positivos++;
                    if (r.machos > 25) entry.criticos++;
                }
            });

            return Object.values(map).sort((a, b) => b.totalLancamentos - a.totalLancamentos);
        },

        /**
         * Evolução Temporal (Diária ou Mensal) com Ordenação Cronológica Estrita
         */
        computeTemporalAnalytics: function (records, groupBy = 'dia') {
            const map = {};

            records.forEach(r => {
                let key = '';
                let sortKey = '';

                if (groupBy === 'mes') {
                    if (r.data_iso && r.data_iso.length >= 7) {
                        const y = r.data_iso.substring(0, 4);
                        const m = r.data_iso.substring(5, 7);
                        key = `${m}/${y}`;
                        sortKey = `${y}-${m}`;
                    } else if (r.data_dia && r.data_dia.includes('/')) {
                        const parts = r.data_dia.split('/');
                        key = `${parts[1]}/${parts[2]}`;
                        sortKey = `${parts[2]}-${parts[1]}`;
                    } else {
                        key = 'Data N/D';
                        sortKey = '0000-00';
                    }
                } else {
                    if (r.data_dia) {
                        key = r.data_dia;
                        sortKey = r.data_iso || r.data_dia;
                    } else if (r.data_iso) {
                        const parts = r.data_iso.split('-');
                        key = `${parts[2]}/${parts[1]}/${parts[0]}`;
                        sortKey = r.data_iso;
                    } else {
                        key = 'Data N/D';
                        sortKey = '0000-00-00';
                    }
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

            return Object.values(map).sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || ''));
        },

        /**
         * Distribuição por Faixas de Gravidade de Captura
         */
        computeSeverityDistribution: function (records) {
            const threshold = _params.manejo === 'plantio' ? _params.min_adultos_plantio : _params.min_adultos_soca;
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
                    else if (m < threshold) classes["Baixa Captura (1-5)"]++;
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
            const threshold = _params.manejo === 'plantio' ? _params.min_adultos_plantio : _params.min_adultos_soca;
            return (records || []).filter(r => {
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
                    if (filters.faixaGravidade === 'CRITERIO' && (r.machos < threshold || !r.is_recolhimento)) return false;
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

    return BrocaEngine;
}));
