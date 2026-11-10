# -*- coding: utf-8 -*-
"""
test_herbicida.py
Bateria de Testes Automatizados para a Central de Inteligência de Aplicação de Herbicidas
Usina Pitangueiras - Safra 2026
"""

import os
import json
import re
import math
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_JS_PATH = os.path.join(BASE_DIR, "js", "data.js")
INDEX_HTML_PATH = os.path.join(BASE_DIR, "index.html")
ENGINE_JS_PATH = os.path.join(BASE_DIR, "js", "herbicida_engine.js")
DASHBOARD_JS_PATH = os.path.join(BASE_DIR, "js", "dashboard.js")
STYLES_CSS_PATH = os.path.join(BASE_DIR, "css", "styles.css")

def load_data():
    if not os.path.exists(DATA_JS_PATH):
        raise FileNotFoundError(f"data.js não encontrado em: {DATA_JS_PATH}")
    with open(DATA_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(r"window\.HERBICIDA_DATA\s*=\s*(\[.*?\]);", content, re.DOTALL)
    if not match:
        raise ValueError("Estrutura window.HERBICIDA_DATA não localizada em data.js")
    return json.loads(match.group(1))

def calculate_wet_bulb(t, rh):
    tw = (t * math.atan(0.151977 * math.sqrt(rh + 8.313659))
          + math.atan(t + rh)
          - math.atan(rh - 1.676331)
          + 0.00391838 * (rh ** 1.5) * math.atan(0.023101 * rh)
          - 4.686035)
    return tw

def run_tests():
    print("=" * 75)
    print("TESTES OBRIGATÓRIOS DA CENTRAL DE INTELIGÊNCIA DE HERBICIDAS")
    print("Usina Pitangueiras – Safra 2026")
    print("=" * 75)

    data = load_data()
    total = len(data)
    print(f"Base Real Carregada: {total} registros de aplicação de defensivos.")
    assert total == 30, f"Esperado exatamente 30 registros reais, encontrado {total}"
    print("[OK] Cenário 1: Carga da base real de 30 registros confirmada.")

    # Cenário 2: Georreferenciamento (100% com coordenadas válidas)
    valid_coords = 0
    for r in data:
        lat = r.get("lat")
        lon = r.get("lon")
        assert lat is not None and lon is not None, f"Registro {r['id']} sem coordenadas"
        assert -22.0 <= lat <= -20.0, f"Latitude {lat} fora de Pitangueiras no registro {r['id']}"
        assert -49.0 <= lon <= -47.0, f"Longitude {lon} fora de Pitangueiras no registro {r['id']}"
        valid_coords += 1
    assert valid_coords == 30, "100% dos registros devem possuir coordenadas válidas"
    print("[OK] Cenário 2: Georreferenciamento auditado (30/30 registros com GPS em Pitangueiras).")

    # Cenário 3: Status MapFy e Score = 0,00
    fechados = sum(1 for r in data if r["status"] == "Fechado")
    abertos = sum(1 for r in data if r["status"] == "Aberto")
    assert fechados == 27, f"Esperado 27 Fechados, obtido {fechados}"
    assert abertos == 3, f"Esperado 3 Abertos, obtido {abertos}"
    for r in data:
        assert r["score"] == "0,00", f"Score deve ser '0,00', obtido {r['score']} no registro {r['id']}"
    print("[OK] Cenário 3: Status MapFy (27 Fechados, 3 Abertos) e Score investigado (30 com '0,00').")

    # Cenário 4: Meteorologia & Cálculo do Delta T
    com_clima = [r for r in data if r.get("has_weather")]
    assert len(com_clima) == 22, f"Esperado 22 registros com clima estruturado, obtido {len(com_clima)}"
    
    # Validar cálculo do Delta T em registro de referência (ID 3994710: Temp=34.1, UR=34)
    ref_rec = next(r for r in com_clima if r["id"] == 3994710)
    expected_tw = calculate_wet_bulb(34.1, 34.0)
    expected_dt = 34.1 - expected_tw
    assert abs(ref_rec["delta_t_num"] - expected_dt) < 0.05, f"Delta T diverge da fórmula: {ref_rec['delta_t_num']} vs {expected_dt}"

    ideal_count = sum(1 for r in com_clima if r["delta_t_classe"] == "Ideal (2-8°C)")
    atencao_count = sum(1 for r in com_clima if r["delta_t_classe"] == "Atenção (8-10°C)")
    critico_count = sum(1 for r in com_clima if r["delta_t_classe"] == "Crítico (> 10°C)")
    assert ideal_count == 13, f"Esperado 13 registros Ideais, obtido {ideal_count}"
    assert atencao_count == 3, f"Esperado 3 registros em Atenção, obtido {atencao_count}"
    assert critico_count == 6, f"Esperado 6 registros Críticos, obtido {critico_count}"
    print(f"[OK] Cenário 4: Meteorologia e Delta T validados (13 Ideais, 3 Atenção, 6 Críticos, 8 sem telemetria).")

    # Cenário 5: Frota de Equipamentos Identificados
    tratores_11225 = [r for r in data if "11225" in str(r.get("obs", ""))]
    tratores_11125 = [r for r in data if "11125" in str(r.get("obs", ""))]
    equip_70122 = [r for r in data if "70122" in str(r.get("obs", ""))]
    caminhao_31817 = [r for r in data if "31817" in str(r.get("obs", ""))]
    assert len(tratores_11225) == 5, f"Esperado 5 menções ao Trator 11225, obtido {len(tratores_11225)}"
    assert len(tratores_11125) == 4, f"Esperado 4 menções ao Trator 11125, obtido {len(tratores_11125)}"
    assert len(equip_70122) == 4, f"Esperado 4 menções ao Equipamento 70122, obtido {len(equip_70122)}"
    assert len(caminhao_31817) == 2, f"Esperado 2 menções ao Caminhão 31817, obtido {len(caminhao_31817)}"
    print("[OK] Cenário 5: Extração da Frota aprovada (Trator 11225: 5, Trator 11125: 4, Equip. 70122: 4, Caminhão 31817: 2).")

    # Cenário 6: Conservação de Filtros e Bicos
    filtro_ok = sum(1 for r in data if r["filtro_bomba"] == "OK")
    filtro_nok = sum(1 for r in data if r["filtro_bomba"] == "NOK")
    assert filtro_ok == 25 and filtro_nok == 5, f"Filtros: OK={filtro_ok}, NOK={filtro_nok}"

    bico_ok = sum(1 for r in data if r["limpeza_bicos"] == "OK")
    bico_nok = sum(1 for r in data if r["limpeza_bicos"] == "NOK")
    bico_na = sum(1 for r in data if "N / A" in r["limpeza_bicos"] or "N/A" in r["limpeza_bicos"])
    assert bico_ok == 25 and bico_nok == 4 and bico_na == 1, f"Bicos: OK={bico_ok}, NOK={bico_nok}, NA={bico_na}"
    print("[OK] Cenário 6: Conservação validada (Filtros: 25 OK / 5 NOK; Bicos: 25 OK / 4 NOK / 1 N/A).")

    # Cenário 7: Procedimentos Operacionais
    aval_ok = sum(1 for r in data if r["aval_previa"] == "OK")
    assert aval_ok == 30, f"Avaliação prévia deve ser 100% OK, obtido {aval_ok}"
    mapa_ok = sum(1 for r in data if r["mapa_os"] == "OK")
    mapa_nok = sum(1 for r in data if r["mapa_os"] == "NOK")
    assert mapa_ok == 27 and mapa_nok == 3, f"Mapa/OS: OK={mapa_ok}, NOK={mapa_nok}"
    print("[OK] Cenário 7: Procedimentos validados (Avaliação Prévia 100% OK; Mapa/OS 27 OK / 3 NOK).")

    # Cenário 8: Regra Estrita de Navegação no HTML
    with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
        html_content = f.read()

    assert 'href="../index.html"' in html_content, "index.html deve conter link de retorno para '../index.html'"
    assert "Mandala Hub" in html_content, "index.html deve conter o texto 'Mandala Hub'"

    forbidden_nav = [
        r'href=["\']\.\./subsolagem',
        r'href=["\']\.\./canteirizacao',
        r'href=["\']\.\./sulcacao',
        r'href=["\']\.\./dosagem_sulco',
        r'href=["\']\.\./abertura_asa',
        r'href=["\']\.\./paralelismo',
        r'href=["\']\.\./qualidade_muda',
        r'href=["\']\.\./viabilidade_gemas',
        r'href=["\']\.\./qualidade_cana',
        r'href=["\']\.\./dosagem_cobricao',
        r'href=["\']\.\./cobricao',
        r'href=["\']\.\./arremate_acabamento'
    ]
    for p in forbidden_nav:
        assert not re.search(p, html_content, re.IGNORECASE), f"Link cruzado proibido detectado: {p}"
    print("[OK] Cenário 8: Regra Estrita de Navegação validada (apenas retorno ao Mandala Hub, sem links cruzados).")

    # Cenário 9: Provedor de Mapa Livre (Zero Carto, Zero Watermarks)
    with open(DASHBOARD_JS_PATH, "r", encoding="utf-8") as f:
        dash_js = f.read()
    assert "tile.openstreetmap.org" in dash_js, "Deve utilizar OpenStreetMap oficial"
    assert "cartocdn.com" not in dash_js.lower(), "Carto basemaps proibido"
    assert "carto.com" not in dash_js.lower(), "Carto basemaps proibido"
    print("[OK] Cenário 9: Provedor de Mapa verificado (OpenStreetMap 100% livre, zero marcas d'água de API KEY).")

    # Cenário 10: Integridade dos Elementos da UI
    required_ids = [
        "kpiTotal", "kpiFechado", "kpiAberto", "kpiComNok", "kpiComOcorrencia",
        "kpiAlertasClima", "kpiFazendas", "kpiOS", "filterFazenda", "filterOS",
        "filterOperacao", "filterPlantaSoca", "filterDeltaT", "filterEquipamento",
        "btnResetFilters", "btnExportExcel", "btnExportCSV", "searchInput",
        "chartTempUrScatter", "chartVentoUrScatter", "chartDeltaTClasses",
        "chartLimpezaMatriz", "chartVazaoEspacamento", "chartOperacoes",
        "chartPlantaSoca", "chartTimeline", "mapContainer", "tabelaHerbicida",
        "pageInfo", "prevPage", "nextPage", "detailModal"
    ]
    for el_id in required_ids:
        assert f'id="{el_id}"' in html_content, f"Elemento crítico id='{el_id}' ausente no index.html"
    print(f"[OK] Cenário 10: Todos os {len(required_ids)} elementos estruturais e seletores validados.")

    # Cenário 11: Exportações XLSX e CSV
    assert "exportToExcel" in dash_js, "Função exportToExcel presente em dashboard.js"
    assert "exportToCSV" in dash_js, "Função exportToCSV presente em dashboard.js"
    assert "xlsx.full.min.js" in html_content, "Biblioteca SheetJS importada no HTML"
    print("[OK] Cenário 11: Módulos de exportação XLSX (Excel nativo) e CSV validados.")

    print("=" * 75)
    print("TODOS OS 11 CENÁRIOS DE TESTE FORAM APROVADOS COM SUCESSO!")
    print("=" * 75)

if __name__ == "__main__":
    run_tests()
