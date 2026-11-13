import os
import re

targets = ['sulcacao', 'abertura_asa', 'paralelismo', 'dosagem_sulco']

for t in targets:
    html_path = f'DashBoard/{t}/index.html'
    js_path = f'DashBoard/{t}/js/dashboard.js'
    
    with open(html_path, encoding='utf-8', errors='ignore') as f:
        html = f.read()
    with open(js_path, encoding='utf-8', errors='ignore') as f:
        js = f.read()

    map_div = re.findall(r'<div[^>]*id=["\'](map[^"\']*)["\']', html)
    has_btn_sync = 'btnSyncGlobalFilter' in html or 'btnToggleSyncFilter' in html
    has_evo_range = 'btn-evo-filter' in html
    has_map_sync = 'btnToggleMapSyncFilter' in html
    
    print(f"Target: {t}")
    print(f"  HTML: MapDiv={map_div}, SyncBtn={has_btn_sync}, EvoRange={has_evo_range}, MapSync={has_map_sync}")
    
    # Check JS
    has_init_evo = 'initEvolutionFilter' in js
    has_update_charts = 'updateChartsAndVisuals' in js
    has_update_map = 'updateMap' in js
    print(f"  JS: initEvolutionFilter={has_init_evo}, updateChartsAndVisuals={has_update_charts}, updateMap={has_update_map}")
