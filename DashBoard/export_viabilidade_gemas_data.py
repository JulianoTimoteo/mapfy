#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_viabilidade_gemas_data.py
================================
Processa o arquivo 'Server_MapFy/relatorios/Plantio - 09 - Quantidade de Gemas/dados.csv'
e gera 'DashBoard/viabilidade_gemas/js/data.js' perfeitamente normalizado, auditado e tipado.
"""

import json
from pathlib import Path
from datetime import datetime
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR.parent / "Server_MapFy" / "relatorios" / "Plantio - 09 - Quantidade de Gemas" / "dados.csv"
OUTPUT_JS = BASE_DIR / "viabilidade_gemas" / "js" / "data.js"

def main():
    if not CSV_PATH.exists():
        print(f"Erro: Arquivo CSV não encontrado em: {CSV_PATH}")
        return

    df = pd.read_csv(CSV_PATH, sep=';', encoding='utf-8-sig')
    print(f"Lidos {len(df)} registros brutos de {CSV_PATH.name}")

    # Mapeamento de colunas por índice:
    # 0: ID, 1: Usuário, 2: Data, 3: Latitude, 4: Longitude, 5: Data início, 6: Data Fim
    # 7: Status, 8: Score, 9: Score perc., 10: Score desc., 11: Data Lançamento
    # 12: Local, 13: Frente, 14: OS, 15: Responsável
    # 16: Quantidade de Gemas Total, 17: Quantidade de Gemas Viáveis, 18: Quantidade de Gemas Inviáveis
    # 19: Unnamed: 19
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
    col_frente = df.columns[13]
    col_os = df.columns[14]
    col_resp = df.columns[15]
    col_tot = df.columns[16]
    col_via = df.columns[17]
    col_inv = df.columns[18]

    records = []
    for _, row in df.iterrows():
        rid = int(row[col_id])
        user = str(row[col_user]).strip() if pd.notna(row[col_user]) else ""
        data_str = str(row[col_data]).strip() if pd.notna(row[col_data]) else ""

        try:
            dt_obj = datetime.strptime(data_str, "%d/%m/%Y %H:%M")
            dt_iso = dt_obj.strftime("%Y-%m-%d %H:%M")
            date_only = dt_obj.strftime("%d/%m/%Y")
        except Exception:
            dt_iso = ""
            date_only = ""

        try:
            lat = float(str(row[col_lat]).replace(",", "."))
            lon = float(str(row[col_lon]).replace(",", "."))
        except Exception:
            lat = 0.0
            lon = 0.0

        ini_str = str(row[col_ini]).strip() if pd.notna(row[col_ini]) else ""
        fim_str = str(row[col_fim]).strip() if pd.notna(row[col_fim]) else ""

        try:
            dt_i = datetime.strptime(ini_str, "%d/%m/%Y %H:%M")
            dt_f = datetime.strptime(fim_str, "%d/%m/%Y %H:%M")
            dur_min = max(0.0, round((dt_f - dt_i).total_seconds() / 60.0, 1))
        except Exception:
            dur_min = 0.0

        status = str(row[col_status]).strip() if pd.notna(row[col_status]) else "Aberto"

        try:
            score_val = float(str(row[col_score]).replace(",", "."))
        except Exception:
            score_val = 0.0

        try:
            score_perc = int(float(str(row[col_score_perc]).replace(",", ".")))
        except Exception:
            score_perc = 0

        score_desc = str(row[col_score_desc]).strip() if pd.notna(row[col_score_desc]) else ""
        lanc_str = str(row[col_lanc]).strip() if pd.notna(row[col_lanc]) else ""
        local_val = str(row[col_local]).strip() if pd.notna(row[col_local]) else ""
        frente_val = str(row[col_frente]).strip() if pd.notna(row[col_frente]) else ""
        os_val = str(row[col_os]).strip() if pd.notna(row[col_os]) else ""
        resp_val = str(row[col_resp]).strip() if pd.notna(row[col_resp]) else ""

        # Quantidades numéricas de gemas
        try:
            tot_g = int(float(str(row[col_tot]).replace(",", ".")))
        except Exception:
            tot_g = 0

        try:
            via_g = int(float(str(row[col_via]).replace(",", ".")))
        except Exception:
            via_g = 0

        try:
            inv_g = int(float(str(row[col_inv]).replace(",", ".")))
        except Exception:
            inv_g = 0

        # Regra Central de Consistência
        diferenca = tot_g - (via_g + inv_g)
        is_consistente = (diferenca == 0) and (tot_g > 0) and (via_g >= 0) and (inv_g >= 0)

        viab_ind = round((via_g / tot_g) * 100, 1) if tot_g > 0 else 0.0
        inviab_ind = round((inv_g / tot_g) * 100, 1) if tot_g > 0 else 0.0

        has_valid_coords = (lat != 0.0 and lon != 0.0 and -30.0 < lat < -15.0 and -55.0 < lon < -40.0)

        # Diagnóstico de Score MapFy vs Viabilidade Real Calculada
        # No formulário, 100% dos registros possuem Score = 0,00 e Baixo, divergindo da viabilidade real
        score_divergente = (score_val == 0.0 and viab_ind > 0.0)

        # Amostras com gemas inviáveis
        tem_inviaveis = (inv_g > 0)

        # Outlier estatístico de gemas totais (Tukey Fences: Q1=55, Q3=60, IQR=5 -> Fences=[47.5, 67.5])
        is_outlier = (tot_g < 47.5 or tot_g > 67.5)

        record = {
            "id": rid,
            "usuario": user,
            "data": data_str,
            "data_iso": dt_iso,
            "data_dia": date_only,
            "lat": lat,
            "lon": lon,
            "data_inicio": ini_str,
            "data_fim": fim_str,
            "duracao_min": dur_min,
            "status": status,
            "score": score_val,
            "score_perc": score_perc,
            "score_desc": score_desc,
            "data_lancamento": lanc_str,
            "local": local_val,
            "frente": frente_val,
            "os": os_val,
            "responsavel": resp_val,
            "gemas_total": tot_g,
            "gemas_viaveis": via_g,
            "gemas_inviaveis": inv_g,
            "diferenca": diferenca,
            "is_consistente": is_consistente,
            "viabilidade_ind": viab_ind,
            "inviabilidade_ind": inviab_ind,
            "has_valid_coords": has_valid_coords,
            "score_divergente": score_divergente,
            "tem_inviaveis": tem_inviaveis,
            "is_outlier": is_outlier
        }
        records.append(record)

    # Ordenar por data decrescente (mais recente primeiro)
    records.sort(key=lambda r: (r["data_iso"], r["id"]), reverse=True)

    OUTPUT_JS.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write("// Base de dados real gerada automaticamente de Server_MapFy/relatorios/Plantio - 09 - Quantidade de Gemas/dados.csv\n")
        f.write(f"// Total de registros: {len(records)}\n")
        f.write("window.VIABILIDADE_GEMAS_DATA = ")
        json.dump(records, f, ensure_ascii=False, indent=None)
        f.write(";\n")

    print(f"Sucesso: {len(records)} registros exportados para {OUTPUT_JS}")

if __name__ == "__main__":
    main()
