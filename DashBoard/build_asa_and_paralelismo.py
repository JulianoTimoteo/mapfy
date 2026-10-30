# -*- coding: utf-8 -*-
"""
build_asa_and_paralelismo.py
Exports data and generates complete executive dashboards for:
1. Abertura da Asa (DashBoard/abertura_asa/)
2. Paralelismo (DashBoard/paralelismo/)
"""
import pandas as pd
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent # workspace root
REPORTS_DIR = BASE_DIR / "Server_MapFy" / "relatorios"

p_asa = [c for c in REPORTS_DIR.iterdir() if '06' in c.name and 'asa' in c.name.lower()][0]
p_par = [c for c in REPORTS_DIR.iterdir() if '07' in c.name and 'paralelismo' in c.name.lower()][0]

# ==============================================================================
# 1. EXPORT DATA.JS
# ==============================================================================
# Abertura da Asa
df_asa = pd.read_csv(p_asa / "dados.csv", sep=';', encoding='utf-8-sig', dtype=str)
cols_asa = ['ID', 'Usuário', 'Data', 'Latitude', 'Longitude', 'Data início', 'Data Fim', 'Status', 'Score', 'Data Lançamento', 'Local (Fazenda - Talhão)', 'OS', 'Frente', 'Responsável', 'Abertura da Asa', 'Unnamed: 15']
df_asa.columns = cols_asa[:len(df_asa.columns)]
recs_asa = df_asa.where(pd.notnull(df_asa), None).to_dict(orient='records')
for r in recs_asa:
    if r.get('Frente'):
        r['Frente'] = r['Frente'].replace('PRPRIA', 'PRÓPRIA').replace('MOTOMECANIZAO', 'MOTOMECANIZAÇÃO').strip()
    if r.get('Responsável'):
        r['Responsável'] = r['Responsável'].strip()

out_asa_data = BASE_DIR / "DashBoard" / "abertura_asa" / "js" / "data.js"
with open(out_asa_data, "w", encoding="utf-8") as f:
    f.write('/**\n * Base de Dados Consolidada - Abertura da Asa\n')
    f.write(f' * Total: {len(recs_asa)} medições reais\n')
    f.write(' * Usina Pitangueiras - Safra 2026\n */\n\n')
    f.write('window.ABERTURA_ASA_RAW_DATA = ')
    json.dump(recs_asa, f, ensure_ascii=False, indent=2)
    f.write(';\n')
print(f"Abertura da Asa: {len(recs_asa)} records exported.")

# Paralelismo
df_par = pd.read_csv(p_par / "dados.csv", sep=';', encoding='utf-8-sig', dtype=str)
cols_par = ['ID', 'Usuário', 'Data', 'Latitude', 'Longitude', 'Data início', 'Data Fim', 'Status', 'Score', 'Data Lançamento', 'Local (Fazenda - Talhão)', 'OS', 'Frente', 'Responsável', 'Paralelismo', 'Unnamed: 15']
df_par.columns = cols_par[:len(df_par.columns)]
recs_par = df_par.where(pd.notnull(df_par), None).to_dict(orient='records')
for r in recs_par:
    if r.get('Frente'):
        r['Frente'] = r['Frente'].replace('PRPRIA', 'PRÓPRIA').replace('MOTOMECANIZAO', 'MOTOMECANIZAÇÃO').strip()
    if r.get('Responsável'):
        r['Responsável'] = r['Responsável'].strip()

out_par_data = BASE_DIR / "DashBoard" / "paralelismo" / "js" / "data.js"
with open(out_par_data, "w", encoding="utf-8") as f:
    f.write('/**\n * Base de Dados Consolidada - Paralelismo RTK\n')
    f.write(f' * Total: {len(recs_par)} medições reais\n')
    f.write(' * Usina Pitangueiras - Safra 2026\n */\n\n')
    f.write('window.PARALELISMO_RAW_DATA = ')
    json.dump(recs_par, f, ensure_ascii=False, indent=2)
    f.write(';\n')
