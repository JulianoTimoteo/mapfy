# -*- coding: utf-8 -*-
"""
test_arremate.py
Bateria de Testes Automatizados para Plantio - 13 - Arremate e Acabamento
Usina Pitangueiras - Safra 2026
"""

import os
import json
import re
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_JS_PATH = os.path.join(BASE_DIR, "js", "data.js")
INDEX_HTML_PATH = os.path.join(BASE_DIR, "index.html")
ENGINE_JS_PATH = os.path.join(BASE_DIR, "js", "arremate_engine.js")
DASHBOARD_JS_PATH = os.path.join(BASE_DIR, "js", "dashboard.js")
STYLES_CSS_PATH = os.path.join(BASE_DIR, "css", "styles.css")

def load_data():
    if not os.path.exists(DATA_JS_PATH):
        raise FileNotFoundError(f"data.js não encontrado em: {DATA_JS_PATH}")
    with open(DATA_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(r"window\.ARREMATE(?:_ACABAMENTO)?_DATA\s*=\s*(\[.*?\]);", content, re.DOTALL)
    if not match:
        raise ValueError("Estrutura window.ARREMATE_DATA não localizada em data.js")
    return json.loads(match.group(1))

def run_tests():
    print("=" * 75)
    print("TESTES OBRIGATÓRIOS DO DASHBOARD DE ARREMATE E ACABAMENTO")
    print("Usina Pitangueiras – Safra 2026")
    print("=" * 75)

    data = load_data()
    total = len(data)
    print(f"Base Real Carregada: {total} registros de Arremate e Acabamento.")
    assert total == 807, f"Esperado exatamente 807 registros reais, encontrado {total}"
    print("[OK] Cenário 1: Carga da base real de 807 registros confirmada.")

    # Cenário 2: Validação semântica de 100% BOM
    classifications = [r.get("arremate_norm") or r.get("arremate_orig") for r in data]
    bom_count = sum(1 for c in classifications if c == "BOM")
    assert bom_count == 807, f"Todos os 807 registros devem ter Arremate e Acabamento == 'BOM', encontrado {bom_count}"
    assert bom_count / total == 1.0, "Taxa de conformidade de Arremate e Acabamento deve ser exatamente 100.0%"
    print("[OK] Cenário 2: Validação semântica e fidelidade - 100% (807/807) dos registros avaliados como 'BOM'.")

    # Cenário 3: Diagnóstico do Score e Transição Sistêmica em Agosto/2026
    score_10 = [r for r in data if r.get("score_num") == 10.0 or r.get("score") == "10,00"]
    score_0 = [r for r in data if r.get("score_num") == 0.0 or r.get("score") == "0,00"]
    assert len(score_10) == 84, f"Esperado 84 registros com Score 10.00 (Agosto a Outubro), obtido {len(score_10)}"
    assert len(score_0) == 723, f"Esperado 723 registros com Score 0.00 (Janeiro a Maio), obtido {len(score_0)}"
    assert len(score_10) + len(score_0) == 807, "A soma das duas fases de score deve totalizar exatamente 807 registros"

    for r in score_10:
        assert r["score_perc_num"] == 100 or r["score_perc"] == "100%", f"Score perc inválido para score 10.0, registro {r['id']}"
        assert r["score_desc"] == "Bom", f"Score desc deve ser 'Bom', registro {r['id']}"
    for r in score_0:
        assert r["score_perc_num"] == 0 or r["score_perc"] == "0%", f"Score perc inválido para score 0.0, registro {r['id']}"
        assert r["score_desc"] == "Baixo", f"Score desc deve ser 'Baixo', registro {r['id']}"
    print(f"[OK] Cenário 3: Investigação de Score validada: 723 registros (89,59%) na Fase 1 (Score 0) e 84 (10,41%) na Fase 2 (Score 10).")

    # Cenário 4: Integridade de Coordenadas Geográficas (100% válidas)
    valid_coords = 0
    for r in data:
        lat = r.get("lat")
        lon = r.get("lon")
        assert lat is not None and lon is not None, f"Registro {r['id']} sem coordenadas"
        assert -22.0 <= lat <= -20.0, f"Latitude {lat} fora da região de Pitangueiras no registro {r['id']}"
        assert -49.0 <= lon <= -47.0, f"Longitude {lon} fora da região de Pitangueiras no registro {r['id']}"
        valid_coords += 1
    assert valid_coords == 807, "100% dos registros devem possuir coordenadas válidas"
    print(f"[OK] Cenário 4: Georreferenciamento auditado com sucesso (807/807 pontos com GPS válido).")

    # Cenário 5: Unicidade dos IDs e Ausência de Duplicatas
    ids = [r["id"] for r in data]
    assert len(ids) == len(set(ids)), f"IDs duplicados detectados: {len(ids)} vs {len(set(ids))}"
    print(f"[OK] Cenário 5: Chave primária consistente - 807 IDs únicos verificados.")

    # Cenário 6: Período Temporal de Inspeções
    datas_dt = []
    for r in data:
        try:
            dt = datetime.strptime(r["data"], "%d/%m/%Y %H:%M")
            datas_dt.append(dt)
        except Exception as e:
            raise ValueError(f"Formato de data inválido no registro {r['id']}: {r['data']}")
    assert len(datas_dt) == 807
    min_data = min(datas_dt)
    max_data = max(datas_dt)
    assert min_data.strftime("%d/%m/%Y") == "12/01/2026", f"Data mínima inesperada: {min_data}"
    assert max_data.strftime("%d/%m/%Y") == "28/10/2026", f"Data máxima inesperada: {max_data}"
    print(f"[OK] Cenário 6: Janela cronológica auditada: de {min_data.strftime('%d/%m/%Y %H:%M')} até {max_data.strftime('%d/%m/%Y %H:%M')}.")

    # Cenário 7: Status das Inspeções (100% 'Aberto' do MapFy)
    status_counts = {}
    for r in data:
        st = r.get("status")
        status_counts[st] = status_counts.get(st, 0) + 1
    assert status_counts.get("Aberto") == 807, f"Esperado 807 com status Aberto, obtido {status_counts}"
    print(f"[OK] Cenário 7: Status auditado: 100% 'Aberto' (status padrão do sincronismo móvel MapFy).")

    # Cenário 8: Verificação Estrita de Navegação no HTML (Regra de Ouro)
    with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
        html_content = f.read()

    # Deve possuir o botão de retorno ao Mandala Hub
    assert 'href="../index.html"' in html_content, "index.html deve conter o link de retorno para '../index.html'"
    assert "Mandala Hub" in html_content, "index.html deve conter o texto 'Mandala Hub'"

    # PROIBIDO: links cruzados para outras abas de plantio
    forbidden_nav_patterns = [
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
        r'href=["\']\.\./area_vivencia'
    ]
    for pattern in forbidden_nav_patterns:
        match = re.search(pattern, html_content, re.IGNORECASE)
        assert not match, f"Violação da Regra Estrita de Navegação! Detectado link cruzado com padrão: {pattern}"
    print("[OK] Cenário 8: Regra Estrita de Navegação validada (apenas retorno ao Mandala Hub, sem links cruzados).")

    # Cenário 9: Provedor de Mapa Livre (OpenStreetMap sem água de Carto)
    with open(DASHBOARD_JS_PATH, "r", encoding="utf-8") as f:
        dash_js_content = f.read()

    assert "tile.openstreetmap.org" in dash_js_content, "Tile layer deve apontar para OpenStreetMap oficial"
    # Proibição absoluta de basemaps Carto que geram marcas d'água 'API KEY REQUIRED'
    assert "cartocdn.com" not in dash_js_content.lower(), "Carto basemaps proibido em dashboard.js"
    assert "carto.com" not in dash_js_content.lower(), "Carto basemaps proibido em dashboard.js"
    print("[OK] Cenário 9: Provedor de Mapa verificado (OpenStreetMap 100% livre, zero marcas d'água de API KEY).")

    # Cenário 10: Integridade dos Elementos Críticos da UI
    required_ids = [
        "kpiTotalRegistros", "kpiPeriodoAmostral", "kpiBomCount", "kpiConformidadePerc",
        "kpiOutrasCount", "kpiScoreMedia", "kpiScorePercMedia", "kpiFrentesCount",
        "kpiTalhoesOS", "kpiResponsaveisCount", "kpiScoreDivergente", "kpiGeorrefPerc",
        "filterFrente", "filterOS", "filterLocal", "filterResponsavel", "filterFaseScore",
        "btnResetFilters", "btnExportExcel", "btnExportCSV", "tableSearchInput",
        "chartConformidadeDonut", "chartClassificacaoBars", "chartTimeline",
        "chartFrentes", "chartOS", "chartLocais", "chartResponsaveis",
        "chartHourly", "chartScorePhase", "map-container",
        "tableBody", "tableInfo", "paginationControls", "detailsModal"
    ]
    for el_id in required_ids:
        assert f'id="{el_id}"' in html_content, f"Elemento crítico id='{el_id}' ausente no index.html"
    print(f"[OK] Cenário 10: Todos os {len(required_ids)} elementos estruturais e seletores da UI validados.")

    # Cenário 11: Exportações XLSX e CSV
    assert "exportToExcel" in dash_js_content or "exportToXLSX" in dash_js_content, "Função exportToExcel/XLSX deve estar presente em dashboard.js"
    assert "exportToCSV" in dash_js_content, "Função exportToCSV deve estar presente em dashboard.js"
    assert "xlsx.full.min.js" in html_content, "Biblioteca SheetJS deve ser importada no index.html"
    print("[OK] Cenário 11: Módulos de exportação XLSX (Excel nativo) e CSV validados.")

    print("=" * 75)
    print("TODOS OS 11 CENÁRIOS DE TESTE FORAM APROVADOS COM SUCESSO!")
    print("=" * 75)

if __name__ == "__main__":
    run_tests()
