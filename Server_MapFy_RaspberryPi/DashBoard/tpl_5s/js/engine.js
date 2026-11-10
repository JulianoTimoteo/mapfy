/**
 * engine.js
 * Motor Analítico e Estatístico de 5S e Gestão - TPL
 * Usina Pitangueiras - Safra 2026
 */

window.Tpl5sEngine = (function () {
    'use strict';

    const QUESTION_METADATA = {
        q01: { id: '01', title: 'Área de Vivência (Limpeza & Organização)', short: 'Área Vivência', category: 'Ambiente' },
        q03: { id: '03', title: 'Integridade de Itens / Sem Itens Faltando ou Quebrados', short: 'Itens & Ferramentas', category: 'Conservação' },
        q04: { id: '04', title: 'Sinalização Adequada e Acesso Seguro', short: 'Sinalização & Acesso', category: 'Segurança' },
        q05: { id: '05', title: 'Conservação, Limpeza e Organização de Equipamentos', short: 'Equipamentos', category: 'Conservação' },
        q06: { id: '06', title: 'Uso Adequado de EPIs pelos Colaboradores', short: 'Uso de EPIs', category: 'Segurança / NR' },
        q07: { id: '07', title: 'Extintor de Incêndio Válido e Carregado', short: 'Extintores', category: 'Crítico / Prevenção' }
    };

    function computeKPIs(records) {
        const total = records.length;
        if (total === 0) {
            return {
                total: 0,
                fechados: 0,
                abertos: 0,
                validados: 0,
                totalItensAvaliados: 0,
                totalOk: 0,
                totalNok: 0,
                percConformidadeGlobal: 100.0,
                vistorias100Ok: 0,
                vistoriasComNok: 0,
                percVistoriasComNok: 0.0,
                extintoresNok: 0,
                episNok: 0,
                setoresCount: 0,
                frentesCount: 0,
                fazendasCount: 0,
                responsaveisCount: 0,
                georreferenciados: 0,
                percGeo: 100.0
            };
        }

        let fechados = 0;
        let abertos = 0;
        let validados = 0;
        let totalItensAvaliados = 0;
        let totalOk = 0;
        let totalNok = 0;
        let vistorias100Ok = 0;
        let vistoriasComNok = 0;
        let extintoresNok = 0;
        let episNok = 0;
        let georreferenciados = 0;

        const setores = new Set();
        const frentes = new Set();
        const fazendas = new Set();
        const responsaveis = new Set();

        records.forEach(r => {
            if (r.status === 'Fechado') fechados++;
            else if (r.status === 'Validado') validados++;
            else abertos++;

            totalItensAvaliados += (r.total_avaliados || 0);
            totalOk += (r.total_ok || 0);
            totalNok += (r.total_nok || 0);

            if (r.tem_nok) vistoriasComNok++;
            else vistorias100Ok++;

            if (r.q07 === 'NOK') extintoresNok++;
            if (r.q06 === 'NOK') episNok++;
            if (r.has_coords) georreferenciados++;

            if (r.setor) setores.add(r.setor);
            if (r.frente) frentes.add(r.frente);
            if (r.fazenda) fazendas.add(r.fazenda);
            if (r.responsavel) responsaveis.add(r.responsavel);
        });

        const percConformidadeGlobal = totalItensAvaliados > 0
            ? Number(((totalOk / totalItensAvaliados) * 100.0).toFixed(1))
            : 100.0;

        const percVistoriasComNok = total > 0
            ? Number(((vistoriasComNok / total) * 100.0).toFixed(1))
            : 0.0;

        const percGeo = total > 0
            ? Number(((georreferenciados / total) * 100.0).toFixed(1))
            : 100.0;

        return {
            total,
            fechados,
            abertos,
            validados,
            totalItensAvaliados,
            totalOk,
            totalNok,
            percConformidadeGlobal,
            vistorias100Ok,
            vistoriasComNok,
            percVistoriasComNok,
            extintoresNok,
            episNok,
            setoresCount: setores.size,
            frentesCount: frentes.size,
            fazendasCount: fazendas.size,
            responsaveisCount: responsaveis.size,
            georreferenciados,
            percGeo
        };
    }

    function computeQuestionBreakdown(records) {
        const stats = {
            q01: { ok: 0, nok: 0, na: 0 },
            q03: { ok: 0, nok: 0, na: 0 },
            q04: { ok: 0, nok: 0, na: 0 },
            q05: { ok: 0, nok: 0, na: 0 },
            q06: { ok: 0, nok: 0, na: 0 },
            q07: { ok: 0, nok: 0, na: 0 }
        };

        records.forEach(r => {
            ['q01', 'q03', 'q04', 'q05', 'q06', 'q07'].forEach(qk => {
                const ans = r[qk];
                if (ans === 'OK') stats[qk].ok++;
                else if (ans === 'NOK') stats[qk].nok++;
                else stats[qk].na++;
            });
        });

        return Object.keys(stats).map(k => {
            const q = stats[k];
            const meta = QUESTION_METADATA[k];
            const avaliados = q.ok + q.nok;
            const percOk = avaliados > 0 ? Number(((q.ok / avaliados) * 100.0).toFixed(1)) : 100.0;
            const percNok = avaliados > 0 ? Number(((q.nok / avaliados) * 100.0).toFixed(1)) : 0.0;
            return {
                key: k,
                id: meta.id,
                title: meta.title,
                short: meta.short,
                category: meta.category,
                ok: q.ok,
                nok: q.nok,
                na: q.na,
                avaliados,
                percOk,
                percNok
            };
        });
    }

    function computeSetorBreakdown(records) {
        const map = {};
        records.forEach(r => {
            const set = r.setor || 'NÃO DEFINIDO';
            if (!map[set]) {
                map[set] = {
                    setor: set,
                    total: 0,
                    itensAvaliados: 0,
                    ok: 0,
                    nok: 0,
                    vistoriasComNok: 0,
                    extintoresNok: 0
                };
            }
            map[set].total++;
            map[set].itensAvaliados += (r.total_avaliados || 0);
            map[set].ok += (r.total_ok || 0);
            map[set].nok += (r.total_nok || 0);
            if (r.tem_nok) map[set].vistoriasComNok++;
            if (r.q07 === 'NOK') map[set].extintoresNok++;
        });

        return Object.values(map).map(s => {
            s.percConformidade = s.itensAvaliados > 0
                ? Number(((s.ok / s.itensAvaliados) * 100.0).toFixed(1))
                : 100.0;
            s.percVistoriasNok = s.total > 0
                ? Number(((s.vistoriasComNok / s.total) * 100.0).toFixed(1))
                : 0.0;
            return s;
        }).sort((a, b) => b.total - a.total);
    }

    function computeFrenteRanking(records) {
        const map = {};
        records.forEach(r => {
            const f = r.frente || 'Sem Frente';
            if (!map[f]) {
                map[f] = { frente: f, total: 0, ok: 0, nok: 0, comNok: 0 };
            }
            map[f].total++;
            map[f].ok += (r.total_ok || 0);
            map[f].nok += (r.total_nok || 0);
            if (r.tem_nok) map[f].comNok++;
        });

        return Object.values(map).map(f => {
            const totItens = f.ok + f.nok;
            f.percConformidade = totItens > 0 ? Number(((f.ok / totItens) * 100.0).toFixed(1)) : 100.0;
            f.taxaNok = f.total > 0 ? Number(((f.comNok / f.total) * 100.0).toFixed(1)) : 0.0;
            return f;
        }).sort((a, b) => b.total - a.total);
    }

    function computeResponsavelRanking(records) {
        const map = {};
        records.forEach(r => {
            const resp = r.responsavel || 'Não Identificado';
            if (!map[resp]) {
                map[resp] = { responsavel: resp, total: 0, ok: 0, nok: 0, comNok: 0 };
            }
            map[resp].total++;
            map[resp].ok += (r.total_ok || 0);
            map[resp].nok += (r.total_nok || 0);
            if (r.tem_nok) map[resp].comNok++;
        });

        return Object.values(map).map(r => {
            const totItens = r.ok + r.nok;
            r.percConformidade = totItens > 0 ? Number(((r.ok / totItens) * 100.0).toFixed(1)) : 100.0;
            return r;
        }).sort((a, b) => b.total - a.total);
    }

    function computeTemporalData(records, mode) {
        const map = {};
        records.forEach(r => {
            let key = '';
            if (!r.data) return;
            const part = r.data.split(' ')[0] || '';
            const dmy = part.split('/');
            if (dmy.length !== 3) return;

            if (mode === 'mes') {
                key = `${dmy[1]}/${dmy[2]}`;
            } else {
                key = part; // dd/mm/aaaa
            }

            if (!map[key]) {
                map[key] = { label: key, total: 0, nok: 0, sortKey: `${dmy[2]}${dmy[1]}${dmy[0]}` };
            }
            map[key].total++;
            if (r.tem_nok) map[key].nok++;
        });

        return Object.values(map).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }

    function computeDurationStats(records) {
        const durs = records.map(r => r.duracao_min).filter(d => d > 0);
        if (durs.length === 0) return { avg: 0, median: 0, min: 0, max: 0 };

        durs.sort((a, b) => a - b);
        const sum = durs.reduce((acc, v) => acc + v, 0);
        const avg = Number((sum / durs.length).toFixed(1));
        const mid = Math.floor(durs.length / 2);
        const median = durs.length % 2 !== 0 ? durs[mid] : Number(((durs[mid - 1] + durs[mid]) / 2.0).toFixed(1));
        const min = durs[0];
        const max = durs[durs.length - 1];

        return { avg, median, min, max, count: durs.length };
    }

    function normalizeRecord(r) {
        if (!r) return null;
        const lat = parseFloat(String(r['Latitude'] || r.lat || '').replace(',', '.'));
        const lon = parseFloat(String(r['Longitude'] || r.lon || r.lng || '').replace(',', '.'));
        const dataStr = String(r['Data'] || r.data || '').trim();
        const dataDia = dataStr.includes(' ') ? dataStr.split(' ')[0] : dataStr;

        const normAns = (v) => {
            if (!v) return 'N/A';
            const s = String(v).trim().toUpperCase();
            if (s === 'OK') return 'OK';
            if (s === 'NOK' || s === 'NÃO' || s === 'NAO') return 'NOK';
            return 'N/A';
        };

        const q01 = normAns(r['01-Área de vivência está em boas condições de organização e limpeza?'] || r.q01);
        const q03 = normAns(r['03 - Não há itens faltando, quebrados ou com sinais de mal uso?'] || r.q03);
        const q04 = normAns(r['04 - A sinalização está adequada e o acesso ao local é seguro?'] || r.q04);
        const q05 = normAns(r['05 - Boas condições de organização, limpeza e conservação dos equipamentos?'] || r.q05);
        const q06 = normAns(r['06 - Os colaboradores estão utilizando os EPIs adequados?'] || r.q06);
        const q07 = normAns(r['07 - Extintor está válido e carregado?'] || r.q07);

        const questions = [q01, q03, q04, q05, q06, q07];
        const totalAvaliados = questions.filter(q => q === 'OK' || q === 'NOK').length;
        const totalOk = questions.filter(q => q === 'OK').length;
        const totalNok = questions.filter(q => q === 'NOK').length;
        const temNok = totalNok > 0;
        const percConformidade = totalAvaliados > 0 ? Number(((totalOk / totalAvaliados) * 100).toFixed(1)) : 100.0;

        let pinColor = '#10B981'; // Verde padrão
        if (q07 === 'NOK' || q06 === 'NOK') {
            pinColor = '#EF4444'; // Vermelho crítico (extintor ou EPI)
        } else if (temNok) {
            pinColor = '#F59E0B'; // Âmbar
        }

        return {
            id: String(r['ID'] || r.id || ''),
            usuario: r['Usuário'] || r.usuario || '',
            data: dataStr,
            data_dia: dataDia,
            data_inicio: r['Data início'] || r.data_inicio || '',
            data_fim: r['Data Fim'] || r.data_fim || '',
            duracao_min: 5,
            status: r['Status'] || r.status || 'Aberto',
            score: r['Score'] || r.score || '0,00',
            setor: r['Setor'] || r.setor || 'OUTROS',
            fazenda: r['Fazenda'] || r.fazenda || '',
            frente: r['Frente'] || r.frente || 'NÃO INFORMADA',
            responsavel: r['Responsável Vistoria'] || r['Responsável'] || r.responsavel || 'NÃO INFORMADO',
            operacao: r['Operação'] || r.operacao || '',
            q01,
            q03,
            q04,
            q05,
            q06,
            q07,
            total_avaliados: totalAvaliados,
            total_ok: totalOk,
            total_nok: totalNok,
            tem_nok: temNok,
            perc_conformidade: percConformidade,
            pin_color: pinColor,
            obs: r['Observação'] || r.obs || '',
            lat: isNaN(lat) ? null : lat,
            lon: isNaN(lon) ? null : lon,
            has_coords: !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0,
            _raw: r
        };
    }

    return {
        QUESTION_METADATA,
        computeKPIs,
        computeQuestionBreakdown,
        computeSetorBreakdown,
        computeFrenteRanking,
        computeResponsavelRanking,
        computeTemporalData,
        computeDurationStats,
        normalizeRecord
    };
})();
