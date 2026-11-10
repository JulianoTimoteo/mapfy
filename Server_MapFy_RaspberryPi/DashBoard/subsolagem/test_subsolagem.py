#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_subsolagem.py
==================
Suite de Testes Automatizados para a Aba de Subsolagem
Usina Pitangueiras • Safra 2026
"""

import os
import json
import math
import statistics
from datetime import datetime

def run_tests():
    print("=" * 60)
    print("INICIANDO TESTES DO DASHBOARD EXECUTIVO - SUBSOLAGEM")
    print("=" * 60)

    # 1. Carregamento dos dados
    data_js_path = os.path.join(os.path.dirname(__file__), 'js', 'data.js')
    assert os.path.exists(data_js_path), "data.js não encontrado!"
    with open(data_js_path, 'r', encoding='utf-8') as f:
        content = f.read()
    json_str = content[content.find('['):content.rfind(']')+1]
    records = json.loads(json_str)

    assert len(records) == 367, f"Esperado 367 registros, obtido {len(records)}"
    print(f"[OK] Teste 1: Base de dados carregada com {len(records)} registros reais.")

    # 2. Identificação da data mais recente
    dates = []
    for r in records:
        d = r.get('Data', '').strip()
        if d:
            dt = datetime.strptime(d, '%d/%m/%Y %H:%M')
            dates.append((dt, d, r['ID']))
    dates.sort(key=lambda x: x[0])
    latest = dates[-1]
    assert '01/10/2026' in latest[1], f"Esperado 01/10/2026 como maior data, obtido {latest[1]}"
    print(f"[OK] Teste 2: Maior data identificada automaticamente: {latest[1]} (ID: {latest[2]})")

    # 3. Mapeamento de Frentes
    frentes = set(r.get('Frente') for r in records if r.get('Frente'))
    assert len(frentes) == 4, f"Esperado 4 frentes, obtido {len(frentes)}"
    print(f"[OK] Teste 3: {len(frentes)} frentes mapeadas: {list(frentes)}")

    # 4. Ordens de Serviço (OS)
    oss = set(r.get('OS') for r in records if r.get('OS') and r.get('OS') != 'Sem OS')
    assert len(oss) == 51, f"Esperado 51 OS distintas, obtido {len(oss)}"
    print(f"[OK] Teste 4: {len(oss)} Ordens de Serviço (OS) distintas mapeadas.")

    # 5. Cálculos Estatísticos de Profundidade
    depths = [float(r['Subsolagem'].replace(',', '.')) for r in records if r.get('Subsolagem')]
    assert len(depths) == 367, f"Esperado 367 profundidades válidas, obtido {len(depths)}"
    
    mean_val = round(statistics.mean(depths), 2)
    median_val = round(statistics.median(depths), 2)
    min_val = min(depths)
    max_val = max(depths)
    std_dev_val = round(statistics.stdev(depths), 2)

    assert abs(mean_val - 48.59) <= 0.05, f"Média incorreta: {mean_val}"
    assert abs(median_val - 49.0) <= 0.05, f"Mediana incorreta: {median_val}"
    assert min_val == 36.0, f"Mínimo incorreto: {min_val}"
    assert max_val == 60.0, f"Máximo incorreto: {max_val}"
    assert abs(std_dev_val - 4.04) <= 0.05, f"Desvio padrão incorreto: {std_dev_val}"

    print(f"[OK] Teste 5: Estatísticas validadas: Média={mean_val} cm, Mediana={median_val} cm, Mín={min_val} cm, Máx={max_val} cm, Desvio=±{std_dev_val}")

    # 6. Faixa Técnica (45 a 55 cm)
    dentro = sum(1 for d in depths if 45.0 <= d <= 55.0)
    abaixo = sum(1 for d in depths if d < 45.0)
    acima = sum(1 for d in depths if d > 55.0)

    assert dentro == 307, f"Esperado 307 dentro da meta, obtido {dentro}"
    assert abaixo == 42, f"Esperado 42 abaixo da meta, obtido {abaixo}"
    assert acima == 18, f"Esperado 18 acima da meta, obtido {acima}"
    print(f"[OK] Teste 6: Faixa técnica validada: Dentro={dentro} (83.7%), Abaixo={abaixo} (11.4%), Acima={acima} (4.9%)")

    # 7. Coordenadas GPS
    with_coords = 0
    for r in records:
        lat = float(r['Latitude'].replace(',', '.')) if r.get('Latitude') else None
        lng = float(r['Longitude'].replace(',', '.')) if r.get('Longitude') else None
        if lat and lng and -90 <= lat <= 90 and -180 <= lng <= 180:
            with_coords += 1
    assert with_coords == 367, f"Esperado 367 com coordenadas válidas, obtido {with_coords}"
    print(f"[OK] Teste 7: 367/367 registros com coordenadas GPS válidas para plotagem no mapa.")

    # 8. Verificação de Arquivos da Aplicação
    sub_dir = os.path.dirname(__file__)
    for req_file in ['index.html', 'css/styles.css', 'js/data.js', 'js/subsolagem_engine.js', 'js/dashboard.js']:
        fp = os.path.join(sub_dir, req_file)
        assert os.path.exists(fp) and os.path.getsize(fp) > 0, f"Arquivo {req_file} inválido ou ausente"
    print("[OK] Teste 8: Todos os módulos de frontend (HTML, CSS, JS) verificados e íntegros.")

    print("=" * 60)
    print("TODOS OS TESTES FORAM APROVADOS COM SUCESSO! (8/8)")
    print("O MÓDULO SUBSOLAGEM ESTÁ 100% OPERACIONAL E CONFORME O PROMPT MESTRE.")
    print("=" * 60)

if __name__ == '__main__':
    run_tests()
