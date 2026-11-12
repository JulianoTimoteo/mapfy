/**
 * herbicida_engine.js
 * Motor de Inteligência Agronômica, Meteorológica e Operacional para Aplicação de Herbicidas
 * Usina Pitangueiras - Safra 2026
 * 
 * Implementação canônica da Fórmula Psicrométrica de Stull (2011)
 * Classificação oficial de Delta T e Auditoria de Tecnologia de Aplicação
 */

(function (window) {
    'use strict';

    const HerbicidaEngine = {

        /**
         * Calcula a temperatura de bulbo úmido usando a equação de Stull (2011)
         * Tw = T * atan(0.151977 * sqrt(UR + 8.313659)) + atan(T + UR) - atan(UR - 1.676331) 
         *      + 0.00391838 * UR^(1.5) * atan(0.023101 * UR) - 4.686035
         * @param {number} t Temperatura de bulbo seco em °C
         * @param {number} rh Umidade Relativa do ar em % (0 a 100)
         * @returns {number|null} Temperatura de bulbo úmido (°C) ou null se inválido
         */
        calculateWetBulb: function (t, rh) {
            if (t === null || rh === null || isNaN(t) || isNaN(rh)) return null;
            const temp = Number(t);
            const ur = Number(rh);

            // Validação de intervalo físico válido para a aproximação de Stull
            if (temp < -10 || temp > 55 || ur < 1 || ur > 100) {
                return null;
            }

            const tw = (
                temp * Math.atan(0.151977 * Math.sqrt(ur + 8.313659)) +
                Math.atan(temp + ur) -
                Math.atan(ur - 1.676331) +
                0.00391838 * Math.pow(ur, 1.5) * Math.atan(0.023101 * ur) -
                4.686035
            );

            return Math.round(tw * 100) / 100;
        },

        /**
         * Calcula o Delta T (°C): Temperatura do Ar (Bulbo Seco) - Bulbo Úmido
         * @param {number} t Temperatura de bulbo seco (°C)
         * @param {number} rh Umidade Relativa (%)
         * @returns {number|null} Delta T em °C ou null se dados forem inválidos
         */
        calculateDeltaT: function (t, rh) {
            const tw = this.calculateWetBulb(t, rh);
            if (tw === null) return null;
            return Math.round((Number(t) - tw) * 100) / 100;
        },

        /**
         * Classifica a faixa agronômica oficial do Delta T (Safra 2026)
         * @param {number} dt Delta T em °C
         * @returns {Object} Objeto com classe, cor, status e recomendações
         */
        classifyDeltaT: function (dt) {
            if (dt === null || isNaN(dt)) {
                return {
                    classe: "Sem Dados",
                    statusKey: "sem_dados",
                    color: "#64748B",
                    badgeClass: "badge-slate",
                    desc: "Telemetria meteorológica não informada",
                    recomendacao: "Registrar medições reais de campo ou sincronizar com a estação virtual externa.",
                    faixaTxt: "N/A"
                };
            }

            const val = Number(dt);

            if (val < 2.0) {
                return {
                    classe: "Muito Baixo (< 2°C)",
                    statusKey: "muito_baixo",
                    color: "#2563EB",
                    badgeClass: "badge-blue",
                    desc: "Baixa evaporação de gotas / Risco de inversão térmica",
                    recomendacao: "O ar está saturado ou próximo do ponto de orvalho. Gotículas permanecem suspensas em névoa/neblina e sofrem deriva estática sem depositar no alvo. Aguarde aquecimento solar e circulação de ar.",
                    faixaTxt: "< 2°C"
                };
            } else if (val <= 8.0) {
                return {
                    classe: "Ideal (2-8°C)",
                    statusKey: "ideal",
                    color: "#059669",
                    badgeClass: "badge-emerald",
                    desc: "Condições mais adequadas para pulverização",
                    recomendacao: "Excelente equilíbrio entre vida útil da gota e absorção foliar. Aplicação recomendada mantendo a velocidade do vento entre 3 e 10 km/h e pontas adequadas ao alvo.",
                    faixaTxt: "2 - 8°C"
                };
            } else if (val <= 10.0) {
                return {
                    classe: "Atenção (8-10°C)",
                    statusKey: "atencao",
                    color: "#D97706",
                    badgeClass: "badge-amber",
                    desc: "Condições marginais / Evaporação acelerada",
                    recomendacao: "O ambiente apresenta maior potencial de evaporação das gotas. Avaliar o uso de gotas mais grossas (pontas de indução de ar), adjuvantes antideriva e monitorar a velocidade do vento.",
                    faixaTxt: "> 8 - 10°C"
                };
            } else {
                return {
                    classe: "Crítico (> 10°C)",
                    statusKey: "critico",
                    color: "#DC2626",
                    badgeClass: "badge-red",
                    desc: "Inadequada para gotas médias e finas / Evaporação severa",
                    recomendacao: "Evaporação drástica e imediata antes de atingir o solo ou planta daninha. Alto risco de ineficácia de produto e contaminação vizinha. Interromper a aplicação imediatamente.",
                    faixaTxt: "> 10°C"
                };
            }
        },

        /**
         * Perfis Agronômicos de Produtos Herbicidas e Matriz de Decisão Delta T
         */
        HERBICIDE_PRODUCT_PROFILES: {
            "sistemicos": {
                tipo: "Herbicidas Sistêmicos (Pós-Emergência)",
                exemplos: ["Glifosato", "2,4-D", "Haloxifope", "Cletodim", "Imazapique"],
                alvo: "Folhagem verde ativa da planta daninha",
                deltaTIdeal: "2 a 8°C",
                deltaTMax: 8.0,
                gotaRecomendada: "Média a Grossa (250 a 350 µm)",
                pontasRecomendadas: "Leque plano antideriva ou pré-orifício (ex: TTJ60, AIXR)",
                adjuvante: "Óleo mineral ou vegetal esterificado (MSO) + antideriva",
                riscoAltoDeltaT: "Cristalização prematura da gota na cutícula e fechamento estomático, reduzindo absorção sistêmica para menos de 40%."
            },
            "contato": {
                tipo: "Herbicidas de Contato (Dessecação / Folha Larga)",
                exemplos: ["Diquat", "Glufosinato de Amônio", "Saflufenacil", "Carfentrazona"],
                alvo: "Área foliar completa da invasora (sem translocação)",
                deltaTIdeal: "2 a 8°C (Rigoroso)",
                deltaTMax: 8.0,
                gotaRecomendada: "Média (200 a 300 µm)",
                pontasRecomendadas: "Leque duplo plano com alta densidade de gotas (ex: TTJ60, TXB)",
                adjuvante: "Espalhante adesivo siliconado de alta penetração",
                riscoAltoDeltaT: "Gotas finas evaporam antes de atingir as folhas basais; risco de queima incompleta e rebrota rápida."
            },
            "pre_emergentes": {
                tipo: "Herbicidas Pré-Emergentes (Solo / Palhada)",
                exemplos: ["Sulfentrazona", "Indaziflam", "Tebuthiuron", "Metribuzin", "Flumioxazina"],
                alvo: "Solo descoberto ou palhada de cana crua (banco de sementes)",
                deltaTIdeal: "2 a 8°C (Tolerado até 10°C)",
                deltaTMax: 10.0,
                gotaRecomendada: "Muito Grossa a Ultra Grossa (400 a 650 µm)",
                pontasRecomendadas: "Indução de ar estrita (ex: TTI, AIXR, ULD)",
                adjuvante: "Polímeros antideriva e surfactantes de transposição de palhada",
                riscoAltoDeltaT: "Perda por deriva de partículas finas para áreas vizinhas e menor deposição na terra sob a palhada."
            }
        },

        /**
         * Avalia a conformidade operacional de uma aplicação frente ao tipo de produto
         */
        evaluateProductApplication: function (productKey, deltaT, vento) {
            const profile = this.HERBICIDE_PRODUCT_PROFILES[productKey] || this.HERBICIDE_PRODUCT_PROFILES["sistemicos"];
            if (deltaT === null || isNaN(deltaT)) {
                return { status: "Sem Dados", statusClass: "badge-slate", seguro: false, motivo: "Sem telemetria" };
            }
            const dt = Number(deltaT);
            const w = (vento !== null && !isNaN(vento)) ? Number(vento) : 0;

            if (dt < 2.0) {
                return {
                    status: "Risco de Inversão Térmica",
                    statusClass: "badge-blue",
                    seguro: false,
                    motivo: "Ar muito úmido/frio. Gotas em suspensão estática. Risco de deriva vaporizada."
                };
            }
            if (dt > profile.deltaTMax) {
                return {
                    status: "Inadequada (Evaporação Severa)",
                    statusClass: "badge-red",
                    seguro: false,
                    motivo: `Delta T de ${dt}°C excede o limite máximo recomendado de ${profile.deltaTMax}°C para ${profile.tipo}. ${profile.riscoAltoDeltaT}`
                };
            }
            if (dt > 8.0 && profile.deltaTMax >= 10.0) {
                return {
                    status: "Condicional (Exige Indução de Ar)",
                    statusClass: "badge-amber",
                    seguro: true,
                    motivo: "Faixa marginal. Permitido somente com gotas muito grossas (bicos de ar induzido) e adjuvante antideriva."
                };
            }
            if (w > 12.0) {
                return {
                    status: "Atenção (Vento Elevado)",
                    statusClass: "badge-amber",
                    seguro: false,
                    motivo: `Vento de ${w} km/h acima do limite seguro de 10-12 km/h. Risco de arraste mecânico de gotas.`
                };
            }
            return {
                status: "Janela Agronômica Ideal",
                statusClass: "badge-emerald",
                seguro: true,
                motivo: `Condição ideal para ${profile.tipo}. Excelente absorção e deposição no alvo.`
            };
        },

        /**
         * Gera recomendação técnica agronômica consolidada a partir do conjunto de dados
         */
        getConsolidatedRecommendation: function (stats) {
            if (!stats || !stats.deltaT || stats.totalComClima === 0) {
                return {
                    titulo: "Telemetria Incompleta no Conjunto Filtrado",
                    texto: "Não há registros com medição meteorológica completa (Temperatura, Umidade e Vento) no filtro atual para emitir laudo psicrométrico. Sincronize com a API Open-Meteo ou selecione outro período.",
                    severidade: "info",
                    cor: "#64748B"
                };
            }

            const dtMedio = stats.deltaT.avg;
            const percIdeal = stats.deltaT.percIdeal || 0;
            const percCritico = stats.deltaT.percCritico || 0;
            const ventoMedio = stats.vento.avg;

            if (percCritico >= 30 || dtMedio > 10.0) {
                return {
                    titulo: "ALERTA CRÍTICO: Risco Severo de Evaporação e Perda de Eficácia",
                    texto: `Média de Delta T em ${dtMedio.toFixed(1)}°C (${percCritico}% das inspeções em faixa crítica). As gotas evaporam antes de atingir o alvo, reduzindo a deposição do herbicida e aumentando o risco de fito em áreas vizinhas. Parada técnica mandatória.`,
                    severidade: "critico",
                    cor: "#DC2626"
                };
            }

            if (dtMedio > 8.0) {
                return {
                    titulo: "ATENÇÃO OPERACIONAL: Evaporação Acelerada das Gotas",
                    texto: `Delta T médio em ${dtMedio.toFixed(1)}°C. Recomenda-se uso estrito de bicos com indução de ar (gotas grossas/muito grossas), redução da pressão e inclusão de óleo vegetal/mineral ou adjuvantes antideriva para manter a calda líquida até a absorção foliar.`,
                    severidade: "atencao",
                    cor: "#D97706"
                };
            }

            if (dtMedio < 2.0 && stats.totalComClima > 0) {
                return {
                    titulo: "ALERTA DE INVERSÃO TÉRMICA: Risco de Deriva Estática",
                    texto: `Delta T médio em ${dtMedio.toFixed(1)}°C (< 2°C). Atmosfera altamente estável com ar frio estagnado rente ao solo. As gotas finas ficam flutuando e podem ser arrastadas por brisas leves para fora do talhão. Aguardar vento mínimo de 3 km/h.`,
                    severidade: "inversao",
                    cor: "#2563EB"
                };
            }

            return {
                titulo: "CONDIÇÃO EXCELENTE: Janela Agronômica Segura",
                texto: `Delta T médio de ${dtMedio.toFixed(1)}°C (${percIdeal}% das inspeções dentro da janela ideal de 2 a 8°C). Velocidade média do vento em ${ventoMedio.toFixed(1)} km/h. Condição ideal para aplicação uniforme e máxima eficácia de controle de plantas daninhas.`,
                severidade: "ideal",
                cor: "#059669"
            };
        },

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
            const horaStr = dataStr.includes(' ') ? dataStr.split(' ')[1] : '';

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
            let deltaTClassObj = HerbicidaEngine.classifyDeltaT(null);
            let bulboUmidoNum = null;

            if (!isNaN(tempNum) && !isNaN(urNum)) {
                bulboUmidoNum = HerbicidaEngine.calculateWetBulb(tempNum, urNum);
                deltaTNum = HerbicidaEngine.calculateDeltaT(tempNum, urNum);
                deltaTClassObj = HerbicidaEngine.classifyDeltaT(deltaTNum);
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
            const isClima = deltaTClassObj.classe.includes('Crítico') || isParadaClima;
            const temOcorrencia = temNok || isClima || obs.length > 0;
            const hasCoords = !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;

            // Identificação de equipamentos em observações
            const equipNomes = [];
            const obsUpper = obs.toUpperCase();
            if (obsUpper.includes('11225')) equipNomes.push('Trator 11225');
            if (obsUpper.includes('11125')) equipNomes.push('Trator 11125');
            if (obsUpper.includes('70122')) equipNomes.push('Equipamento 70122');
            if (obsUpper.includes('31817')) equipNomes.push('Caminhão de Calda 31817');

            // Categorias e tags
            const tags = [];
            if (isParadaClima) tags.push('Parada por Clima');
            if (deltaTClassObj.classe.includes('Crítico')) tags.push('Delta T Crítico');
            if (deltaTClassObj.classe.includes('Atenção')) tags.push('Delta T Atenção');
            if (obsUpper.includes('VAZAMENTO')) tags.push('Vazamento');
            if (obsUpper.includes('BICO')) tags.push('Problema no Bico');
            if (q04 === 'NOK') tags.push('Filtro da Bomba NOK');
            if (q05 === 'NOK') tags.push('Limpeza de Bicos NOK');

            return {
                id: String(r['ID'] || r.id || ''),
                usuario: r['Usuário'] || r.usuario || 'Não informado',
                data: dataStr || 'Não informado',
                data_dia: dataDia || 'Não informado',
                data_iso: dataIso,
                hora_str: horaStr,
                data_inicio: r['Data início'] || r.data_inicio || '',
                data_fim: r['Data Fim'] || r.data_fim || '',
                status: r['Status'] || r.status || 'Aberto',
                score: r['Score'] || r.score || '0,00',
                score_num: scoreNum,
                fazenda: r['Fazenda'] || r.fazenda || 'Não informada',
                os: String(r['Ordem de Serviço'] || r.os || 'Não informada'),
                operacao: r['Operação'] || r.operacao || 'Não informada',
                planta_soca: r['Planta ou Soca'] || r.planta_soca || 'Não informado',
                q01, q02, q03, q04, q05,
                filtro_bomba: q04,
                limpeza_bicos: q05,
                abertura_leque: q03,
                mapa_os: q02,
                aval_previa: q01,
                is_nok_filtro: q04 === 'NOK',
                is_nok_bico: q05 === 'NOK',
                is_vazamento: obsUpper.includes('VAZAMENTO'),
                is_problema_bico: obsUpper.includes('BICO') || q05 === 'NOK',
                has_acao: obsUpper.includes('ORIENTADO') || obsUpper.includes('CORRIGIDO') || obsUpper.includes('EFETUADO'),
                vento_num: isNaN(ventoNum) ? null : ventoNum,
                ur_num: isNaN(urNum) ? null : urNum,
                temp_num: isNaN(tempNum) ? null : tempNum,
                bulbo_umido_num: bulboUmidoNum,
                espacamento_bico_num: isNaN(espacamentoBicoNum) ? null : espacamentoBicoNum,
                esp_orig: r['Espaçamento de Bico'] || 'Não informado',
                esp_grupo: !isNaN(espacamentoBicoNum) ? `${espacamentoBicoNum}m` : 'Não informado',
                vazao_num: isNaN(vazaoNum) ? null : vazaoNum,
                vazao_orig: r['Vazão'] ? `${r['Vazão']} L/ha` : 'Não informado',
                has_weather: hasWeather,
                delta_t_num: deltaTNum,
                delta_t_classe: deltaTClassObj.classe,
                delta_t_status_key: deltaTClassObj.statusKey,
                delta_t_color: deltaTClassObj.color,
                delta_t_desc: deltaTClassObj.desc,
                delta_t_rec: deltaTClassObj.recomendacao,
                pin_color: deltaTClassObj.color,
                observacoes: obs,
                obs: obs,
                equipamentos_nomes: equipNomes,
                tags: tags,
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
         * Filtra os registros analíticos conforme os critérios dinâmicos globais
         * @param {Array} records Lista de registros normalizados
         * @param {Object} filters Objeto de filtros ativos
         * @returns {Array} Registros filtrados
         */
        filterRecords: function (records, filters = {}) {
            if (!Array.isArray(records)) return [];
            return records.filter(r => {
                // Filtro por Data Início (formato YYYY-MM-DD)
                if (filters.dataInicio) {
                    const rDate = r.data_iso || '';
                    if (rDate && rDate < filters.dataInicio) return false;
                }

                // Filtro por Data Fim (formato YYYY-MM-DD)
                if (filters.dataFim) {
                    const rDate = r.data_iso || '';
                    if (rDate && rDate > filters.dataFim) return false;
                }

                // Fazenda
                if (filters.fazenda && filters.fazenda !== 'TODAS' && r.fazenda !== filters.fazenda) {
                    return false;
                }

                // Ordem de Serviço (OS)
                if (filters.os && filters.os !== 'TODAS' && String(r.os) !== String(filters.os)) {
                    return false;
                }

                // Operação
                if (filters.operacao && filters.operacao !== 'TODAS' && r.operacao !== filters.operacao) {
                    return false;
                }

                // Planta ou Soca
                if (filters.plantaSoca && filters.plantaSoca !== 'TODAS' && r.planta_soca !== filters.plantaSoca) {
                    return false;
                }

                // Status MapFy
                if (filters.status && filters.status !== 'TODOS' && r.status !== filters.status) {
                    return false;
                }

                // Filtro da Bomba
                if (filters.filtroBomba && filters.filtroBomba !== 'TODOS') {
                    if (filters.filtroBomba === 'OK' && r.is_nok_filtro) return false;
                    if (filters.filtroBomba === 'NOK' && !r.is_nok_filtro) return false;
                }

                // Limpeza de Bicos
                if (filters.limpezaBicos && filters.limpezaBicos !== 'TODOS') {
                    if (filters.limpezaBicos === 'OK' && r.limpeza_bicos !== 'OK') return false;
                    if (filters.limpezaBicos === 'NOK' && r.limpeza_bicos !== 'NOK') return false;
                    if (filters.limpezaBicos === 'N / A' && !r.limpeza_bicos.includes('N')) return false;
                }

                // Faixa de Delta T
                if (filters.deltaTClasse && filters.deltaTClasse !== 'TODAS') {
                    if (r.delta_t_classe !== filters.deltaTClasse) return false;
                }

                // Equipamento nominal
                if (filters.equipamento && filters.equipamento !== 'TODOS') {
                    const nomes = r.equipamentos_nomes || [];
                    if (!nomes.includes(filters.equipamento)) return false;
                }

                // Apenas Ocorrências
                if (filters.somenteOcorrencias && !r.tem_ocorrencia) {
                    return false;
                }

                // Apenas com Respostas NOK
                if (filters.somenteNok && !r.tem_nok_estruturado && !r.is_nok_filtro && !r.is_nok_bico) {
                    return false;
                }

                // Apenas Georreferenciados (100%)
                if (filters.somenteCoords && (!r.has_coords || r.lat === 0 || r.lon === 0)) {
                    return false;
                }

                // Busca Textual Global
                if (filters.buscaTexto) {
                    const termo = filters.buscaTexto.toLowerCase();
                    const matchId = String(r.id).toLowerCase().includes(termo);
                    const matchFazenda = String(r.fazenda).toLowerCase().includes(termo);
                    const matchOs = String(r.os).toLowerCase().includes(termo);
                    const matchOp = String(r.operacao).toLowerCase().includes(termo);
                    const matchObs = String(r.obs || '').toLowerCase().includes(termo);
                    const matchEquip = (r.equipamentos_nomes || []).some(e => e.toLowerCase().includes(termo));

                    if (!matchId && !matchFazenda && !matchOs && !matchOp && !matchObs && !matchEquip) {
                        return false;
                    }
                }

                return true;
            });
        },

        /**
         * Estatísticas detalhadas de meteorologia de campo (Telemetria MapFy)
         */
        computeWeatherStats: function (records) {
            const weatherRecords = records.filter(r => r.has_weather && r.temp_num !== null && r.ur_num !== null && r.vento_num !== null);
            const totalComClima = weatherRecords.length;
            const totalRegistros = records.length;
            const semTelemetria = totalRegistros - totalComClima;

            if (totalComClima === 0) {
                return {
                    totalComClima: 0,
                    semTelemetria: semTelemetria,
                    totalRegistros: totalRegistros,
                    percComClima: 0,
                    vento: { avg: 0, min: 0, max: 0, count: 0, hasData: false },
                    ur: { avg: 0, min: 0, max: 0, count: 0, hasData: false },
                    temp: { avg: 0, min: 0, max: 0, count: 0, hasData: false },
                    bulboUmido: { avg: 0, min: 0, max: 0, count: 0, hasData: false },
                    deltaT: {
                        avg: 0, min: 0, max: 0, count: 0, hasData: false,
                        classes: {
                            "Muito Baixo (< 2°C)": 0,
                            "Ideal (2-8°C)": 0,
                            "Atenção (8-10°C)": 0,
                            "Crítico (> 10°C)": 0,
                            "Sem Dados": semTelemetria
                        },
                        percIdeal: 0,
                        percAtencao: 0,
                        percCritico: 0,
                        percMuitoBaixo: 0
                    }
                };
            }

            const ventos = weatherRecords.map(r => r.vento_num);
            const urs = weatherRecords.map(r => r.ur_num);
            const temps = weatherRecords.map(r => r.temp_num);
            const deltaTs = weatherRecords.map(r => r.delta_t_num).filter(v => v !== null);
            const bulbos = weatherRecords.map(r => r.bulbo_umido_num).filter(v => v !== null);

            const calcStats = arr => {
                if (arr.length === 0) return { avg: 0, min: 0, max: 0, count: 0, hasData: false };
                const sum = arr.reduce((a, b) => a + b, 0);
                return {
                    avg: Math.round((sum / arr.length) * 10) / 10,
                    min: Math.round(Math.min(...arr) * 10) / 10,
                    max: Math.round(Math.max(...arr) * 10) / 10,
                    count: arr.length,
                    hasData: true
                };
            };

            const deltaTClasses = {
                "Muito Baixo (< 2°C)": 0,
                "Ideal (2-8°C)": 0,
                "Atenção (8-10°C)": 0,
                "Crítico (> 10°C)": 0,
                "Sem Dados": semTelemetria
            };

            weatherRecords.forEach(r => {
                const k = r.delta_t_classe;
                if (k && deltaTClasses[k] !== undefined) {
                    deltaTClasses[k]++;
                } else if (k && k.includes('Inversão')) {
                    deltaTClasses["Muito Baixo (< 2°C)"]++;
                } else if (k && k.includes('Ideal')) {
                    deltaTClasses["Ideal (2-8°C)"]++;
                } else if (k && k.includes('Atenção')) {
                    deltaTClasses["Atenção (8-10°C)"]++;
                } else if (k && k.includes('Crítico')) {
                    deltaTClasses["Crítico (> 10°C)"]++;
                }
            });

            const idealCount = deltaTClasses["Ideal (2-8°C)"];
            const atencaoCount = deltaTClasses["Atenção (8-10°C)"];
            const criticoCount = deltaTClasses["Crítico (> 10°C)"];
            const muitoBaixoCount = deltaTClasses["Muito Baixo (< 2°C)"];

            const percIdeal = Math.round((idealCount / totalComClima) * 100);
            const percAtencao = Math.round((atencaoCount / totalComClima) * 100);
            const percCritico = Math.round((criticoCount / totalComClima) * 100);
            const percMuitoBaixo = Math.round((muitoBaixoCount / totalComClima) * 100);

            return {
                totalComClima: totalComClima,
                semTelemetria: semTelemetria,
                totalRegistros: totalRegistros,
                percComClima: Math.round((totalComClima / totalRegistros) * 100),
                vento: calcStats(ventos),
                ur: calcStats(urs),
                temp: calcStats(temps),
                bulboUmido: calcStats(bulbos),
                deltaT: {
                    ...calcStats(deltaTs),
                    classes: deltaTClasses,
                    percIdeal: percIdeal,
                    percAtencao: percAtencao,
                    percCritico: percCritico,
                    percMuitoBaixo: percMuitoBaixo
                }
            };
        },

        /**
         * Distribuição por faixas horárias para o novo gráfico inteligente de segurança operacional
         */
        computeHourlySafetyDistribution: function (records) {
            const periods = {
                'Manhã Cedo (06h - 09h)': { ideal: 0, atencao: 0, critico: 0, muitoBaixo: 0, total: 0 },
                'Meio da Manhã (09h - 12h)': { ideal: 0, atencao: 0, critico: 0, muitoBaixo: 0, total: 0 },
                'Início da Tarde (12h - 15h)': { ideal: 0, atencao: 0, critico: 0, muitoBaixo: 0, total: 0 },
                'Final da Tarde (15h - 18h)': { ideal: 0, atencao: 0, critico: 0, muitoBaixo: 0, total: 0 },
                'Noturno / Outros': { ideal: 0, atencao: 0, critico: 0, muitoBaixo: 0, total: 0 }
            };

            records.forEach(r => {
                if (!r.has_weather || r.delta_t_num === null) return;
                let hour = 12;
                if (r.hora_str && r.hora_str.includes(':')) {
                    hour = parseInt(r.hora_str.split(':')[0], 10) || 12;
                }

                let slot = 'Noturno / Outros';
                if (hour >= 6 && hour < 9) slot = 'Manhã Cedo (06h - 09h)';
                else if (hour >= 9 && hour < 12) slot = 'Meio da Manhã (09h - 12h)';
                else if (hour >= 12 && hour < 15) slot = 'Início da Tarde (12h - 15h)';
                else if (hour >= 15 && hour < 18) slot = 'Final da Tarde (15h - 18h)';

                periods[slot].total++;
                if (r.delta_t_num < 2.0) periods[slot].muitoBaixo++;
                else if (r.delta_t_num <= 8.0) periods[slot].ideal++;
                else if (r.delta_t_num <= 10.0) periods[slot].atencao++;
                else periods[slot].critico++;
            });

            return periods;
        },

        /**
         * Calcula KPIs executivos do dashboard
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
                if (r.is_clima || r.delta_t_classe.includes('Crítico') || r.is_parada_clima) alertasClima++;
                if (r.fazenda && r.fazenda !== 'Não informada') fazendasSet.add(r.fazenda);
                if (r.os && r.os !== 'Não informada') osSet.add(r.os);
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

                const eg = r.esp_grupo || 'Não Informado';
                espGrupos[eg] = (espGrupos[eg] || 0) + 1;

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
            let paradasClima = 0;
            let vazamentos = 0;
            let problemasBicos = 0;
            let acoesRegistradas = 0;

            records.forEach(r => {
                if (r.is_parada_clima) paradasClima++;
                if (r.is_vazamento) vazamentos++;
                if (r.is_problema_bico) problemasBicos++;
                if (r.has_acao) acoesRegistradas++;
            });

            return {
                paradasClima: paradasClima,
                vazamentos: vazamentos,
                problemasBicos: problemasBicos,
                acoesRegistradas: acoesRegistradas
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
                if (r.fazenda && r.fazenda !== 'Não informada') entry.fazendas.add(r.fazenda);
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
                    map[ps] = { tipo: ps, total: 0, ocorrencias: 0 };
                }
                map[ps].total++;
                if (r.tem_ocorrencia) map[ps].ocorrencias++;
            });
            return Object.values(map);
        },

        /**
         * Ranking de Fazendas
         */
        computeFarmRanking: function (records) {
            const map = {};
            records.forEach(r => {
                const f = r.fazenda || 'Não Informada';
                if (!map[f]) {
                    map[f] = { fazenda: f, total: 0, ocorrencias: 0, paradasClima: 0 };
                }
                map[f].total++;
                if (r.tem_ocorrencia) map[f].ocorrencias++;
                if (r.is_parada_clima) map[f].paradasClima++;
            });
            return Object.values(map).map(e => ({
                ...e,
                taxaOcorrencia: Math.round((e.ocorrencias / e.total) * 100)
            })).sort((a, b) => b.total - a.total);
        },

        /**
         * Estatísticas de Duração da Inspeção
         */
        computeDurationStats: function (records) {
            const durations = [];
            records.forEach(r => {
                if (r.data_inicio && r.data_fim) {
                    try {
                        // Formato: DD/MM/YYYY HH:MM
                        const parseDt = s => {
                            const [d, h] = s.split(' ');
                            const [day, m, y] = d.split('/');
                            const [hr, min] = h.split(':');
                            return new Date(y, m - 1, day, hr, min);
                        };
                        const dt1 = parseDt(r.data_inicio);
                        const dt2 = parseDt(r.data_fim);
                        const diffMin = Math.round((dt2 - dt1) / (1000 * 60));
                        if (diffMin >= 0 && diffMin < 300) durations.push(diffMin);
                    } catch (e) { }
                }
            });

            if (durations.length === 0) {
                return { avg: 5, median: 5, min: 2, max: 15 };
            }

            durations.sort((a, b) => a - b);
            const sum = durations.reduce((a, b) => a + b, 0);
            const mid = Math.floor(durations.length / 2);
            const median = durations.length % 2 !== 0 ? durations[mid] : Math.round((durations[mid - 1] + durations[mid]) / 2);

            return {
                avg: Math.round(sum / durations.length),
                median: median,
                min: durations[0],
                max: durations[durations.length - 1]
            };
        },

        /**
         * Agrupamento Temporal para Gráfico de Linha do Tempo (Dia ou Mês)
         */
        computeTemporalData: function (records, mode) {
            const map = {};
            (records || []).forEach(r => {
                if (!r.data) return;
                const part = r.data.split(' ')[0] || '';
                const dmy = part.split('/');
                if (dmy.length !== 3) return;

                let key = '';
                if (mode === 'mes') {
                    key = `${dmy[1]}/${dmy[2]}`;
                } else {
                    key = part; // dd/mm/aaaa
                }

                if (!map[key]) {
                    map[key] = {
                        label: key,
                        total: 0,
                        ocorrencias: 0,
                        sortKey: `${dmy[2]}${dmy[1]}${dmy[0]}`
                    };
                }
                map[key].total++;
                if (r.tem_ocorrencia || r.tem_nok) {
                    map[key].ocorrencias++;
                }
            });

            return Object.values(map).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
        }
    };

    window.HerbicidaEngine = HerbicidaEngine;

})(window);
