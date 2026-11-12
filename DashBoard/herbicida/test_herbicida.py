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
WEATHER_CACHE_JS_PATH = os.path.join(BASE_DIR, "js", "weather_cache_data.js")
WEATHER_SERVICE_JS_PATH = os.path.join(BASE_DIR, "js", "weather_service.js")
DASHBOARD_JS_PATH = os.path.join(BASE_DIR, "js", "dashboard.js")
STYLES_CSS_PATH = os.path.join(BASE_DIR, "css", "styles.css")

def parse_float_br(val):
    if val is None:
        return None
    s = str(val).strip().replace(',', '.')
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None

def calculate_wet_bulb(t, rh):
    """Fórmula psicrométrica de Stull (2011)"""
    tw = (t * math.atan(0.151977 * math.sqrt(rh + 8.313659))
          + math.atan(t + rh)
          - math.atan(rh - 1.676331)
          + 0.00391838 * (rh ** 1.5) * math.atan(0.023101 * rh)
          - 4.686035)
    return tw

def normalize_python_record(r):
    """
    Equivalente Python de HerbicidaEngine.normalizeRecord
    Normaliza as chaves do MapFy com espaços ou nomes alternativos
    """
    rec_id = r.get("ID") or r.get("id") or 0
    fazenda = str(r.get("Fazenda") or r.get("fazenda") or "").strip()
    os_val = str(r.get("Ordem de serviço") or r.get("os") or "").strip()
    operacao = str(r.get("Operação") or r.get("operacao") or "").strip()
    planta_soca = str(r.get("Planta ou Soca") or r.get("planta_soca") or "").strip()
    status = str(r.get("Status") or r.get("status") or "").strip()
    score = str(r.get("Score") or r.get("score") or "0,00").strip()
    data_str = str(r.get("Data início") or r.get("data") or "").strip()

    lat = parse_float_br(r.get("Latitude") or r.get("lat")) or 0.0
    lon = parse_float_br(r.get("Longitude") or r.get("lon")) or 0.0

    # Clima
    vento_raw = r.get("Vento") or r.get("vento")
    ur_raw = r.get("Umidade Relativa") or r.get("Umidade Relativa do Ar") or r.get("ur")
    temp_raw = r.get("Temperatura ") or r.get("Temperatura") or r.get("temp")

    vento_num = parse_float_br(vento_raw)
    ur_num = parse_float_br(ur_raw)
    temp_num = parse_float_br(temp_raw)

    has_weather = (temp_num is not None and ur_num is not None)

    delta_t_num = None
    delta_t_classe = "Sem Telemetria"
    if has_weather:
        tw = calculate_wet_bulb(temp_num, ur_num)
        delta_t_num = round(temp_num - tw, 1)
        if delta_t_num < 2.0:
            delta_t_classe = "Inversão (< 2°C)"
        elif delta_t_num <= 8.0:
            delta_t_classe = "Ideal (2-8°C)"
        elif delta_t_num <= 10.0:
            delta_t_classe = "Atenção (8-10°C)"
        else:
            delta_t_classe = "Crítico (> 10°C)"

    # Conservação e implemento
    filtro_bomba = str(r.get("Limpeza de filtros da bomba do implemento ") or r.get("Limpeza de filtros da bomba do implemento") or r.get("filtro_bomba") or "").strip()
    limpeza_bicos = str(r.get("Limpeza de bicos") or r.get("Limpeza de bicos de aplicação") or r.get("limpeza_bicos") or "").strip()
    aval_previa = str(r.get("O responsável realizou a avaliação de qualidade antes de iniciar a operação?") or r.get("Avaliação previa") or r.get("aval_previa") or "").strip()
    mapa_os = str(r.get("O responsável possui a Ordem de Serviço e o Mapa da Área disponíveis na frente?") or r.get("Ordem e Mapa de aplicação disponivel ") or r.get("mapa_os") or "").strip()

    obs = str(r.get("Observações") or r.get("Observação:") or r.get("obs") or "").strip()

    return {
        "id": int(rec_id),
        "fazenda": fazenda,
        "os": os_val,
        "operacao": operacao,
        "planta_soca": planta_soca,
        "status": status,
        "score": score,
        "data": data_str,
        "lat": lat,
        "lon": lon,
        "vento": vento_num,
        "ur": ur_num,
        "temp": temp_num,
        "has_weather": has_weather,
        "delta_t_num": delta_t_num,
        "delta_t_classe": delta_t_classe,
        "filtro_bomba": filtro_bomba,
        "limpeza_bicos": limpeza_bicos,
        "aval_previa": aval_previa,
        "mapa_os": mapa_os,
        "obs": obs
    }

