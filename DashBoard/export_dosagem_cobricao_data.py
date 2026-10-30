# -*- coding: utf-8 -*-
"""
export_dosagem_cobricao_data.py
Gera o dataset enriquecido e normalizado em DashBoard/dosagem_cobricao/js/data.js
para o monitoramento de Plantio - 11 - Dosagem de Produto - Cobrição.
"""
import os
import json
import pandas as pd
import numpy as np
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
REPORTS_DIR = os.path.join(ROOT_DIR, "Server_MapFy", "relatorios")

# Localizar pasta
target_folder = None
for f in os.listdir(REPORTS_DIR):
    if "11" in f and "Cobri" in f:
        target_folder = os.path.join(REPORTS_DIR, f)
        break

if not target_folder:
    raise FileNotFoundError("Diretório de Plantio - 11 - Dosagem de Produto - Cobrição não foi encontrado.")

csv_path = os.path.join(target_folder, "dados.csv")
print(f"Lendo dados de: {csv_path}")

df = pd.read_csv(csv_path, sep=';', encoding='utf-8-sig', dtype=str)
print(f"Total de linhas brutas: {len(df)}")

# Mapear colunas
col_id = df.columns[0]
col_user = df.columns[1]
col_data = df.columns[2]
col_lat = df.columns[3]
col_lon = df.columns[4]
col_ini = df.columns[5]
col_fim = df.columns[6]
col_status = df.columns[7]
col_score = df.columns[8]
col_lanc = df.columns[9]
col_local = df.columns[10]
col_os = df.columns[11]
col_frente = df.columns[12]
col_resp = df.columns[13]
col_dosagem = df.columns[14]

def parse_br_float(val):
    if pd.isna(val):
        return None
    s = str(val).strip()
    if not s or s.lower() in ('nan', 'none', 'null', 'n/d'):
        return None
    # Converter vírgula para ponto
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
    s = s.replace("PRPRIA", "PRÓPRIA").replace("PRPRIA", "PRÓPRIA")
    s = s.replace("MANEZO", "MANEZÃO").replace("MANZO", "MANEZÃO")
    s = s.replace("Manezo", "MANEZÃO").replace("Manezao", "MANEZÃO")
    s = s.replace("142- Bidu", "142 - FRENTE BIDU")
    s = s.replace("135 - PEDRINHO", "135 - FRENTE PEDRINHO")
    return s

def clean_resp(resp_str):
    if pd.isna(resp_str):
        return "N/D"
    return str(resp_str).strip()

# Pré-cálculo numérico para estatísticas e identificação de outliers
df_temp = pd.DataFrame()
df_temp['dos_num'] = df[col_dosagem].apply(parse_br_float)
valid_vals = df_temp['dos_num'].dropna()

q1 = float(valid_vals.quantile(0.25))
q3 = float(valid_vals.quantile(0.75))
iqr = q3 - q1
mediana_global = float(valid_vals.median())
media_global = float(valid_vals.mean())
lower_fence = round(q1 - 1.5 * iqr, 4)
upper_fence = round(q3 + 1.5 * iqr, 4)

print(f"Estatísticas de Dosagem: Média={media_global:.4f} | Mediana={mediana_global:.4f} | Q1={q1:.4f} | Q3={q3:.4f} | IQR={iqr:.4f}")
print(f"Limites Estatísticos (IQR 1.5x): [{lower_fence:.4f}, {upper_fence:.4f}]")

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

    dos_orig = str(r[col_dosagem]).strip() if pd.notna(r[col_dosagem]) else ""
    dos_num = parse_br_float(dos_orig)
    is_valid_dos = (dos_num is not None)

    # Identificação estatística de variação (IQR)
    is_outlier = False
    diff_med = None
    if is_valid_dos:
        diff_med = round(dos_num - mediana_global, 4)
        if dos_num < lower_fence or dos_num > upper_fence:
            is_outlier = True

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
        "score": str(r[col_score]).strip() if pd.notna(r[col_score]) else "0,00",
        "data_lancamento": str(r[col_lanc]).strip() if pd.notna(r[col_lanc]) else "",
        "local": str(r[col_local]).strip() if pd.notna(r[col_local]) else "",
        "os": str(r[col_os]).strip() if pd.notna(r[col_os]) else "",
        "frente": clean_frente(r[col_frente]),
        "responsavel": clean_resp(r[col_resp]),
        "dosagem_orig": dos_orig,
        "dosagem_num": dos_num,
        "is_valid_dos": is_valid_dos,
        "is_outlier": is_outlier,
        "diff_mediana": diff_med,
        "categoria_analitica": "Atípico para Investigação" if is_outlier else "Distribuição Típica"
    }
    records.append(rec)

# Ordenar por data cronológica decrescente (mais recente primeiro)
records.sort(key=lambda x: x["data_iso"] or "", reverse=True)

outliers_count = sum(1 for r in records if r["is_outlier"])
print(f"Total registros processados: {len(records)}")
print(f"Total de registros atípicos (outliers IQR): {outliers_count} ({outliers_count/len(records)*100:.2f}%)")
print(f"Data mais recente: {records[0]['data']}")
print(f"Data mais antiga: {records[-1]['data']}")

# Escrever data.js
out_js = os.path.join(BASE_DIR, "dosagem_cobricao", "js", "data.js")
with open(out_js, "w", encoding="utf-8") as f:
    f.write("// Dataset gerado automaticamente a partir de dados reais do MapFy\n")
    f.write("// Fonte: Server_MapFy/relatorios/Plantio - 11 - Dosagem de Produto - Cobrição\n")
    f.write(f"// Total de Registros: {len(records)} | Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
    f.write("window.DOSAGEM_COBRICAO_DATA = ")
    json.dump(records, f, ensure_ascii=False, indent=None)
    f.write(";\n")

size_kb = os.path.getsize(out_js) / 1024
print(f"Arquivo data.js gerado com sucesso: {out_js} ({size_kb:.1f} KB)")
