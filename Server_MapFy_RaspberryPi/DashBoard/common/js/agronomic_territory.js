/**
 * agronomic_territory.js
 * =======================
 * Módulo Central de Inteligência e Gestão Territorial Agronômica
 * Usina Pitangueiras - Safra 2026
 * 
 * Responsabilidades:
 * 1. Cadastro, consolidação e auditoria de áreas em hectares por Fazenda, Zona, Talhão e Parcelas.
 * 2. Prevenção de ambiguidades entre quantidade de registros e quantidade real de talhões.
 * 3. Consolidação estrita hierárquica:
 *    FAZENDA -> ZONA -> TALHÃO -> PARCELAS DE ÁREA
 * 4. Persistência local (localStorage) com backup em JSON/CSV e semente auditada.
 * 5. Caso de Referência Homologado (Páginas 61-62 do Manual Técnico):
 *    Fazenda 54401 — Sítio Benvinda:
 *    - Talhão 1: 6,83 ha + 17,42 ha = 24,25 ha
 *    - Talhão 2: 4,34 ha + 2,06 ha = 6,40 ha
 *    - Total Sítio: 30,65 ha
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AgronomicTerritory = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const STORAGE_KEY = 'pitangueiras_agronomic_territory_v1';
    const AUDIT_LOG_KEY = 'pitangueiras_territory_audit_v1';

    // Semente padrão auditada (Sítio Benvinda e referências)
    const SEED_PARCELAS = [
        {
            id: 'PARC_54401_Z3_T1_A',
            fazenda: '54401',
            nome_faz: 'SITIO BENVINDA',
            zona: 3,
            talhao: 1,
            area: 6.83,
            shape_id: 'SHP_54401_1_A',
            origem: 'Cadastral GeoJSON',
            situacao: 'Auditado',
            atualizado_em: '2026-11-14T07:55:00-03:00',
            atualizado_por: 'Manual Técnico Agronômico'
        },
        {
            id: 'PARC_54401_Z3_T1_B',
            fazenda: '54401',
            nome_faz: 'SITIO BENVINDA',
            zona: 3,
            talhao: 1,
            area: 17.42,
            shape_id: 'SHP_54401_1_B',
            origem: 'Cadastro Agronômico',
            situacao: 'Auditado',
            atualizado_em: '2026-11-14T07:55:00-03:00',
            atualizado_por: 'Manual Técnico Agronômico'
        },
        {
            id: 'PARC_54401_Z3_T2_A',
            fazenda: '54401',
            nome_faz: 'SITIO BENVINDA',
            zona: 3,
            talhao: 2,
            area: 4.34,
            shape_id: 'SHP_54401_2_A',
            origem: 'Cadastral GeoJSON',
            situacao: 'Auditado',
            atualizado_em: '2026-11-14T07:55:00-03:00',
            atualizado_por: 'Manual Técnico Agronômico'
        },
        {
            id: 'PARC_54401_Z3_T2_B',
            fazenda: '54401',
            nome_faz: 'SITIO BENVINDA',
            zona: 3,
            talhao: 2,
            area: 2.06,
            shape_id: 'SHP_54401_2_B',
            origem: 'Cadastro Agronômico',
            situacao: 'Auditado',
            atualizado_em: '2026-11-14T07:55:00-03:00',
            atualizado_por: 'Manual Técnico Agronômico'
        }
    ];

    const Territory = {
        _parcelasMap: new Map(), // chave: id_parcela -> obj parcela
        _shapeFallbacks: new Map(), // chave: 'fazenda_talhao' -> { area, nome_faz, zona }
        _auditLog: [],
        _listeners: [],

        init: function (options = {}) {
            this._parcelasMap.clear();
            this._shapeFallbacks.clear();
            this._auditLog = [];

            // 1. Carregar Shapes Fallback se fornecidos ou disponíveis globalmente
            const shapesData = options.shapesData || 
                (typeof window !== 'undefined' && window.PITANGUEIRAS_SHAPES_DATA) || 
                null;
            if (shapesData && shapesData.features) {
                this.loadShapesFallback(shapesData.features);
            }

            // 2. Tentar carregar do localStorage no navegador
            let loadedFromStorage = false;
            if (typeof localStorage !== 'undefined') {
                try {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            parsed.forEach(p => {
                                if (p && p.id && p.fazenda && p.talhao !== undefined) {
                                    this._parcelasMap.set(String(p.id), this._sanitizeParcela(p));
                                }
                            });
                            loadedFromStorage = true;
                        }
                    }
                    const rawAudit = localStorage.getItem(AUDIT_LOG_KEY);
                    if (rawAudit) {
                        this._auditLog = JSON.parse(rawAudit) || [];
                    }
                } catch (e) {
                    console.warn('[AgronomicTerritory] Falha ao ler localStorage:', e);
                }
            }

            // 3. Se não houver dados no storage, inicializar com semente padrão
            if (!loadedFromStorage || this._parcelasMap.size === 0) {
                SEED_PARCELAS.forEach(p => {
                    this._parcelasMap.set(String(p.id), this._sanitizeParcela(p));
                });
                this._logAudit('INICIALIZACAO_PADRAO', '54401', 'Inicialização com semente auditada do Sítio Benvinda (4 parcelas).');
            }

            return this;
        },

        /**
         * Carrega atributos cadastrais das 6.469 feições dos shapes como base territorial de fallback
         */
        loadShapesFallback: function (features) {
            if (!Array.isArray(features)) return;
            features.forEach(f => {
                const props = f.properties || {};
                const faz = String(props.fazenda || props.FAZENDA || '').trim();
                const tal = String(props.talhao !== undefined ? props.talhao : (props.TALHAO !== undefined ? props.TALHAO : '')).trim();
                const area = parseFloat(String(props.area || props.AREA_TOTAL || 0).replace(',', '.')) || 0;
                const nomeFaz = String(props.nome_faz || props.NOME_FAZ || '').trim();
                const zona = parseInt(props.zona || props.ZONA || 1, 10);

                if (faz && tal) {
                    const key = `${faz}_${tal}`;
                    if (!this._shapeFallbacks.has(key)) {
                        this._shapeFallbacks.set(key, {
                            fazenda: faz,
                            talhao: tal,
                            area: area,
                            nome_faz: nomeFaz,
                            zona: zona
                        });
                    }
                }
            });
        },

        _sanitizeParcela: function (p) {
            return {
                id: String(p.id || `PARC_${p.fazenda}_${p.talhao}_${Date.now()}`),
                fazenda: String(p.fazenda || '').trim(),
                nome_faz: String(p.nome_faz || '').trim().toUpperCase(),
                zona: parseInt(p.zona || 1, 10),
                talhao: String(p.talhao !== undefined ? p.talhao : '').trim(),
                area: Math.max(0, parseFloat(String(p.area || 0).replace(',', '.')) || 0),
                shape_id: String(p.shape_id || ''),
                origem: String(p.origem || 'Manual'),
                situacao: String(p.situacao || 'Auditado'),
                atualizado_em: p.atualizado_em || new Date().toISOString(),
                atualizado_por: p.atualizado_por || 'Sistema'
            };
        },

        _persist: function () {
            if (typeof localStorage !== 'undefined') {
                try {
                    const list = Array.from(this._parcelasMap.values());
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
                    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(this._auditLog.slice(-100)));
                } catch (e) {
                    console.warn('[AgronomicTerritory] Erro ao persistir dados no localStorage:', e);
                }
            }
            this._notifyListeners();
        },

        _logAudit: function (acao, fazenda, detalhes, usuario = 'JARVIS DEV') {
            const entry = {
                timestamp: new Date().toISOString(),
                usuario: usuario,
                acao: acao,
                fazenda: String(fazenda || ''),
                detalhes: detalhes
            };
            this._auditLog.push(entry);
            if (this._auditLog.length > 200) {
                this._auditLog.shift();
            }
        },

        _notifyListeners: function () {
            this._listeners.forEach(fn => {
                try { fn(); } catch (err) { console.error('[AgronomicTerritory] Listener error:', err); }
            });
        },

        onChange: function (fn) {
            if (typeof fn === 'function') this._listeners.push(fn);
        },

        // --- CONSULTAS HIERÁRQUICAS ---

        /**
         * Retorna todas as parcelas cadastradas para um talhão específico
         */
        getParcelas: function (fazenda, talhao) {
            const faz = String(fazenda || '').trim();
            const tal = String(talhao || '').trim();
            const res = [];
            for (const p of this._parcelasMap.values()) {
                if (p.fazenda === faz && String(p.talhao) === tal) {
                    res.push(Object.assign({}, p));
                }
            }
            return res;
        },

        /**
         * Retorna a área consolidada do talhão (soma exata das parcelas).
         * Se não houver parcelas cadastradas no módulo, consulta os atributos dos shapes.
         */
        getTalhaoArea: function (fazenda, talhao) {
            const parcelas = this.getParcelas(fazenda, talhao);
            if (parcelas.length > 0) {
                const total = parcelas.reduce((acc, p) => acc + (p.area || 0), 0);
                return Math.round(total * 100) / 100;
            }
            // Fallback nos shapes
            const key = `${String(fazenda).trim()}_${String(talhao).trim()}`;
            if (this._shapeFallbacks.has(key)) {
                return this._shapeFallbacks.get(key).area;
            }
            return 0;
        },

        /**
         * Retorna o resumo consolidado de um talhão
         */
        getTalhaoSummary: function (fazenda, talhao) {
            const faz = String(fazenda || '').trim();
            const tal = String(talhao || '').trim();
            const parcelas = this.getParcelas(faz, tal);
            const key = `${faz}_${tal}`;
            const fb = this._shapeFallbacks.get(key) || {};

            const areaConsolidada = parcelas.length > 0 
                ? Math.round(parcelas.reduce((acc, p) => acc + p.area, 0) * 100) / 100
                : (fb.area || 0);

            const nomeFaz = (parcelas[0] && parcelas[0].nome_faz) || fb.nome_faz || `FAZENDA ${faz}`;
            const zona = (parcelas[0] && parcelas[0].zona) || fb.zona || 1;

            return {
                fazenda: faz,
                nome_faz: nomeFaz,
                zona: zona,
                talhao: tal,
                area_ha: areaConsolidada,
                total_parcelas: parcelas.length,
                parcelas: parcelas,
                is_custom: parcelas.length > 0,
                shape_area: fb.area || null,
                divergencia_ha: fb.area ? Math.round((areaConsolidada - fb.area) * 100) / 100 : 0
            };
        },

        /**
         * Retorna a área total consolidada da fazenda inteira (soma de todos os seus talhões).
         * NUNCA soma parcelas duplicadas nem confunde talhões com registros.
         */
        getFazendaArea: function (fazenda) {
            const summary = this.getFazendaSummary(fazenda);
            return summary ? summary.area_total_ha : 0;
        },

        /**
         * Retorna o resumo detalhado de toda a Fazenda, com cada talhão consolidado
         */
        getFazendaSummary: function (fazenda) {
            const faz = String(fazenda || '').trim();
            if (!faz) return null;

            // Conjunto de todos os talhões conhecidos para esta fazenda (cadastrados + shapes)
            const talhoesSet = new Set();
            let nomeFaz = '';
            let zonaPadrao = 1;

            // 1. Varrer parcelas customizadas
            for (const p of this._parcelasMap.values()) {
                if (p.fazenda === faz) {
                    talhoesSet.add(String(p.talhao));
                    if (p.nome_faz) nomeFaz = p.nome_faz;
                    if (p.zona) zonaPadrao = p.zona;
                }
            }

            // 2. Varrer shapes de fallback
            for (const [key, fb] of this._shapeFallbacks.entries()) {
                if (fb.fazenda === faz) {
                    talhoesSet.add(String(fb.talhao));
                    if (!nomeFaz && fb.nome_faz) nomeFaz = fb.nome_faz;
                    if (fb.zona) zonaPadrao = fb.zona;
                }
            }

            if (talhoesSet.size === 0) return null;

            const talhoesList = [];
            let areaTotal = 0;
            let totalParcelasGeral = 0;

            const sortedTalhoes = Array.from(talhoesSet).sort((a, b) => {
                const nA = parseInt(a, 10);
                const nB = parseInt(b, 10);
                if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
                return a.localeCompare(b);
            });

            sortedTalhoes.forEach(tal => {
                const tSum = this.getTalhaoSummary(faz, tal);
                talhoesList.push(tSum);
                areaTotal += tSum.area_ha;
                totalParcelasGeral += tSum.total_parcelas > 0 ? tSum.total_parcelas : 1;
            });

            return {
                fazenda: faz,
                nome_faz: nomeFaz || `FAZENDA ${faz}`,
                zona_principal: zonaPadrao,
                area_total_ha: Math.round(areaTotal * 100) / 100,
                total_talhoes: talhoesList.length,
                total_parcelas: totalParcelasGeral,
                talhoes: talhoesList
            };
        },

        /**
         * Retorna a lista de todas as parcelas cadastradas
         */
        getAllParcelas: function () {
            return Array.from(this._parcelasMap.values());
        },

        /**
         * Retorna o resumo consolidado de todas as fazendas da Usina Pitangueiras
         */
        getAllFazendasSummary: function () {
            const fazendasSet = new Set();
            for (const p of this._parcelasMap.values()) {
                if (p.fazenda) fazendasSet.add(p.fazenda);
            }
            for (const fb of this._shapeFallbacks.values()) {
                if (fb.fazenda) fazendasSet.add(fb.fazenda);
            }

            const list = [];
            fazendasSet.forEach(faz => {
                const sum = this.getFazendaSummary(faz);
                if (sum) list.push(sum);
            });

            list.sort((a, b) => {
                const nA = parseInt(a.fazenda, 10);
                const nB = parseInt(b.fazenda, 10);
                if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
                return a.fazenda.localeCompare(b.fazenda);
            });

            return list;
        },

        // --- CRUD E GESTÃO ---

        /**
         * Adiciona ou atualiza uma parcela com validação estrita e auditoria
         */
        addOrUpdateParcela: function (rawParcela, usuario = 'Usuário Agronômico') {
            if (!rawParcela || !rawParcela.fazenda || rawParcela.talhao === undefined) {
                throw new Error('Fazenda e Talhão são obrigatórios para cadastrar uma parcela.');
            }

            const sanitized = this._sanitizeParcela(rawParcela);
            const id = sanitized.id;
            const anterior = this._parcelasMap.get(id);

            sanitized.atualizado_em = new Date().toISOString();
            sanitized.atualizado_por = usuario;

            this._parcelasMap.set(id, sanitized);

            if (anterior) {
                this._logAudit('EDICAO_PARCELA', sanitized.fazenda, 
                    `Parcela ${id} do Talhão ${sanitized.talhao} alterada de ${anterior.area} ha para ${sanitized.area} ha.`, usuario);
            } else {
                this._logAudit('CRIACAO_PARCELA', sanitized.fazenda, 
                    `Nova parcela ${id} (${sanitized.area} ha) criada para Talhão ${sanitized.talhao}.`, usuario);
            }

            this._persist();
            return sanitized;
        },

        /**
         * Remove uma parcela cadastrada
         */
        removeParcela: function (parcelaId, usuario = 'Usuário Agronômico') {
            const id = String(parcelaId || '').trim();
            const p = this._parcelasMap.get(id);
            if (!p) return false;

            this._parcelasMap.delete(id);
            this._logAudit('EXCLUSAO_PARCELA', p.fazenda, 
                `Parcela ${id} (${p.area} ha) do Talhão ${p.talhao} removida.`, usuario);

            this._persist();
            return true;
        },

        /**
         * Importa lista de parcelas de JSON ou Objeto estruturado com prevenção estrita de duplicidade
         */
        importFromJson: function (jsonOrArray, usuario = 'Importação Agronômica') {
            let data = jsonOrArray;
            if (typeof jsonOrArray === 'string') {
                data = JSON.parse(jsonOrArray);
            }
            const items = Array.isArray(data) ? data : (data.parcelas || []);
            if (!Array.isArray(items)) throw new Error('Formato inválido para importação de áreas.');

            let adicionados = 0;
            let atualizados = 0;

            items.forEach(item => {
                if (!item || !item.fazenda || item.talhao === undefined) return;
                const sanitized = this._sanitizeParcela(item);
                if (this._parcelasMap.has(sanitized.id)) {
                    atualizados++;
                } else {
                    adicionados++;
                }
                this._parcelasMap.set(sanitized.id, sanitized);
            });

            this._logAudit('IMPORTACAO_DADOS', 'Multiplas', 
                `Importação concluída: ${adicionados} adicionados, ${atualizados} atualizados. Total: ${this._parcelasMap.size}.`, usuario);

            this._persist();
            return { total: this._parcelasMap.size, adicionados, atualizados };
        },

        /**
         * Exporta todas as parcelas em formato JSON para backup
         */
        exportToJson: function () {
            const payload = {
                versao: '2026.11.14_v1',
                data_exportacao: new Date().toISOString(),
                total_parcelas: this._parcelasMap.size,
                parcelas: Array.from(this._parcelasMap.values()),
                audit_log: this._auditLog
            };
            return JSON.stringify(payload, null, 2);
        },

        /**
         * Exporta em formato CSV compatível com Excel
         */
        exportToCsv: function () {
            const headers = ['ID_PARCELA', 'FAZENDA', 'NOME_FAZENDA', 'ZONA', 'TALHAO', 'AREA_HA', 'ORIGEM', 'SITUACAO', 'ATUALIZADO_EM', 'ATUALIZADO_POR'];
            const lines = [headers.join(';')];

            for (const p of this._parcelasMap.values()) {
                const row = [
                    p.id,
                    p.fazenda,
                    `"${p.nome_faz}"`,
                    p.zona,
                    p.talhao,
                    String(p.area).replace('.', ','),
                    `"${p.origem}"`,
                    `"${p.situacao}"`,
                    p.atualizado_em,
                    `"${p.atualizado_por}"`
                ];
                lines.push(row.join(';'));
            }
            return lines.join('\r\n');
        },

        /**
         * Restaura a base para a semente inicial auditada (Sítio Benvinda)
         */
        resetToDefault: function (usuario = 'Administrador') {
            this._parcelasMap.clear();
            SEED_PARCELAS.forEach(p => {
                this._parcelasMap.set(String(p.id), this._sanitizeParcela(p));
            });
            this._logAudit('RESET_PADRAO', '54401', 'Restauração da base cadastral padrão auditada.', usuario);
            this._persist();
            return true;
        },

        getAuditLog: function () {
            return this._auditLog.slice().reverse();
        },

        getStats: function () {
            const allFaz = this.getAllFazendasSummary();
            const totalArea = allFaz.reduce((acc, f) => acc + f.area_total_ha, 0);
            const totalTalhoes = allFaz.reduce((acc, f) => acc + f.total_talhoes, 0);
            return {
                total_fazendas: allFaz.length,
                total_talhoes: totalTalhoes,
                total_parcelas: this._parcelasMap.size,
                area_total_ha: Math.round(totalArea * 100) / 100
            };
        }
    };

    // Inicialização segura
    Territory.init();

    return Territory;
}));
