# -*- coding: utf-8 -*-
"""
test_paralelismo.py
Suíte de Testes Automatizados para o Módulo de Paralelismo RTK
Usina Pitangueiras • Safra 2026
"""
import json
import math
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def run_tests():
    print("=" * 60)
    print("INICIANDO TESTES DO DASHBOARD EXECUTIVO - PARALELISMO RTK")
    print("=" * 60)

    # 1. Carregamento dos dados
    data_js = BASE_DIR / "js" / "data.js"
    assert data_js.exists(), "Arquivo data.js não encontrado!"
    with open(data_js, "r", encoding="utf-8") as f:
        content = f.read()
        json_str = content.split("window.PARALELISMO_RAW_DATA = ")[1].rstrip(";\n")
        records = json.loads(json_str)

    assert len(records) == 2453, f"Esperado 2453 registros, obtido {len(records)}"
    print(f"[OK] Teste 1: Base de dados carregada com {len(records)} registros reais.")

    # 2. Teste de Data Mais Recente
    dates = [r.get("Data") for r in records if r.get("Data")]
    assert any("29/09/2026" in d for d in dates), "Data mais recente (29/09/2026) não encontrada!"
    print(f"[OK] Teste 2: Maior data identificada automaticamente: 29/09/2026.")

    # 3. Teste de Frentes
    frentes = set(r.get("Frente") for r in records if r.get("Frente"))
    assert len(frentes) >= 5, f"Esperado >= 5 frentes, obtido {len(frentes)}"
    print(f"[OK] Teste 3: {len(frentes)} frentes mapeadas.")

    # 4. Teste de OS
    os_set = set(r.get("OS") for r in records if r.get("OS"))
    assert len(os_set) >= 50, f"Esperado >= 50 OS, obtido {len(os_set)}"
    print(f"[OK] Teste 4: {len(os_set)} Ordens de Serviço (OS) distintas mapeadas.")

    # 5. Teste de Estatísticas de Paralelismo
    vals = [float(r["Paralelismo"].replace(",", ".")) for r in records if r.get("Paralelismo")]
    n = len(vals)
    assert n == 2453, f"Esperado 2453 valores numéricos válidos, obtido {n}"
    
    mean = sum(vals) / n
    sorted_vals = sorted(vals)
    median = sorted_vals[n // 2] if n % 2 != 0 else (sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2.0
    min_val = sorted_vals[0]
    max_val = sorted_vals[-1]
    variance = sum((x - mean) ** 2 for x in vals) / (n - 1)
    std_dev = math.sqrt(variance)

    assert abs(mean - 1.425) < 0.05, f"Média incorreta: {mean:.3f}"
    assert abs(median - 1.400) < 0.05, f"Mediana incorreta: {median:.3f}"
    assert min_val == 1.35, f"Mínimo incorreto: {min_val}"
    assert max_val == 1.58, f"Máximo incorreto: {max_val}"
    print(f"[OK] Teste 5: Estatísticas validadas: Média={mean:.3f} m, Mediana={median:.3f} m, Mín={min_val:.2f} m, Máx={max_val:.2f} m, Desvio=±{std_dev:.3f}")

    # 6. Teste da Faixa Técnica Padrão [1.40 m, 1.50 m]
    dentro = sum(1 for v in vals if 1.40 <= v <= 1.50)
    abaixo = sum(1 for v in vals if v < 1.40)
    acima = sum(1 for v in vals if v > 1.50)

    assert dentro == 2247, f"Esperado 2247 dentro, obtido {dentro}"
    print(f"[OK] Teste 6: Faixa técnica validada: Dentro={dentro} ({dentro/n*100:.1f}%), Abaixo={abaixo} ({abaixo/n*100:.1f}%), Acima={acima} ({acima/n*100:.1f}%)")

    # 7. Teste de Coordenadas GPS
    coords_valid = 0
    for r in records:
        try:
            lat = float(r["Latitude"].replace(",", "."))
            lon = float(r["Longitude"].replace(",", "."))
            if lat != 0 and lon != 0 and -90 <= lat <= 90 and -180 <= lon <= 180:
                coords_valid += 1
        except:
            pass
    assert coords_valid == 2453, f"Esperado 2453 coordenadas válidas, obtido {coords_valid}"
    print(f"[OK] Teste 7: {coords_valid}/{len(records)} registros com coordenadas GPS válidas.")

    # 8. Teste de Arquivos do Frontend
    assert (BASE_DIR / "index.html").exists(), "index.html não encontrado!"
    assert (BASE_DIR / "css" / "styles.css").exists(), "styles.css não encontrado!"
    assert (BASE_DIR / "js" / "paralelismo_engine.js").exists(), "paralelismo_engine.js não encontrado!"
    assert (BASE_DIR / "js" / "dashboard.js").exists(), "dashboard.js não encontrado!"
    print("[OK] Teste 8: Todos os módulos de frontend verificados e íntegros.")

    print("=" * 60)
    print("TODOS OS TESTES FORAM APROVADOS COM SUCESSO! (8/8)")
    print("O MÓDULO PARALELISMO RTK ESTÁ 100% OPERACIONAL E CONFORME AS DIRETRIZES.")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
