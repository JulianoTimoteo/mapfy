import os
import urllib.request
from playwright.sync_api import sync_playwright

edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

dashboards_to_test = [
    'subsolagem',
    'checklist_veicular',
    'canteirizacao',
    'sulcacao',
    'abertura_asa',
    'paralelismo',
    'dosagem_sulco',
    'qualidade_muda',
    'viabilidade_gemas',
    'qualidade_cana',
    'cobricao',
    'dosagem_cobricao',
    'arremate_acabamento',
    'area_vivencia',
    'herbicida',
    'broca_armadilha',
    'tpl_5s'
]

def test_all():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=edge_path, headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        
        passed = []
        failed = []

        for folder in dashboards_to_test:
            print(f"\n==========================================")
            print(f"[TESTE AUDITORIA] Testando: {folder}")
            print(f"==========================================")
            path = os.path.abspath(f'DashBoard/{folder}/index.html')
            url = 'file:' + urllib.request.pathname2url(path)
            
            try:
                page.goto(url)
                page.wait_for_timeout(1000)

                # 1. Estado inicial dos Gráficos
                sync_text = page.locator('#syncText').inner_text()
                sync_icon = page.locator('#syncIcon').inner_text()
                evo_btns_disabled = page.evaluate("() => Array.from(document.querySelectorAll('.btn-evo-filter')).map(b => b.disabled)")
                print(f"[{folder}] 1. Gráficos - Inicial: Icon={sync_icon}, Text='{sync_text}', Disabled={all(evo_btns_disabled)}")
                assert "🔒" in sync_icon and "Filtro Global Ativo" in sync_text
                assert all(evo_btns_disabled), f"[{folder}] Botões da evolução deveriam iniciar desabilitados"

                # 2. Destravar Gráficos
                page.click('#btnSyncGlobalFilter')
                page.wait_for_timeout(300)
                unlocked_text = page.locator('#syncText').inner_text()
                evo_btns_enabled = page.evaluate("() => Array.from(document.querySelectorAll('.btn-evo-filter')).map(b => !b.disabled)")
                print(f"[{folder}] 2. Gráficos - Destravado: Text='{unlocked_text}', Enabled={all(evo_btns_enabled)}")
                assert "🔓" in page.locator('#syncIcon').inner_text() and "Filtro Autônomo" in unlocked_text
                assert all(evo_btns_enabled), f"[{folder}] Botões da evolução deveriam habilitar após clique"

                # 3. Navegar para a aba de mapa se necessário (ex: checklist_veicular tem abas)
                tab_map = page.locator("button[data-tab='mapa']")
                if tab_map.count() > 0:
                    tab_map.click()
                    page.wait_for_timeout(300)

                # 4. Estado inicial do Mapa
                map_sync_text = page.locator('#mapSyncText').inner_text()
                map_sync_icon = page.locator('#mapSyncIcon').inner_text()
                map_btns_disabled = page.evaluate("() => Array.from(document.querySelectorAll('.btn-map-filter')).map(b => b.disabled)")
                print(f"[{folder}] 3. Mapa - Inicial: Icon={map_sync_icon}, Text='{map_sync_text}', Disabled={all(map_btns_disabled)}")
                assert "🔒" in map_sync_icon and "Filtro Global Ativo" in map_sync_text
                assert all(map_btns_disabled), f"[{folder}] Botões do mapa deveriam iniciar desabilitados"

                # 5. Destravar Mapa
                page.click('#btnToggleMapSyncFilter')
                page.wait_for_timeout(300)
                map_unlocked_text = page.locator('#mapSyncText').inner_text()
                map_btns_enabled = page.evaluate("() => Array.from(document.querySelectorAll('.btn-map-filter')).map(b => !b.disabled)")
                print(f"[{folder}] 4. Mapa - Destravado: Text='{map_unlocked_text}', Enabled={all(map_btns_enabled)}")
                assert "🔓" in page.locator('#mapSyncIcon').inner_text() and "Filtro Autônomo" in map_unlocked_text
                assert all(map_btns_enabled), f"[{folder}] Botões do mapa deveriam habilitar após clique"

                passed.append(folder)
                print(f">>> [PASSOU] {folder}: 100% OK e validado! <<<")
            except Exception as e:
                print(f"❌ [FALHOU] {folder}: {e}")
                failed.append((folder, str(e)))

        browser.close()
        print("\n=======================================================")
        print(f"RESUMO FINAL: {len(passed)} PASSARAM, {len(failed)} FALHARAM")
        print("=======================================================")
        if failed:
            for f, err in failed:
                print(f"- {f}: {err}")
            exit(1)
        else:
            print("\n>>> SUCESSO TOTAL E ABSOLUTO: TODOS OS 17 DASHBOARDS FORAM 100% VALIDADOS! <<<")

if __name__ == '__main__':
    test_all()