print(f"Paralelismo: {len(recs_par)} records exported.")
# ==============================================================================
# 2. GENERATE ENGINES
# ==============================================================================
def make_engine_code(mod_key, engine_name, storage_key, default_min, default_max, unit, col_search_term, default_obs):
    return f'''/**
 * {mod_key}_engine.js
 * ==================
 * Motor Estatístico e Regras de Qualidade para {mod_key.capitalize()}
 * Usina Pitangueiras • Safra 2026
 */

(function (window) {{
    'use strict';

    const {engine_name} = {{}};

    const DEFAULT_TARGETS = {{
        unidade: '{unit}',
        min: {default_min},
        max: {default_max},
        ativa: true,
        regraId: 'REGRA-{mod_key.upper()}-PITANGUEIRAS-2026',
        observacao: '{default_obs}'
    }};

    {engine_name}.getTargetConfig = function () {{
        try {{
            const saved = localStorage.getItem('{storage_key}');
            if (saved) {{
                return {{ ...DEFAULT_TARGETS, ...JSON.parse(saved) }};
            }}
        }} catch (e) {{
            console.warn('Falha ao ler targets:', e);
        }}
        return {{ ...DEFAULT_TARGETS }};
    }};

    {engine_name}.saveTargetConfig = function (cfg) {{
        try {{
            const merged = {{ ...DEFAULT_TARGETS, ...cfg }};
            localStorage.setItem('{storage_key}', JSON.stringify(merged));
            return merged;
        }} catch (e) {{
            console.error('Falha ao salvar targets:', e);
            return DEFAULT_TARGETS;
        }}
    }};

    {engine_name}.parseDateBR = function (str) {{
        if (!str || typeof str !== 'string') return null;
        const parts = str.trim().split(' ');
        if (!parts[0]) return null;
        const dateParts = parts[0].split('/');
        if (dateParts.length !== 3) return null;
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        let hours = 0, minutes = 0;
        if (parts[1]) {{
            const timeParts = parts[1].split(':');
            hours = parseInt(timeParts[0], 10) || 0;
            minutes = parseInt(timeParts[1], 10) || 0;
        }}
        const d = new Date(year, month, day, hours, minutes);
        return isNaN(d.getTime()) ? null : d;
    }};

    {engine_name}.formatDateBR = function (d) {{
        if (!d || isNaN(d.getTime())) return '';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${{day}}/${{month}}/${{d.getFullYear()}}`;
    }};

    {engine_name}.normalizeRecord = function (raw) {{
        const id = String(raw.ID || '').trim();
        const usuario = String(raw.Usuario || raw['Usuário'] || '').trim();
        const dataStr = String(raw.Data || '').trim();
        const dataParsed = {engine_name}.parseDateBR(dataStr);
        const dataBR = dataParsed ? {engine_name}.formatDateBR(dataParsed) : dataStr.split(' ')[0] || '';
        const isoDate = dataParsed ? `${{dataParsed.getFullYear()}}-${{String(dataParsed.getMonth()+1).padStart(2, '0')}}-${{String(dataParsed.getDate()).padStart(2, '0')}}` : '';

        const dataLancStr = String(raw.DataLancamento || raw['Data Lançamento'] || '').trim();
        const dataLancParsed = {engine_name}.parseDateBR(dataLancStr);
        const dataLancBR = dataLancParsed ? {engine_name}.formatDateBR(dataLancParsed) : dataLancStr;

        const latStr = String(raw.Latitude || '').replace(',', '.').trim();
        const lngStr = String(raw.Longitude || '').replace(',', '.').trim();
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

        const dataInicioStr = String(raw.DataInicio || raw['Data início'] || '').trim();
        const dataFimStr = String(raw.DataFim || raw['Data Fim'] || '').trim();
        const dtInicio = {engine_name}.parseDateBR(dataInicioStr);
        const dtFim = {engine_name}.parseDateBR(dataFimStr);
        let duracaoMinutos = 0;
        let duracaoInconsistente = false;
        if (dtInicio && dtFim) {{
            duracaoMinutos = Math.round((dtFim.getTime() - dtInicio.getTime()) / (1000 * 60));
            if (duracaoMinutos < 0 || duracaoMinutos > 720) duracaoInconsistente = true;
        }}

        // Campo numérico
        let valRaw = '';
        for (const k in raw) {{
            if (k.toLowerCase().includes('{col_search_term}')) {{
                valRaw = String(raw[k] || '').trim();
                break;
            }}
        }}
        let profundidade = null;
        let temProfundidadeValida = false;
        if (valRaw !== '') {{
            const num = parseFloat(valRaw.replace(',', '.'));
            if (!isNaN(num) && num > 0) {{
                profundidade = num;
                temProfundidadeValida = true;
            }}
        }}

        let frente = String(raw.Frente || '').trim();
        if (frente.includes('EDMILSON') || frente.includes('261')) frente = '261 - FRENTE PRÓPRIA (EDMILSON)';
        else if (frente.includes('PEDRINHO') || frente.includes('135')) frente = '135 - FRENTE PEDRINHO';
        else if (frente.includes('MANEZ') || frente.includes('139')) frente = '139 - FRENTE MANEZÃO';
        else if (frente.includes('BIDU') || frente.includes('142')) frente = '142 - FRENTE BIDU';
        else if (frente.includes('MECANIZADA') || frente.includes('101')) frente = '101 - FRENTE MECANIZADA';
        else if (frente.includes('MIURA') || frente.includes('136')) frente = '136 - FRENTE MIURA';
        else if (frente.includes('CASSIO') && frente.includes('105')) frente = '105 - FRENTE CASSIO (ZACARIAS)';
        else if (frente.includes('CASSIO') && frente.includes('143')) frente = '143 - FRENTE CASSIO';
        if (!frente) frente = 'Não Informado';

        const resp = String(raw.Responsavel || raw['Responsável'] || '').trim() || 'Não Informado';

        const inconsistencias = [];
        if (!id) inconsistencias.push('ID ausente');
        if (!dataParsed) inconsistencias.push('Data inválida');
        if (!temProfundidadeValida) inconsistencias.push('Medição inválida');
        if (!hasValidCoords) inconsistencias.push('GPS ausente ou inválido');
        if (duracaoInconsistente) inconsistencias.push(`Duração atípica (${{duracaoMinutos}} min)`);

        return {{
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
            local: String(raw.Local || raw['Local (Fazenda - Talhão)'] || '').trim() || 'Não Informado',
            os: String(raw.OS || '').trim() || 'Sem OS',
            frente,
            responsavel: resp,
            profundidadeRaw: valRaw,
            profundidade,
            temProfundidadeValida,
            inconsistencias,
            temInconsistencia: inconsistencias.length > 0
        }};
    }};

    {engine_name}.classifyDepth = function (prof, targetConfig) {{
        if (!targetConfig || !targetConfig.ativa) {{
            return {{ status: 'NÃO CLASSIFICADO', label: 'Faixa Não Definida', badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30', color: '#64748b', diff: 0 }};
        }}
        if (prof === null || isNaN(prof)) {{
            return {{ status: 'INVÁLIDO', label: 'Sem Medição', badgeClass: 'bg-rose-500/15 text-rose-500 border-rose-500/30', color: '#ef4444', diff: 0 }};
        }}
        if (prof < targetConfig.min) {{
            return {{ status: 'ABAIXO', label: `Abaixo da Meta (< ${{targetConfig.min}}${{targetConfig.unidade}})`, badgeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30', color: '#f59e0b', diff: Number((prof - targetConfig.min).toFixed(2)) }};
        }}
        if (prof > targetConfig.max) {{
            return {{ status: 'ACIMA', label: `Acima da Meta (> ${{targetConfig.max}}${{targetConfig.unidade}})`, badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30', color: '#a855f7', diff: Number((prof - targetConfig.max).toFixed(2)) }};
        }}
        return {{ status: 'DENTRO', label: `Dentro da Meta (${{targetConfig.min}} a ${{targetConfig.max}}${{targetConfig.unidade}})`, badgeClass: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30', color: '#10b981', diff: 0 }};
    }};

    {engine_name}.calculateMedian = function (sortedArray) {{
        if (!sortedArray || sortedArray.length === 0) return 0;
        const mid = Math.floor(sortedArray.length / 2);
        return sortedArray.length % 2 !== 0 ? sortedArray[mid] : (sortedArray[mid - 1] + sortedArray[mid]) / 2.0;
    }};

    {engine_name}.calculateStdDev = function (array, mean) {{
        if (!array || array.length <= 1) return 0;
        const sumSq = array.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
        return Math.sqrt(sumSq / (array.length - 1));
    }};

    {engine_name}.calculateMetrics = function (records, targetConfig) {{
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

        records.forEach(r => {{
            if (r.temProfundidadeValida) {{
                depths.push(r.profundidade);
                if (targetConfig && targetConfig.ativa) {{
                    if (r.profundidade < targetConfig.min) abaixoFaixa++;
                    else if (r.profundidade > targetConfig.max) acimaFaixa++;
                    else dentroFaixa++;
                }}
            }}
            if (r.os && r.os !== 'Sem OS') osSet.add(r.os);
            if (r.local && r.local !== 'Não Informado') localSet.add(r.local);
            if (r.frente && r.frente !== 'Não Informado') frentesSet.add(r.frente);
            if (r.responsavel && r.responsavel !== 'Não Informado') respSet.add(r.responsavel);
            if (r.hasValidCoords) coordsValidasCount++;
            if (r.temInconsistencia) pendenciasCount++;
            if (r.duracaoMinutos >= 0 && r.duracaoMinutos <= 720) {{
                somaDuracao += r.duracaoMinutos;
                contDuracao++;
            }}
        }});

        depths.sort((a, b) => a - b);
        const validCount = depths.length;
        let media = 0, mediana = 0, min = 0, max = 0, stdDev = 0, amplitude = 0;
        if (validCount > 0) {{
            const sum = depths.reduce((acc, v) => acc + v, 0);
            media = sum / validCount;
            mediana = {engine_name}.calculateMedian(depths);
            min = depths[0];
            max = depths[validCount - 1];
            amplitude = max - min;
            stdDev = {engine_name}.calculateStdDev(depths, media);
        }}

        const percDentro = validCount > 0 ? Number(((dentroFaixa / validCount) * 100).toFixed(1)) : 0;
        const percAbaixo = validCount > 0 ? Number(((abaixoFaixa / validCount) * 100).toFixed(1)) : 0;
        const percAcima = validCount > 0 ? Number(((acimaFaixa / validCount) * 100).toFixed(1)) : 0;

        return {{
            totalMedicoes,
            validCount,
            invalidCount: totalMedicoes - validCount,
            media: Number(media.toFixed(2)),
            mediana: Number(mediana.toFixed(2)),
            min: Number(min.toFixed(2)),
            max: Number(max.toFixed(2)),
            amplitude: Number(amplitude.toFixed(2)),
            desvioPadrao: Number(stdDev.toFixed(2)),
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
            coordsValidasCount,
            pendenciasCount,
            duracaoMediaMinutos: contDuracao > 0 ? Number((somaDuracao / contDuracao).toFixed(1)) : 0
        }};
    }};

    {engine_name}.calculateOSVariability = function (records, targetConfig) {{
        const osMap = {{}};
        records.forEach(r => {{
            const osKey = r.os || 'Sem OS';
            if (!osMap[osKey]) {{
                osMap[osKey] = {{ os: osKey, total: 0, depths: [], frentes: new Set(), locais: new Set(), responsaveis: new Set(), dentro: 0, abaixo: 0, acima: 0 }};
            }}
            const group = osMap[osKey];
            group.total++;
            if (r.frente) group.frentes.add(r.frente);
            if (r.local) group.locais.add(r.local);
            if (r.responsavel) group.responsaveis.add(r.responsavel);
            if (r.temProfundidadeValida) {{
                group.depths.push(r.profundidade);
                if (targetConfig && targetConfig.ativa) {{
                    if (r.profundidade < targetConfig.min) group.abaixo++;
                    else if (r.profundidade > targetConfig.max) group.acima++;
                    else group.dentro++;
                }}
            }}
        }});

        return Object.values(osMap).map(g => {{
            const vCount = g.depths.length;
            let media = 0, stdDev = 0, min = 0, max = 0, amplitude = 0;
            if (vCount > 0) {{
                const sum = g.depths.reduce((a, b) => a + b, 0);
                media = sum / vCount;
                stdDev = {engine_name}.calculateStdDev(g.depths, media);
                g.depths.sort((a, b) => a - b);
                min = g.depths[0];
                max = g.depths[vCount - 1];
                amplitude = max - min;
            }}
            const percConforme = vCount > 0 ? Number(((g.dentro / vCount) * 100).toFixed(1)) : 0;
            return {{
                os: g.os,
                totalMedicoes: g.total,
                validMedicoes: vCount,
                media: Number(media.toFixed(2)),
                min: Number(min.toFixed(2)),
                max: Number(max.toFixed(2)),
                amplitude: Number(amplitude.toFixed(2)),
                desvioPadrao: Number(stdDev.toFixed(2)),
                cvPerc: media > 0 ? Number(((stdDev / media) * 100).toFixed(1)) : 0,
                dentro: g.dentro,
                abaixo: g.abaixo,
                acima: g.acima,
                percConforme,
                frentes: Array.from(g.frentes),
                locais: Array.from(g.locais),
                responsaveis: Array.from(g.responsaveis)
            }};
        }}).sort((a, b) => b.totalMedicoes - a.totalMedicoes);
    }};

    {engine_name}.calculateHistogram = function (records) {{
        const depths = records.filter(r => r.temProfundidadeValida).map(r => r.profundidade);
        if (depths.length === 0) return {{ labels: [], counts: [], percentages: [] }};

        // Bins customizados por módulo
        let bins = [];
        if ('{mod_key}' === 'abertura_asa') {{
            bins = [
                {{ min: -Infinity, max: 48, label: '< 48 cm' }},
                {{ min: 48, max: 51, label: '48 a 50 cm' }},
                {{ min: 51, max: 54, label: '51 a 53 cm' }},
                {{ min: 54, max: 57, label: '54 a 56 cm' }},
                {{ min: 57, max: 60, label: '57 a 59 cm' }},
                {{ min: 60, max: Infinity, label: '≥ 60 cm' }}
            ];
        }} else {{
            bins = [
                {{ min: -Infinity, max: 1.38, label: '< 1,38 m' }},
                {{ min: 1.38, max: 1.41, label: '1,38 a 1,40 m' }},
                {{ min: 1.41, max: 1.45, label: '1,41 a 1,44 m' }},
                {{ min: 1.45, max: 1.48, label: '1,45 a 1,47 m' }},
                {{ min: 1.48, max: 1.51, label: '1,48 a 1,50 m' }},
                {{ min: 1.51, max: Infinity, label: '> 1,50 m' }}
            ];
        }}

        const counts = new Array(bins.length).fill(0);
        depths.forEach(d => {{
            for (let i = 0; i < bins.length; i++) {{
                if (d >= bins[i].min && d < bins[i].max) {{
                    counts[i]++;
                    break;
                }}
            }}
        }});

        const total = depths.length;
        return {{
            labels: bins.map(b => b.label),
            counts,
            percentages: counts.map(c => Number(((c / total) * 100).toFixed(1)))
        }};
    }};

    {engine_name}.calculateTimeSeries = function (records) {{
        const dayMap = {{}};
        records.forEach(r => {{
            if (r.temProfundidadeValida && r.dataBR) {{
                const day = r.dataBR;
                if (!dayMap[day]) {{
                    dayMap[day] = {{ day, depths: [], count: 0, dateParsed: r.dataParsed }};
                }}
                dayMap[day].depths.push(r.profundidade);
                dayMap[day].count++;
            }}
        }});

        const sortedDays = Object.values(dayMap).sort((a, b) => {{
            const tA = a.dateParsed ? a.dateParsed.getTime() : 0;
            const tB = b.dateParsed ? b.dateParsed.getTime() : 0;
            return tA - tB;
        }});

        return {{
            labels: sortedDays.map(d => d.day),
            medias: sortedDays.map(d => {{
                const s = d.depths.reduce((acc, v) => acc + v, 0);
                return Number((s / d.depths.length).toFixed(2));
            }}),
            counts: sortedDays.map(d => d.count)
        }};
    }};

    {engine_name}.calculateFrenteBreakdown = function (records) {{
        const frenteMap = {{}};
        records.forEach(r => {{
            const f = r.frente || 'Não Informado';
            if (!frenteMap[f]) {{
                frenteMap[f] = {{ frente: f, depths: [], count: 0 }};
            }}
            frenteMap[f].count++;
            if (r.temProfundidadeValida) frenteMap[f].depths.push(r.profundidade);
        }});

        return Object.values(frenteMap).map(item => {{
            const s = item.depths.reduce((acc, v) => acc + v, 0);
            const m = item.depths.length > 0 ? Number((s / item.depths.length).toFixed(2)) : 0;
            return {{ frente: item.frente, count: item.count, media: m }};
        }}).sort((a, b) => b.count - a.count);
    }};

    window.{engine_name} = {engine_name};

}})(window);
'''

