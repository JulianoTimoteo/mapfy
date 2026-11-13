import os
import re

dash_dirs = [d for d in os.listdir('DashBoard') if os.path.isdir(os.path.join('DashBoard', d)) and d not in ['assets', 'common', 'live_data', 'Maps', 'backup_missao_climatica_2026']]

for d in sorted(dash_dirs):
    js_dir = os.path.join('DashBoard', d, 'js')
    if not os.path.exists(js_dir): continue
    js_files = os.listdir(js_dir)
    dash_js = os.path.join(js_dir, 'dashboard.js')
    engine_js = [f for f in js_files if 'engine' in f]
    
    engine_name = "Nenhum"
    if engine_js:
        with open(os.path.join(js_dir, engine_js[0]), encoding='utf-8', errors='ignore') as f:
            e_content = f.read()
        m = re.findall(r'window\.([A-Za-z0-9_]+Engine)', e_content)
        if not m:
            m = re.findall(r'const\s+([A-Za-z0-9_]+Engine)', e_content)
        engine_name = m[0] if m else engine_js[0]

    with open(dash_js, encoding='utf-8', errors='ignore') as f:
        d_content = f.read()

    charts_func = re.findall(r'function\s+([a-zA-Z0-9_]*(?:Charts|Chart|Visuals)[a-zA-Z0-9_]*)\s*\(', d_content)
    map_func = re.findall(r'function\s+([a-zA-Z0-9_]*(?:Map|Markers)[a-zA-Z0-9_]*)\s*\(', d_content)

    print(f"{d:20} | Engine={engine_name:25} | ChartsFunc={charts_func} | MapFunc={map_func}")
