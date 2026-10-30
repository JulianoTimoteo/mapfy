#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_qualidade_cana_data.py
=============================
Processa o relatório 'Plantio - 10 - Quantidade de Cana' e gera
'DashBoard/qualidade_cana/js/data.js' perfeitamente normalizado, auditado e tipado.
"""

import json
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent
JSON_PATH = BASE_DIR.parent / "Server_MapFy" / "relatorios" / "Plantio - 10 - Quantidade de Cana" / "dados.json"
OUTPUT_DIR = BASE_DIR / "qualidade_cana"
OUTPUT_JS = OUTPUT_DIR / "js" / "data.js"

def normalize_text(val):
    if val is None:
        return ""
    return " ".join(str(val).strip().split())

def categorize_observation(obs_raw):
    """
    Categoriza a observação textual em:
    - 'VAZIO': Vazio ou apenas espaços
    - 'PONTO': Ponto isolado '.'
    - 'PADRAO': Textos padronizados repetitivos 'Bom', 'Boa'
    - 'DESCRITIVO': Texto informativo/descritivo real
    """
    if not obs_raw or obs_raw.strip() == "":
        return "VAZIO", ""
    
    clean = obs_raw.strip()
    clean_lower = clean.lower()

    if clean == ".":
        return "PONTO", clean
    
    if clean_lower in ["bom", "boa", "ok"]:
        return "PADRAO", clean
    
    return "DESCRITIVO", clean

def main():
    if not JSON_PATH.exists():
        print(f"Erro: Arquivo não encontrado em {JSON_PATH}")
        return

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    print(f"Carregados {len(raw_data)} registros de {JSON_PATH.name}")

    records = []
    for item in raw_data:
        rid = int(item.get("ID"))
        user = normalize_text(item.get("Usuário"))
        data_str = normalize_text(item.get("Data"))

        try:
            dt_obj = datetime.strptime(data_str, "%d/%m/%Y %H:%M")
            dt_iso = dt_obj.strftime("%Y-%m-%d %H:%M")
            date_only = dt_obj.strftime("%d/%m/%Y")
            hour_only = dt_obj.hour
        except Exception:
            dt_iso = ""
            date_only = ""
            hour_only = -1

        try:
            lat = float(str(item.get("Latitude", "")).replace(",", "."))
            lon = float(str(item.get("Longitude", "")).replace(",", "."))
            has_valid_coords = (lat != 0.0 and lon != 0.0 and -30.0 < lat < -15.0 and -55.0 < lon < -40.0)
        except Exception:
            lat = 0.0
            lon = 0.0
            has_valid_coords = False

        ini_str = normalize_text(item.get("Data início"))
        fim_str = normalize_text(item.get("Data Fim"))

        try:
            dt_i = datetime.strptime(ini_str, "%d/%m/%Y %H:%M")
            dt_f = datetime.strptime(fim_str, "%d/%m/%Y %H:%M")
            dur_min = max(0.0, round((dt_f - dt_i).total_seconds() / 60.0, 1))
        except Exception:
            dur_min = 0.0

        status = normalize_text(item.get("Status")) or "Aberto"

        try:
            score_val = float(str(item.get("Score", "")).replace(",", "."))
        except Exception:
            score_val = 0.0

        try:
            score_perc = int(float(str(item.get("Score perc.", "")).replace(",", ".")))
        except Exception:
            score_perc = 0

        score_desc = normalize_text(item.get("Score desc."))
        lanc_str = normalize_text(item.get("Data e Hora do Lançamento"))
        local_val = normalize_text(item.get("Local (Fazenda - Talhão)"))
        os_val = normalize_text(item.get("OS"))
        frente_val = normalize_text(item.get("Frente"))
        resp_val = normalize_text(item.get("Responsável"))

        # Quantidade de Cana (Campo categórico qualitativo)
        qtd_cana_raw = normalize_text(item.get("Quantidade de Cana"))
        qtd_cana_norm = qtd_cana_raw.upper() if qtd_cana_raw else "NÃO INFORMADO"

        # Observações (reparando chave com espaço no final se houver)
        obs_raw = item.get("Observações ") or item.get("Observações") or ""
        obs_raw = normalize_text(obs_raw)
        obs_tipo, obs_limpa = categorize_observation(obs_raw)

        # Diagnóstico de divergência de Score
        # Registros onde Quantidade de Cana = BOM mas Score = 0,00 ou Baixo
        score_divergente = (qtd_cana_norm == "BOM" and (score_val == 0.0 or score_desc.lower() == "baixo"))

        record = {
            "id": rid,
            "usuario": user,
            "data": data_str,
            "data_iso": dt_iso,
            "data_dia": date_only,
            "hora": hour_only,
            "lat": lat,
            "lon": lon,
            "has_valid_coords": has_valid_coords,
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
            "quantidade_cana_raw": qtd_cana_raw,
            "quantidade_cana_norm": qtd_cana_norm,
            "observacoes_raw": obs_raw,
            "observacoes_limpa": obs_limpa,
            "observacoes_tipo": obs_tipo, # 'VAZIO', 'PONTO', 'PADRAO', 'DESCRITIVO'
            "is_bom": (qtd_cana_norm == "BOM"),
            "score_divergente": score_divergente,
            "has_obs_relevante": (obs_tipo == "DESCRITIVO")
        }
        records.append(record)

    # Ordenar por data decrescente (mais recente primeiro)
    records.sort(key=lambda r: (r["data_iso"], r["id"]), reverse=True)

    OUTPUT_JS.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write("// Base de dados real gerada de Server_MapFy/relatorios/Plantio - 10 - Quantidade de Cana/dados.json\n")
        f.write(f"// Total de registros: {len(records)}\n")
        f.write("window.QUALIDADE_CANA_DATA = ")
        json.dump(records, f, ensure_ascii=False, indent=None)
        f.write(";\n")

    print(f"Sucesso: {len(records)} registros exportados para {OUTPUT_JS}")

if __name__ == "__main__":
    main()
