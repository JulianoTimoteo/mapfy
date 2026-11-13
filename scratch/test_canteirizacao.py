import os
import urllib.request
from playwright.sync_api import sync_playwright

edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

def test_canteirizacao():
    path = os.path.abspath('DashBoard/canteirizacao/index.html')
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

        # 1. Estado inicial dos Gráficos
        sync_text = page.locator('#syncText').inner_text()
        sync_icon = page.locator('#syncIcon').inner_text()
        evo_btns_disabled = page.evaluate("() => Array.from(document.querySelectorAll('.btn-evo-filter')).map(b => b.disabled)")
        print(f"1. Gráficos - Inicial: Icon={sync_icon}, Text='{sync_text}', Disabled={evo_btns_disabled}")

        # 1. Estado inicial do Mapa
        map_sync_text = page.locator('#mapSyncText').inner_text()
        map_sync_icon = page.locator('#mapSyncIcon').inner_text()
        map_btns_disabled = page.evaluate("() => Array.from(document.querySelectorAll('.btn-map-filter')).map(b => b.disabled)")
        print(f"1. Mapa - Inicial: Icon={map_sync_icon}, Text='{map_sync_text}', Disabled={map_btns_disabled}")

        # 2. Destravar Gráficos
        page.click('#btnSyncGlobalFilter')
        page.wait_for_timeout(500)
        unlocked_text = page.locator('#syncText').inner_text()
        evo_btns_enabled = page.evaluate("() => Array.from(document.querySelectorAll('.btn-evo-filter')).map(b => b.disabled)")
        print(f"2. Gráficos - Destravado: Text='{unlocked_text}', Disabled={evo_btns_enabled}")

        # 3. Clicar em 7D nos Gráficos
        page.click('.btn-evo-filter[data-evo-range="7D"]')
        page.wait_for_timeout(500)
        donut_val = page.locator('#donutValDentro').inner_text()
        print(f"3. Gráficos - Donut após 7D: {donut_val}")

        # 4. Destravar Mapa
        page.click('#btnToggleMapSyncFilter')
        page.wait_for_timeout(500)
        map_unlocked_text = page.locator('#mapSyncText').inner_text()
        map_btns_enabled = page.evaluate("() => Array.from(document.querySelectorAll('.btn-map-filter')).map(b => b.disabled)")
        print(f"4. Mapa - Destravado: Text='{map_unlocked_text}', Disabled={map_btns_enabled}")

        # 5. Clicar em 15D no Mapa
        page.click('.btn-map-filter[data-map-range="15D"]')
        page.wait_for_timeout(500)
        print("5. Mapa - Clicado em 15D")

        # 6. Retravar Gráficos
        page.click('#btnSyncGlobalFilter')
        page.wait_for_timeout(500)
        relocked_text = page.locator('#syncText').inner_text()
        evo_btns_relocked = page.evaluate("() => Array.from(document.querySelectorAll('.btn-evo-filter')).map(b => b.disabled)")
        print(f"6. Gráficos - Retravado: Text='{relocked_text}', Disabled={evo_btns_relocked}")

        print(f"Total de erros de console/página: {len(errors)}")
        if errors:
            print("Erros detectados:", errors)

        page.screenshot(path='scratch/canteirizacao_filter_modes_verified.png', full_page=True)
        browser.close()

if __name__ == '__main__':
    test_canteirizacao()
