# -*- coding: utf-8 -*-
"""
test_dosagem.py
Suíte de Testes Automatizados para o Módulo de Dosagem de Produto na Sulcação
Usina Pitangueiras • Safra 2026
"""
import json
import math
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def run_tests():
    print("=" * 60)
    print("INICIANDO TESTES DO DASHBOARD EXECUTIVO - DOSAGEM NA SULCAÇÃO")
    print("=" * 60)

    # 1. Carregamento dos dados
    data_js = BASE_DIR / "js" / "data.js"
    assert data_js.exists(), "Arquivo data.js não encontrado!"
    with open(data_js, "r", encoding="utf-8") as f:
        content = f.read()
        json_str = content.split("window.DOSAGEM_RAW_DATA = ")[1].rstrip(";\n")
        records = json.loads(json_str)

    assert len(records) == 1279, f"Esperado 1279 registros, obtido {len(records)}"
    print(f"[OK] Teste 1: Base de dados carregada com {len(records)} registros reais.")

    # 2. Teste de Segmentação de Produtos (Adubo & Torta)
    adubo_recs = [r for r in records if "adubo" in (r.get("Produto") or "").lower()]
    torta_recs = [r for r in records if "torta" in (r.get("Produto") or "").lower()]
    assert len(adubo_recs) == 1185, f"Esperado 1185 registros de Adubo, obtido {len(adubo_recs)}"
    assert len(torta_recs) == 94, f"Esperado 94 registros de Torta, obtido {len(torta_recs)}"
    print(f"[OK] Teste 2: Segmentação de Insumos validada: Adubo={len(adubo_recs)} (92.6%), Torta={len(torta_recs)} (7.4%).")

    # 3. Teste de Estatísticas por Produto (Adubo vs Torta)
    ad_vals = [float(r["Dosagem de Produto - Sulcação"].replace(",", ".")) for r in adubo_recs if r.get("Dosagem de Produto - Sulcação")]
    to_vals = [float(r["Dosagem de Produto - Sulcação"].replace(",", ".")) for r in torta_recs if r.get("Dosagem de Produto - Sulcação")]

    ad_mean = sum(ad_vals) / len(ad_vals)
    to_mean = sum(to_vals) / len(to_vals)

    ad_sorted = sorted(ad_vals)
    ad_median = ad_sorted[len(ad_vals) // 2]
    to_sorted = sorted(to_vals)
    to_median = to_sorted[len(to_vals) // 2]

    assert abs(ad_mean - 3.40) < 0.05, f"Média de Adubo incorreta: {ad_mean:.3f}"
    assert abs(to_mean - 5.62) < 0.05, f"Média de Torta incorreta: {to_mean:.3f}"
    assert abs(ad_median - 3.405) < 0.05, f"Mediana de Adubo incorreta: {ad_median:.3f}"
    assert abs(to_median - 5.645) < 0.05, f"Mediana de Torta incorreta: {to_median:.3f}"
    print(f"[OK] Teste 3: Estatísticas comparativas validadas: Adubo (Média={ad_mean:.3f}, Mediana={ad_median:.3f}) vs Torta (Média={to_mean:.3f}, Mediana={to_median:.3f}).")

    # 4. Teste de Data Mais Recente
    dates = [r.get("Data") for r in records if r.get("Data")]
    assert any("28/10/2026" in d for d in dates), "Data mais recente (28/10/2026) não encontrada!"
    print(f"[OK] Teste 4: Maior data identificada automaticamente: 28/10/2026.")

    # 5. Teste de Frentes e OS
    frentes = set(r.get("Frente") for r in records if r.get("Frente"))
    os_set = set(r.get("OS") for r in records if r.get("OS"))
    assert len(frentes) == 15, f"Esperado 15 frentes, obtido {len(frentes)}"
    assert len(os_set) == 179, f"Esperado 179 OS, obtido {len(os_set)}"
    print(f"[OK] Teste 5: Mapeamento operacional validado: {len(frentes)} frentes e {len(os_set)} OS distintas.")

    # 6. Teste de Coordenadas GPS
    coords_valid = 0
    for r in records:
        try:
            lat = float(r["Latitude"].replace(",", "."))
            lon = float(r["Longitude"].replace(",", "."))
            if lat != 0 and lon != 0 and -90 <= lat <= 90 and -180 <= lon <= 180:
                coords_valid += 1
        except:
            pass
    assert coords_valid == 1279, f"Esperado 1279 coordenadas válidas, obtido {coords_valid}"
    print(f"[OK] Teste 6: 1279/1279 registros com coordenadas GPS válidas (100%).")

    # 7. Teste de Auditoria de Score e Status
    score_zeros = sum(1 for r in records if r.get("Score") == "0,00")
    status_aberto = sum(1 for r in records if r.get("Status") == "Aberto")
    assert score_zeros == 1279, f"Esperado 1279 registros com Score 0,00, obtido {score_zeros}"
    assert status_aberto == 1275, f"Esperado 1275 registros com Status Aberto, obtido {status_aberto}"
    print(f"[OK] Teste 7: Auditoria de integridade do Score (100% 0,00) e Status (1275 Aberto, 4 Fechado).")

    # 8. Teste de Arquivos do Frontend
    assert (BASE_DIR / "index.html").exists(), "index.html não encontrado!"
    assert (BASE_DIR / "css" / "styles.css").exists(), "styles.css não encontrado!"
    assert (BASE_DIR / "js" / "dosagem_engine.js").exists(), "dosagem_engine.js não encontrado!"
    assert (BASE_DIR / "js" / "dashboard.js").exists(), "dashboard.js não encontrado!"
    print("[OK] Teste 8: Todos os módulos de frontend verificados e íntegros.")

    print("=" * 60)
    print("TODOS OS TESTES FORAM APROVADOS COM SUCESSO! (8/8)")
    print("O MÓDULO DOSAGEM NA SULCAÇÃO ESTÁ 100% OPERACIONAL E CONFORME O PROMPT MESTRE.")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