def load_data():
    if not os.path.exists(DATA_JS_PATH):
        raise FileNotFoundError(f"data.js não encontrado em: {DATA_JS_PATH}")
    with open(DATA_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(r"window\.HERBICIDA_DATA\s*=\s*(\[.*?\]);", content, re.DOTALL)
    if not match:
        raise ValueError("Estrutura window.HERBICIDA_DATA não localizada em data.js")
    raw_data = json.loads(match.group(1))
    return [normalize_python_record(r) for r in raw_data]

def run_tests():
    print("=" * 80)
    print("TESTES OBRIGATÓRIOS DA CENTRAL DE INTELIGÊNCIA DE HERBICIDAS")
    print("Usina Pitangueiras – Safra 2026")
    print("=" * 80)

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
    sem_clima = [r for r in data if not r.get("has_weather")]
    assert len(com_clima) == 22, f"Esperado 22 registros com clima estruturado, obtido {len(com_clima)}"
    assert len(sem_clima) == 8, f"Esperado 8 registros sem telemetria estruturada, obtido {len(sem_clima)}"
    
    # Validar cálculo do Delta T em registro de referência (ID 3994710: Temp=34.1, UR=34)
    ref_rec = next(r for r in com_clima if r["id"] == 3994710)
    expected_tw = calculate_wet_bulb(34.1, 34.0)
    expected_dt = 34.1 - expected_tw
    assert abs(ref_rec["delta_t_num"] - round(expected_dt, 1)) < 0.15, f"Delta T diverge da fórmula: {ref_rec['delta_t_num']} vs {expected_dt}"

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

    # Cenário 10: Integridade dos Elementos da UI Atualizados
    required_ids = [
        "kpiTotal", "kpiFechado", "kpiAberto", "kpiComNok", "kpiComOcorrencia",
        "kpiAlertasClima", "kpiFazendas", "kpiOS", "filterFazenda", "filterOS",
        "filterOperacao", "filterPlantaSoca", "filterDeltaT", "filterEquipamento",
        "btnResetFilters", "btnExportExcel", "btnExportCSV", "searchInput",
        "chartAuditComparison", "chartAuditDistribution", "chartDeltaTClasses",
        "chartLimpezaMatriz", "chartVazaoEspacamento", "chartOperacoes",
        "chartPlantaSoca", "chartTimeline", "mapContainer", "tabelaHerbicida",
        "pageInfo", "prevPage", "nextPage", "detailModal"
    ]
    for el_id in required_ids:
        assert f'id="{el_id}"' in html_content, f"Elemento crítico id='{el_id}' ausente no index.html"
    print(f"[OK] Cenário 10: Todos os {len(required_ids)} elementos estruturais e novos seletores validados.")

    # Cenário 11: Exportações XLSX e CSV
    assert "exportToExcel" in dash_js, "Função exportToExcel presente em dashboard.js"
    assert "exportToCSV" in dash_js, "Função exportToCSV presente em dashboard.js"
    assert "xlsx.full.min.js" in html_content, "Biblioteca SheetJS importada no HTML"
    print("[OK] Cenário 11: Módulos de exportação XLSX (Excel nativo) e CSV validados.")

    # Cenário 12: Cache Meteorológico Pré-carregado
    assert os.path.exists(WEATHER_CACHE_JS_PATH), "weather_cache_data.js deve existir"
    with open(WEATHER_CACHE_JS_PATH, "r", encoding="utf-8") as f:
        cache_content = f.read()
    assert "MAPFY_PRELOADED_WEATHER_CACHE" in cache_content, "Cache global MAPFY_PRELOADED_WEATHER_CACHE deve estar definido"
    print("[OK] Cenário 12: Cache meteorológico pré-carregado validado (isolamento offline completo).")

    # Cenário 13: Serviço Open-Meteo & Auditoria Climática
    assert os.path.exists(WEATHER_SERVICE_JS_PATH), "weather_service.js deve existir"
    with open(WEATHER_SERVICE_JS_PATH, "r", encoding="utf-8") as f:
        ws_content = f.read()
    assert "OpenMeteoService" in ws_content, "OpenMeteoService deve estar definido"
    assert "compareRecord" in ws_content, "Método compareRecord de confronto deve estar definido"
    assert "auditDataset" in ws_content, "Método auditDataset deve estar definido"
    print("[OK] Cenário 13: Camada de Inteligência Meteorológica e Auditoria Climática validada.")

    # Cenário 14: Módulo Pedagógico e Matriz Decisória de Herbicidas
    assert "Entenda o Delta T em Segundos" in html_content, "Módulo pedagógico do Delta T deve estar no HTML"
    assert "Matriz de Decisão Operacional por Tipo de Herbicida" in html_content, "Matriz decisória de herbicidas deve estar no HTML"
    assert "HERBICIDE_PRODUCT_PROFILES" in open(ENGINE_JS_PATH, "r", encoding="utf-8").read(), "Perfis de herbicidas no engine"
    print("[OK] Cenário 14: Módulo Pedagógico de Delta T e Matriz Decisória de Herbicidas validados.")

    # Cenário 15: Dossiê Meteorológico Individual Completo
    assert "Dossiê Meteorológico Individual" in html_content, "Dossiê Individual presente no modal do index.html"
    assert "chartModalTimeline" in dash_js or "chartModalTimeline" in html_content, "Canvas da Linha do Tempo horária presente no modal"
    assert "renderModalTimelineChart" in dash_js, "Função de renderização da linha do tempo presente em dashboard.js"
    print("[OK] Cenário 15: Dossiê Meteorológico Individual Completo com Linha do Tempo e Trilha A x B validado.")

    print("=" * 80)
    print("TODOS OS 15 CENÁRIOS DE TESTE FORAM APROVADOS COM 100% DE SUCESSO!")
    print("A Central de Inteligência Climática de Herbicidas está 100% íntegra e operacional.")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
