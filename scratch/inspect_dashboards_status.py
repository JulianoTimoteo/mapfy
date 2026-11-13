import os
import re

dash_dirs = [d for d in os.listdir('DashBoard') if os.path.isdir(os.path.join('DashBoard', d)) and d not in ['assets', 'common', 'live_data', 'Maps', 'backup_missao_climatica_2026']]

print(f"{'DASHBOARD':22} | {'MAP_CONTAINER':15} | {'EVO_SYNC':8} | {'EVO_RANGE':9} | {'MAP_SYNC':8} | {'MAP_RANGE':9}")
print("-" * 85)

for d in sorted(dash_dirs):
    html_path = os.path.join('DashBoard', d, 'index.html')
    js_path = os.path.join('DashBoard', d, 'js', 'dashboard.js')
    if not os.path.exists(html_path):
        continue
    with open(html_path, encoding='utf-8', errors='ignore') as f:
        html = f.read()

    # Identificar container de mapa
    map_containers = re.findall(r'<div[^>]*id=["\'](map[^"\']*)["\'][^>]*class=["\'][^"\']*h-96[^"\']*', html)
    if not map_containers:
        map_containers = re.findall(r'<div[^>]*id=["\'](map[^"\']*)["\']', html)
        map_containers = [m for m in map_containers if 'mobile' not in m.lower() and 'point' not in m.lower() and 'count' not in m.lower()]

    map_c = map_containers[0] if map_containers else "NENHUM"
    has_evo_sync = bool(re.search(r'id=["\'](btnSyncGlobalFilter|btnToggleSyncFilter)["\']', html))
    has_evo_range = 'btn-evo-filter' in html
    has_map_sync = 'btnToggleMapSyncFilter' in html
    has_map_range = 'btn-map-filter' in html

    print(f"{d:22} | {map_c:15} | {str(has_evo_sync):8} | {str(has_evo_range):9} | {str(has_map_sync):8} | {str(has_map_range):9}")
