# -*- coding: utf-8 -*-
"""
export_arremate_acabamento_data.py
Gera o dataset enriquecido e normalizado em DashBoard/arremate_acabamento/js/data.js
para o monitoramento de Plantio - 13 - Arremate e Acabamento.
"""
import os
import json
import pandas as pd
import numpy as np
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
REPORTS_DIR = os.path.join(ROOT_DIR, "Server_MapFy", "relatorios")

target_folder = None
for f in os.listdir(REPORTS_DIR):
    if "13" in f or "Arremate" in f:
        target_folder = os.path.join(REPORTS_DIR, f)
        break

if not target_folder:
    raise FileNotFoundError("Diretório de Plantio - 13 - Arremate e Acabamento não foi encontrado.")

csv_path = os.path.join(target_folder, "dados.csv")
print(f"Lendo dados de: {csv_path}")

df = pd.read_csv(csv_path, sep=';', encoding='utf-8-sig', dtype=str)
print(f"Total de linhas brutas: {len(df)}")

col_id = df.columns[0]
col_user = df.columns[1]
col_data = df.columns[2]
col_lat = df.columns[3]
col_lon = df.columns[4]
col_ini = df.columns[5]
col_fim = df.columns[6]
col_status = df.columns[7]
col_score = df.columns[8]
col_score_perc = df.columns[9]
col_score_desc = df.columns[10]
col_lanc = df.columns[11]
col_local = df.columns[12]
col_os = df.columns[13]
col_frente = df.columns[14]
col_resp = df.columns[15]
col_arremate = df.columns[16]

def parse_br_float(val):
    if pd.isna(val):
        return None
    s = str(val).strip()
    if not s or s.lower() in ('nan', 'none', 'null', 'n/d'):
        return None
    s = s.replace(',', '.')
    try:
        f = float(s)
        if np.isfinite(f):
            return f
        return None
    except:
        return None

def parse_coord(val):
    if pd.isna(val):
        return None
    try:
        s = str(val).strip().replace(',', '.')
        f = float(s)
        if -90 <= f <= 90 or -180 <= f <= 180:
            return round(f, 6)
        return None
    except:
        return None

def parse_date(date_str):
    if pd.isna(date_str):
        return None, None, None
    s = str(date_str).strip()
    for fmt in ('%d/%m/%Y %H:%M', '%d/%m/%Y %H:%M:%S', '%d/%m/%Y'):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.strftime('%Y-%m-%d %H:%M'), dt.strftime('%d/%m/%Y'), dt.hour
        except:
            pass
    return None, None, None

def clean_frente(frente_str):
    if pd.isna(frente_str):
        return "N/D"
    s = str(frente_str).strip()
    s = s.replace("PRPRIA", "PRÓPRIA").replace("PRÓPRIA", "PRÓPRIA")
    s = s.replace("MANEZO", "MANEZÃO").replace("MANZO", "MANEZÃO")
    s = s.replace("Manezo", "MANEZÃO").replace("Manezao", "MANEZÃO")
    s = s.replace("142- Bidu", "142 - FRENTE BIDU").replace("141- BIDU", "141 - FRENTE BIDU")
    s = s.replace("122 - Frente  Bidu", "122 - FRENTE BIDU")
    s = s.replace("135 - PEDRINHO", "135 - FRENTE PEDRINHO")
    return s

def clean_resp(resp_str):
    if pd.isna(resp_str):
        return "N/D"
    return str(resp_str).strip()

