#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_qualidade_muda_data.py
=============================
Processa o arquivo 'Server_MapFy/relatorios/Plantio - 08 - Qualidade da muda/dados.csv'
e gera o arquivo 'DashBoard/qualidade_muda/js/data.js' perfeitamente tipado e auditado.
"""

import json
import re
import pandas as pd
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR.parent / "Server_MapFy" / "relatorios" / "Plantio - 08 - Qualidade da muda" / "dados.csv"
OUTPUT_JS = BASE_DIR / "qualidade_muda" / "js" / "data.js"

def extract_broca_info(text):
    if not isinstance(text, str) or not text.strip():
        return {'has_broca': False, 'qtd': None, 'tipo': 'Sem Observação'}
    t = text.strip()
    tl = t.lower()
    
    if 'broca' not in tl and 'brocada' not in tl:
        if tl in ['bom', 'boa', 'boa qualidade', 'cana em boa qualidade', 'cana com boa qualidade', 'qualidade boa', 'boa  qualidade', 'boa ']:
            return {'has_broca': False, 'qtd': None, 'tipo': 'Conforme (Bom)'}
        elif t == '.':
            return {'has_broca': False, 'qtd': None, 'tipo': 'Pontuação (.)'}
        else:
            return {'has_broca': False, 'qtd': None, 'tipo': 'Outros'}
    
    # Menção a Broca
    if 'plano de a' in tl or 'plano de ação' in tl:
        return {'has_broca': True, 'qtd': None, 'tipo': 'Plano de Ação (Broca)'}
    
    m = re.search(r'(\d+)\s*(?:cana\s+)?broca', tl)
    if m:
        return {'has_broca': True, 'qtd': int(m.group(1)), 'tipo': f'{m.group(1)} Brocas'}
    
    m2 = re.search(r'achado\s*(\d+)', tl)
    if m2:
        return {'has_broca': True, 'qtd': int(m2.group(1)), 'tipo': f'{m2.group(1)} Brocas'}

    return {'has_broca': True, 'qtd': None, 'tipo': 'Menção Sem Quantidade'}

def main():
    if not CSV_PATH.exists():
        print(f"Erro: Arquivo CSV não encontrado em: {CSV_PATH}")
        return

    df = pd.read_csv(CSV_PATH, sep=';', encoding='utf-8-sig')
    print(f"Lidos {len(df)} registros brutos de {CSV_PATH.name}")

    # Mapeamento seguro das colunas por posição
    # 0: ID, 1: Usuário, 2: Data, 3: Latitude, 4: Longitude, 5: Data início, 6: Data Fim
    # 7: Status, 8: Score, 9: Score perc., 10: Score desc., 11: Data Lançamento
    # 12: Local, 13: OS, 14: Frente, 15: Responsável, 16: Qualidade da Muda
    # 17: Observações, 18: Unnamed: 18
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
    col_qualidade = df.columns[16]
    col_obs = df.columns[17]

    records = []
    for _, row in df.iterrows():
        rid = int(row[col_id])
        user = str(row[col_user]).strip() if pd.notna(row[col_user]) else ""
        data_str = str(row[col_data]).strip() if pd.notna(row[col_data]) else ""
        
        # ISO date parsing
        try:
            dt_obj = datetime.strptime(data_str, "%d/%m/%Y %H:%M")
            dt_iso = dt_obj.strftime("%Y-%m-%d %H:%M")
            date_only = dt_obj.strftime("%d/%m/%Y")
        except Exception:
            dt_iso = ""
            date_only = ""

        # Coordenadas
        try:
            lat = float(str(row[col_lat]).replace(",", "."))
            lon = float(str(row[col_lon]).replace(",", "."))
        except Exception:
            lat = 0.0
            lon = 0.0

        ini_str = str(row[col_ini]).strip() if pd.notna(row[col_ini]) else ""
        fim_str = str(row[col_fim]).strip() if pd.notna(row[col_fim]) else ""
        
        # Duração em minutos
        try:
            dt_i = datetime.strptime(ini_str, "%d/%m/%Y %H:%M")
            dt_f = datetime.strptime(fim_str, "%d/%m/%Y %H:%M")
            dur_min = max(0.0, round((dt_f - dt_i).total_seconds() / 60.0, 1))
        except Exception:
            dur_min = 0.0

        status = str(row[col_status]).strip() if pd.notna(row[col_status]) else "Aberto"
        
        # Scores
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
        os_val = str(row[col_os]).strip() if pd.notna(row[col_os]) else ""
        frente_val = str(row[col_frente]).strip() if pd.notna(row[col_frente]) else ""
        resp_val = str(row[col_resp]).strip() if pd.notna(row[col_resp]) else ""
        
        # Qualidade da Muda
        qual_raw = str(row[col_qualidade]).strip() if pd.notna(row[col_qualidade]) else ""
        qual_clean = qual_raw.upper()
        if qual_clean not in ["BOM", "RUIM"]:
            qual_clean = "BOM" if "BOM" in qual_clean else ("RUIM" if "RUIM" in qual_clean else qual_raw)

        # Observações
        obs_raw = str(row[col_obs]).strip() if pd.notna(row[col_obs]) else ""
        broca_info = extract_broca_info(obs_raw)

        # Divergência de score (ex: BOM com Score 0 ou RUIM com Score 1)
        is_divergente = (qual_clean == "BOM" and score_val == 0.0) or (qual_clean == "RUIM" and score_val == 1.0)

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
            "os": os_val,
            "frente": frente_val,
            "responsavel": resp_val,
            "qualidade_muda": qual_clean,
            "observacoes": obs_raw,
            "has_broca": broca_info["has_broca"],
            "broca_qtd": broca_info["qtd"],
            "broca_tipo": broca_info["tipo"],
            "is_divergente_score": is_divergente
        }
        records.append(record)

    # Ordenar por data decrescente (mais recente primeiro)
    records.sort(key=lambda r: (r["data_iso"], r["id"]), reverse=True)

    OUTPUT_JS.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write("// Base de dados real gerada automaticamente de Server_MapFy/relatorios/Plantio - 08 - Qualidade da muda/dados.csv\n")
        f.write(f"// Total de registros: {len(records)}\n")
        f.write("window.QUALIDADE_MUDA_DATA = ")
        json.dump(records, f, ensure_ascii=False, indent=None)
        f.write(";\n")

    print(f"Sucesso: {len(records)} registros exportados para {OUTPUT_JS}")

if __name__ == "__main__":
    main()
