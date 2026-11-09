/**
 * herbicida_engine.js
 * Motor de Inteligência Agronômica, Meteorológica e Operacional para Aplicação de Herbicidas
 * Usina Pitangueiras - Safra 2026
 */

(function (window) {
    'use strict';

    const HerbicidaEngine = {

        /**
         * Normaliza registro bruto do MapFy para a estrutura analítica padrão
         */
        normalizeRecord: function (r) {
            if (!r) return null;
            const lat = parseFloat(String(r['Latitude'] || r.lat || '').replace(',', '.'));
            const lon = parseFloat(String(r['Longitude'] || r.lon || r.lng || '').replace(',', '.'));
            const scoreNum = parseFloat(String(r['Score'] || r.score || '').replace(',', '.')) || 0;
            const dataStr = String(r['Data'] || r.data || '').trim();
            const dataDia = dataStr.includes(' ') ? dataStr.split(' ')[0] : dataStr;

            let dataIso = '';
            if (dataDia.includes('/')) {
                const parts = dataDia.split('/');
                if (parts.length === 3) dataIso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }

            const ventoNum = parseFloat(String(r['Vento'] || r.vento || '').replace(',', '.'));
            const urNum = parseFloat(String(r['Umidade Relativa'] || r.ur || '').replace(',', '.'));
            const tempNum = parseFloat(String(r['Temperatura '] || r['Temperatura'] || r.temp || '').replace(',', '.'));
            const espacamentoBicoNum = parseFloat(String(r['Espaçamento de Bico'] || r.espacamento || '').replace(',', '.'));
            const vazaoNum = parseFloat(String(r['Vazão'] || r.vazao || '').replace(',', '.'));

            const hasWeather = !isNaN(tempNum) && !isNaN(urNum) && !isNaN(ventoNum);
            let deltaTNum = null;
            let deltaTClasse = 'Sem Dados';
            if (!isNaN(tempNum) && !isNaN(urNum)) {
                deltaTNum = HerbicidaEngine.calculateDeltaT(tempNum, urNum);
                const dtClassObj = HerbicidaEngine.classifyDeltaT(deltaTNum);
                deltaTClasse = dtClassObj.classe;
            }

            const normAns = (v) => {
                if (!v) return 'N/A';
                const s = String(v).trim().toUpperCase();
                if (s === 'OK') return 'OK';
                if (s === 'NOK' || s === 'NÃO' || s === 'NAO') return 'NOK';
                return 'N/A';
            };

            const q01 = normAns(r['O responsável realizou a avaliação de qualidade antes de iniciar a operação?'] || r.q01);
            const q02 = normAns(r['O responsável possui a Ordem de Serviço e o Mapa da Área disponíveis na frente?'] || r.q02);
            const q03 = normAns(r['Abertura do leque'] || r.q03);
            const q04 = normAns(r['Limpeza de filtros da bomba do implemento '] || r['Limpeza de filtros da bomba do implemento'] || r.q04);
            const q05 = normAns(r['Limpeza de bicos'] || r.q05);

            const temNok = [q01, q02, q03, q04, q05].some(q => q === 'NOK');
            const obs = String(r['Observações'] || r.observacoes || '').trim();
            const isParadaClima = obs.toLowerCase().includes('parada') || obs.toLowerCase().includes('climáticas') || obs.toLowerCase().includes('climaticas');
            const isClima = deltaTClasse.includes('Crítico') || isParadaClima;
            const temOcorrencia = temNok || isClima || obs.length > 0;
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
                fazenda: r['Fazenda'] || r.fazenda || '',
                os: String(r['Ordem de Serviço'] || r.os || ''),
                operacao: r['Operação'] || r.operacao || '',
                planta_soca: r['Planta ou Soca'] || r.planta_soca || '',
                q01, q02, q03, q04, q05,
                vento_num: isNaN(ventoNum) ? null : ventoNum,
                ur_num: isNaN(urNum) ? null : urNum,
                temp_num: isNaN(tempNum) ? null : tempNum,
                espacamento_bico_num: isNaN(espacamentoBicoNum) ? null : espacamentoBicoNum,
                vazao_num: isNaN(vazaoNum) ? null : vazaoNum,
                has_weather: hasWeather,
                delta_t_num: deltaTNum,
                delta_t_classe: deltaTClasse,
                observacoes: obs,
                tem_nok_estruturado: temNok,
                is_parada_clima: isParadaClima,
                is_clima: isClima,
                tem_ocorrencia: temOcorrencia,
                lat: hasCoords ? lat : null,
                lon: hasCoords ? lon : null,
                has_coords: hasCoords,
                _raw: r
            };
        },

        /**
         * Calcula a temperatura de bulbo úmido usando a equação de Stull (2011)
         * @param {number} t Temperatura de bulbo seco em °C
         * @param {number} rh Umidade Relativa do ar em %
         * @returns {number} Temperatura de bulbo úmido (°C)
         */
        calculateWetBulb: function (t, rh) {
            if (t === null || rh === null || isNaN(t) || isNaN(rh)) return null;
            const tw = (t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659))
                + Math.atan(t + rh)
                - Math.atan(rh - 1.676331)
                + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh)
                - 4.686035);
            return Math.round(tw * 100) / 100;
        },

        /**
         * Calcula o Delta T (°C): T_seco - T_úmido
         */
        calculateDeltaT: function (t, rh) {
            const tw = this.calculateWetBulb(t, rh);
            if (tw === null) return null;
            return Math.round((t - tw) * 100) / 100;
        },

        /**
         * Classifica a faixa agronômica oficial do Delta T
         */
        classifyDeltaT: function (dt) {
            if (dt === null || isNaN(dt)) return { classe: "Sem Dados", color: "#64748B", desc: "Telemetria não informada" };
            if (dt < 2.0) {
                return { classe: "Inversão (< 2°C)", color: "#3B82F6", desc: "Alto risco de inversão térmica e deriva de partículas" };
            } else if (dt <= 8.0) {
                return { classe: "Ideal (2-8°C)", color: "#10B981", desc: "Condições ideais de evaporação e deposição" };
            } else if (dt <= 10.0) {
                return { classe: "Atenção (8-10°C)", color: "#F59E0B", desc: "Evaporação acelerada: monitorar e usar gotas médias/grossas" };
            } else {
                return { classe: "Crítico (> 10°C)", color: "#EF4444", desc: "Evaporação severa: interromper aplicação imediatamente" };
            }
        },

        /**
         * Calcula todos os KPIs executivos
         */
        computeExecutiveKPIs: function (records) {
            const total = records.length;
            if (total === 0) {
                return {
                    total: 0, fechados: 0, abertos: 0, comNok: 0, percNok: 0,
                    comOcorrencia: 0, percOcorrencia: 0, alertasClima: 0,
                    fazendasCount: 0, osCount: 0, georrefPerc: 100
                };
            }

            let fechados = 0;
            let abertos = 0;
            let comNok = 0;
            let comOcorrencia = 0;
            let alertasClima = 0;
            const fazendasSet = new Set();
            const osSet = new Set();
            let comCoords = 0;

            records.forEach(r => {
                if (r.status === 'Fechado') fechados++;
                if (r.status === 'Aberto') abertos++;
                if (r.tem_nok_estruturado) comNok++;
                if (r.tem_ocorrencia) comOcorrencia++;
                if (r.is_clima || r.delta_t_classe === 'Crítico (> 10°C)' || r.is_parada_clima) alertasClima++;
                if (r.fazenda) fazendasSet.add(r.fazenda);
                if (r.os) osSet.add(r.os);
                if (r.has_coords) comCoords++;
            });

            return {
                total: total,
                fechados: fechados,
                abertos: abertos,
                comNok: comNok,
                percNok: Math.round((comNok / total) * 1000) / 10,
                comOcorrencia: comOcorrencia,
                percOcorrencia: Math.round((comOcorrencia / total) * 1000) / 10,
                alertasClima: alertasClima,
                fazendasCount: fazendasSet.size,
                osCount: osSet.size,
                georrefPerc: Math.round((comCoords / total) * 1000) / 10
            };
        },

        /**
         * Estatísticas detalhadas de meteorologia
         */
        computeWeatherStats: function (records) {
            const weatherRecords = records.filter(r => r.has_weather && r.temp_num !== null && r.ur_num !== null && r.vento_num !== null);
            const totalComClima = weatherRecords.length;

            if (totalComClima === 0) {
                return {
                    totalComClima: 0,
                    vento: { avg: 0, min: 0, max: 0, count: 0 },
                    ur: { avg: 0, min: 0, max: 0, count: 0 },
                    temp: { avg: 0, min: 0, max: 0, count: 0 },
                    deltaT: { avg: 0, min: 0, max: 0, count: 0, classes: {} }
                };
            }

            const ventos = weatherRecords.map(r => r.vento_num);
            const urs = weatherRecords.map(r => r.ur_num);
            const temps = weatherRecords.map(r => r.temp_num);
            const deltaTs = weatherRecords.map(r => r.delta_t_num);

            const calcStats = arr => {
                const sum = arr.reduce((a, b) => a + b, 0);
                return {
                    avg: Math.round((sum / arr.length) * 10) / 10,
                    min: Math.min(...arr),
                    max: Math.max(...arr),
                    count: arr.length
                };
            };

            // Contagem por classes de Delta T
            const deltaTClasses = {
                "Ideal (2-8°C)": 0,
                "Atenção (8-10°C)": 0,
                "Crítico (> 10°C)": 0,
                "Inversão (< 2°C)": 0,
                "Sem Telemetria": records.length - totalComClima
            };

            weatherRecords.forEach(r => {
                if (r.delta_t_classe && deltaTClasses[r.delta_t_classe] !== undefined) {
                    deltaTClasses[r.delta_t_classe]++;
                } else if (r.delta_t_classe) {
                    deltaTClasses[r.delta_t_classe] = (deltaTClasses[r.delta_t_classe] || 0) + 1;
                }
            });

            return {
                totalComClima: totalComClima,
                semTelemetria: records.length - totalComClima,
                vento: calcStats(ventos),
                ur: calcStats(urs),
                temp: calcStats(temps),
                deltaT: {
                    ...calcStats(deltaTs),
                    classes: deltaTClasses
                }
            };
        },

        /**
         * Estatísticas de regulagem e condições do equipamento
         */
        computeEquipmentCondition: function (records) {
            let filtroOk = 0, filtroNok = 0;
            let bicoOk = 0, bicoNok = 0, bicoNa = 0;
            let ambosOk = 0, apenasFiltroNok = 0, apenasBicoNok = 0, ambosNok = 0;

            const espGrupos = {};
            const vazoes = {};

            records.forEach(r => {
                const fNok = r.is_nok_filtro;
                const bNok = r.is_nok_bico;
                const bNa = (r.limpeza_bicos || '').includes('N / A') || (r.limpeza_bicos || '').includes('N/A');

                if (fNok) filtroNok++; else filtroOk++;
                if (bNok) bicoNok++; else if (bNa) bicoNa++; else bicoOk++;

                if (!fNok && !bNok) ambosOk++;
                else if (fNok && !bNok) apenasFiltroNok++;
                else if (!fNok && bNok) apenasBicoNok++;
                else if (fNok && bNok) ambosNok++;

                // Grupos de Espaçamento
                const eg = r.esp_grupo || 'Não Informado';
                espGrupos[eg] = (espGrupos[eg] || 0) + 1;

                // Vazão
                const vz = r.vazao_orig || 'Não Informado';
                vazoes[vz] = (vazoes[vz] || 0) + 1;
            });

            const total = records.length;
            return {
                filtros: {
                    ok: filtroOk,
                    nok: filtroNok,
                    percOk: total > 0 ? Math.round((filtroOk / total) * 1000) / 10 : 0
                },
                bicos: {
                    ok: bicoOk,
                    nok: bicoNok,
                    na: bicoNa,
                    percOk: (bicoOk + bicoNok) > 0 ? Math.round((bicoOk / (bicoOk + bicoNok)) * 1000) / 10 : 0
                },
                matrizLimpeza: {
                    ambosOk: ambosOk,
                    apenasFiltroNok: apenasFiltroNok,
                    apenasBicoNok: apenasBicoNok,
                    ambosNok: ambosNok
                },
                espGrupos: espGrupos,
                vazoes: vazoes
            };
        },

        /**
         * Estatísticas dos procedimentos operacionais
         */
        computeProcedures: function (records) {
            let avalOk = 0, avalNok = 0;
            let mapaOk = 0, mapaNok = 0;

            records.forEach(r => {
                if (r.aval_previa === 'OK') avalOk++; else avalNok++;
                if (r.mapa_os === 'OK') mapaOk++; else mapaNok++;
            });

            const total = records.length;
            return {
                avalPrevia: {
                    ok: avalOk,
                    nok: avalNok,
                    percOk: total > 0 ? Math.round((avalOk / total) * 1000) / 10 : 0
                },
                mapaOs: {
                    ok: mapaOk,
                    nok: mapaNok,
                    percOk: total > 0 ? Math.round((mapaOk / total) * 1000) / 10 : 0
                }
            };
        },

        /**
         * Inteligência das Ocorrências e Observações
         */
        computeOccurrencesIntelligence: function (records) {
            const categoriesCount = {};
            const tagsCount = {};
            let paradasClima = 0;
            let vazamentos = 0;
            let problemasBicos = 0;
            let acoesRegistradas = 0;

            records.forEach(r => {
                if (r.is_parada_clima) paradasClima++;
                if (r.is_vazamento) vazamentos++;
                if (r.is_problema_bico) problemasBicos++;
                if (r.has_acao) acoesRegistradas++;

                if (Array.isArray(r.categorias)) {
                    r.categorias.forEach(cat => {
                        categoriesCount[cat] = (categoriesCount[cat] || 0) + 1;
                    });
                }
                if (Array.isArray(r.tags)) {
                    r.tags.forEach(tag => {
                        tagsCount[tag] = (tagsCount[tag] || 0) + 1;
                    });
                }
            });

            return {
                paradasClima: paradasClima,
                vazamentos: vazamentos,
                problemasBicos: problemasBicos,
                acoesRegistradas: acoesRegistradas,
                categoriesCount: categoriesCount,
                tagsCount: tagsCount
            };
        },

        /**
         * Identificação e Histórico de Equipamentos Citados
         */
        computeEquipmentFleet: function (records) {
            const fleetMap = {
                "Trator 11225": { id: "11225", tipo: "Trator", nome: "Trator 11225", inspecoes: 0, ocorrencias: 0, problemas: [], registros: [] },
                "Trator 11125": { id: "11125", tipo: "Trator", nome: "Trator 11125", inspecoes: 0, ocorrencias: 0, problemas: [], registros: [] },
                "Equipamento 70122": { id: "70122", tipo: "Equipamento", nome: "Equipamento 70122", inspecoes: 0, ocorrencias: 0, problemas: [], registros: [] },
                "Caminhão de Calda 31817": { id: "31817", tipo: "Caminhão", nome: "Caminhão de Calda 31817", inspecoes: 0, ocorrencias: 0, problemas: [], registros: [] }
            };

            let naoIdentificados = 0;

            records.forEach(r => {
                const eqNames = r.equipamentos_nomes || [];
                if (eqNames.length === 0) {
                    naoIdentificados++;
                } else {
                    eqNames.forEach(nome => {
                        if (fleetMap[nome]) {
                            const entry = fleetMap[nome];
                            entry.inspecoes++;
                            if (r.tem_ocorrencia) entry.ocorrencias++;
                            if (r.obs) entry.problemas.push(r.obs);
                            entry.registros.push(r);
                        }
                    });
                }
            });

            return {
                frota: Object.values(fleetMap),
                naoIdentificados: naoIdentificados
            };
        },

        /**
         * Agrupamento por Operação Agrícola
         */
        computeOperationBreakdown: function (records) {
            const map = {};
            records.forEach(r => {
                const op = r.operacao || 'Não Informado';
                if (!map[op]) {
                    map[op] = {
                        nome: op,
                        total: 0,
                        ocorrencias: 0,
                        nok: 0,
                        paradasClima: 0,
                        vazoes: new Set(),
                        fazendas: new Set()
                    };
                }
                const entry = map[op];
                entry.total++;
                if (r.tem_ocorrencia) entry.ocorrencias++;
                if (r.tem_nok_estruturado) entry.nok++;
                if (r.is_parada_clima) entry.paradasClima++;
                if (r.vazao_orig && r.vazao_orig !== 'Não Informado') entry.vazoes.add(r.vazao_orig);
                if (r.fazenda) entry.fazendas.add(r.fazenda);
            });

            return Object.values(map).map(e => ({
                ...e,
                fazendasCount: e.fazendas.size,
                vazoesList: Array.from(e.vazoes).join(', ') || 'N/I',
                percOcorrencia: Math.round((e.ocorrencias / e.total) * 100)
            })).sort((a, b) => b.total - a.total);
        },

        /**
         * Agrupamento por Planta ou Soca
         */
        computePlantaSocaBreakdown: function (records) {
            const map = {};
            records.forEach(r => {
                const ps = r.planta_soca || 'Não Informado';
                if (!map[ps]) {
                    map[ps] = { tipo: ps, total: 0, ocorrencias: 0, nok: 0, paradasClima: 0 };
                }
                map[ps].total++;
                if (r.tem_ocorrencia) map[ps].ocorrencias++;
                if (r.tem_nok_estruturado) map[ps].nok++;
                if (r.is_parada_clima) map[ps].paradasClima++;
            });
            return Object.values(map).sort((a, b) => b.total - a.total);
        },

        /**
         * Agrupamento e Ranking por Fazenda com volume ponderado
         */
        computeFarmRanking: function (records) {
            const map = {};
            records.forEach(r => {
                const faz = r.fazenda || 'Não Informado';
                if (!map[faz]) {
                    map[faz] = {
                        fazenda: faz,
                        total: 0,
                        ocorrencias: 0,
                        nok: 0,
                        paradasClima: 0,
                        problemasEquip: 0,
                        ultimaData: r.data
                    };
                }
                const entry = map[faz];
                entry.total++;
                if (r.tem_ocorrencia) entry.ocorrencias++;
                if (r.tem_nok_estruturado) entry.nok++;
                if (r.is_parada_clima) entry.paradasClima++;
                if (r.is_vazamento || r.is_problema_bico || r.is_nok_filtro || r.is_nok_bico) entry.problemasEquip++;
            });

            return Object.values(map).map(e => ({
                ...e,
                taxaOcorrencia: Math.round((e.ocorrencias / e.total) * 100)
            })).sort((a, b) => b.total - a.total || b.ocorrencias - a.ocorrencias);
        },

        /**
         * Agrupamento temporal (Diário / Mensal)
         */
        computeTemporalData: function (records, groupBy) {
            const map = {};
            records.forEach(r => {
                let key;
                if (groupBy === 'mes') {
                    // YYYY-MM
                    key = r.data_iso ? r.data_iso.substring(0, 7) : '2026-10';
                } else if (groupBy === 'semana') {
                    // Agrupa por semana ou quinzena
                    key = r.data_dia ? r.data_dia.substring(3) : 'Semana'; // MM/YYYY
                } else {
                    // Diário: DD/MM
                    key = r.data_dia ? r.data_dia.substring(0, 5) : 'Dia';
                }

                if (!map[key]) {
                    map[key] = { label: key, total: 0, ocorrencias: 0, nok: 0, paradasClima: 0 };
                }
                map[key].total++;
                if (r.tem_ocorrencia) map[key].ocorrencias++;
                if (r.tem_nok_estruturado) map[key].nok++;
                if (r.is_parada_clima) map[key].paradasClima++;
            });

            return Object.values(map);
        },

        /**
         * Estatísticas de Duração da Inspeção
         */
        computeDurationStats: function (records) {
            const durations = records.map(r => r.duracao_min).filter(d => typeof d === 'number' && !isNaN(d));
            if (durations.length === 0) return { avg: 0, min: 0, max: 0, median: 0 };

            durations.sort((a, b) => a - b);
            const sum = durations.reduce((a, b) => a + b, 0);
            const mid = Math.floor(durations.length / 2);
            const median = durations.length % 2 !== 0 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2;

            return {
                avg: Math.round((sum / durations.length) * 10) / 10,
                min: durations[0],
                max: durations[durations.length - 1],
                median: Math.round(median * 10) / 10
            };
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
                if (filters.os && filters.os !== 'TODAS') {
                    if (r.os !== filters.os) return false;
                }
                if (filters.operacao && filters.operacao !== 'TODAS') {
                    if (r.operacao !== filters.operacao) return false;
                }
                if (filters.plantaSoca && filters.plantaSoca !== 'TODAS') {
                    if (r.planta_soca !== filters.plantaSoca) return false;
                }
                if (filters.status && filters.status !== 'TODOS') {
                    if (r.status !== filters.status) return false;
                }
                if (filters.filtroBomba && filters.filtroBomba !== 'TODOS') {
                    if (r.filtro_bomba !== filters.filtroBomba) return false;
                }
                if (filters.limpezaBicos && filters.limpezaBicos !== 'TODOS') {
                    if (r.limpeza_bicos !== filters.limpezaBicos) return false;
                }
                if (filters.deltaTClasse && filters.deltaTClasse !== 'TODAS') {
                    if (r.delta_t_classe !== filters.deltaTClasse) return false;
                }
                if (filters.equipamento && filters.equipamento !== 'TODOS') {
                    if (!r.equipamentos_nomes || !r.equipamentos_nomes.includes(filters.equipamento)) return false;
                }
                if (filters.somenteOcorrencias) {
                    if (!r.tem_ocorrencia) return false;
                }
                if (filters.somenteNok) {
                    if (!r.tem_nok_estruturado) return false;
                }
                if (filters.somenteCoords) {
                    if (!r.has_coords) return false;
                }
                if (filters.buscaTexto) {
                    const q = filters.buscaTexto.toLowerCase();
                    const match = String(r.id).includes(q) ||
                        (r.fazenda && r.fazenda.toLowerCase().includes(q)) ||
                        (r.os && r.os.toLowerCase().includes(q)) ||
                        (r.operacao && r.operacao.toLowerCase().includes(q)) ||
                        (r.usuario && r.usuario.toLowerCase().includes(q)) ||
                        (r.obs && r.obs.toLowerCase().includes(q)) ||
                        (r.equipamentos_nomes && r.equipamentos_nomes.some(e => e.toLowerCase().includes(q)));
                    if (!match) return false;
                }
                return true;
            });
        }
    };

    window.HerbicidaEngine = HerbicidaEngine;
})(window);
