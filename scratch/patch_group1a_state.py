import re

group1a = ['abertura_asa', 'dosagem_sulco', 'paralelismo', 'sulcacao']

for folder in group1a:
    js_path = f"DashBoard/{folder}/js/dashboard.js"
    with open(js_path, 'r', encoding='utf-8') as f:
        code = f.read()

    # Procurar declaração do state
    # Exemplo:
    # const state = {
    #     rawRecords: [],
    # ...
    #     evolutionRange: 'ALL',
    
    # Vamos garantir que evolutionRange seja '7D', syncWithGlobalFilter: true, mapSyncWithGlobal: true, mapRange: '7D'
    if "syncWithGlobalFilter: true" not in code:
        # Substituir evolutionRange: ... por:
        # evolutionRange: '7D',
        # syncWithGlobalFilter: true,
        # mapSyncWithGlobal: true,
        # mapRange: '7D',
        code = re.sub(
            r"(evolutionRange:\s*['\"][^'\"]*['\"],?)",
            r"evolutionRange: '7D',\n        syncWithGlobalFilter: true,\n        mapSyncWithGlobal: true,\n        mapRange: '7D',",
            code,
            count=1
        )
        with open(js_path, 'w', encoding='utf-8') as f:
            f.write(code)
        print(f"Atualizado state em {js_path}")
    else:
        print(f"Já continha state em {js_path}")
