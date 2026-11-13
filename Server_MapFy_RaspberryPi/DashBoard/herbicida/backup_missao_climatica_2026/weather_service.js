/**
 * weather_service.js
 * Camada de Inteligência Meteorológica por Coordenadas GPS (Open-Meteo API)
 * MapFy - Tecnologia de Aplicação | Safra 2026
 * 
 * Funcionalidades:
 * - Consulta à API de Histórico (Archive) para dados passados de inspeções
 * - Consulta à API de Previsão/Tempo Real (Forecast) para condições atuais da frente
 * - Cache persistente via localStorage com fallback em memória
 * - Resiliência offline e tratamento de timeout estrito
 * - Cálculo psicrométrico de Delta T sobre dados da API externa (Stull, 2011)
 * - Comparação e auditoria cruzada (Campo MapFy vs Modelo Open-Meteo)
 */

(function (window) {
    'use strict';

    const CACHE_PREFIX = 'mapfy_weather_cache_v2_';
    const CACHE_TTL_HOURS = 72; // 3 dias de validade para o cache histórico
    const memoryCache = new Map();

    const OpenMeteoService = {
        name: 'OpenMeteoService',
        baseUrlForecast: 'https://api.open-meteo.com/v1/forecast',
        baseUrlArchive: 'https://archive-api.open-meteo.com/v1/archive',
        timezone: 'America/Sao_Paulo',

        /**
         * Gera chave única para cache baseada em coordenadas arredondadas e data
         */
        getCacheKey: function (lat, lon, dateIso) {
            const rLat = Number(lat).toFixed(3);
            const rLon = Number(lon).toFixed(3);
            return `${CACHE_PREFIX}${rLat}_${rLon}_${dateIso}`;
        },

        /**
         * Recupera dados do cache local (localStorage ou memória)
         */
        getFromCache: function (lat, lon, dateIso) {
            const key = this.getCacheKey(lat, lon, dateIso);
            if (memoryCache.has(key)) {
                return memoryCache.get(key);
            }
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
                console.warn('[WeatherService] Falha ao ler cache:', e);
                return null;
            }
        },

        /**
         * Grava dados no cache local
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
                // Em caso de cota de localStorage cheia, mantém em memória
                console.warn('[WeatherService] Não foi possível salvar em localStorage (limite atingido):', e);
            }
        },

        /**
         * Consulta dados meteorológicos históricos para uma coordenada e data
         * @param {number} lat Latitude
         * @param {number} lon Longitude
         * @param {string} dateIso Data no formato YYYY-MM-DD
         * @param {string} hourStr Horário no formato HH:MM (ex: "10:46")
         * @returns {Promise<Object|null>}
         */
        fetchHistorical: async function (lat, lon, dateIso, hourStr) {
            if (!lat || !lon || !dateIso) return null;

            // 1. Tenta recuperar do cache
            const cached = this.getFromCache(lat, lon, dateIso);
            if (cached) {
                return this.extractHourData(cached, hourStr, lat, lon, dateIso, true);
            }

            // 2. Consulta API Open-Meteo Archive com timeout de 6 segundos
            const url = `${this.baseUrlArchive}?latitude=${lat}&longitude=${lon}` +
                `&start_date=${dateIso}&end_date=${dateIso}` +
                `&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
                `&timezone=${encodeURIComponent(this.timezone)}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    console.warn(`[WeatherService] API retornou status ${response.status} para ${lat},${lon}`);
                    return null;
                }
                const json = await response.json();
                this.saveToCache(lat, lon, dateIso, json);
                return this.extractHourData(json, hourStr, lat, lon, dateIso, false);
            } catch (err) {
                clearTimeout(timeoutId);
                console.warn(`[WeatherService] Erro ao consultar histórico Open-Meteo (${lat},${lon}):`, err.message);
                return null;
            }
        },

        /**
         * Consulta dados meteorológicos atuais (Previsão / Tempo Real)
         * @param {number} lat 
         * @param {number} lon 
         */
        fetchCurrentForecast: async function (lat, lon) {
            if (!lat || !lon) return null;
            const url = `${this.baseUrlForecast}?latitude=${lat}&longitude=${lon}` +
                `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
                `&timezone=${encodeURIComponent(this.timezone)}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!response.ok) return null;
                const json = await response.json();
                const cur = json.current || {};
                const temp = cur.temperature_2m ?? null;
                const ur = cur.relative_humidity_2m ?? null;
                let deltaT = null;
                if (temp !== null && ur !== null && window.HerbicidaEngine) {
                    deltaT = window.HerbicidaEngine.calculateDeltaT(temp, ur);
                }

                return {
                    fonte: 'Open-Meteo Forecast (Tempo Real)',
                    tempo: cur.time,
                    temp: temp,
                    ur: ur,
                    vento: cur.wind_speed_10m ?? null,
                    direcaoVento: cur.wind_direction_10m ?? null,
                    rajada: cur.wind_gusts_10m ?? null,
                    precipitacao: cur.precipitation ?? 0,
                    deltaT: deltaT,
                    classeDeltaT: window.HerbicidaEngine ? window.HerbicidaEngine.classifyDeltaT(deltaT).classe : 'N/A',
                    isEstimate: true
                };
            } catch (err) {
                clearTimeout(timeoutId);
                console.warn('[WeatherService] Erro na consulta de previsão:', err.message);
                return null;
            }
        },

        /**
         * Extrai e interpola os valores para a hora mais próxima da inspeção
         */
        extractHourData: function (apiJson, hourStr, lat, lon, dateIso, fromCache) {
            const hourly = apiJson.hourly;
            if (!hourly || !hourly.time || hourly.time.length === 0) return null;

            let targetHour = 12; // Padrão se não informado
            let targetMinute = 0;
            if (hourStr && hourStr.includes(':')) {
                const parts = hourStr.split(':');
                targetHour = parseInt(parts[0], 10) || 12;
                targetMinute = parseInt(parts[1], 10) || 0;
            }

            // Arredonda para a hora cheia mais próxima
            let nearestHour = targetHour;
            if (targetMinute >= 30) nearestHour = Math.min(23, targetHour + 1);

            const hourTargetStr = `${dateIso}T${String(nearestHour).padStart(2, '0')}:00`;
            let index = hourly.time.indexOf(hourTargetStr);
            if (index === -1) {
                // Fallback para a primeira hora do dia ou índice mais próximo
                index = Math.min(Math.max(0, nearestHour), hourly.time.length - 1);
            }

            const temp = hourly.temperature_2m ? hourly.temperature_2m[index] : null;
            const ur = hourly.relative_humidity_2m ? hourly.relative_humidity_2m[index] : null;
            const vento = hourly.wind_speed_10m ? hourly.wind_speed_10m[index] : null;
            const direcaoVento = hourly.wind_direction_10m ? hourly.wind_direction_10m[index] : null;
            const rajada = hourly.wind_gusts_10m ? hourly.wind_gusts_10m[index] : null;

            let deltaT = null;
            let deltaTClasse = 'Sem Dados';
            if (temp !== null && ur !== null && window.HerbicidaEngine) {
                deltaT = window.HerbicidaEngine.calculateDeltaT(temp, ur);
                const classObj = window.HerbicidaEngine.classifyDeltaT(deltaT);
                deltaTClasse = classObj.classe;
            }

            return {
                fonte: 'Open-Meteo Archive (Modelo Reanálise ERA5)',
                horarioApi: hourly.time[index],
                horarioInspecao: `${dateIso} ${hourStr || '12:00'}`,
                diferencaMinutos: Math.abs((nearestHour * 60) - (targetHour * 60 + targetMinute)),
                coordsConsultadas: { lat: Number(lat).toFixed(4), lon: Number(lon).toFixed(4) },
                temp: temp !== null ? Math.round(temp * 10) / 10 : null,
                ur: ur !== null ? Math.round(ur) : null,
                vento: vento !== null ? Math.round(vento * 10) / 10 : null,
                direcaoVento: direcaoVento,
                rajada: rajada !== null ? Math.round(rajada * 10) / 10 : null,
                deltaT: deltaT,
                deltaTClasse: deltaTClasse,
                fromCache: fromCache,
                isEstimate: true,
                resolucaoKm: '~11 km (Grade ECMWF)'
            };
        },

        /**
         * Compara dados de campo do MapFy com a API externa
         */
        compareRecord: function (fieldRec, apiData) {
            if (!fieldRec || !apiData) {
                return {
                    status: 'Indisponível',
                    badgeClass: 'badge-slate',
                    desc: 'Sem dados externos sincronizados',
                    diffTemp: null,
                    diffUr: null,
                    diffVento: null,
                    diffDeltaT: null
                };
            }

            const tempField = fieldRec.temp_num;
            const urField = fieldRec.ur_num;
            const ventoField = fieldRec.vento_num;
            const dtField = fieldRec.delta_t_num;

            const tempApi = apiData.temp;
            const urApi = apiData.ur;
            const ventoApi = apiData.vento;
            const dtApi = apiData.deltaT;

            const diffTemp = (tempField !== null && tempApi !== null) ? Math.round((tempField - tempApi) * 10) / 10 : null;
            const diffUr = (urField !== null && urApi !== null) ? Math.round(urField - urApi) : null;
            const diffVento = (ventoField !== null && ventoApi !== null) ? Math.round((ventoField - ventoApi) * 10) / 10 : null;
            const diffDeltaT = (dtField !== null && dtApi !== null) ? Math.round((dtField - dtApi) * 10) / 10 : null;

            // Critérios agronômicos de divergência:
            // Compatível: |ΔTemp| <= 3°C E |ΔUR| <= 15%
            // Divergência Moderada: |ΔTemp| <= 5°C E |ΔUR| <= 25%
            // Divergência Elevada: |ΔTemp| > 5°C OU |ΔUR| > 25%
            let status = 'Compatível';
            let badgeClass = 'badge-emerald';
            let desc = 'Medições de campo aderentes ao modelo meteorológico regional';

            const absDTemp = diffTemp !== null ? Math.abs(diffTemp) : 0;
            const absDUr = diffUr !== null ? Math.abs(diffUr) : 0;

            if (diffTemp === null || diffUr === null) {
                status = 'Parcial';
                badgeClass = 'badge-slate';
                desc = 'Dados incompletos para validação cruzada';
            } else if (absDTemp > 5.0 || absDUr > 25) {
                status = 'Divergência Elevada';
                badgeClass = 'badge-red';
                desc = 'Microclima de campo substancialmente diferente da grade regional (possível aquecimento do solo/barra)';
            } else if (absDTemp > 3.0 || absDUr > 15) {
                status = 'Divergência Moderada';
                badgeClass = 'badge-amber';
                desc = 'Variação normal entre microclima do talhão e média da malha';
            }

            return {
                status: status,
                badgeClass: badgeClass,
                desc: desc,
                diffTemp: diffTemp,
                diffUr: diffUr,
                diffVento: diffVento,
                diffDeltaT: diffDeltaT
            };
        },

        /**
         * Sincroniza em lote uma lista de inspeções
         * Limita requisições para evitar rate limit
         */
        syncRecords: async function (records, onProgress) {
            const results = new Map();
            const validCoords = records.filter(r => r.has_coords && r.data_iso);
            let completed = 0;
            const total = validCoords.length;

            for (const r of validCoords) {
                const hourStr = (r.data && r.data.includes(' ')) ? r.data.split(' ')[1] : '12:00';
                try {
                    const apiData = await this.fetchHistorical(r.lat, r.lon, r.data_iso, hourStr);
                    if (apiData) {
                        results.set(r.id, apiData);
                    }
                } catch (e) {
                    console.warn(`[WeatherService] Falha ao sincronizar registro ${r.id}:`, e);
                }

                completed++;
                if (typeof onProgress === 'function') {
                    onProgress(completed, total, r.id);
                }

                // Pequeno espaçamento de 40ms entre requisições não cacheadas para fluidez
                await new Promise(resolve => setTimeout(resolve, 40));
            }

            return results;
        }
    };

    window.OpenMeteoService = OpenMeteoService;

})(window);
