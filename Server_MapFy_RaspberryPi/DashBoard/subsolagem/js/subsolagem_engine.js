/**
 * subsolagem_engine.js
 * ====================
 * Motor Estatístico e Regras de Qualidade para Operação de Subsolagem
 * Usina Pitangueiras • Safra 2026
 */

(function (window) {
    'use strict';

    const SubsolagemEngine = {};

    // Configuração Padrão da Faixa Técnica
    const DEFAULT_TARGETS = {
        unidade: 'cm',
        min: 45.0,
        max: 55.0,
        ativa: true,
        regraId: 'REGRA-SUBSOLO-PITANGUEIRAS-2026',
        observacao: 'Faixa técnica padrão recomendada para descompactação de solo (45 a 55 cm)'
    };

    /**
     * Recupera ou salva a configuração técnica no localStorage
     */
    SubsolagemEngine.getTargetConfig = function () {
        try {
            const saved = localStorage.getItem('mapfy_subsolagem_targets');
            if (saved) {
                const parsed = JSON.parse(saved);
                return { ...DEFAULT_TARGETS, ...parsed };
            }
        } catch (e) {
            console.warn('Falha ao ler targets do localStorage:', e);
        }
        return { ...DEFAULT_TARGETS };
    };

    SubsolagemEngine.saveTargetConfig = function (cfg) {
        try {
            const merged = { ...DEFAULT_TARGETS, ...cfg };
            localStorage.setItem('mapfy_subsolagem_targets', JSON.stringify(merged));
            return merged;
        } catch (e) {
            console.error('Falha ao salvar targets:', e);
            return DEFAULT_TARGETS;
        }
    };

    /**
     * Converte datas brasileiras (DD/MM/AAAA HH:mm ou MM/DD/AAAA com AM/PM) em objetos Date válidos
     */
    SubsolagemEngine.parseDateBR = function (str) {
        if (!str || typeof str !== 'string') return null;
        const parts = str.trim().split(' ');
        if (!parts[0]) return null;

        const dateParts = parts[0].split('/');
        if (dateParts.length !== 3) return null;

        let n1 = parseInt(dateParts[0], 10);
        let n2 = parseInt(dateParts[1], 10);
        let year = parseInt(dateParts[2], 10);

        let day, month;
        if (n1 > 12 && n2 <= 12) {
            day = n1; month = n2 - 1;
        } else if (n2 > 12 && n1 <= 12) {
            day = n2; month = n1 - 1;
        } else {
            // Se tem indicador AM/PM ou formato internacional
            if (str.toUpperCase().includes('AM') || str.toUpperCase().includes('PM')) {
                day = n2; month = n1 - 1;
            } else {
                day = n1; month = n2 - 1;
            }
        }

        let hours = 0, minutes = 0;
        if (parts[1]) {
            const timeParts = parts[1].split(':');
            hours = parseInt(timeParts[0], 10) || 0;
            minutes = parseInt(timeParts[1], 10) || 0;
            const upper = str.toUpperCase();
            if (upper.includes('PM') && hours < 12) hours += 12;
            if (upper.includes('AM') && hours === 12) hours = 0;
        }

        const d = new Date(year, month, day, hours, minutes);
        return isNaN(d.getTime()) ? null : d;
    };

    /**
     * Formata objeto Date em DD/MM/AAAA
     */
    SubsolagemEngine.formatDateBR = function (d) {
        if (!d || isNaN(d.getTime())) return '';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    /**
     * Normalização e Validação de um registro de Subsolagem
     */
    SubsolagemEngine.normalizeRecord = function (raw) {
        const id = String(raw.ID || raw.id || '').trim();
        const usuario = String(raw.Usuario || raw['Usuário'] || raw.User || raw.user || '').trim();
        const dataStr = String(raw.Data || raw.Date || raw['Data Lançamento'] || raw.data || '').trim();
        const dataParsed = SubsolagemEngine.parseDateBR(dataStr);
        const dataBR = dataParsed ? SubsolagemEngine.formatDateBR(dataParsed) : dataStr.split(' ')[0] || '';
        const isoDate = dataParsed ? `${dataParsed.getFullYear()}-${String(dataParsed.getMonth()+1).padStart(2, '0')}-${String(dataParsed.getDate()).padStart(2, '0')}` : '';

        // Data de Lançamento
        const dataLancStr = String(raw.DataLancamento || raw['Data Lançamento'] || raw.Data || raw.Date || '').trim();
        const dataLancParsed = SubsolagemEngine.parseDateBR(dataLancStr);
        const dataLancBR = dataLancParsed ? SubsolagemEngine.formatDateBR(dataLancParsed) : dataLancStr;

        // Coordenadas
        const latStr = String(raw.Latitude || '').replace(',', '.').trim();
        const lngStr = String(raw.Longitude || '').replace(',', '.').trim();
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

        // Duração da Medição
        const dataInicioStr = String(raw.DataInicio || raw['Data início'] || raw['Start date'] || '').trim();
        const dataFimStr = String(raw.DataFim || raw['Data Fim'] || raw['End date'] || '').trim();
        const dtInicio = SubsolagemEngine.parseDateBR(dataInicioStr);
        const dtFim = SubsolagemEngine.parseDateBR(dataFimStr);
        let duracaoMinutos = 0;
        let duracaoInconsistente = false;

        if (dtInicio && dtFim) {
            duracaoMinutos = Math.round((dtFim.getTime() - dtInicio.getTime()) / (1000 * 60));
            if (duracaoMinutos < 0 || duracaoMinutos > 720) {
                duracaoInconsistente = true;
            }
        }

        // Profundidade (Subsolagem)
        const subRaw = String(raw.Subsolagem || '').trim();
        let profundidade = null;
        let temProfundidadeValida = false;
        if (subRaw !== '') {
            const num = parseFloat(subRaw.replace(',', '.'));
            if (!isNaN(num) && num > 0) {
                profundidade = num;
                temProfundidadeValida = true;
            }
        }

        // Frente
        let frente = String(raw.Frente || '').trim();
        if (frente.includes('TRATOS') || frente.includes('MOTOMECANIZA')) {
            frente = '53 - PRÓPRIA TRATOS - MOTOMECANIZAÇÃO';
        } else if (frente.toLowerCase().includes('motomecaniza')) {
            frente = '53 - motomecanização';
        } else if (frente === '53') {
            frente = '53 - FRENTE 53';
        } else if (frente.includes('EDMILSON')) {
            frente = '261 - FRENTE PRÓPRIA (EDMILSON)';
        }
        if (!frente) frente = 'Não Informado';

        // Responsável
        let resp = String(raw.Responsavel || raw['Responsável'] || '').trim();
        if (!resp) resp = 'Não Informado';

        // Inconsistências de dados para auditoria
        const inconsistencias = [];
        if (!id) inconsistencias.push('ID ausente');
        if (!dataParsed) inconsistencias.push('Data inválida ou ausente');
        if (!temProfundidadeValida) inconsistencias.push('Profundidade não numérica ou ausente');
        if (!hasValidCoords) inconsistencias.push('Coordenadas GPS ausentes ou inválidas');
        if (duracaoInconsistente) inconsistencias.push(`Duração atípica (${duracaoMinutos} min)`);
        if (dataLancBR && dataBR && dataLancBR !== dataBR) {
            inconsistencias.push(`Divergência Data Inspeção (${dataBR}) vs Lançamento (${dataLancBR})`);
        }

        return {
            id,
            usuario,
            dataStr,
            dataHoraBR: dataStr,
            dataBR,
            isoDate,
            dataParsed,
            dataLancamentoStr: dataLancStr,
            dataLancamentoBR: dataLancBR,
            dataLancamentoParsed: dataLancParsed,
            lat: hasValidCoords ? lat : null,
            lng: hasValidCoords ? lng : null,
            hasValidCoords,
            dataInicioStr,
            dataFimStr,
            duracaoMinutos,
            duracaoInconsistente,
            status: String(raw.Status || '').trim() || 'Aberto',
            score: String(raw.Score || '0,00').trim(),
            scorePerc: String(raw.ScorePerc || raw['Score perc.'] || '0').trim(),
            scoreDesc: String(raw.ScoreDesc || raw['Score desc.'] || 'Profundidade').trim(),
            local: String(raw.Local || raw['Local (Fazenda - Talhão)'] || '').trim() || 'Não Informado',
            os: String(raw.OS || '').trim() || 'Sem OS',
            frente,
            responsavel: resp,
            subsolagemRaw: subRaw,
            profundidade,
            temProfundidadeValida,
            inconsistencias,
            temInconsistencia: inconsistencias.length > 0
        };
    };

    /**
     * Classifica uma medição individual conforme a faixa técnica
     */
    SubsolagemEngine.classifyDepth = function (prof, targetConfig) {
        if (!targetConfig || !targetConfig.ativa) {
            return {
                status: 'NÃO CLASSIFICADO',
                label: 'Faixa Não Definida',
                badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
                color: '#64748b',
                diff: 0
            };
        }

        if (prof === null || isNaN(prof)) {
            return {
                status: 'INVÁLIDO',
                label: 'Sem Medição',
                badgeClass: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
                color: '#ef4444',
                diff: 0
            };
        }

        if (prof < targetConfig.min) {
            return {
                status: 'ABAIXO',
                label: `Abaixo da Meta (< ${targetConfig.min}${targetConfig.unidade})`,
                badgeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
                color: '#f59e0b',
                diff: Number((prof - targetConfig.min).toFixed(1))
            };
        }

        if (prof > targetConfig.max) {
            return {
                status: 'ACIMA',
                label: `Acima da Meta (> ${targetConfig.max}${targetConfig.unidade})`,
                badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
                color: '#a855f7',
                diff: Number((prof - targetConfig.max).toFixed(1))
            };
        }

        return {
            status: 'DENTRO',
            label: `Dentro da Meta (${targetConfig.min} a ${targetConfig.max}${targetConfig.unidade})`,
            badgeClass: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
            color: '#10b981',
            diff: 0
        };
    };

    /**
     * Cálculo de Mediana
     */
    SubsolagemEngine.calculateMedian = function (sortedArray) {
        if (!sortedArray || sortedArray.length === 0) return 0;
        const mid = Math.floor(sortedArray.length / 2);
        if (sortedArray.length % 2 !== 0) {
            return sortedArray[mid];
        }
        return (sortedArray[mid - 1] + sortedArray[mid]) / 2.0;
    };

    /**
     * Cálculo de Desvio-Padrão Amostral
     */
    SubsolagemEngine.calculateStdDev = function (array, mean) {
        if (!array || array.length <= 1) return 0;
        const sumSq = array.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
        return Math.sqrt(sumSq / (array.length - 1));
    };

    /**
     * Consolidação dos Indicadores Executivos dos Registros Filtrados (Seção 8)
     */
    SubsolagemEngine.calculateMetrics = function (records, targetConfig) {
        const totalMedicoes = records.length;
        const depths = [];
        let pendenciasCount = 0;
        let coordsValidasCount = 0;
        let somaDuracao = 0;
        let contDuracao = 0;

        const osSet = new Set();
        const localSet = new Set();
        const frentesSet = new Set();
        const respSet = new Set();

        let dentroFaixa = 0;
        let abaixoFaixa = 0;
        let acimaFaixa = 0;

        records.forEach(r => {
            if (r.temProfundidadeValida) {
                depths.push(r.profundidade);

                if (targetConfig && targetConfig.ativa) {
                    if (r.profundidade < targetConfig.min) abaixoFaixa++;
                    else if (r.profundidade > targetConfig.max) acimaFaixa++;
                    else dentroFaixa++;
                }
            }

            if (r.os && r.os !== 'Sem OS') osSet.add(r.os);
            if (r.local && r.local !== 'Não Informado') localSet.add(r.local);
            if (r.frente && r.frente !== 'Não Informado') frentesSet.add(r.frente);
            if (r.responsavel && r.responsavel !== 'Não Informado') respSet.add(r.responsavel);

            if (r.hasValidCoords) coordsValidasCount++;
            if (r.temInconsistencia) pendenciasCount++;

            if (r.duracaoMinutos >= 0 && r.duracaoMinutos <= 720) {
                somaDuracao += r.duracaoMinutos;
                contDuracao++;
            }
        });

        depths.sort((a, b) => a - b);
        const validCount = depths.length;

        let media = 0;
        let mediana = 0;
        let min = 0;
        let max = 0;
        let stdDev = 0;
        let amplitude = 0;

        if (validCount > 0) {
            const sum = depths.reduce((acc, v) => acc + v, 0);
            media = sum / validCount;
            mediana = SubsolagemEngine.calculateMedian(depths);
            min = depths[0];
            max = depths[validCount - 1];
            amplitude = max - min;
            stdDev = SubsolagemEngine.calculateStdDev(depths, media);
        }

        const percDentro = validCount > 0 ? Number(((dentroFaixa / validCount) * 100).toFixed(1)) : 0;
        const percAbaixo = validCount > 0 ? Number(((abaixoFaixa / validCount) * 100).toFixed(1)) : 0;
        const percAcima = validCount > 0 ? Number(((acimaFaixa / validCount) * 100).toFixed(1)) : 0;

        return {
            totalMedicoes,
            validCount,
            invalidCount: totalMedicoes - validCount,
            media: Number(media.toFixed(2)),
            mediana: Number(mediana.toFixed(2)),
            min: Number(min.toFixed(1)),
            max: Number(max.toFixed(1)),
            amplitude: Number(amplitude.toFixed(1)),
            stdDev: Number(stdDev.toFixed(2)),
            totalOS: osSet.size,
            totalLocais: localSet.size,
            totalFrentes: frentesSet.size,
            totalResponsaveis: respSet.size,
            dentroFaixa,
            abaixoFaixa,
            acimaFaixa,
            percDentro,
            percAbaixo,
            percAcima,
            pendenciasCount,
            coordsValidasCount,
            duracaoMediaMinutos: contDuracao > 0 ? Math.round(somaDuracao / contDuracao) : 0,
            targetConfig: targetConfig || DEFAULT_TARGETS
        };
    };

    /**
     * Análise Comparativa por Frente (Seção 10)
     */
    SubsolagemEngine.buildFrenteAnalysis = function (records, targetConfig) {
        const map = {};

        records.forEach(r => {
            const f = r.frente || 'Não Informado';
            if (!map[f]) {
                map[f] = {
                    frente: f,
                    records: [],
                    depths: [],
                    osSet: new Set(),
                    localSet: new Set(),
                    dentro: 0,
                    abaixo: 0,
                    acima: 0,
                    latestRecord: null
                };
            }
            map[f].records.push(r);
            if (r.temProfundidadeValida) {
                map[f].depths.push(r.profundidade);

                if (targetConfig && targetConfig.ativa) {
                    if (r.profundidade < targetConfig.min) map[f].abaixo++;
                    else if (r.profundidade > targetConfig.max) map[f].acima++;
                    else map[f].dentro++;
                }
            }
            if (r.os && r.os !== 'Sem OS') map[f].osSet.add(r.os);
            if (r.local && r.local !== 'Não Informado') map[f].localSet.add(r.local);

            if (r.dataParsed) {
                if (!map[f].latestRecord || r.dataParsed > map[f].latestRecord.dataParsed) {
                    map[f].latestRecord = r;
                }
            }
        });

        const list = Object.values(map).map(item => {
            item.depths.sort((a, b) => a - b);
            const count = item.depths.length;
            let media = 0, mediana = 0, min = 0, max = 0, stdDev = 0;

            if (count > 0) {
                const sum = item.depths.reduce((a, b) => a + b, 0);
                media = sum / count;
                mediana = SubsolagemEngine.calculateMedian(item.depths);
                min = item.depths[0];
                max = item.depths[count - 1];
                stdDev = SubsolagemEngine.calculateStdDev(item.depths, media);
            }

            const percDentro = count > 0 ? Number(((item.dentro / count) * 100).toFixed(1)) : 0;

            return {
                frente: item.frente,
                total: item.records.length,
                validos: count,
                media: Number(media.toFixed(1)),
                mediana: Number(mediana.toFixed(1)),
                min: Number(min.toFixed(1)),
                max: Number(max.toFixed(1)),
                stdDev: Number(stdDev.toFixed(2)),
                totalOS: item.osSet.size,
                totalLocais: item.localSet.size,
                dentro: item.dentro,
                abaixo: item.abaixo,
                acima: item.acima,
                percDentro,
                ultimaDataBR: item.latestRecord ? item.latestRecord.dataBR : '-'
            };
        });

        // Ordena por maior volume de medições
        return list.sort((a, b) => b.total - a.total);
    };

    /**
     * Análise de Controle de Qualidade por OS (Seção 11)
     */
    SubsolagemEngine.buildOSAnalysis = function (records, targetConfig) {
        const map = {};

        records.forEach(r => {
            const os = r.os || 'Sem OS';
            if (!map[os]) {
                map[os] = {
                    os,
                    records: [],
                    depths: [],
                    frentesSet: new Set(),
                    localsSet: new Set(),
                    respsSet: new Set(),
                    dentro: 0,
                    abaixo: 0,
                    acima: 0,
                    firstDate: null,
                    lastDate: null
                };
            }
            map[os].records.push(r);
            if (r.temProfundidadeValida) {
                map[os].depths.push(r.profundidade);

                if (targetConfig && targetConfig.ativa) {
                    if (r.profundidade < targetConfig.min) map[os].abaixo++;
                    else if (r.profundidade > targetConfig.max) map[os].acima++;
                    else map[os].dentro++;
                }
            }

            if (r.frente) map[os].frentesSet.add(r.frente);
            if (r.local) map[os].localsSet.add(r.local);
            if (r.responsavel) map[os].respsSet.add(r.responsavel);

            if (r.dataParsed) {
                if (!map[os].firstDate || r.dataParsed < map[os].firstDate) map[os].firstDate = r.dataParsed;
                if (!map[os].lastDate || r.dataParsed > map[os].lastDate) map[os].lastDate = r.dataParsed;
            }
        });

        const list = Object.values(map).map(item => {
            item.depths.sort((a, b) => a - b);
            const count = item.depths.length;
            let media = 0, mediana = 0, min = 0, max = 0, stdDev = 0;

            if (count > 0) {
                const sum = item.depths.reduce((a, b) => a + b, 0);
                media = sum / count;
                mediana = SubsolagemEngine.calculateMedian(item.depths);
                min = item.depths[0];
                max = item.depths[count - 1];
                stdDev = SubsolagemEngine.calculateStdDev(item.depths, media);
            }

            const percDentro = count > 0 ? Number(((item.dentro / count) * 100).toFixed(1)) : 0;
            const amplitude = Number((max - min).toFixed(1));

            return {
                os: item.os,
                total: item.records.length,
                validos: count,
                media: Number(media.toFixed(1)),
                mediana: Number(mediana.toFixed(1)),
                min: Number(min.toFixed(1)),
                max: Number(max.toFixed(1)),
                amplitude,
                stdDev: Number(stdDev.toFixed(2)),
                percDentro,
                frentes: Array.from(item.frentesSet).join(', '),
                locais: Array.from(item.localsSet).join(', '),
                responsaveis: Array.from(item.respsSet).join(', '),
                primeiraDataBR: item.firstDate ? SubsolagemEngine.formatDateBR(item.firstDate) : '-',
                ultimaDataBR: item.lastDate ? SubsolagemEngine.formatDateBR(item.lastDate) : '-'
            };
        });

        // Ordena por maior volume de medições
        return list.sort((a, b) => b.total - a.total);
    };

    /**
     * Histograma de Frequência das Profundidades (Seção 12)
     */
    SubsolagemEngine.buildHistogram = function (records, binSize) {
        binSize = binSize || 5;
        const validRecords = records.filter(r => r.temProfundidadeValida);
        if (validRecords.length === 0) return { labels: [], counts: [], percentages: [] };

        // Faixas de 35 a 60 em passos de 5 cm:
        // [35-39], [40-44], [45-49], [50-54], [55-60]
        const bins = [
            { min: 0, max: 39.9, label: '< 40 cm', count: 0 },
            { min: 40.0, max: 44.9, label: '40 a 44 cm', count: 0 },
            { min: 45.0, max: 49.9, label: '45 a 49 cm', count: 0 },
            { min: 50.0, max: 54.9, label: '50 a 54 cm', count: 0 },
            { min: 55.0, max: 59.9, label: '55 a 59 cm', count: 0 },
            { min: 60.0, max: 999.0, label: '≥ 60 cm', count: 0 }
        ];

        validRecords.forEach(r => {
            const p = r.profundidade;
            for (const b of bins) {
                if (p >= b.min && p <= b.max) {
                    b.count++;
                    break;
                }
            }
        });

        const total = validRecords.length;
        return {
            labels: bins.map(b => b.label),
            counts: bins.map(b => b.count),
            percentages: bins.map(b => Number(((b.count / total) * 100).toFixed(1))),
            total
        };
    };

    /**
     * Série Temporal: Evolução da Profundidade Média por Dia (Seção 12)
     */
    SubsolagemEngine.buildTimeSeries = function (records, targetConfig) {
        const map = {};

        records.forEach(r => {
            if (!r.temProfundidadeValida || !r.dataParsed) return;
            const dateKey = r.isoDate;
            if (!map[dateKey]) {
                map[dateKey] = {
                    dateKey,
                    dateBR: r.dataBR,
                    dateParsed: new Date(r.dataParsed.getFullYear(), r.dataParsed.getMonth(), r.dataParsed.getDate()),
                    depths: [],
                    osSet: new Set(),
                    frentesSet: new Set(),
                    locaisSet: new Set()
                };
            }
            map[dateKey].depths.push(r.profundidade);
            if (r.os && r.os !== '-' && r.os !== 'N/A') map[dateKey].osSet.add(r.os);
            if (r.frente && r.frente !== '-' && r.frente !== 'N/A') map[dateKey].frentesSet.add(r.frente);
            if (r.localidadeTalhao && r.localidadeTalhao !== '-' && r.localidadeTalhao !== 'N/A') map[dateKey].locaisSet.add(r.localidadeTalhao);
        });

        const sortedDays = Object.values(map).sort((a, b) => a.dateParsed.getTime() - b.dateParsed.getTime());

        const datesBR = [];
        const medias = [];
        const medianas = [];
        const mins = [];
        const maxs = [];
        const counts = [];
        const targetMinLine = [];
        const targetMaxLine = [];
        const osList = [];
        const frentesList = [];
        const locaisList = [];

        sortedDays.forEach(day => {
            day.depths.sort((a, b) => a - b);
            const count = day.depths.length;
            const sum = day.depths.reduce((a, b) => a + b, 0);
            const media = Number((sum / count).toFixed(1));
            const mediana = Number(SubsolagemEngine.calculateMedian(day.depths).toFixed(1));
            const min = day.depths[0];
            const max = day.depths[count - 1];

            datesBR.push(day.dateBR);
            medias.push(media);
            medianas.push(mediana);
            mins.push(min);
            maxs.push(max);
            counts.push(count);

            const arrOS = Array.from(day.osSet).sort();
            osList.push(arrOS.length > 0 ? (arrOS.length > 3 ? `${arrOS.slice(0, 3).join(', ')} (+${arrOS.length - 3})` : arrOS.join(', ')) : 'N/A');

            const arrFrentes = Array.from(day.frentesSet).sort();
            frentesList.push(arrFrentes.length > 0 ? arrFrentes.join(', ') : 'N/A');

            const arrLocais = Array.from(day.locaisSet).sort();
            locaisList.push(arrLocais.length > 0 ? (arrLocais.length > 3 ? `${arrLocais.slice(0, 3).join(', ')} (+${arrLocais.length - 3})` : arrLocais.join(', ')) : 'N/A');

            if (targetConfig && targetConfig.ativa) {
                targetMinLine.push(targetConfig.min);
                targetMaxLine.push(targetConfig.max);
            }
        });

        return {
            labels: datesBR,
            medias,
            medianas,
            mins,
            maxs,
            counts,
            targetMinLine,
            targetMaxLine,
            osList,
            frentesList,
            locaisList
        };
    };

    /**
     * Análise por Responsável / Inspetor (Seção 15)
     */
    SubsolagemEngine.buildResponsavelAnalysis = function (records) {
        const map = {};

        records.forEach(r => {
            const resp = r.responsavel || 'Não Informado';
            if (!map[resp]) {
                map[resp] = {
                    responsavel: resp,
                    records: [],
                    depths: [],
                    frentesSet: new Set(),
                    osSet: new Set()
                };
            }
            map[resp].records.push(r);
            if (r.temProfundidadeValida) map[resp].depths.push(r.profundidade);
            if (r.frente) map[resp].frentesSet.add(r.frente);
            if (r.os) map[resp].osSet.add(r.os);
        });

        return Object.values(map).map(item => {
            item.depths.sort((a, b) => a - b);
            const count = item.depths.length;
            let media = 0, mediana = 0, min = 0, max = 0, stdDev = 0;
            if (count > 0) {
                const sum = item.depths.reduce((a, b) => a + b, 0);
                media = Number((sum / count).toFixed(1));
                mediana = Number(SubsolagemEngine.calculateMedian(item.depths).toFixed(1));
                min = item.depths[0];
                max = item.depths[count - 1];
                stdDev = Number(SubsolagemEngine.calculateStdDev(item.depths, media).toFixed(2));
            }
            return {
                responsavel: item.responsavel,
                total: item.records.length,
                validos: count,
                media,
                mediana,
                min,
                max,
                stdDev,
                totalFrentes: item.frentesSet.size,
                totalOS: item.osSet.size
            };
        }).sort((a, b) => b.total - a.total);
    };

    window.SubsolagemEngine = SubsolagemEngine;

})(window);
