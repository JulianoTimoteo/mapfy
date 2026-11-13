import os, urllib.request
from playwright.sync_api import sync_playwright

edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

def debug_modules(folders):
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=edge_path, headless=True)
        
        for folder in folders:
            page = browser.new_page(viewport={'width': 1440, 'height': 900})
            print(f"\n--- Debug {folder} ---")
            page.on('pageerror', lambda err: print(f"PAGEERROR [{folder}]: {err.message}"))
            page.on('console', lambda msg: print(f"CONSOLE [{folder}]: [{msg.type}] {msg.text}"))

            path = os.path.abspath(f'DashBoard/{folder}/index.html')
            url = 'file:' + urllib.request.pathname2url(path)
            page.goto(url)
            page.wait_for_timeout(1000)

            sync_btn = page.locator('#btnSyncGlobalFilter')
            print(f"[{folder}] BtnSync count:", sync_btn.count())
            if sync_btn.count() > 0:
                print(f"[{folder}] BtnSync text:", page.locator('#syncText').inner_text())
                page.evaluate("() => document.getElementById('btnSyncGlobalFilter').click()")
                page.wait_for_timeout(500)
                print(f"[{folder}] Após click:", page.locator('#syncText').inner_text())
            page.close()

        browser.close()

if __name__ == '__main__':
    debug_modules(['herbicida', 'broca_armadilha', 'dosagem_cobricao', 'arremate_acabamento'])
