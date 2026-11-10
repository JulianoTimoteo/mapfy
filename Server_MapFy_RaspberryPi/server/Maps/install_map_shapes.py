"""
install_map_shapes.py
=====================
Atualiza fullscreen_inspector.js e injeta a inclusão de map_shapes_layer.js
em todos os 17 dashboards HTML.
"""

import glob
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# 1. Atualizar fullscreen_inspector.js
fi_path = BASE_DIR / "common" / "js" / "fullscreen_inspector.js"
if fi_path.is_file():
    text = fi_path.read_text(encoding="utf-8")
    if "map_shapes_layer.js" not in text:
        marker = "try {\n            if (!window.MapfyApiConnector"
        addition = """try {
            if (!window.PitangueirasMapShapes && !document.querySelector('script[src*="map_shapes_layer.js"]')) {
                const s = document.createElement('script');
                s.src = '../common/js/map_shapes_layer.js';
                document.head.appendChild(s);
            }
        } catch (e) {}
        try {
            if (!window.MapfyApiConnector"""
        if marker in text:
            text = text.replace(marker, addition)
            fi_path.write_text(text, encoding="utf-8")
            print("[install_map_shapes] fullscreen_inspector.js atualizado com sucesso.")
        else:
            print("[install_map_shapes] Marcador não encontrado em fullscreen_inspector.js.")
    else:
        print("[install_map_shapes] fullscreen_inspector.js já possui map_shapes_layer.js.")

# 2. Injetar tag de script nos 17 dashboards
pattern = str(BASE_DIR / "*" / "index.html")
count = 0
for file_str in glob.glob(pattern):
    path = Path(file_str)
    if not path.is_file():
        continue
    html = path.read_text(encoding="utf-8")
    if "map_shapes_layer.js" not in html:
        target = '<script src="../common/js/fullscreen_inspector.js"></script>'
        replacement = '<script src="../common/js/map_shapes_layer.js"></script>\n    <script src="../common/js/fullscreen_inspector.js"></script>'
        if target in html:
            html = html.replace(target, replacement)
            path.write_text(html, encoding="utf-8")
            count += 1
            print(f"[install_map_shapes] Injetado em {path.parent.name}")

print(f"[install_map_shapes] Total de dashboards atualizados com script tag: {count}")