records = []
for idx, r in df.iterrows():
    raw_id = r[col_id]
    try:
        item_id = int(str(raw_id).strip())
    except:
        item_id = str(raw_id).strip()

    data_iso, data_dia, hora = parse_date(r[col_data])
    ini_iso, _, _ = parse_date(r[col_ini])
    fim_iso, _, _ = parse_date(r[col_fim])

    duracao_min = None
    if ini_iso and fim_iso:
        try:
            dt_ini = datetime.strptime(ini_iso, '%Y-%m-%d %H:%M')
            dt_fim = datetime.strptime(fim_iso, '%Y-%m-%d %H:%M')
            diff = (dt_fim - dt_ini).total_seconds() / 60.0
            if diff >= 0:
                duracao_min = round(diff, 1)
        except:
            duracao_min = None

    lat = parse_coord(r[col_lat])
    lon = parse_coord(r[col_lon])
    has_coords = (lat is not None and lon is not None and lat != 0 and lon != 0)

    score_orig = str(r[col_score]).strip() if pd.notna(r[col_score]) else "0,00"
    score_num = parse_br_float(score_orig) or 0.0

    score_perc_orig = str(r[col_score_perc]).strip() if pd.notna(r[col_score_perc]) else "0"
    score_perc_num = parse_br_float(score_perc_orig) or 0.0

    score_desc = str(r[col_score_desc]).strip() if pd.notna(r[col_score_desc]) else "Baixo"

    arremate_orig = str(r[col_arremate]).strip() if pd.notna(r[col_arremate]) else ""
    arremate_norm = arremate_orig.upper()
    is_bom = (arremate_norm == 'BOM')

    # Divergência de score: avaliado como BOM mas com pontuação zero (antes da ativação de agosto/2026)
    is_score_divergente = (is_bom and score_num == 0.0)

    rec = {
        "id": item_id,
        "usuario": str(r[col_user]).strip() if pd.notna(r[col_user]) else "",
        "data": str(r[col_data]).strip() if pd.notna(r[col_data]) else "",
        "data_iso": data_iso or "",
        "data_dia": data_dia or "",
        "hora": hora if hora is not None else 12,
        "lat": lat,
        "lon": lon,
        "has_coords": has_coords,
        "data_inicio": str(r[col_ini]).strip() if pd.notna(r[col_ini]) else "",
        "data_fim": str(r[col_fim]).strip() if pd.notna(r[col_fim]) else "",
        "duracao_min": duracao_min,
        "status": str(r[col_status]).strip() if pd.notna(r[col_status]) else "Aberto",
        "score": score_orig,
        "score_num": score_num,
        "score_perc": score_perc_orig,
        "score_perc_num": score_perc_num,
        "score_desc": score_desc,
        "data_lancamento": str(r[col_lanc]).strip() if pd.notna(r[col_lanc]) else "",
        "local": str(r[col_local]).strip() if pd.notna(r[col_local]) else "",
        "os": str(r[col_os]).strip() if pd.notna(r[col_os]) else "",
        "frente": clean_frente(r[col_frente]),
        "responsavel": clean_resp(r[col_resp]),
        "arremate_orig": arremate_orig,
        "arremate_norm": arremate_norm,
        "is_bom": is_bom,
        "is_score_divergente": is_score_divergente,
        "fase_score": "Score Ativo (10 / 100%)" if score_num > 0 else "Pré-Ativação (0 / 0%)",
        "cor_marcador": "#10b981" if score_num > 0 else "#059669"
    }
    records.append(rec)

# Ordenar cronologicamente decrescente
records.sort(key=lambda x: x["data_iso"] or "", reverse=True)

score_10_count = sum(1 for r in records if r["score_num"] >= 10.0)
score_0_count = sum(1 for r in records if r["score_num"] == 0.0)
print(f"Total registros processados: {len(records)}")
print(f"Registros Score 10 (100% Bom): {score_10_count}")
print(f"Registros Score 0 (Pré-ativação): {score_0_count}")
print(f"Data mais recente: {records[0]['data']}")
print(f"Data mais antiga: {records[-1]['data']}")

out_js = os.path.join(BASE_DIR, "arremate_acabamento", "js", "data.js")
with open(out_js, "w", encoding="utf-8") as f:
    f.write("// Dataset gerado automaticamente a partir de dados reais do MapFy\n")
    f.write("// Fonte: Server_MapFy/relatorios/Plantio - 13 - Arremate e Acabamento\n")
    f.write(f"// Total de Registros: {len(records)} | Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
    f.write("window.ARREMATE_DATA = ")
    json.dump(records, f, ensure_ascii=False, indent=None)
    f.write(";\n")

size_kb = os.path.getsize(out_js) / 1024
print(f"Arquivo data.js gerado com sucesso: {out_js} ({size_kb:.1f} KB)")
