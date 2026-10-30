path = 'DashBoard/build_dashboard_html.py'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update ACTIVE_PANELS
if '"CHECK LIST VEICULAR": "checklist_veicular/index.html"' not in code:
    code = code.replace(
        '"5S e Gestão - TPL": "tpl_5s/index.html"',
        '"5S e Gestão - TPL": "tpl_5s/index.html",\n    "CHECK LIST VEICULAR": "checklist_veicular/index.html"'
    )
    print("Added CHECK LIST VEICULAR to ACTIVE_PANELS!")

# 2. Update get_active_panel
if 'if "veicular" in f:' not in code:
    code = code.replace(
        'if "5s" in f or "tpl" in f:\n        return "tpl_5s/index.html"',
        'if "5s" in f or "tpl" in f:\n        return "tpl_5s/index.html"\n    if "veicular" in f or "checklist veic" in f:\n        return "checklist_veicular/index.html"'
    )
    print("Added veicular to get_active_panel!")

# 3. Update getActiveUrl in JS template
if "f.includes('veicular')" not in code:
    code = code.replace(
        "if (f.includes('vivência') || f.includes('vivencia') || f.includes('check-list')) return 'area_vivencia/index.html';",
        "if (f.includes('vivência') || f.includes('vivencia') || (f.includes('check-list') && !f.includes('veic'))) return 'area_vivencia/index.html';\n            if (f.includes('5s') || f.includes('tpl')) return 'tpl_5s/index.html';\n            if (f.includes('veicular') || f.includes('checklist veic')) return 'checklist_veicular/index.html';"
    )
    print("Added veicular to getActiveUrl in JS!")

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

print("build_dashboard_html.py updated!")
