import os

folders = [f for f in os.listdir('DashBoard') if os.path.isdir(os.path.join('DashBoard', f)) and f not in ['assets', 'common', 'live_data', 'Maps']]

print(f"Total de Dashboards identificados: {len(folders)}")
for folder in sorted(folders):
    idx = os.path.join('DashBoard', folder, 'index.html')
    js_dash = os.path.join('DashBoard', folder, 'js', 'dashboard.js')
    
    has_html = os.path.exists(idx)
    html_sync_evo = False
    html_sync_map = False
    html_map_id = 'NONE'
    
    if has_html:
        with open(idx, 'r', encoding='utf-8', errors='ignore') as f:
            hcontent = f.read()
            html_sync_evo = 'btnSyncGlobalFilter' in hcontent
            html_sync_map = 'btnToggleMapSyncFilter' in hcontent
            if 'id="mapContainer"' in hcontent:
                html_map_id = 'mapContainer'
            elif 'id="map-container"' in hcontent:
                html_map_id = 'map-container'
            elif 'id="mapSubsolagem"' in hcontent:
                html_map_id = 'mapSubsolagem'
            elif 'id="map' in hcontent:
                html_map_id = 'other_map'

    has_js = os.path.exists(js_dash)
    js_sync_evo = False
    js_sync_map = False
    js_state_evo = False
    if has_js:
        with open(js_dash, 'r', encoding='utf-8', errors='ignore') as f:
            jcontent = f.read()
            js_sync_evo = 'syncWithGlobalFilter' in jcontent and 'initEvolutionFilter' in jcontent
            js_sync_map = 'mapSyncWithGlobal' in jcontent and 'initMapFilter' in jcontent
            js_state_evo = 'syncWithGlobalFilter: true' in jcontent or 'syncWithGlobalFilter:true' in jcontent

    status = 'OK' if (html_sync_evo and html_sync_map and js_sync_evo and js_sync_map and js_state_evo) else 'PENDENTE'
    print(f"[{status:8}] {folder:22} | HTML: evo={html_sync_evo} map={html_sync_map} mapId={html_map_id} | JS: evo={js_sync_evo} map={js_sync_map} stateInit={js_state_evo}")
