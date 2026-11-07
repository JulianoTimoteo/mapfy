import os
from pathlib import Path
from playwright.sync_api import sync_playwright

url = Path('DashBoard/broca_armadilha/index.html').resolve().as_uri()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    
    page.goto(url)
    page.wait_for_timeout(2000)
    
    # Action 1: Toggle theme twice
    btn_theme = page.locator('#themeToggleBtn')
    if btn_theme.is_visible():
        btn_theme.click()
        page.wait_for_timeout(500)
        btn_theme.click()
        page.wait_for_timeout(500)
        
    # Action 2: Timeline quick filters 30D, 15D, 7D, Todos
    for label in ['30D', '15D', '7D', 'Todos']:
        b = page.locator(f'button:has-text("{label}")').first
        if b.is_visible():
            b.click()
            page.wait_for_timeout(500)
            
    # Action 3: Diário / Mensal
    btn_mes = page.locator('#btnTimelineMes')
    if btn_mes.is_visible():
        btn_mes.click()
        page.wait_for_timeout(500)
    btn_dia = page.locator('#btnTimelineDia')
    if btn_dia.is_visible():
        btn_dia.click()
        page.wait_for_timeout(500)
        
    # Action 4: Period toolbar buttons
    for bid in ['#btnLatestDate', '#btnToday', '#btnAllDates']:
        btn = page.locator(bid)
        if btn.is_visible():
            btn.click()
            page.wait_for_timeout(500)
            
    # Action 5: Chart fullscreen
    card = page.locator('#chartTimeline').locator('xpath=ancestor::div[contains(@class, "app-card")]').first
    fs_btn = card.locator('.btn-chart-fullscreen')
    if fs_btn.is_visible():
        fs_btn.click()
        page.wait_for_timeout(500)
        fs_btn.click()
        page.wait_for_timeout(500)
        
    out_path = 'D:/Jarvis/chart_debug_after_actions.png'
    card.screenshot(path=out_path)
    print('Saved after-actions screenshot!')
    browser.close()
