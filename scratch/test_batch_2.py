import os, urllib.request
from playwright.sync_api import sync_playwright

edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

batch_2 = [
    'dosagem_sulco',
    'qualidade_muda',
    'viabilidade_gemas',
    'qualidade_cana',
    'cobricao'
]

def test_batch():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=edge_path, headless=True)
        
        for folder in batch_2:
            print(f"\n==========================================")
            print(f"[TESTE AUDITORIA] Testando: {folder}")
            print(f"==========================================")
            path = os.path.abspath(f'DashBoard/{folder}/index.html')
            url = 'file:' + urllib.request.pathname2url(path)
            
            page = browser.new_page(viewport={'width': 1440, 'height': 900})
            try:
                page.goto(url)
                page.wait_for_timeout(1000)

                # 1. Gráficos - Inicial
                sync_text = page.locator('#syncText').inner_text()
                sync_icon = page.locator('#syncIcon').inner_text()
                evo_btns_disabled = page.evaluate("() => Array.from(document.querySelectorAll('.btn-evo-filter')).map(b => b.disabled)")
                print(f"[{folder}] 1. Gráficos - Inicial: Icon={sync_icon}, Text='{sync_text}', Disabled={all(evo_btns_disabled)}")
                assert "🔒" in sync_icon and "Filtro Global Ativo" in sync_text
                assert all(evo_btns_disabled), f"[{folder}] Botões da evolução deveriam iniciar desabilitados"

                # 2. Destravar Gráficos
                page.click('#btnSyncGlobalFilter')
                page.wait_for_timeout(400)
                unlocked_text = page.locator('#syncText').inner_text()
                evo_btns_enabled = page.evaluate("() => Array.from(document.querySelectorAll('.btn-evo-filter')).map(b => !b.disabled)")
                print(f"[{folder}] 2. Gráficos - Destravado: Text='{unlocked_text}', Enabled={all(evo_btns_enabled)}")
                assert "🔓" in page.locator('#syncIcon').inner_text() and "Filtro Autônomo" in unlocked_text
                assert all(evo_btns_enabled), f"[{folder}] Botões da evolução deveriam habilitar após clique"

                # 3. Mapa - Inicial
                map_sync_text = page.locator('#mapSyncText').inner_text()
                map_sync_icon = page.locator('#mapSyncIcon').inner_text()
                map_btns_disabled = page.evaluate("() => Array.from(document.querySelectorAll('.btn-map-filter')).map(b => b.disabled)")
                print(f"[{folder}] 3. Mapa - Inicial: Icon={map_sync_icon}, Text='{map_sync_text}', Disabled={all(map_btns_disabled)}")
                assert "🔒" in map_sync_icon and "Filtro Global Ativo" in map_sync_text
                assert all(map_btns_disabled), f"[{folder}] Botões do mapa deveriam iniciar desabilitados"

                # 4. Destravar Mapa
                page.click('#btnToggleMapSyncFilter')
                page.wait_for_timeout(400)
                map_unlocked_text = page.locator('#mapSyncText').inner_text()
                map_btns_enabled = page.evaluate("() => Array.from(document.querySelectorAll('.btn-map-filter')).map(b => !b.disabled)")
                print(f"[{folder}] 4. Mapa - Destravado: Text='{map_unlocked_text}', Enabled={all(map_btns_enabled)}")
                assert "🔓" in page.locator('#mapSyncIcon').inner_text() and "Filtro Autônomo" in map_unlocked_text
                assert all(map_btns_enabled), f"[{folder}] Botões do mapa deveriam habilitar após clique"

                print(f">>> [PASSOU] {folder}: 100% OK e validado! <<<")
            finally:
                page.close()

        browser.close()
        print("\n>>> SUCESSO: LOTE 2 CONCLUÍDO COM SUCESSO! <<<")

if __name__ == '__main__':
    test_batch()
