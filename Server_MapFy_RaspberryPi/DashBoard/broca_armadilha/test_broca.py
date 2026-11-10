# -*- coding: utf-8 -*-
"""
test_broca.py
Bateria de Testes Automatizados para Infestação de Broca - Armadilha
Usina Pitangueiras - Safra 2026
"""

import os
import json
import re
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_JS_PATH = os.path.join(BASE_DIR, "js", "data.js")
INDEX_HTML_PATH = os.path.join(BASE_DIR, "index.html")
ENGINE_JS_PATH = os.path.join(BASE_DIR, "js", "broca_engine.js")
DASHBOARD_JS_PATH = os.path.join(BASE_DIR, "js", "dashboard.js")
STYLES_CSS_PATH = os.path.join(BASE_DIR, "css", "styles.css")

def load_data():
    if not os.path.exists(DATA_JS_PATH):
        raise FileNotFoundError(f"data.js não encontrado em: {DATA_JS_PATH}")
    with open(DATA_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(r"window\.BROCA_ARMADILHA_DATA\s*=\s*(\[.*?\]);", content, re.DOTALL)
    if not match:
        raise ValueError("Estrutura window.BROCA_ARMADILHA_DATA não localizada em data.js")
    return json.loads(match.group(1))

def run_tests():
    print("=" * 75)
    print("TESTES OBRIGATÓRIOS DO MÓDULO DE INFESTAÇÃO DE BROCA (ARMADILHA)")
    print("Usina Pitangueiras – Safra 2026")
    print("=" * 75)

    data = load_data()
    total = len(data)
    print(f"Base Real Carregada: {total} lançamentos de armadilha.")
    assert total == 116, f"Esperado exatamente 116 registros reais, encontrado {total}"
    print("[OK] Cenário 1: Carga da base real de 116 lançamentos confirmada.")

    # Cenário 2: Soma de Quantidade de Capturas e Médias Entomológicas
    capturas_list = [r["machos"] for r in data]
    total_capturas = sum(capturas_list)
    assert total_capturas == 906, f"Esperado 906 brocas capturadas no total, obtido {total_capturas}"
    
    media_geral = total_capturas / total
    assert abs(media_geral - 7.8103) < 0.01, f"Média geral esperada ~7.81, obtido {media_geral:.2f}"
    
    recolhimentos = [r for r in data if r["etapa"] == "RECOLHIMENTO"]
    instalacoes = [r for r in data if r["etapa"] == "INSTALAÇÃO"]
    assert len(recolhimentos) == 57, f"Esperado 57 recolhimentos, obtido {len(recolhimentos)}"
    assert len(instalacoes) == 59, f"Esperado 59 instalações, obtido {len(instalacoes)}"
    
    media_recolh = total_capturas / len(recolhimentos)
    assert abs(media_recolh - 15.8947) < 0.01, f"Média por recolhimento esperada ~15.89, obtido {media_recolh:.2f}"
    
    positivos = [r for r in recolhimentos if r["machos"] > 0]
    assert len(positivos) == 48, f"Esperado 48 recolhimentos positivos, obtido {len(positivos)}"
    media_positivos = total_capturas / len(positivos)
    assert abs(media_positivos - 18.875) < 0.01, f"Média dos positivos esperada 18.88, obtido {media_positivos:.2f}"

    max_captura = max(capturas_list)
    assert max_captura == 50, f"Maior captura individual esperada 50, obtido {max_captura}"
    print(f"[OK] Cenário 2: Métricas entomológicas validadas (Total: {total_capturas} brocas, Média Leitura: {media_recolh:.2f}, Máx: {max_captura}).")

    # Cenário 3: Validação das Etapas do Ciclo e Registros Zerados
    for r in instalacoes:
        assert r["machos"] == 0, f"Instalação #{r['id']} deve ter 0 capturas, obtido {r['machos']}"
    
    zerados_total = sum(1 for r in data if r["machos"] == 0)
    assert zerados_total == 68, f"Esperado 68 zerados no total (59 instal + 9 recolh), obtido {zerados_total}"
    assert zerados_total / total == 68 / 116, "Percentual de zerados na base validado"
    print("[OK] Cenário 3: Ciclo biológico validado (59 instalações zeradas + 9 recolhimentos zerados = 68 registros zerados).")

    # Cenário 4: Georreferenciamento e Integridade Territorial
    valid_coords = 0
    for r in data:
        lat = r.get("lat")
        lon = r.get("lon")
        assert lat is not None and lon is not None, f"Registro #{r['id']} sem coordenadas"
        assert -22.0 <= lat <= -20.0, f"Latitude {lat} fora da região de Pitangueiras no registro #{r['id']}"
        assert -49.0 <= lon <= -47.0, f"Longitude {lon} fora da região de Pitangueiras no registro #{r['id']}"
        valid_coords += 1
    assert valid_coords == 116, "100% dos registros devem possuir coordenadas válidas"
    print("[OK] Cenário 4: Georreferenciamento auditado (116/116 registros com GPS validado).")

    # Cenário 5: Unicidade dos IDs e Cobertura Territorial
    ids = [r["id"] for r in data]
    assert len(ids) == len(set(ids)), "IDs duplicados detectados!"
    
    fazendas = set(r["fazenda"] for r in data)
    locais = set(r["local_orig"] for r in data)
    assert len(fazendas) == 41, f"Esperado 41 fazendas distintas, obtido {len(fazendas)}"
    assert len(locais) == 59, f"Esperado 59 pares Fazenda > Talhão monitorados, obtido {len(locais)}"
    print(f"[OK] Cenário 5: Unicidade confirmada (116 IDs únicos em 41 fazendas e 59 talhões).")

    # Cenário 6: Equipe Técnica de Monitoramento
    resps = {}
    for r in data:
        resp = r["responsavel_nome"]
        resps[resp] = resps.get(resp, 0) + 1
    assert len(resps) == 4, f"Esperado 4 responsáveis, obtido {len(resps)}"
    assert resps.get("EDILIANA CARDOSO DA COSTA") == 106
    assert resps.get("Juliana Aparecida Ferreira De Freitas") == 6
    assert resps.get("MABILA HELEN D FIGUEIREDO") == 3
    assert resps.get("EDINO CARDOSO GOMES RODRIGUES") == 1
    print("[OK] Cenário 6: Equipe técnica validada (Ediliana: 106, Juliana: 6, Mabila: 3, Edino: 1).")

    # Cenário 7: Status e Score MapFy
    for r in data:
        assert r["status"] == "Aberto", f"Status deve ser 'Aberto', obtido {r['status']}"
        assert r["score"] == "0,00", f"Score deve ser '0,00', obtido {r['score']}"
    print("[OK] Cenário 7: Status (100% Aberto) e Score (100% '0,00') investigados e documentados.")

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
        r'href=["\']\.\./arremate_acabamento',
        r'href=["\']\.\./herbicida'
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

    # Cenário 10: Integridade dos Elementos Estruturais da UI
    required_ids = [
        "kpiTotalCapturas", "kpiTotalLancamentos", "kpiInstalacoes", "kpiRecolhimentos",
        "kpiMediaGeral", "kpiMediaRecolhimento", "kpiMediaPositivos", "kpiMaiorCaptura",
        "kpiZerados", "kpiLocaisMonitorados", "filterFazenda", "filterEtapa",
        "filterResponsavel", "btnResetFilters", "btnExportExcel", "btnExportCSV",
        "searchInput", "chartFazendas", "chartTalhoes", "chartTimeline",
        "chartSeverity", "mapContainer", "tabelaBroca", "pageInfo", "prevPage",
        "nextPage", "detailModal"
    ]
    for el_id in required_ids:
        assert f'id="{el_id}"' in html_content, f"Elemento crítico id='{el_id}' ausente no index.html"
    print(f"[OK] Cenário 10: Todos os {len(required_ids)} elementos estruturais e seletores da UI validados.")

    # Cenário 11: Exportações XLSX e CSV
    assert "exportToExcel" in dash_js, "Função exportToExcel presente em dashboard.js"
    assert "exportToCSV" in dash_js, "Função exportToCSV presente em dashboard.js"
    assert "xlsx.full.min.js" in html_content, "Biblioteca SheetJS importada no HTML"
    print("[OK] Cenário 11: Módulos de exportação XLSX (Excel nativo) e CSV validados.")

    # Cenário 12: Proibição Estrita da Palavra "Macho" / "Machos" na UI do index.html
    macho_matches = re.findall(r'\bmacho[s]?\b', html_content, re.IGNORECASE)
    assert len(macho_matches) == 0, f"Palavra proibida 'macho/machos' encontrada em index.html: {macho_matches}"
    print("[OK] Cenário 12: Proibição estrita da palavra 'macho' validada com sucesso (0 ocorrências em index.html).")

    # Cenário 13: Exibição Obrigatória dos Valores em Todos os Gráficos
    assert "chartjs-plugin-datalabels" in html_content, "Plugin ChartDataLabels deve estar importado no HTML"
    assert "fallbackDataLabelsPlugin" in dash_js, "Plugin de fallback para renderizar valores nos gráficos presente em dashboard.js"
    assert "datalabels:" in dash_js, "Configuração de datalabels presente para os gráficos"
    print("[OK] Cenário 13: Exibição visual de valores configurada para todos os gráficos (Barras, Donut e Timeline).")

    # Cenário 14: Validação Exata do Ranking Top 10 Fazendas com Maior Captura Territorial
    faz_stats = {}
    for r in data:
        f = r["fazenda"]
        if f not in faz_stats:
            faz_stats[f] = {"talhoes": set(), "lancamentos": 0, "capturas": 0}
        faz_stats[f]["talhoes"].add(r["talhao"])
        faz_stats[f]["lancamentos"] += 1
        faz_stats[f]["capturas"] += r["machos"]

    sorted_faz = sorted(faz_stats.items(), key=lambda x: (x[1]["capturas"], x[1]["lancamentos"]), reverse=True)
    top_10 = sorted_faz[:10]

    expected_top = [
        ("40101", 7, 11, 110, 12.1),
        ("63401", 1, 3, 100, 11.0),
        ("43401", 1, 2, 50, 5.5),
        ("34802", 2, 4, 48, 5.3),
        ("70411", 5, 10, 43, 4.7),
        ("39701", 2, 4, 43, 4.7),
        ("53401", 1, 2, 43, 4.7),
        ("68802", 2, 4, 38, 4.2),
        ("63502", 1, 2, 38, 4.2),
        ("39001", 1, 2, 36, 4.0),
    ]

    for i, (exp_faz, exp_talh, exp_lanc, exp_capt, exp_part) in enumerate(expected_top):
        act_faz, act_data = top_10[i]
        assert act_faz == exp_faz, f"Posição {i+1}: esperado Fazenda {exp_faz}, obtido {act_faz}"
        assert len(act_data["talhoes"]) == exp_talh, f"Fazenda {exp_faz}: esperado {exp_talh} talhões, obtido {len(act_data['talhoes'])}"
        assert act_data["lancamentos"] == exp_lanc, f"Fazenda {exp_faz}: esperado {exp_lanc} lançamentos, obtido {act_data['lancamentos']}"
        assert act_data["capturas"] == exp_capt, f"Fazenda {exp_faz}: esperado {exp_capt} capturas, obtido {act_data['capturas']}"
        part = round((act_data["capturas"] / total_capturas) * 100, 1)
        assert abs(part - exp_part) <= 0.1, f"Fazenda {exp_faz}: participação esperada {exp_part}%, obtido {part}%"

    print("[OK] Cenário 14: Tabela Top 10 Fazendas com Maior Captura validada exatamente de acordo com os dados oficiais.")

    print("=" * 75)
    print("TODOS OS 14 CENÁRIOS DE TESTE FORAM APROVADOS COM SUCESSO!")
    print("=" * 75)

if __name__ == "__main__":
    run_tests()
