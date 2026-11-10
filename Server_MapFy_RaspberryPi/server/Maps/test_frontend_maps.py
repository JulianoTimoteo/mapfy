import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

dashboards = ["subsolagem", "cobricao", "qualidade_cana", "sulcacao", "dosagem_sulco"]

def test_all():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        print("Testando dashboards com a nova camada de talhões agrícolas:")
        for dash in dashboards:
            page = browser.new_page()
            url = f"http://localhost:5500/DashBoard/{dash}/index.html"
            try:
                page.goto(url, wait_until="networkidle", timeout=20000)
                time.sleep(1.5)
                has_btn = page.locator(".leaflet-control-talhoes").is_visible()
                canvases = page.evaluate("() => document.querySelectorAll('.leaflet-agriculturalShapes-pane canvas').length")
                print(f"  [OK] {dash:20} -> Botão: {has_btn} | Canvases: {canvases}")
            except Exception as e:
                print(f"  [ERRO] {dash}: {e}")
            finally:
                page.close()
        browser.close()

if __name__ == "__main__":
    test_all()
