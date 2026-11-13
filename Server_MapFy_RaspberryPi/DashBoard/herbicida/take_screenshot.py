import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

def take_shot(output_name="screenshot_herbicida_ANTES.png", wait_secs=3):
    html_file = Path(__file__).parent / "index.html"
    file_url = html_file.resolve().as_uri()
    out_path = Path(__file__).parent / output_name

    with sync_playwright() as p:
        # Usa o Google Chrome do sistema ou o chromium embutido
        browser = p.chromium.launch(
            headless=True,
            channel="chrome",
            args=["--no-sandbox", "--disable-web-security"]
        )
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1
        )
        page = context.new_page()
        page.goto(file_url, wait_until="networkidle")
        time.sleep(wait_secs)
        
        # Rola um pouco para baixo para focar na seção meteorológica
        # ou tira screenshot da página inteira
        page.screenshot(path=str(out_path), full_page=False)
        print(f"Screenshot salvo em {out_path} ({out_path.stat().st_size} bytes)")
        browser.close()

if __name__ == "__main__":
    out_name = sys.argv[1] if len(sys.argv) > 1 else "screenshot_herbicida_ANTES.png"
    take_shot(out_name)