# Write engines
with open(BASE_DIR / "DashBoard" / "abertura_asa" / "js" / "abertura_asa_engine.js", "w", encoding="utf-8") as f:
    f.write(make_engine_code(
        mod_key="abertura_asa",
        engine_name="AberturaAsaEngine",
        storage_key="mapfy_abertura_asa_targets",
        default_min=50.0,
        default_max=58.0,
        unit="cm",
        col_search_term="asa",
        default_obs="Faixa técnica recomendada para abertura da asa do sulcador (50 a 58 cm)"
    ))
print("abertura_asa_engine.js written")

with open(BASE_DIR / "DashBoard" / "paralelismo" / "js" / "paralelismo_engine.js", "w", encoding="utf-8") as f:
    f.write(make_engine_code(
        mod_key="paralelismo",
        engine_name="ParalelismoEngine",
        storage_key="mapfy_paralelismo_targets",
        default_min=1.40,
        default_max=1.50,
        unit="m",
        col_search_term="paralelismo",
        default_obs="Faixa técnica recomendada de paralelismo RTK entre sulcos (1.40 a 1.50 m)"
    ))
print("paralelismo_engine.js written")
# ==============================================================================
# 3. GENERATE INDEX.HTML AND DASHBOARD.JS FOR ABERTURA DA ASA AND PARALELISMO
# ==============================================================================
import sys
sys.path.append(str(BASE_DIR / "DashBoard"))
from generate_html_and_js import generate_module
from generate_dashboard_js import build_js

