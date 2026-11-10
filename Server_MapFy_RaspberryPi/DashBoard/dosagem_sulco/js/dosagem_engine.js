/**
 * dosagem_engine.js
 * =================
 * Motor Estatístico, Regras de Qualidade e Análise de Dosagem na Sulcação
 * Usina Pitangueiras • Safra 2026
 */

(function (window) {
    'use strict';

    const DosagemEngine = {};

    // Configurações Técnicas Padrão por Produto (Auditáveis e Calibráveis)
    const DEFAULT_TARGETS = {
        adubo: {
            produto: 'Adubo',
            min: 3.00,
            alvo: 3.40,
            max: 3.80,
            unidade: 'kg/m',
            ativa: true,
            justificativa: 'Faixa técnica agronômica padrão de adubação no sulco'
        },
        torta: {
            produto: 'Torta',
            min: 5.20,
            alvo: 5.60,
            max: 6.00,
            unidade: 't/ha',
            ativa: true,
            justificativa: 'Faixa técnica agronômica padrão de aplicação de torta de filtro'
        },
        configurada: true,
        regraId: 'REGRA-DOSAGEM-PITANGUEIRAS-2026'
    };

    /**
     * Recupera ou salva configurações de alvos técnicos no localStorage
     */
    DosagemEngine.getTargetConfig = function () {
        try {
            const saved = localStorage.getItem('mapfy_dosagem_targets_v1');
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    adubo: { ...DEFAULT_TARGETS.adubo, ...(parsed.adubo || {}) },
                    torta: { ...DEFAULT_TARGETS.torta, ...(parsed.torta || {}) },
                    configurada: parsed.configurada !== undefined ? parsed.configurada : true,
                    regraId: DEFAULT_TARGETS.regraId
                };
            }
        } catch (e) {
            console.warn('Falha ao ler targets de dosagem:', e);
        }
        return {
            adubo: { ...DEFAULT_TARGETS.adubo },
            torta: { ...DEFAULT_TARGETS.torta },
            configurada: true,
            regraId: DEFAULT_TARGETS.regraId
        };
    };

    DosagemEngine.saveTargetConfig = function (cfg) {
        try {
            localStorage.setItem('mapfy_dosagem_targets_v1', JSON.stringify(cfg));
            return cfg;
        } catch (e) {
            console.error('Falha ao salvar targets de dosagem:', e);
            return DEFAULT_TARGETS;
        }
    };

    /**
     * Converte datas brasileiras (DD/MM/AAAA HH:mm) em objetos Date
     */
    DosagemEngine.parseDateBR = function (str) {
        if (!str || typeof str !== 'string') return null;
        const parts = str.trim().split(' ');
        if (!parts[0]) return null;

        const dateParts = parts[0].split('/');
        if (dateParts.length !== 3) return null;

        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);

        let hours = 0, minutes = 0;
        if (parts[1]) {
            const timeParts = parts[1].split(':');
            hours = parseInt(timeParts[0], 10) || 0;
            minutes = parseInt(timeParts[1], 10) || 0;
        }

        const d = new Date(year, month, day, hours, minutes);
        return isNaN(d.getTime()) ? null : d;
    };

    DosagemEngine.formatDateBR = function (d) {
        if (!d || isNaN(d.getTime())) return '';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}/${d.getFullYear()}`;
    };

    /**
     * Normalização e Validação de um registro de Dosagem
     */
    DosagemEngine.normalizeRecord = function (raw) {
        const id = String(raw.ID || '').trim();
        const usuario = String(raw.Usuario || raw['Usuário'] || '').trim();
        const dataStr = String(raw.Data || '').trim();
        const dataParsed = DosagemEngine.parseDateBR(dataStr);
        const dataBR = dataParsed ? DosagemEngine.formatDateBR(dataParsed) : dataStr.split(' ')[0] || '';
        const isoDate = dataParsed ? `${dataParsed.getFullYear()}-${String(dataParsed.getMonth()+1).padStart(2, '0')}-${String(dataParsed.getDate()).padStart(2, '0')}` : '';

        const dataLancStr = String(raw.DataLancamento || raw['Data Lançamento'] || '').trim();
        const dataLancParsed = DosagemEngine.parseDateBR(dataLancStr);
        const dataLancBR = dataLancParsed ? DosagemEngine.formatDateBR(dataLancParsed) : dataLancStr;

        // Coordenadas
        const latStr = String(raw.Latitude || '').replace(',', '.').trim();
        const lngStr = String(raw.Longitude || '').replace(',', '.').trim();
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

        // Duração da Medição
        const dataInicioStr = String(raw.DataInicio || raw['Data início'] || '').trim();
        const dataFimStr = String(raw.DataFim || raw['Data Fim'] || '').trim();
        const dtInicio = DosagemEngine.parseDateBR(dataInicioStr);
        const dtFim = DosagemEngine.parseDateBR(dataFimStr);
        let duracaoMinutos = 0;
        let duracaoInconsistente = false;

        if (dtInicio && dtFim) {
            duracaoMinutos = Math.round((dtFim.getTime() - dtInicio.getTime()) / (1000 * 60));
            if (duracaoMinutos < 0 || duracaoMinutos > 720) {
                duracaoInconsistente = true;
            }
        }

        // Produto
        let produto = String(raw.Produto || '').trim();
        if (!produto) produto = 'Não Informado';

        // Dosagem numérica
        let dosagemRaw = '';
        for (const k in raw) {
            if (k.toLowerCase().includes('dosagem')) {
                dosagemRaw = String(raw[k] || '').trim();
                break;
            }
        }
        let dosagem = null;
        let temDosagemValida = false;
        if (dosagemRaw !== '') {
            const num = parseFloat(dosagemRaw.replace(',', '.'));
            if (!isNaN(num) && num > 0) {
                dosagem = num;
                temDosagemValida = true;
            }
        }

        // Frente
        let frente = String(raw.Frente || '').trim();
        if (frente.includes('EDMILSON') || frente.includes('261')) frente = '261 - FRENTE PRÓPRIA (EDMILSON)';
        else if (frente.includes('PEDRINHO') || frente.includes('135')) frente = '135 - FRENTE PEDRINHO';
        else if (frente.includes('MECANIZADA') || frente.includes('101')) frente = '101 - FRENTE MECANIZADA';
        else if (frente.includes('CASSIO') && frente.includes('105')) frente = '105 - FRENTE CASSIO (ZACARIAS)';
        else if (frente.includes('CASSIO') && frente.includes('143')) frente = '143 - FRENTE CASSIO';
        else if (frente.includes('MANEZ') || frente.includes('139')) frente = '139 - FRENTE MANEZÃO';
        else if (frente.includes('BIDU') || frente.includes('142')) frente = '142 - FRENTE BIDU';
        if (!frente) frente = 'Não Informado';

        const resp = String(raw.Responsavel || raw['Responsável'] || '').trim() || 'Não Informado';
        const local = String(raw.Local || raw['Local (Fazenda - Talhão)'] || '').trim() || 'Não Informado';
        const os = String(raw.OS || '').trim() || 'Sem OS';
        const status = String(raw.Status || '').trim() || 'Aberto';
        const score = String(raw.Score || '0,00').trim();

        // Inconsistências de dados para auditoria
        const inconsistencias = [];
        if (!id) inconsistencias.push('ID ausente');
        if (!dataParsed) inconsistencias.push('Data inválida');
        if (!temDosagemValida) inconsistencias.push('Dosagem não numérica ou ausente');
        if (!hasValidCoords) inconsistencias.push('Coordenadas GPS ausentes ou inválidas');
        if (duracaoInconsistente) inconsistencias.push(`Duração atípica (${duracaoMinutos} min)`);
        if (dataLancBR && dataBR && dataLancBR !== dataBR) {
            inconsistencias.push(`Divergência Data Coleta (${dataBR}) vs Lançamento (${dataLancBR})`);
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
            status,
            score,
            local,
            os,
            frente,
            responsavel: resp,
            produto,
            dosagemRaw,
            dosagem,
            temDosagemValida,
            inconsistencias,
            temInconsistencia: inconsistencias.length > 0
        };
    };

    /**
     * Classifica uma medição conforme o produto e a faixa técnica configurada
     */
    DosagemEngine.classifyRecord = function (rec, targetConfig) {
        if (!rec || !rec.temDosagemValida) {
            return {
                status: 'INVÁLIDO',
                label: 'Sem Dosagem Válida',
                badgeClass: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
                color: '#ef4444',
                diff: 0
            };
        }

        const prodKey = (rec.produto || '').toLowerCase().includes('torta') ? 'torta' : 'adubo';
        const cfg = targetConfig ? targetConfig[prodKey] : null;

        if (!cfg || !cfg.ativa) {
            return {
                status: 'DESCRITIVO',
                label: 'Análise Descritiva',
                badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
                color: '#64748b',
                diff: 0
            };
        }

        if (rec.dosagem < cfg.min) {
            return {
                status: 'ABAIXO',
                label: `Abaixo da Meta (< ${cfg.min} ${cfg.unidade})`,
                badgeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
                color: '#f59e0b',
                diff: Number((rec.dosagem - cfg.min).toFixed(3))
            };
        }

        if (rec.dosagem > cfg.max) {
            return {
                status: 'ACIMA',
                label: `Acima da Meta (> ${cfg.max} ${cfg.unidade})`,
                badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
                color: '#a855f7',
                diff: Number((rec.dosagem - cfg.max).toFixed(3))
            };
        }

        return {
            status: 'DENTRO',
            label: `Dentro da Meta (${cfg.min} a ${cfg.max} ${cfg.unidade})`,
            badgeClass: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
            color: '#10b981',
            diff: 0
        };
    };

    /**
     * Mediana e Desvio Padrão
     */
    DosagemEngine.calculateMedian = function (sortedArray) {
        if (!sortedArray || sortedArray.length === 0) return 0;
        const mid = Math.floor(sortedArray.length / 2);
        return sortedArray.length % 2 !== 0 ? sortedArray[mid] : (sortedArray[mid - 1] + sortedArray[mid]) / 2.0;
    };

    DosagemEngine.calculateStdDev = function (array, mean) {
        if (!array || array.length <= 1) return 0;
        const sumSq = array.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
        return Math.sqrt(sumSq / (array.length - 1));
    };

    /**
     * Detecção de Anomalias Estatísticas via IQR por Produto
     */
    DosagemEngine.detectAnomalies = function (records) {
        const anomalies = [];
        const byProduct = { 'Adubo': [], 'Torta': [] };

        records.forEach(r => {
            if (r.temDosagemValida) {
                const p = r.produto.includes('Torta') ? 'Torta' : 'Adubo';
                byProduct[p].push(r.dosagem);
            }
        });

        // Calcula limites IQR por produto
        const limits = {};
        for (const p in byProduct) {
            const arr = byProduct[p].sort((a, b) => a - b);
            if (arr.length >= 4) {
                const q1 = arr[Math.floor(arr.length * 0.25)];
                const q3 = arr[Math.floor(arr.length * 0.75)];
                const iqr = q3 - q1;
                limits[p] = {
                    q1, q3, iqr,
                    lower: q1 - 1.5 * iqr,
                    upper: q3 + 1.5 * iqr
                };
            }
        }

        records.forEach(r => {
            const p = r.produto.includes('Torta') ? 'Torta' : 'Adubo';
            const lim = limits[p];
            if (r.temDosagemValida && lim) {
                if (r.dosagem < lim.lower || r.dosagem > lim.upper) {
                    anomalies.push({
                        record: r,
                        tipo: 'OUTLIER_ESTATISTICO',
                        motivo: `Dosagem discrepante (${r.dosagem.toFixed(3)}) fora do intervalo IQR [${lim.lower.toFixed(2)}, ${lim.upper.toFixed(2)}] para ${p}`,
                        regra: 'Estatística Boxplot 1.5x IQR'
                    });
                }
            }
            if (r.duracaoInconsistente) {
                anomalies.push({
                    record: r,
                    tipo: 'DURACAO_ATIPICA',
                    motivo: `Tempo de medição atípico (${r.duracaoMinutos} min)`,
                    regra: 'Auditoria de Duração Operacional'
                });
            }
            if (!r.hasValidCoords) {
                anomalies.push({
                    record: r,
                    tipo: 'GPS_INVALIDO',
                    motivo: 'Registro sem georreferenciamento de precisão',
                    regra: 'Auditoria de Geotecnologia'
                });
            }
        });

        return anomalies;
    };

    /**
     * Cálculo de Indicadores Executivos Globais
     */
    DosagemEngine.calculateMetrics = function (records, targetConfig, selectedProduct = 'ALL') {
        let pool = records;
        if (selectedProduct !== 'ALL') {
            pool = pool.filter(r => r.produto === selectedProduct);
        }

        const totalMedicoes = pool.length;
        const dosages = [];
        let dentroFaixa = 0;
        let abaixoFaixa = 0;
        let acimaFaixa = 0;
        let coordsValidasCount = 0;
        let pendenciasCount = 0;

        const osSet = new Set();
        const localSet = new Set();
        const frentesSet = new Set();
        const respSet = new Set();
        const produtosSet = new Set();

        pool.forEach(r => {
            if (r.temDosagemValida) {
                dosages.push(r.dosagem);
                const cls = DosagemEngine.classifyRecord(r, targetConfig);
                if (cls.status === 'DENTRO') dentroFaixa++;
                else if (cls.status === 'ABAIXO') abaixoFaixa++;
                else if (cls.status === 'ACIMA') acimaFaixa++;
            }
            if (r.os && r.os !== 'Sem OS') osSet.add(r.os);
            if (r.local && r.local !== 'Não Informado') localSet.add(r.local);
            if (r.frente && r.frente !== 'Não Informado') frentesSet.add(r.frente);
            if (r.responsavel && r.responsavel !== 'Não Informado') respSet.add(r.responsavel);
            if (r.produto) produtosSet.add(r.produto);
            if (r.hasValidCoords) coordsValidasCount++;
            if (r.temInconsistencia) pendenciasCount++;
        });

        dosages.sort((a, b) => a - b);
        const validCount = dosages.length;
        let media = 0, mediana = 0, min = 0, max = 0, stdDev = 0, amplitude = 0;

        if (validCount > 0) {
            const sum = dosages.reduce((a, b) => a + b, 0);
            media = sum / validCount;
            mediana = DosagemEngine.calculateMedian(dosages);
            min = dosages[0];
            max = dosages[validCount - 1];
            amplitude = max - min;
            stdDev = DosagemEngine.calculateStdDev(dosages, media);
        }

        const percDentro = validCount > 0 ? Number(((dentroFaixa / validCount) * 100).toFixed(1)) : 0;
        const percAbaixo = validCount > 0 ? Number(((abaixoFaixa / validCount) * 100).toFixed(1)) : 0;
        const percAcima = validCount > 0 ? Number(((acimaFaixa / validCount) * 100).toFixed(1)) : 0;

        return {
            totalMedicoes,
            validCount,
            invalidCount: totalMedicoes - validCount,
            media: Number(media.toFixed(3)),
            mediana: Number(mediana.toFixed(3)),
            min: Number(min.toFixed(3)),
            max: Number(max.toFixed(3)),
            amplitude: Number(amplitude.toFixed(3)),
            desvioPadrao: Number(stdDev.toFixed(3)),
            cvPerc: media > 0 ? Number(((stdDev / media) * 100).toFixed(1)) : 0,
            dentroFaixa,
            abaixoFaixa,
            acimaFaixa,
            percDentro,
            percAbaixo,
            percAcima,
            osCount: osSet.size,
            talhoesCount: localSet.size,
            frentesCount: frentesSet.size,
            responsaveisCount: respSet.size,
            produtosCount: produtosSet.size,
            coordsValidasCount,
            pendenciasCount
        };
    };

    /**
     * Comparação Entre Produtos (Adubo vs Torta)
     */
    DosagemEngine.compareProducts = function (records, targetConfig) {
        const products = ['Adubo', 'Torta'];
        const comp = {};

        products.forEach(p => {
            const sub = records.filter(r => (r.produto || '').includes(p));
            const m = DosagemEngine.calculateMetrics(sub, targetConfig, p);
            const cfg = targetConfig ? (p === 'Torta' ? targetConfig.torta : targetConfig.adubo) : null;
            comp[p] = {
                ...m,
                produto: p,
                unidade: cfg ? cfg.unidade : (p === 'Torta' ? 't/ha' : 'kg/m'),
                targetMin: cfg ? cfg.min : null,
                targetMax: cfg ? cfg.max : null,
                targetAlvo: cfg ? cfg.alvo : null
            };
        });

        return comp;
    };

    /**
     * Série Temporal Diária
     */
    DosagemEngine.calculateTimeSeries = function (records, selectedProduct = 'ALL') {
        let pool = records;
        if (selectedProduct !== 'ALL') {
            pool = pool.filter(r => r.produto === selectedProduct);
        }

        const dayMap = {};
        pool.forEach(r => {
            if (r.temDosagemValida && r.dataBR) {
                const day = r.dataBR;
                if (!dayMap[day]) {
                    dayMap[day] = { day, dosages: [], count: 0, dateParsed: r.dataParsed };
                }
                dayMap[day].dosages.push(r.dosagem);
                dayMap[day].count++;
            }
        });

        const sortedDays = Object.values(dayMap).sort((a, b) => {
            const tA = a.dateParsed ? a.dateParsed.getTime() : 0;
            const tB = b.dateParsed ? b.dateParsed.getTime() : 0;
            return tA - tB;
        });

        return {
            labels: sortedDays.map(d => d.day),
            medias: sortedDays.map(d => {
                const s = d.dosages.reduce((acc, v) => acc + v, 0);
                return Number((s / d.dosages.length).toFixed(3));
            }),
            counts: sortedDays.map(d => d.count)
        };
    };

    /**
     * Histograma por Faixas
     */
    DosagemEngine.calculateHistogram = function (records, selectedProduct = 'ALL') {
        let pool = records;
        if (selectedProduct !== 'ALL') {
            pool = pool.filter(r => r.produto === selectedProduct);
        }

        const dosages = pool.filter(r => r.temDosagemValida).map(r => r.dosagem);
        if (dosages.length === 0) return { labels: [], counts: [], percentages: [] };

        // Bins dinâmicos dependendo do produto selecionado
        let bins = [];
        if (selectedProduct === 'Adubo') {
            bins = [
                { min: -Infinity, max: 2.50, label: '< 2,50' },
                { min: 2.50, max: 3.00, label: '2,50 a 2,99' },
                { min: 3.00, max: 3.40, label: '3,00 a 3,39' },
                { min: 3.40, max: 3.80, label: '3,40 a 3,79' },
                { min: 3.80, max: 4.50, label: '3,80 a 4,49' },
                { min: 4.50, max: Infinity, label: '≥ 4,50' }
            ];
        } else if (selectedProduct === 'Torta') {
            bins = [
                { min: -Infinity, max: 4.50, label: '< 4,50' },
                { min: 4.50, max: 5.20, label: '4,50 a 5,19' },
                { min: 5.20, max: 5.60, label: '5,20 a 5,59' },
                { min: 5.60, max: 6.00, label: '5,60 a 5,99' },
                { min: 6.00, max: Infinity, label: '≥ 6,00' }
            ];
        } else {
            bins = [
                { min: -Infinity, max: 2.50, label: '< 2,50' },
                { min: 2.50, max: 3.50, label: '2,50 a 3,49' },
                { min: 3.50, max: 4.50, label: '3,50 a 4,49' },
                { min: 4.50, max: 5.50, label: '4,50 a 5,49' },
                { min: 5.50, max: 6.50, label: '5,50 a 6,49' },
                { min: 6.50, max: Infinity, label: '≥ 6,50' }
            ];
        }

        const counts = new Array(bins.length).fill(0);
        dosages.forEach(d => {
            for (let i = 0; i < bins.length; i++) {
                if (d >= bins[i].min && d < bins[i].max) {
                    counts[i]++;
                    break;
                }
            }
        });

        const total = dosages.length;
        return {
            labels: bins.map(b => b.label),
            counts,
            percentages: counts.map(c => Number(((c / total) * 100).toFixed(1)))
        };
    };

    /**
     * Desempenho por Frente
     */
    DosagemEngine.calculateFrenteBreakdown = function (records, selectedProduct = 'ALL') {
        let pool = records;
        if (selectedProduct !== 'ALL') {
            pool = pool.filter(r => r.produto === selectedProduct);
        }

        const frenteMap = {};
        pool.forEach(r => {
            const f = r.frente || 'Não Informado';
            if (!frenteMap[f]) {
                frenteMap[f] = { frente: f, dosages: [], count: 0 };
            }
            frenteMap[f].count++;
            if (r.temDosagemValida) frenteMap[f].dosages.push(r.dosagem);
        });

        return Object.values(frenteMap).map(item => {
            const s = item.dosages.reduce((acc, v) => acc + v, 0);
            const m = item.dosages.length > 0 ? Number((s / item.dosages.length).toFixed(3)) : 0;
            return { frente: item.frente, count: item.count, media: m };
        }).sort((a, b) => b.count - a.count);
    };

    /**
     * Análise de Variabilidade por OS
     */
    DosagemEngine.calculateOSVariability = function (records, targetConfig) {
        const osMap = {};
        records.forEach(r => {
            const osKey = r.os || 'Sem OS';
            if (!osMap[osKey]) {
                osMap[osKey] = {
                    os: osKey,
                    total: 0,
                    dosages: [],
                    frentes: new Set(),
                    locais: new Set(),
                    responsaveis: new Set(),
                    produtos: new Set(),
                    dentro: 0,
                    abaixo: 0,
                    acima: 0
                };
            }
            const g = osMap[osKey];
            g.total++;
            if (r.frente) g.frentes.add(r.frente);
            if (r.local) g.locais.add(r.local);
            if (r.responsavel) g.responsaveis.add(r.responsavel);
            if (r.produto) g.produtos.add(r.produto);
            if (r.temDosagemValida) {
                g.dosages.push(r.dosagem);
                const cls = DosagemEngine.classifyRecord(r, targetConfig);
                if (cls.status === 'DENTRO') g.dentro++;
                else if (cls.status === 'ABAIXO') g.abaixo++;
                else if (cls.status === 'ACIMA') g.acima++;
            }
        });

        return Object.values(osMap).map(g => {
            const vCount = g.dosages.length;
            let media = 0, stdDev = 0, min = 0, max = 0, amplitude = 0;
            if (vCount > 0) {
                const sum = g.dosages.reduce((a, b) => a + b, 0);
                media = sum / vCount;
                stdDev = DosagemEngine.calculateStdDev(g.dosages, media);
                g.dosages.sort((a, b) => a - b);
                min = g.dosages[0];
                max = g.dosages[vCount - 1];
                amplitude = max - min;
            }
            const percConforme = vCount > 0 ? Number(((g.dentro / vCount) * 100).toFixed(1)) : 0;
            return {
                os: g.os,
                totalMedicoes: g.total,
                validMedicoes: vCount,
                media: Number(media.toFixed(3)),
                min: Number(min.toFixed(3)),
                max: Number(max.toFixed(3)),
                amplitude: Number(amplitude.toFixed(3)),
                desvioPadrao: Number(stdDev.toFixed(3)),
                cvPerc: media > 0 ? Number(((stdDev / media) * 100).toFixed(1)) : 0,
                dentro: g.dentro,
                abaixo: g.abaixo,
                acima: g.acima,
                percConforme,
                produtos: Array.from(g.produtos),
                frentes: Array.from(g.frentes),
                locais: Array.from(g.locais),
                responsaveis: Array.from(g.responsaveis)
            };
        }).sort((a, b) => b.totalMedicoes - a.totalMedicoes);
    };

    window.DosagemEngine = DosagemEngine;

})(window);
