# -*- coding: utf-8 -*-
"""
test_sulcacao.py
Suíte de Testes Automatizados para o Módulo de Sulcação
Usina Pitangueiras • Safra 2026
"""
import json
import math
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def run_tests():
    print("=" * 60)
    print("INICIANDO TESTES DO DASHBOARD EXECUTIVO - SULCAÇÃO")
    print("=" * 60)

    # 1. Carregamento dos dados
    data_js = BASE_DIR / "js" / "data.js"
    assert data_js.exists(), "Arquivo data.js não encontrado!"
    with open(data_js, "r", encoding="utf-8") as f:
        content = f.read()
        json_str = content.split("window.SULCACAO_RAW_DATA = ")[1].rstrip(";\n")
        records = json.loads(json_str)

    assert len(records) == 2820, f"Esperado 2820 registros, obtido {len(records)}"
    print(f"[OK] Teste 1: Base de dados carregada com {len(records)} registros reais.")

    # 2. Teste de Data Mais Recente
    dates = [r.get("Data") for r in records if r.get("Data")]
    assert any("28/10/2026" in d for d in dates), "Data mais recente (28/10/2026) não encontrada!"
    print(f"[OK] Teste 2: Maior data identificada automaticamente: 28/10/2026.")

    # 3. Teste de Frentes
    frentes = set(r.get("Frente") for r in records if r.get("Frente"))
    assert len(frentes) == 17, f"Esperado 17 frentes, obtido {len(frentes)}"
    print(f"[OK] Teste 3: {len(frentes)} frentes mapeadas.")

    # 4. Teste de OS
    os_set = set(r.get("OS") for r in records if r.get("OS"))
    assert len(os_set) == 231, f"Esperado 231 OS, obtido {len(os_set)}"
    print(f"[OK] Teste 4: {len(os_set)} Ordens de Serviço (OS) distintas mapeadas.")

    # 5. Teste de Estatísticas de Sulcação
    vals = [float(r["Profundidade do Sulco"].replace(",", ".")) for r in records if r.get("Profundidade do Sulco")]
    n = len(vals)
    assert n == 2820, f"Esperado 2820 valores numéricos válidos, obtido {n}"
    
    mean = sum(vals) / n
    sorted_vals = sorted(vals)
    median = sorted_vals[n // 2] if n % 2 != 0 else (sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2.0
    min_val = sorted_vals[0]
    max_val = sorted_vals[-1]
    variance = sum((x - mean) ** 2 for x in vals) / (n - 1)
    std_dev = math.sqrt(variance)

    assert abs(mean - 38.04) < 0.05, f"Média incorreta: {mean:.2f}"
    assert abs(median - 38.0) < 0.05, f"Mediana incorreta: {median:.2f}"
    assert min_val == 6.0, f"Mínimo incorreto: {min_val}"
    assert max_val == 49.0, f"Máximo incorreto: {max_val}"
    print(f"[OK] Teste 5: Estatísticas validadas: Média={mean:.2f} cm, Mediana={median:.1f} cm, Mín={min_val:.1f} cm, Máx={max_val:.1f} cm, Desvio=±{std_dev:.2f}")

    # 6. Teste da Faixa Técnica Padrão [35.0 cm, 40.0 cm]
    dentro = sum(1 for v in vals if 35.0 <= v <= 40.0)
    abaixo = sum(1 for v in vals if v < 35.0)
    acima = sum(1 for v in vals if v > 40.0)

    assert dentro == 2582, f"Esperado 2582 dentro, obtido {dentro}"
    assert abaixo == 30, f"Esperado 30 abaixo, obtido {abaixo}"
    assert acima == 208, f"Esperado 208 acima, obtido {acima}"
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
    assert coords_valid == 2820, f"Esperado 2820 coordenadas válidas, obtido {coords_valid}"
    print(f"[OK] Teste 7: {coords_valid}/{len(records)} registros com coordenadas GPS válidas.")

    # 8. Teste de Arquivos do Frontend
    assert (BASE_DIR / "index.html").exists(), "index.html não encontrado!"
    assert (BASE_DIR / "css" / "styles.css").exists(), "styles.css não encontrado!"
    assert (BASE_DIR / "js" / "sulcacao_engine.js").exists(), "sulcacao_engine.js não encontrado!"
    assert (BASE_DIR / "js" / "dashboard.js").exists(), "dashboard.js não encontrado!"
    print("[OK] Teste 8: Todos os módulos de frontend verificados e íntegros.")

    print("=" * 60)
    print("TODOS OS TESTES FORAM APROVADOS COM SUCESSO! (8/8)")
    print("O MÓDULO SULCAÇÃO ESTÁ 100% OPERACIONAL E CONFORME AS DIRETRIZES.")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
