import os, urllib.request
from playwright.sync_api import sync_playwright

edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

def debug_cobricao():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=edge_path, headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        
        errors = []
        page.on('pageerror', lambda err: print(f"PAGEERROR: {err.message}"))
        page.on('console', lambda msg: print(f"CONSOLE: [{msg.type}] {msg.text}"))

        path = os.path.abspath('DashBoard/cobricao/index.html')
        url = 'file:' + urllib.request.pathname2url(path)
        print(f"Abrindo {url}")
        page.goto(url)
        page.wait_for_timeout(1000)

        sync_btn = page.locator('#btnSyncGlobalFilter')
        print("BtnSync count:", sync_btn.count())
        print("BtnSync text:", page.locator('#syncText').inner_text())
        
        # Testar clique direto via JS
        page.evaluate("() => document.getElementById('btnSyncGlobalFilter').click()")
        page.wait_for_timeout(500)
        print("Após evaluate click, text:", page.locator('#syncText').inner_text())

        browser.close()

if __name__ == '__main__':
    debug_cobricao()
