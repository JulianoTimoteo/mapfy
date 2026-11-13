import os, re

remaining = [
    'checklist_veicular', 'area_vivencia', 'herbicida', 'broca_armadilha', 'tpl_5s',
    'qualidade_cana', 'qualidade_muda', 'viabilidade_gemas',
    'arremate_acabamento', 'cobricao', 'dosagem_cobricao'
]

print("=== MAPEAMENTO DOS DASHBOARDS RESTANTES ===")
for folder in remaining:
    idx = os.path.join('DashBoard', folder, 'index.html')
    js_dash = os.path.join('DashBoard', folder, 'js', 'dashboard.js')
    
    html_evo_match = None
    html_map_match = None
    if os.path.exists(idx):
        with open(idx, 'r', encoding='utf-8', errors='ignore') as f:
            hc = f.read()
            # Procurar botões de evolução
            m1 = re.search(r'(btn-evo-filter|data-evo-range|Todos.*15D.*7D)', hc, re.DOTALL)
            m_map = re.search(r'(id=["\']mapContainer["\']|id=["\']map-container["\']|id=["\']map[A-Za-z0-9_]*["\'])', hc)
            html_evo_match = m1.group(0) if m1 else "NAO_ACHOU"
            html_map_match = m_map.group(0) if m_map else "NAO_ACHOU"

    js_fn_charts = []
    js_fn_map = []
    if os.path.exists(js_dash):
        with open(js_dash, 'r', encoding='utf-8', errors='ignore') as f:
            jc = f.read()
            if 'updateCharts' in jc: js_fn_charts.append('updateCharts')
            if 'updateChartsAndVisuals' in jc: js_fn_charts.append('updateChartsAndVisuals')
            if 'renderCharts' in jc: js_fn_charts.append('renderCharts')
            if 'renderDonutChart' in jc: js_fn_charts.append('renderDonutChart')
            if 'updateMap' in jc: js_fn_map.append('updateMap')
            if 'renderMap' in jc: js_fn_map.append('renderMap')
            if 'updateMapMarkers' in jc: js_fn_map.append('updateMapMarkers')
            if 'renderMapMarkers' in jc: js_fn_map.append('renderMapMarkers')

    print(f"[{folder}] HTML: evo={html_evo_match} | map={html_map_match} | JS: charts={js_fn_charts} map={js_fn_map}")