# Generate Abertura da Asa
generate_module(
    mod_key="abertura_asa",
    mod_title="Monitoramento de Abertura da Asa",
    mod_subtitle="Plantio Mecanizado • Regulagem da Asa do Sulcador, Conformidade e Georreferenciamento",
    default_min=50.0,
    default_max=58.0,
    icon_emoji="👐",
    metric_name="Abertura da Asa",
    raw_var="ABERTURA_ASA_RAW_DATA",
    engine_var="AberturaAsaEngine",
    storage_key="mapfy_abertura_asa_targets",
    unit="cm"
)

build_js(
    mod_key="abertura_asa",
    raw_var="ABERTURA_ASA_RAW_DATA",
    engine_var="AberturaAsaEngine",
    storage_key="mapfy_abertura_asa_targets",
    unit="cm"
)

# Generate Paralelismo
generate_module(
    mod_key="paralelismo",
    mod_title="Monitoramento de Paralelismo (RTK)",
    mod_subtitle="Plantio Mecanizado • Espaçamento entre Sulcos, Piloto Automático RTK e Conformidade",
    default_min=1.40,
    default_max=1.50,
    icon_emoji="📏",
    metric_name="Paralelismo",
    raw_var="PARALELISMO_RAW_DATA",
    engine_var="ParalelismoEngine",
    storage_key="mapfy_paralelismo_targets",
    unit="m"
)

build_js(
    mod_key="paralelismo",
    raw_var="PARALELISMO_RAW_DATA",
    engine_var="ParalelismoEngine",
    storage_key="mapfy_paralelismo_targets",
    unit="m"
)
