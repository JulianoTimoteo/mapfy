/**
 * weather_service.js
 * Camada de Inteligência Meteorológica e Auditoria Climática (Open-Meteo API & ERA5 Reanalysis)
 * Central de Inteligência de Aplicação de Herbicidas • Usina Pitangueiras - Safra 2026
 * 
 * Funcionalidades:
 * - Consulta resiliente à API Open-Meteo (Forecast e Archive) com fallback inteligente
 * - Cache triplo de alta performance: Precarregado (offline) -> Memória -> localStorage
 * - Reconstrução meteorológica horária completa (00h às 23h) para cada coordenada e data
 * - Cálculo psicrométrico independente de Bulbo Úmido e Delta T (Stull, 2011)
 * - Confronto e auditoria cruzada estrita: Trilha A (MapFy Campo) vs Trilha B (Open-Meteo ERA5)
 * - Classificação auditável: Compatível, Divergência Moderada, Divergência Elevada, Reconstruído, Inconclusivo
 */

(function (window) {
    'use strict';

    const CACHE_PREFIX = 'mapfy_weather_cache_v2_';
    const CACHE_TTL_HOURS = 168; // 7 dias de validade para o cache dinâmico
    const memoryCache = new Map();

    const OpenMeteoService = {
        name: 'OpenMeteoService',
        baseUrlForecast: 'https://api.open-meteo.com/v1/forecast',
        baseUrlArchive: 'https://archive-api.open-meteo.com/v1/archive',
        timezone: 'America/Sao_Paulo',

        /**
         * Converte graus de direção do vento (0-360) para ponto cardeal
         */
        degreesToCardinal: function (deg) {
            if (deg === null || isNaN(deg)) return 'N/D';
            const val = ((deg %= 360) < 0) ? deg + 360 : deg;
            const points = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
            const idx = Math.round(val / 22.5) % 16;
            return points[idx];
        },

        /**
         * Gera chave única para cache baseada em coordenadas arredondadas e data
         */
        getCacheKey: function (lat, lon, dateIso) {
            const rLat = Number(lat).toFixed(3);
            const rLon = Number(lon).toFixed(3);
            return `${CACHE_PREFIX}${rLat}_${rLon}_${dateIso}`;
        },

        /**
         * Recupera dados do cache com prioridade: Precarregado -> Memória -> localStorage
         */
        getFromCache: function (lat, lon, dateIso) {
            const key = this.getCacheKey(lat, lon, dateIso);

            // 1. Verifica cache precarregado global (offline instantâneo)
            if (window.MAPFY_PRELOADED_WEATHER_CACHE && window.MAPFY_PRELOADED_WEATHER_CACHE[key]) {
                const preData = window.MAPFY_PRELOADED_WEATHER_CACHE[key].data;
                if (preData) {
                    memoryCache.set(key, preData);
                    return preData;
                }
            }

            // 2. Cache em memória da sessão
            if (memoryCache.has(key)) {
                return memoryCache.get(key);
            }

            // 3. Cache persistente em localStorage
            try {
                const itemStr = localStorage.getItem(key);
                if (!itemStr) return null;
                const item = JSON.parse(itemStr);
                const now = Date.now();
                if (now - item.timestamp > CACHE_TTL_HOURS * 3600 * 1000) {
                    localStorage.removeItem(key);
                    return null;
                }
                memoryCache.set(key, item.data);
                return item.data;
            } catch (e) {
                console.warn('[WeatherService] Falha ao ler localStorage:', e);
                return null;
            }
        },

        /**
         * Grava dados no cache (memória e localStorage)
         */
        saveToCache: function (lat, lon, dateIso, data) {
            const key = this.getCacheKey(lat, lon, dateIso);
            memoryCache.set(key, data);
            try {
                const item = {
                    timestamp: Date.now(),
                    data: data
                };
                localStorage.setItem(key, JSON.stringify(item));
            } catch (e) {
                console.warn('[WeatherService] localStorage com cota excedida, retido em memória.');
            }
        },

        /**
         * Consulta dados meteorológicos históricos com fallback duplo
         * 1º Tenta cache
         * 2º Tenta api.open-meteo.com/v1/forecast (rápido, suporta até 92 dias retroativos)
         * 3º Tenta archive-api.open-meteo.com/v1/archive (histórico longo)
         */
        fetchHistorical: async function (lat, lon, dateIso, hourStr) {
            if (!lat || !lon || !dateIso) return null;

            // 1. Tenta recuperar do cache
            const cached = this.getFromCache(lat, lon, dateIso);
            if (cached) {
                return this.extractHourData(cached, hourStr, lat, lon, dateIso, true);
            }

            const hourlyParams = 'temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m';

            // 2. Tenta Forecast Endpoint com start_date e end_date
            const forecastUrl = `${this.baseUrlForecast}?latitude=${lat}&longitude=${lon}` +
                `&start_date=${dateIso}&end_date=${dateIso}` +
                `&hourly=${hourlyParams}` +
                `&timezone=${encodeURIComponent(this.timezone)}`;

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                const resp = await fetch(forecastUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (resp.ok) {
                    const json = await resp.json();
                    if (json.hourly && json.hourly.time && json.hourly.time.length > 0) {
                        this.saveToCache(lat, lon, dateIso, json);
                        return this.extractHourData(json, hourStr, lat, lon, dateIso, false);
                    }
                }
            } catch (e) {
                console.warn('[WeatherService] Forecast endpoint indisponível, tentando Archive fallback:', e.message);
            }

            // 3. Fallback: Archive Endpoint
            const archiveUrl = `${this.baseUrlArchive}?latitude=${lat}&longitude=${lon}` +
                `&start_date=${dateIso}&end_date=${dateIso}` +
                `&hourly=${hourlyParams}` +
                `&timezone=${encodeURIComponent(this.timezone)}`;

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                const resp = await fetch(archiveUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (resp.ok) {
                    const json = await resp.json();
                    if (json.hourly && json.hourly.time && json.hourly.time.length > 0) {
                        this.saveToCache(lat, lon, dateIso, json);
                        return this.extractHourData(json, hourStr, lat, lon, dateIso, false);
                    }
                }
            } catch (err) {
                console.warn(`[WeatherService] Falha total ao consultar Open-Meteo (${lat},${lon},${dateIso}):`, err.message);
            }

            return null;
        },

        /**
         * Extrai os valores pontuais da hora da inspeção e a timeline completa diurna (00h-23h)
         */
        extractHourData: function (apiJson, hourStr, lat, lon, dateIso, fromCache) {
            const hourly = apiJson.hourly;
            if (!hourly || !hourly.time || hourly.time.length === 0) return null;

            let targetHour = 11;
            let targetMinute = 0;
            if (hourStr && hourStr.includes(':')) {
                const parts = hourStr.split(':');
                targetHour = parseInt(parts[0], 10) || 11;
                targetMinute = parseInt(parts[1], 10) || 0;
            }

            // Arredonda para a hora cheia mais próxima
            let nearestHour = targetHour;
            if (targetMinute >= 30) nearestHour = Math.min(23, targetHour + 1);

            const hourTargetStr = `${dateIso}T${String(nearestHour).padStart(2, '0')}:00`;
            let index = hourly.time.indexOf(hourTargetStr);
            if (index === -1) {
                index = Math.min(Math.max(0, nearestHour), hourly.time.length - 1);
            }

            const temp = hourly.temperature_2m ? hourly.temperature_2m[index] : null;
            const ur = hourly.relative_humidity_2m ? hourly.relative_humidity_2m[index] : null;
            const dewPoint = hourly.dew_point_2m ? hourly.dew_point_2m[index] : null;
            const appTemp = hourly.apparent_temperature ? hourly.apparent_temperature[index] : null;
            const vento = hourly.wind_speed_10m ? hourly.wind_speed_10m[index] : null;
            const direcaoVento = hourly.wind_direction_10m ? hourly.wind_direction_10m[index] : null;
            const rajada = hourly.wind_gusts_10m ? hourly.wind_gusts_10m[index] : null;
            const precip = hourly.precipitation ? hourly.precipitation[index] : 0;

            let deltaT = null;
            let bulboUmido = null;
            let deltaTClasse = 'Sem Dados';
            let deltaTStatusKey = 'sem_dados';
            let deltaTColor = '#64748B';

            if (temp !== null && ur !== null && window.HerbicidaEngine) {
                bulboUmido = window.HerbicidaEngine.calculateWetBulb(temp, ur);
                deltaT = window.HerbicidaEngine.calculateDeltaT(temp, ur);
                const cObj = window.HerbicidaEngine.classifyDeltaT(deltaT);
                deltaTClasse = cObj.classe;
                deltaTStatusKey = cObj.statusKey;
                deltaTColor = cObj.color;
            }

            // Constrói a linha do tempo horária de 06h às 18h para o Dossiê Individual
            const timelineDay = [];
            for (let i = 0; i < hourly.time.length; i++) {
                const tStr = hourly.time[i];
                const hNum = parseInt(tStr.split('T')[1]?.split(':')[0] || '0', 10);
                if (hNum >= 6 && hNum <= 18) {
                    const hTemp = hourly.temperature_2m ? hourly.temperature_2m[i] : null;
                    const hUr = hourly.relative_humidity_2m ? hourly.relative_humidity_2m[i] : null;
                    const hVento = hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : null;
                    let hDeltaT = null;
                    if (hTemp !== null && hUr !== null && window.HerbicidaEngine) {
                        hDeltaT = window.HerbicidaEngine.calculateDeltaT(hTemp, hUr);
                    }
                    timelineDay.push({
                        hora: `${String(hNum).padStart(2, '0')}:00`,
                        horaNum: hNum,
                        temp: hTemp,
                        ur: hUr,
                        vento: hVento,
                        deltaT: hDeltaT,
                        isTarget: (hNum === nearestHour)
                    });
                }
            }

            const diffMinutes = Math.abs((nearestHour * 60) - (targetHour * 60 + targetMinute));

            return {
                fonte: 'Open-Meteo ERA5 Reanalysis (ECMWF Modelo Regional)',
                tipoFonte: 'Reanálise Histórica Regional (11km)',
                horarioApi: hourly.time[index],
                horarioInspecao: `${dateIso} ${hourStr || '12:00'}`,
                nearestHour: nearestHour,
                targetHour: targetHour,
                targetMinute: targetMinute,
                diferencaMinutos: diffMinutes,
                incertezaTemporal: diffMinutes > 30 ? 'Média (~30-60 min)' : 'Baixa (< 30 min)',
                coordsConsultadas: {
                    lat: Number(lat).toFixed(4),
                    lon: Number(lon).toFixed(4)
                },
                temp: temp !== null ? Math.round(temp * 10) / 10 : null,
                ur: ur !== null ? Math.round(ur) : null,
                dewPoint: dewPoint !== null ? Math.round(dewPoint * 10) / 10 : null,
                apparentTemp: appTemp !== null ? Math.round(appTemp * 10) / 10 : null,
                vento: vento !== null ? Math.round(vento * 10) / 10 : null,
                direcaoVento: direcaoVento,
                cardinalVento: this.degreesToCardinal(direcaoVento),
                rajada: rajada !== null ? Math.round(rajada * 10) / 10 : null,
                precipitacao: precip,
                bulboUmido: bulboUmido,
                deltaT: deltaT,
                deltaTClasse: deltaTClasse,
                deltaTStatusKey: deltaTStatusKey,
                deltaTColor: deltaTColor,
                fromCache: fromCache,
                isEstimate: true,
                resolucaoKm: '~11 km (Grade ECMWF)',
                timelineDay: timelineDay
            };
        },

        /**
         * Realiza a auditoria cruzada estrita: Trilha A (MapFy) vs Trilha B (Open-Meteo)
         */
        compareRecord: function (fieldRec, apiData) {
            if (!fieldRec) {
                return {
                    status: 'Sem Dados',
                    statusKey: 'sem_dados',
                    badgeClass: 'badge-slate',
                    desc: 'Registro de campo ausente',
                    justificativa: 'Nenhum registro MapFy fornecido para comparação.',
                    confiabilidade: 'Nula',
                    diffTemp: null, diffUr: null, diffVento: null, diffDeltaT: null
                };
            }

            if (!apiData) {
                return {
                    status: 'Fonte Indisponível',
                    statusKey: 'fonte_indisponivel',
                    badgeClass: 'badge-slate',
                    desc: 'Sem dados meteorológicos externos sincronizados',
                    justificativa: 'Falha de comunicação ou ausência de dados na API meteorológica para a data/local.',
                    confiabilidade: 'Nula',
                    diffTemp: null, diffUr: null, diffVento: null, diffDeltaT: null
                };
            }

            const tempField = fieldRec.temp_num;
            const urField = fieldRec.ur_num;
            const ventoField = fieldRec.vento_num;
            const dtField = fieldRec.delta_t_num;

            // Caso especial: Registro sem telemetria preenchida pelo operador de campo
            if (!fieldRec.has_weather || tempField === null || urField === null) {
                return {
                    status: 'Sem Telemetria Original',
                    statusKey: 'reconstruido',
                    badgeClass: 'badge-blue',
                    desc: 'Condição meteorológica reconstruída via Reanálise Regional',
                    justificativa: 'O operador não preencheu Temperatura/Umidade no aplicativo MapFy. O valor exibido foi reconstruído pelo modelo meteorológico para preencher a lacuna.',
                    confiabilidade: 'Estimativa de Modelo (ERA5)',
                    diffTemp: null,
                    diffUr: null,
                    diffVento: null,
                    diffDeltaT: null,
                    isReconstructedOnly: true
                };
            }

            const tempApi = apiData.temp;
            const urApi = apiData.ur;
            const ventoApi = apiData.vento;
            const dtApi = apiData.deltaT;

            const diffTemp = (tempField !== null && tempApi !== null) ? Math.round((tempField - tempApi) * 10) / 10 : null;
            const diffUr = (urField !== null && urApi !== null) ? Math.round(urField - urApi) : null;
            const diffVento = (ventoField !== null && ventoApi !== null) ? Math.round((ventoField - ventoApi) * 10) / 10 : null;
            const diffDeltaT = (dtField !== null && dtApi !== null) ? Math.round((dtField - dtApi) * 10) / 10 : null;

            const absDTemp = diffTemp !== null ? Math.abs(diffTemp) : 0;
            const absDUr = diffUr !== null ? Math.abs(diffUr) : 0;
            const absDDeltaT = diffDeltaT !== null ? Math.abs(diffDeltaT) : 0;

            // REGRAS TÉCNICAS AGRONÔMICAS DE AUDITORIA:
            // 1. COMPATÍVEL: |ΔDeltaT| <= 2.0°C E |ΔTemp| <= 3.5°C E |ΔUR| <= 15%
            // 2. DIVERGÊNCIA MODERADA: |ΔDeltaT| <= 3.5°C E |ΔTemp| <= 5.0°C E |ΔUR| <= 25%
            // 3. DIVERGÊNCIA ELEVADA: |ΔDeltaT| > 3.5°C OU |ΔTemp| > 5.0°C OU |ΔUR| > 25%

            let status = 'Compatível';
            let statusKey = 'compativel';
            let badgeClass = 'badge-emerald';
            let desc = 'Apontamento de campo altamente aderente à reanálise meteorológica regional';
            let justificativa = 'Variações dentro dos limites aceitáveis de calibração instrumental e microclima.';
            let confiabilidade = 'Alta (Forte Aderência)';

            if (absDDeltaT > 3.5 || absDTemp > 5.0 || absDUr > 25) {
                status = 'Divergência Elevada';
                statusKey = 'divergencia_elevada';
                badgeClass = 'badge-red';
                desc = 'Divergência expressiva entre medição de campo e modelo regional';
                justificativa = 'Possível medição de campo influenciada por aquecimento direto de lataria/solo, termohigrômetro descalibrado ou microclima de baixada não captado pela malha de 11km.';
                confiabilidade = 'Sinal de Auditoria (Requer Verificação)';
            } else if (absDDeltaT > 2.0 || absDTemp > 3.5 || absDUr > 15) {
                status = 'Divergência Moderada';
                statusKey = 'divergencia_moderada';
                badgeClass = 'badge-amber';
                desc = 'Variação normal entre o talhão específico e a média da malha regional';
                justificativa = 'O microclima de interior de canavial frequentemente apresenta temperatura 2 a 3°C superior e UR ligeiramente distinta da grade atmosférica a 10m.';
                confiabilidade = 'Média (Variação Microclimática)';
            }

            return {
                status: status,
                statusKey: statusKey,
                badgeClass: badgeClass,
                desc: desc,
                justificativa: justificativa,
                confiabilidade: confiabilidade,
                diffTemp: diffTemp,
                diffUr: diffUr,
                diffVento: diffVento,
                diffDeltaT: diffDeltaT,
                isReconstructedOnly: false
            };
        },

        /**
         * Gera auditoria consolidada do dataset completo
         */
        auditDataset: function (records, weatherMap) {
            let total = records.length;
            let comTelemetria = 0;
            let semTelemetria = 0;
            let compativeis = 0;
            let divModerada = 0;
            let divElevada = 0;
            let reconstruidos = 0;
            let semCoords = 0;

            let sumDeltaTField = 0, countDeltaTField = 0;
            let sumDeltaTApi = 0, countDeltaTApi = 0;
            let sumDiffAbsDeltaT = 0, countDiffDeltaT = 0;

            const isMapValid = weatherMap && typeof weatherMap.get === 'function';

            (records || []).forEach(r => {
                if (!r.has_coords) semCoords++;
                if (r.has_weather) {
                    comTelemetria++;
                    if (r.delta_t_num !== null) {
                        sumDeltaTField += r.delta_t_num;
                        countDeltaTField++;
                    }
                } else {
                    semTelemetria++;
                }

                const apiData = isMapValid ? weatherMap.get(r.id) : null;
                if (apiData) {
                    if (apiData.deltaT !== null) {
                        sumDeltaTApi += apiData.deltaT;
                        countDeltaTApi++;
                    }
                    const comp = this.compareRecord(r, apiData);
                    if (comp.statusKey === 'compativel') compativeis++;
                    else if (comp.statusKey === 'divergencia_moderada') divModerada++;
                    else if (comp.statusKey === 'divergencia_elevada') divElevada++;
                    else if (comp.statusKey === 'reconstruido') reconstruidos++;

                    if (comp.diffDeltaT !== null) {
                        sumDiffAbsDeltaT += Math.abs(comp.diffDeltaT);
                        countDiffDeltaT++;
                    }
                }
            });

            const avgDtField = countDeltaTField > 0 ? (sumDeltaTField / countDeltaTField) : null;
            const avgDtApi = countDeltaTApi > 0 ? (sumDeltaTApi / countDeltaTApi) : null;
            const avgDiffDeltaT = countDiffDeltaT > 0 ? (sumDiffAbsDeltaT / countDiffDeltaT) : null;
            const taxaAderencia = (comTelemetria > 0) ? Math.round(((compativeis + divModerada) / comTelemetria) * 100) : 0;

            return {
                total,
                comTelemetria,
                semTelemetria,
                compativeis,
                divModerada,
                divElevada,
                reconstruidos,
                semCoords,
                avgDtField: avgDtField !== null ? Math.round(avgDtField * 10) / 10 : 0,
                avgDtApi: avgDtApi !== null ? Math.round(avgDtApi * 10) / 10 : 0,
                avgDiffDeltaT: avgDiffDeltaT !== null ? Math.round(avgDiffDeltaT * 10) / 10 : 0,
                taxaAderencia: taxaAderencia
            };
        },

        /**
         * Sincronização Síncrona Instantânea a partir do cache pré-carregado
         */
        syncRecordsSync: function (records) {
            const results = new Map();
            if (!Array.isArray(records)) return results;

            for (const r of records) {
                if (!r.lat || !r.lon || !r.data_iso) continue;
                const cached = this.getFromCache(r.lat, r.lon, r.data_iso);
                if (cached) {
                    const hourStr = (r.data && r.data.includes(' ')) ? r.data.split(' ')[1] : '12:00';
                    const apiData = this.extractHourData(cached, hourStr, r.lat, r.lon, r.data_iso, true);
                    if (apiData) {
                        results.set(r.id, apiData);
                    }
                }
            }
            return results;
        },

        /**
         * Sincroniza em lote a lista de inspeções (Assíncrono com fallback online)
         */
        syncRecords: async function (records, onProgress) {
            const results = new Map();
            const validRecords = records.filter(r => r.has_coords && r.data_iso);
            let completed = 0;
            const total = validRecords.length;

            for (const r of validRecords) {
                const hourStr = (r.data && r.data.includes(' ')) ? r.data.split(' ')[1] : '12:00';
                try {
                    const apiData = await this.fetchHistorical(r.lat, r.lon, r.data_iso, hourStr);
                    if (apiData) {
                        results.set(r.id, apiData);
                    }
                } catch (e) {
                    console.warn(`[WeatherService] Erro ao sincronizar registro ${r.id}:`, e);
                }

                completed++;
                if (typeof onProgress === 'function') {
                    onProgress(completed, total, r.id);
                }

                // Pequena pausa para fluidez na UI
                await new Promise(resolve => setTimeout(resolve, 20));
            }

            return results;
        }
    };

    window.OpenMeteoService = OpenMeteoService;

})(window);
