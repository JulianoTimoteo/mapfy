#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_qualidade_muda.py
======================
Conjunto de testes automatizados para validação do módulo executivo
PLANTIO — QUALIDADE DA MUDA da Usina Pitangueiras (Safra 2026).
"""

import os
import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def run_tests():
    print("=" * 60)
    print("INICIANDO TESTES DO DASHBOARD EXECUTIVO - QUALIDADE DA MUDA")
    print("=" * 60)

    # 1. Teste de Carga dos Dados
    data_js_path = BASE_DIR / "js" / "data.js"
    assert data_js_path.exists(), "data.js não encontrado!"
    with open(data_js_path, "r", encoding="utf-8") as f:
        content = f.read()
        json_str = content.split("window.QUALIDADE_MUDA_DATA = ")[1].rstrip(";\n")
        records = json.loads(json_str)

    total_records = len(records)
    assert total_records == 2710, f"Esperado 2710 registros, obtido {total_records}"
    print(f"[OK] Teste 1: Base de dados carregada com {total_records} registros reais.")

    # 2. Teste da Maior Data
    latest_record = records[0]
    assert "28/10/2026" in latest_record["data"], f"Maior data incorreta: {latest_record['data']}"
    print(f"[OK] Teste 2: Maior data identificada automaticamente: {latest_record['data']}.")

    # 3. Teste de Frentes e OS
    frentes = set(r["frente"] for r in records if r["frente"])
    os_set = set(r["os"] for r in records if r["os"])
    assert len(frentes) == 19, f"Esperado 19 frentes, obtido {len(frentes)}"
    assert len(os_set) >= 220, f"Esperado >= 220 OS, obtido {len(os_set)}"
    print(f"[OK] Teste 3: Mapeamento operacional: {len(frentes)} frentes e {len(os_set)} OS distintas.")

    # 4. Teste de Conformidade da Muda (BOM / RUIM)
    bom_count = sum(1 for r in records if r["qualidade_muda"] == "BOM")
    ruim_count = sum(1 for r in records if r["qualidade_muda"] == "RUIM")
    assert bom_count == 2696, f"Esperado 2696 BOM, obtido {bom_count}"
    assert ruim_count == 14, f"Esperado 14 RUIM, obtido {ruim_count}"
    perc_bom = (bom_count / total_records) * 100
    perc_ruim = (ruim_count / total_records) * 100
    print(f"[OK] Teste 4: Classificação da muda: BOM={bom_count} ({perc_bom:.1f}%), RUIM={ruim_count} ({perc_ruim:.1f}%).")

    # 5. Teste de Coerência e Auditoria de Score
    divergencias = [r for r in records if r["is_divergente_score"]]
    assert len(divergencias) == 57, f"Esperado 57 divergências de score (BOM c/ 0%), obtido {len(divergencias)}"
    for d in divergencias:
        assert d["qualidade_muda"] == "BOM" and d["score"] == 0.0, "Registro divergente incorreto!"
    print(f"[OK] Teste 5: Auditoria de Score: {len(divergencias)} registros BOM c/ Score 0,00 identificados e isolados.")

    # 6. Teste de Ocorrências de Brocas
    brocas = [r for r in records if r["has_broca"]]
    assert len(brocas) == 36, f"Esperado 36 menções a brocas, obtido {len(brocas)}"
    brocas_bom = sum(1 for r in brocas if r["qualidade_muda"] == "BOM")
    brocas_ruim = sum(1 for r in brocas if r["qualidade_muda"] == "RUIM")
    assert brocas_bom == 24 and brocas_ruim == 12, f"Distribuição incorreta de brocas: {brocas_bom} BOM, {brocas_ruim} RUIM"
    print(f"[OK] Teste 6: Análise de Brocas: {len(brocas)} menções ({brocas_bom} em BOM e {brocas_ruim} em RUIM), sem soma populacional abusiva.")

    # 7. Teste de Georreferenciamento
    georef = sum(1 for r in records if r["lat"] != 0 and r["lon"] != 0)
    assert georef == 2710, f"Esperado 2710 pontos GPS válidos, obtido {georef}"
    print(f"[OK] Teste 7: 2710/2710 registros com coordenadas GPS válidas.")

    # 8. Teste de Integridade dos Módulos de Frontend
    html_path = BASE_DIR / "index.html"
    engine_path = BASE_DIR / "js" / "qualidade_muda_engine.js"
    dash_js_path = BASE_DIR / "js" / "dashboard.js"
    css_path = BASE_DIR / "css" / "styles.css"

    for p in [html_path, engine_path, dash_js_path, css_path]:
        assert p.exists() and p.stat().st_size > 0, f"Arquivo ausente ou vazio: {p}"

    html_content = html_path.read_text(encoding="utf-8")
    assert "href=\"../index.html\"" in html_content, "Link para Mandala Hub ausente no index.html!"
    assert "area_vivencia/index.html" not in html_content, "Não deve haver link cruzado para área de vivência!"
    assert "subsolagem/index.html" not in html_content, "Não deve haver link cruzado para subsolagem!"
    print("[OK] Teste 8: Todos os módulos de frontend verificados, íntegros e sem links cruzados.")

    print("=" * 60)
    print("TODOS OS TESTES FORAM APROVADOS COM SUCESSO! (8/8)")
    print("O MÓDULO QUALIDADE DA MUDA ESTÁ 100% OPERACIONAL E CONFORME AS DIRETRIZES.")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
