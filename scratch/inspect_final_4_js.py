for folder in ['area_vivencia', 'herbicida', 'broca_armadilha', 'tpl_5s']:
    js_path = f"DashBoard/{folder}/js/dashboard.js"
    with open(js_path, 'r', encoding='utf-8', errors='ignore') as f:
        code = f.read()
    
    print(f"=== {folder} ===")
    # State
    has_state = 'state' in code
    print(f"State present: {has_state}")
    
    # Encontrar funções de gráficos e mapa
    lines = code.split('\n')
    for line in lines:
        if 'function update' in line or 'function render' in line or 'function init' in line or 'applyFilter' in line:
            if any(k in line.lower() for k in ['chart', 'map', 'filter', 'dashboard', 'bootstrap']):
                print(f"  {line.strip()}")
