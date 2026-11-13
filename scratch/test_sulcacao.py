import os
import urllib.request
from playwright.sync_api import sync_playwright

edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

def test_sulcacao():
    path = os.path.abspath('DashBoard/sulcacao/index.html')
    url = 'file:' + urllib.request.pathname2url(path)

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=edge_path, headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        
        errors = []
        page.on('pageerror', lambda err: errors.append(err.message))
        page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)

        print(f"Navegando para {url}")
        page.goto(url)
        page.wait_for_timeout(2000)

        # 1. Estado inicial
        sync_text = page.locator('#syncText').inner_text()
        evo_disabled = page.evaluate("() => Array.from(document.querySelectorAll('.btn-evo-filter')).map(b => b.disabled)")
        map_sync_text = page.locator('#mapSyncText').inner_text()
        map_disabled = page.evaluate("() => Array.from(document.querySelectorAll('.btn-map-filter')).map(b => b.disabled)")
        print(f"1. Inicial: SyncText='{sync_text}', EvoDisabled={evo_disabled}, MapSync='{map_sync_text}', MapDisabled={map_disabled}")

        # 2. Destravar e testar 7D
        page.click('#btnSyncGlobalFilter')
        page.wait_for_timeout(400)
        page.click('.btn-evo-filter[data-evo-range="7D"]')
        page.wait_for_timeout(400)
        donut_val = page.locator('#donutValDentro').inner_text()
        print(f"2. Donut 7D: {donut_val}")

        # 3. Destravar Mapa
        page.click('#btnToggleMapSyncFilter')
        page.wait_for_timeout(400)
        map_unlocked = page.locator('#mapSyncText').inner_text()
        print(f"3. Mapa destravado: {map_unlocked}")

        browser.close()

if __name__ == '__main__':
    test_sulcacao()
