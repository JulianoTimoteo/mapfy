import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            channel="msedge",
            headless=True
        )
        page = await browser.new_page()
        
        file_url = "file:///C:/Users/julianotimoteo/OneDrive%20-%20Pitangueiras%20Acucar%20e%20Alcool%20Ltda/!%40%23Mapfy_2026/DashBoard/checklist_veicular/index.html"
        await page.goto(file_url, wait_until="networkidle")
        
        # 1. Verificar estado inicial do botão da Evolução
        btn_sync = page.locator("#btnSyncGlobalFilter")
        await btn_sync.wait_for(state="visible", timeout=10000)
        btn_text = await btn_sync.inner_text()
        print(f"[TESTE] Botão Sync Evolução inicial: '{btn_text.strip()}'")
        assert "🔒" in btn_text and "Filtro Global Ativo" in btn_text
        
        # Verificar botões da evolução desabilitados
        evo_7d = page.locator("button.btn-evo-filter[data-evo-range='7D']")
        is_disabled = await evo_7d.is_disabled()
        classes = await evo_7d.get_attribute("class")
        print(f"[TESTE] Botão 7D desabilitado={is_disabled}, classes='{classes}'")
        assert is_disabled, "Botão 7D deveria estar desabilitado no modo travado"
        assert "pointer-events-none" in classes
        
        # 2. Clicar no botão para destravar (Modo Autônomo)
        await btn_sync.click()
        btn_text_unlocked = await btn_sync.inner_text()
        print(f"[TESTE] Após clique: '{btn_text_unlocked.strip()}'")
        assert "🔓" in btn_text_unlocked and "Filtro Autônomo" in btn_text_unlocked
        
        is_disabled_after = await evo_7d.is_disabled()
        print(f"[TESTE] Botão 7D após destravar desabilitado={is_disabled_after}")
        assert not is_disabled_after, "Botão 7D deveria estar habilitado no modo autônomo"
        
        # 3. Testar botão do Mapa
        # Abrir a aba Mapa primeiro
        tab_mapa = page.locator("button[data-tab='mapa']")
        if await tab_mapa.count() > 0:
            await tab_mapa.click()
            await page.wait_for_timeout(500)
            
        btn_map_sync = page.locator("#btnToggleMapSyncFilter")
        await btn_map_sync.wait_for(state="visible", timeout=10000)
        map_btn_text = await btn_map_sync.inner_text()
        print(f"[TESTE] Botão Sync Mapa inicial: '{map_btn_text.strip()}'")
        assert "🔒" in map_btn_text and "Filtro Global Ativo" in map_btn_text
        
        map_7d = page.locator("button.btn-map-filter[data-map-range='7D']")
        map_7d_disabled = await map_7d.is_disabled()
        print(f"[TESTE] Botão Mapa 7D desabilitado={map_7d_disabled}")
        assert map_7d_disabled, "Botão Mapa 7D deveria estar desabilitado"
        
        # Destravar mapa
        await btn_map_sync.click()
        map_btn_text_unlocked = await btn_map_sync.inner_text()
        print(f"[TESTE] Mapa após clique: '{map_btn_text_unlocked.strip()}'")
        assert "🔓" in map_btn_text_unlocked and "Filtro Autônomo" in map_btn_text_unlocked
        
        print("\n>>> SUCESSO TOTAL: Checklist Veicular 100% validado conforme diretrizes! <<<")
        await browser.close()

asyncio.run(run())
