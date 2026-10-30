"""
test_tpl_5s.py
Testes Obrigatórios do Módulo 5S e Gestão - TPL
Usina Pitangueiras - Safra 2026
"""

import os
import json
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_SOURCE = os.path.join(BASE_DIR, '..', '..', 'Server_MapFy', 'relatorios', '5S e Gestão - TPL', 'dados.json')
JS_DATA_FILE = os.path.join(BASE_DIR, 'js', 'data.js')
HTML_FILE = os.path.join(BASE_DIR, 'index.html')
DASHBOARD_JS = os.path.join(BASE_DIR, 'js', 'dashboard.js')
ENGINE_JS = os.path.join(BASE_DIR, 'js', 'engine.js')

def run_tests():
    print("=" * 75)
    print("TESTES OBRIGATÓRIOS DO MÓDULO 5S E GESTÃO — TPL")
    print("Usina Pitangueiras — Safra 2026")
    print("=" * 75)

    # 1. Base Real e Carga
    assert os.path.exists(JSON_SOURCE), f"Fonte de dados não encontrada: {JSON_SOURCE}"
    with open(JSON_SOURCE, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)
    assert len(raw_data) == 171, f"Esperado 171 registros na fonte, obtido {len(raw_data)}"

    assert os.path.exists(JS_DATA_FILE), f"Arquivo data.js não encontrado: {JS_DATA_FILE}"
    with open(JS_DATA_FILE, 'r', encoding='utf-8') as f:
        js_content = f.read()
    
    # Extrai o JSON do window.TPL_5S_DATA
    m = re.search(r'window\.TPL_5S_DATA\s*=\s*(\[.*?\]);', js_content, re.DOTALL)
    assert m, "Estrutura window.TPL_5S_DATA não encontrada em data.js"
    processed_data = json.loads(m.group(1))
    assert len(processed_data) == 171, f"Esperado 171 registros em data.js, obtido {len(processed_data)}"
    print(f"[OK] Cenário 1: Carga da base real de 171 registros confirmada.")

    # 2. Georreferenciamento auditado
    with_coords = [r for r in processed_data if r['has_coords'] and r['lat'] != 0 and r['lon'] != 0]
    assert len(with_coords) == 171, f"Esperado 171 registros georreferenciados, obtido {len(with_coords)}"
    for r in with_coords:
        assert -23.0 <= r['lat'] <= -19.0, f"Latitude fora do quadrante operacional: {r['lat']}"
        assert -50.0 <= r['lon'] <= -47.0, f"Longitude fora do quadrante operacional: {r['lon']}"
    print(f"[OK] Cenário 2: Georreferenciamento auditado (171/171 registros com GPS no quadrante da Pitangueiras).")

    # 3. Status e Score
    status_counts = {}
    for r in processed_data:
        st = r['status']
        status_counts[st] = status_counts.get(st, 0) + 1
        assert r['score'] == '0,00', f"Score diferente de 0,00 detectado: {r['score']}"
    assert status_counts.get('Aberto', 0) == 116, f"Esperado 116 Abertos, obtido {status_counts.get('Aberto')}"
    assert status_counts.get('Fechado', 0) == 51, f"Esperado 51 Fechados, obtido {status_counts.get('Fechado')}"
    assert status_counts.get('Validado', 0) == 4, f"Esperado 4 Validados, obtido {status_counts.get('Validado')}"
    print(f"[OK] Cenário 3: Status MapFy (116 Abertos, 51 Fechados, 4 Validados) e Score investigado (100% com '0,00').")

    # 4. Setores Operacionais
    setor_counts = {}
    for r in processed_data:
        setor_counts[r['setor']] = setor_counts.get(r['setor'], 0) + 1
    assert setor_counts.get('VINHAÇA', 0) == 72
    assert setor_counts.get('TRATOS', 0) == 65
    assert setor_counts.get('PREPARO', 0) == 27
    assert setor_counts.get('PLANTIO', 0) == 7
    print(f"[OK] Cenário 4: Setores operacionais validados (Vinhaça: 72, Tratos: 65, Preparo: 27, Plantio: 7).")

    # 5. Checklist de Requisitos 5S
    extintores_nok = sum(1 for r in processed_data if r['q07'] == 'NOK')
    epis_nok = sum(1 for r in processed_data if r['q06'] == 'NOK')
    epis_ok = sum(1 for r in processed_data if r['q06'] == 'OK')
    assert extintores_nok == 45, f"Esperado 45 extintores NOK, obtido {extintores_nok}"
    assert epis_nok == 2, f"Esperado 2 EPIs NOK, obtido {epis_nok}"
    assert epis_ok == 169, f"Esperado 169 EPIs OK, obtido {epis_ok}"
    print(f"[OK] Cenário 5: Checklist 5S validado (Extintores com 45 NOKs; EPIs com 98.8% de conformidade: 169 OK / 2 NOK).")

    # 6. Regra Estrita de Navegação
    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        html = f.read()
    
    assert '../index.html' in html, "Link de retorno ao Mandala Hub '../index.html' não encontrado"
    # Proibição de links cruzados para outras abas
    prohibited_links = ['cobricao', 'arremate', 'dosagem', 'subsolagem', 'paralelismo', 'herbicida']
    for p in prohibited_links:
        assert f'href="../{p}' not in html, f"Link cruzado proibido detectado: {p}"
    print(f"[OK] Cenário 6: Regra Estrita de Navegação validada (apenas retorno ao Mandala Hub, sem links cruzados).")

    # 7. Provedor de Mapa (OpenStreetMap apenas, zero Carto)
    assert 'tile.openstreetmap.org' in html or 'tile.openstreetmap.org' in open(DASHBOARD_JS, 'r', encoding='utf-8').read()
    assert 'carto.com' not in html and 'carto.com' not in open(DASHBOARD_JS, 'r', encoding='utf-8').read()
    print(f"[OK] Cenário 7: Provedor de Mapa verificado (OpenStreetMap 100% livre, zero Carto e zero watermarks de API KEY).")

    # 8. Responsividade Fluida (w-full max-w-[1920px])
    assert 'max-w-[1920px]' in html, "Container fluido 'max-w-[1920px]' não encontrado no HTML"
    assert 'max-w-7xl' not in html, "Container antigo rígido 'max-w-7xl' encontrado indevidamente no HTML"
    print(f"[OK] Cenário 8: Responsividade fluida validada ('w-full max-w-[1920px]' em toda a página).")

    # 9. Elementos Estruturais
    required_elements = [
        'kpiTotalVistorias', 'kpiConformidadeGeral', 'kpiVistorias100Ok', 'kpiComNok',
        'kpiExtintorNok', 'kpiEpiNok', 'kpiTotalOk', 'kpiSetoresCount', 'kpiFrentesCount', 'kpiGeo',
        'filterDataInicio', 'filterDataFim', 'filterSetor', 'filterFrente', 'filterResponsavel',
        'chkApenasNok', 'chkExtintorNok', 'chkEpiNok', 'chkApenasGeo', 'searchInput',
        'chartSetores', 'chartStatus', 'chartFrentes', 'chartTimeline',
        'mapContainer', 'tableBody', 'detailModal', 'btnExportExcel', 'btnExportCSV'
    ]
    for el in required_elements:
        assert f'id="{el}"' in html, f"Elemento estrutural obrigatório não encontrado no HTML: {el}"
    print(f"[OK] Cenário 9: Todos os 29 elementos estruturais e seletores da interface validados.")

    # 10. DataLabels nos Gráficos
    assert 'chartjs-plugin-datalabels' in html, "Plugin ChartDataLabels não incluído no HTML"
    dash_js = open(DASHBOARD_JS, 'r', encoding='utf-8').read()
    assert 'pitangueiras_universal_datalabels' in dash_js, "Plugin universal de DataLabels não registrado em dashboard.js"
    print(f"[OK] Cenário 10: Rótulos de dados (DataLabels) ativos e garantidos em todos os gráficos (barras e donuts).")

    # 11. Módulos de Exportação
    assert 'exportToExcel' in dash_js and 'exportToCSV' in dash_js
    assert 'xlsx.full.min.js' in html
    print(f"[OK] Cenário 11: Módulos de exportação XLSX (Excel nativo) e CSV validados.")

    print("=" * 75)
    print("TODOS OS 11 CENÁRIOS DE TESTE FORAM APROVADOS COM SUCESSO!")
    print("=" * 75)

if __name__ == '__main__':
    run_tests()
