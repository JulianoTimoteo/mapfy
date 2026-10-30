/**
 * compliance_engine.js
 * =====================
 * Motor Central de Regras de Conformidade, Normalização e Validação
 * Usina Pitangueiras • Monitoramento de Frentes e Áreas de Vivência
 */

(function (window) {
    'use strict';

    // Definição das Regras Operacionais dos Itens (Seção 9 do Prompt Mestre)
    const COMPLIANCE_RULES = {
        aguaPotavel: {
            field: 'Água Potável em temperatura adequada ?',
            label: 'Água potável em temp. adequada',
            shortLabel: 'Água Potável',
            category: 'Sanitário / Saúde',
            type: 'CRITICO',
            expected: 'SIM',
            isMandatory: true,
            weight: 1
        },
        aguaHigienizacao: {
            field: 'Possui água para higienização ?',
            label: 'Água para higienização',
            shortLabel: 'Água Higiene',
            category: 'Sanitário / Higiene',
            type: 'CRITICO',
            expected: 'SIM',
            isMandatory: true,
            weight: 1
        },
        papelHigienico: {
            field: 'Possui papel higiênico e suporte?',
            label: 'Papel higiênico e suporte',
            shortLabel: 'Papel Higiênico',
            category: 'Sanitário / Conforto',
            type: 'CRITICO',
            expected: 'SIM',
            isMandatory: true,
            weight: 1
        },
        papelToalha: {
            field: 'Possui papel toalha e suporte ?',
            label: 'Papel toalha e suporte',
            shortLabel: 'Papel Toalha',
            category: 'Sanitário / Higiene',
            type: 'CRITICO',
            expected: 'SIM',
            isMandatory: true,
            weight: 1
        },
        piaDescarga: {
            field: 'Pia e descarga funcionando ?',
            label: 'Pia e descarga funcionando',
            shortLabel: 'Pia / Descarga',
            category: 'Sanitário / Estrutura',
            type: 'CRITICO',
            expected: 'SIM',
            isMandatory: true,
            weight: 1
        },
        limpeza: {
            field: ' Limpeza',
            label: 'Limpeza da área de vivência',
            shortLabel: 'Limpeza',
            category: 'Qualidade / 5S',
            type: 'CRITICO',
            expected: 'BOM',
            isMandatory: true,
            weight: 1
        },
        itemQuebrado: {
            field: 'Possui algum item quebrado ou em falta?',
            label: 'Item quebrado ou em falta',
            shortLabel: 'Item Quebrado',
            category: 'Manutenção / Estrutura',
            type: 'OCORRENCIA',
            expected: 'NÃO',
            isMandatory: false,
            triggersAlert: true,
            weight: 1
        },
        fitaIsolamento: {
            field: ' Está utilizando fita de Isolamento ',
            label: 'Fita de isolamento',
            shortLabel: 'Fita Isolamento',
            category: 'Segurança / Sinalização',
            type: 'PROCEDIMENTAL',
            expected: 'SIM',
            isMandatory: false,
            weight: 0.5
        },
        coneSinalizacao: {
            field: 'Está utilizando  cone de Sinalização ?',
            label: 'Cone de sinalização',
            shortLabel: 'Cone Sinalização',
            category: 'Segurança / Sinalização',
            type: 'PROCEDIMENTAL',
            expected: 'SIM',
            isMandatory: false,
            weight: 0.5
        },
        bancosFixos: {
            field: 'Bancos Fixos ',
            label: 'Bancos fixos',
            shortLabel: 'Bancos Fixos',
            category: 'Ergonomia / Conforto',
            type: 'INFORMATIVO',
            expected: null, // Regra operacional não formalizada
            isMandatory: false,
            weight: 0
        },
        extintor: {
            field: 'Extintor ',
            label: 'Extintor de incêndio',
            shortLabel: 'Extintor',
            category: 'Segurança / Combate a Incêndio',
            type: 'INFORMATIVO',
            expected: null, // Regra operacional não formalizada
            isMandatory: false,
            weight: 0
        }
    };

    /**
     * Normaliza uma string de data brasileira (DD/MM/AAAA HH:mm ou DD/MM/AAAA)
     */
    function parseBrazilianDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        const trimmed = dateStr.trim();
        // Regex: DD/MM/AAAA HH:mm:ss ou DD/MM/AAAA HH:mm ou DD/MM/AAAA
        const parts = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
        if (!parts) return null;

        const day = parseInt(parts[1], 10);
        const month = parseInt(parts[2], 10) - 1; // 0-based
        const year = parseInt(parts[3], 10);
        const hour = parts[4] ? parseInt(parts[4], 10) : 0;
        const minute = parts[5] ? parseInt(parts[5], 10) : 0;
        const second = parts[6] ? parseInt(parts[6], 10) : 0;

        const d = new Date(year, month, day, hour, minute, second);
        return isNaN(d.getTime()) ? null : d;
    }

    /**
     * Formata um objeto Date para DD/MM/AAAA
     */
    function formatDateBR(d) {
        if (!d) return 'N/D';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }

    /**
     * Formata um objeto Date para DD/MM/AAAA HH:mm
     */
    function formatDateTimeBR(d) {
        if (!d) return 'N/D';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hour = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hour}:${min}`;
    }

    /**
     * Normaliza valores de coordenadas com vírgula para número
     */
    function parseCoord(val) {
        if (val === null || val === undefined || val === '') return null;
        if (typeof val === 'number') return isNaN(val) ? null : val;
        const clean = String(val).replace(',', '.').trim();
        const num = parseFloat(clean);
        return isNaN(num) ? null : num;
    }

    /**
     * Normaliza e valida um registro bruto da base de dados
     */
    function normalizeRecord(raw) {
        const id = String(raw.ID || raw.Id || '').trim();
        const usuario = String(raw['Usuário'] || raw.Usuario || '').trim();
        const dataRaw = String(raw.Data || '').trim();
        const dataParsed = parseBrazilianDate(dataRaw);
        
        const dataInicioRaw = String(raw['Data início'] || raw['Data inicio'] || '').trim();
        const dataFimRaw = String(raw['Data Fim'] || raw.DataFim || '').trim();
        const dataInicioParsed = parseBrazilianDate(dataInicioRaw);
        const dataFimParsed = parseBrazilianDate(dataFimRaw);

        // Cálculo da duração com detecção de inconsistência
        let duracaoMinutos = null;
        let duracaoInconsistente = false;
        if (dataInicioParsed && dataFimParsed) {
            const diffMs = dataFimParsed.getTime() - dataInicioParsed.getTime();
            duracaoMinutos = Math.round(diffMs / 60000);
            if (duracaoMinutos < 0) {
                duracaoInconsistente = true;
            }
        }

        // Normalização das Coordenadas
        const lat = parseCoord(raw.Latitude);
        const lng = parseCoord(raw.Longitude);
        const hasValidCoords = (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && lat !== 0 && lng !== 0);

        // Normalização do Turno
        const turnoRaw = String(raw['Turno '] || raw.Turno || '').trim().toUpperCase();
        let turno = turnoRaw;
        let turnoAtipico = false;
        if (!['A', 'B', 'C'].includes(turnoRaw)) {
            turnoAtipico = true;
            // Preserva o valor original, mas padroniza para auditoria
            if (turnoRaw.startsWith('A')) turno = 'A';
            else if (turnoRaw.startsWith('B')) turno = 'B';
            else if (turnoRaw.startsWith('C')) turno = 'C';
        }

        // Frente
        const frente = String(raw.Frente || 'FRENTE NÃO INFORMADA').trim();

        // Respostas dos Itens
        const answers = {};
        for (const [key, meta] of Object.entries(COMPLIANCE_RULES)) {
            const val = raw[meta.field];
            if (val === undefined || val === null || String(val).trim() === '' || String(val).toLowerCase() === 'nan') {
                answers[key] = 'NÃO INFORMADO';
            } else {
                answers[key] = String(val).trim().toUpperCase();
            }
        }

        // Observação
        let obs = raw.OBS;
        if (obs === undefined || obs === null || String(obs).toLowerCase() === 'nan' || String(obs).trim() === '') {
            obs = null;
        } else {
            obs = String(obs).trim();
        }

        // Monta o objeto normalizado
        const record = {
            id,
            usuario,
            dataRaw,
            dataParsed,
            dataBR: dataParsed ? formatDateBR(dataParsed) : 'N/D',
            dataHoraBR: dataParsed ? formatDateTimeBR(dataParsed) : 'N/D',
            isoDate: dataParsed ? dataParsed.toISOString().slice(0, 10) : '',
            dataInicioParsed,
            dataFimParsed,
            duracaoMinutos,
            duracaoInconsistente,
            status: String(raw.Status || 'Aberto').trim(),
            scoreOriginal: String(raw.Score || '0,00').trim(),
            scorePercOriginal: String(raw['Score perc.'] || '0').trim(),
            scoreDescOriginal: String(raw['Score desc.'] || 'Baixo').trim(),
            responsavel: String(raw['Responsável '] || raw.Responsavel || 'Não Informado').trim(),
            turnoRaw,
            turno,
            turnoAtipico,
            frente,
            local: String(raw['Local (Fazenda - Talhão)'] || raw['Local'] || 'N/D').trim(),
            obs,
            lat,
            lng,
            hasValidCoords,
            answers,
            rawRecord: raw
        };

        // Aplica o motor de conformidade
        evaluateCompliance(record);

        return record;
    }

    /**
     * Aplica o Motor de Regras e Classifica a Inspeção
     */
    function evaluateCompliance(record) {
        const falhasConfirmadas = [];
        const ocorrenciasAvaliadas = [];
        const pendenciasProcedimentais = [];
        const itensConformes = [];
        const itensInformativos = [];
        const camposAusentes = [];

        for (const [itemKey, rule] of Object.entries(COMPLIANCE_RULES)) {
            const val = record.answers[itemKey];

            if (val === 'NÃO INFORMADO') {
                camposAusentes.push({ itemKey, label: rule.label });
                continue;
            }

            if (rule.type === 'CRITICO') {
                if (val === rule.expected) {
                    itensConformes.push({ itemKey, label: rule.label, val });
                } else {
                    falhasConfirmadas.push({
                        itemKey,
                        label: rule.label,
                        val,
                        expected: rule.expected,
                        category: rule.category
                    });
                }
            } else if (rule.type === 'OCORRENCIA') {
                if (val === 'SIM') {
                    ocorrenciasAvaliadas.push({
                        itemKey,
                        label: rule.label,
                        val,
                        motivo: 'Ocorrência de item quebrado ou em falta registrada no checklist'
                    });
                } else {
                    itensConformes.push({ itemKey, label: rule.label, val });
                }
            } else if (rule.type === 'PROCEDIMENTAL') {
                if (val === 'NÃO') {
                    pendenciasProcedimentais.push({
                        itemKey,
                        label: rule.label,
                        val,
                        motivo: 'Ausência do item de sinalização/isolamento (exige validação procedimental)'
                    });
                } else {
                    itensConformes.push({ itemKey, label: rule.label, val });
                }
            } else if (rule.type === 'INFORMATIVO') {
                itensInformativos.push({ itemKey, label: rule.label, val });
            }
        }

        // Determinação da Classificação Operacional da Inspeção
        let classificacao = 'CONFORME';
        let badgeColor = 'emerald';
        let badgeIcon = '✓';
        let prioridade = 4; // Menor prioridade de alerta

        if (falhasConfirmadas.length > 0) {
            classificacao = 'NÃO CONFORME';
            badgeColor = 'rose';
            badgeIcon = '✕';
            prioridade = 1; // Prioridade Crítica
        } else if (ocorrenciasAvaliadas.length > 0) {
            classificacao = 'ATENÇÃO';
            badgeColor = 'amber';
            badgeIcon = '⚠';
            prioridade = 2; // Prioridade Alta
        } else if (pendenciasProcedimentais.length > 0 || camposAusentes.length > 0 || record.duracaoInconsistente) {
            classificacao = 'PENDÊNCIA';
            badgeColor = 'blue';
            badgeIcon = 'ℹ';
            prioridade = 3;
        }

        // Detecção de Inconsistência de Score:
        // Na base de dados original, Score = 0,00 e Score desc. = 'Baixo' para 100% dos registros,
        // inclusive quando a inspeção não possui nenhuma irregularidade.
        const scoreIncompativel = (classificacao === 'CONFORME' && record.scoreDescOriginal === 'Baixo');

        // Índice de Conformidade Calculado (Auditável)
        const totalAvaliados = 6; // 6 itens críticos obrigatórios
        const totalAprovados = 6 - falhasConfirmadas.length;
        const indiceConformidadePerc = Math.round((totalAprovados / totalAvaliados) * 100);

        record.compliance = {
            classificacao,
            badgeColor,
            badgeIcon,
            prioridade,
            falhasConfirmadas,
            ocorrenciasAvaliadas,
            pendenciasProcedimentais,
            itensConformes,
            itensInformativos,
            camposAusentes,
            totalFalhas: falhasConfirmadas.length,
            totalOcorrencias: ocorrenciasAvaliadas.length,
            totalPendencias: pendenciasProcedimentais.length + camposAusentes.length,
            scoreIncompativel,
            indiceConformidadePerc
        };
    }

    /**
     * Calcula métricas e KPIs consolidados para um conjunto de registros filtrados
     */
    function calculateMetrics(records) {
        const total = records.length;
        if (total === 0) {
            return {
                totalInspecoes: 0,
                frentesInspecionadas: 0,
                inspecoesNaoConformes: 0,
                totalItensNaoConformes: 0,
                inspecoesConformes: 0,
                inspecoesAtencao: 0,
                inspecoesAbertas: 0,
                pendenciasInformacao: 0,
                frentesAtencao: 0,
                taxaConformidade: 0,
                frentesList: []
            };
        }

        const frentesSet = new Set();
        const frentesComProblemaSet = new Set();
        let naoConformes = 0;
        let totalFalhasItens = 0;
        let conformes = 0;
        let atencao = 0;
        let abertas = 0;
        let pendencias = 0;

        records.forEach(r => {
            frentesSet.add(r.frente);

            if (r.compliance.classificacao === 'NÃO CONFORME') {
                naoConformes++;
                totalFalhasItens += r.compliance.totalFalhas;
                frentesComProblemaSet.add(r.frente);
            } else if (r.compliance.classificacao === 'ATENÇÃO') {
                atencao++;
                frentesComProblemaSet.add(r.frente);
            } else if (r.compliance.classificacao === 'CONFORME') {
                conformes++;
            }

            if (r.status === 'Aberto') abertas++;
            if (r.compliance.scoreIncompativel || r.duracaoInconsistente || r.turnoAtipico || r.compliance.camposAusentes.length > 0) {
                pendencias++;
            }
        });

        const taxaConformidade = Math.round((conformes / total) * 100);

        return {
            totalInspecoes: total,
            frentesInspecionadas: frentesSet.size,
            inspecoesNaoConformes: naoConformes,
            totalItensNaoConformes: totalFalhasItens,
            inspecoesConformes: conformes,
            inspecoesAtencao: atencao,
            inspecoesAbertas: abertas,
            pendenciasInformacao: pendencias,
            frentesAtencao: frentesComProblemaSet.size,
            taxaConformidade,
            frentesList: Array.from(frentesSet).sort()
        };
    }

    /**
     * Constrói a Matriz de Conformidade: Frentes x Itens de Checklist
     */
    function buildComplianceMatrix(records) {
        const matrix = {};
        const frentes = Array.from(new Set(records.map(r => r.frente))).sort();
        const itemKeys = Object.keys(COMPLIANCE_RULES);

        frentes.forEach(frente => {
            matrix[frente] = {};
            itemKeys.forEach(itemKey => {
                matrix[frente][itemKey] = {
                    total: 0,
                    conformes: 0,
                    naoConformes: 0,
                    ocorrencias: 0,
                    pendencias: 0,
                    records: []
                };
            });
        });

        records.forEach(r => {
            const frente = r.frente;
            itemKeys.forEach(itemKey => {
                const rule = COMPLIANCE_RULES[itemKey];
                const val = r.answers[itemKey];
                const cell = matrix[frente][itemKey];
                cell.total++;
                cell.records.push(r);

                if (rule.type === 'CRITICO') {
                    if (val === rule.expected) cell.conformes++;
                    else cell.naoConformes++;
                } else if (rule.type === 'OCORRENCIA') {
                    if (val === 'SIM') cell.ocorrencias++;
                    else cell.conformes++;
                } else if (rule.type === 'PROCEDIMENTAL') {
                    if (val === 'NÃO') cell.pendencias++;
                    else cell.conformes++;
                } else {
                    cell.conformes++;
                }
            });
        });

        return { frentes, itemKeys, matrix, rules: COMPLIANCE_RULES };
    }

    /**
     * Análise Comparativa por Frente Operacional
     */
    function buildFrenteAnalysis(records) {
        const grouped = {};

        records.forEach(r => {
            if (!grouped[r.frente]) {
                grouped[r.frente] = {
                    frente: r.frente,
                    total: 0,
                    conformes: 0,
                    atencao: 0,
                    naoConformes: 0,
                    totalFalhas: 0,
                    totalItensQuebrados: 0,
                    ultimaData: null,
                    ultimoRegistro: null,
                    records: []
                };
            }
            const g = grouped[r.frente];
            g.total++;
            g.records.push(r);

            if (r.compliance.classificacao === 'CONFORME') g.conformes++;
            else if (r.compliance.classificacao === 'ATENÇÃO') {
                g.atencao++;
                g.totalItensQuebrados++;
            } else if (r.compliance.classificacao === 'NÃO CONFORME') {
                g.naoConformes++;
                g.totalFalhas += r.compliance.totalFalhas;
            }

            if (!g.ultimaData || (r.dataParsed && r.dataParsed > g.ultimaData)) {
                g.ultimaData = r.dataParsed;
                g.ultimoRegistro = r;
            }
        });

        const list = Object.values(grouped).map(g => {
            const percConforme = g.total > 0 ? Math.round((g.conformes / g.total) * 100) : 0;
            const percNaoConforme = g.total > 0 ? Math.round((g.naoConformes / g.total) * 100) : 0;
            return {
                ...g,
                percConforme,
                percNaoConforme,
                ultimaDataBR: g.ultimaData ? formatDateBR(g.ultimaData) : 'N/D',
                statusGeral: g.naoConformes > 0 ? 'CRÍTICO' : (g.atencao > 0 ? 'ATENÇÃO' : 'REGULAR')
            };
        });

        // Ordena por prioridade: frentes com não conformidade primeiro, depois com atenção
        list.sort((a, b) => (b.naoConformes - a.naoConformes) || (b.atencao - a.atencao) || (b.total - a.total));
        return list;
    }

    /**
     * Lista priorizada da Central de Atenção Operacional
     */
    function buildAlertsList(records) {
        const alerts = [];

        records.forEach(r => {
            // 1. Falhas Sanitárias Críticas
            r.compliance.falhasConfirmadas.forEach(f => {
                alerts.push({
                    priority: 'CRÍTICA',
                    level: 1,
                    frente: r.frente,
                    id: r.id,
                    dataHora: r.dataHoraBR,
                    responsavel: r.responsavel,
                    turno: r.turno,
                    local: r.local,
                    item: f.label,
                    resposta: f.val,
                    motivo: `Não conformidade crítica confirmada: ${f.label} com resposta "${f.val}" (esperado: "${f.expected}")`,
                    record: r
                });
            });

            // 2. Ocorrências de Item Quebrado
            r.compliance.ocorrenciasAvaliadas.forEach(o => {
                alerts.push({
                    priority: 'ALTA',
                    level: 2,
                    frente: r.frente,
                    id: r.id,
                    dataHora: r.dataHoraBR,
                    responsavel: r.responsavel,
                    turno: r.turno,
                    local: r.local,
                    item: o.label,
                    resposta: o.val,
                    motivo: `Ocorrência informada: Item quebrado ou em falta identificado na área de vivência`,
                    record: r
                });
            });

            // 3. Pendências de Sinalização / Procedimento
            r.compliance.pendenciasProcedimentais.forEach(p => {
                alerts.push({
                    priority: 'MÉDIA',
                    level: 3,
                    frente: r.frente,
                    id: r.id,
                    dataHora: r.dataHoraBR,
                    responsavel: r.responsavel,
                    turno: r.turno,
                    local: r.local,
                    item: p.label,
                    resposta: p.val,
                    motivo: p.motivo,
                    record: r
                });
            });
        });

        alerts.sort((a, b) => a.level - b.level);
        return alerts;
    }

    // Exporta o módulo para o escopo global
    window.ComplianceEngine = {
        COMPLIANCE_RULES,
        parseBrazilianDate,
        formatDateBR,
        formatDateTimeBR,
        normalizeRecord,
        evaluateCompliance,
        calculateMetrics,
        buildComplianceMatrix,
        buildFrenteAnalysis,
        buildAlertsList
    };

})(window);
