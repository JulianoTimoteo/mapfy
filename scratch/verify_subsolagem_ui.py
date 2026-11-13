import json
from pathlib import Path
from playwright.sync_api import sync_playwright

html_path = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda\!@#Mapfy_2026\DashBoard\subsolagem\index.html").resolve()
file_url = html_path.as_uri()

screenshot_page = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda\!@#Mapfy_2026\scratch\subsolagem_dashboard.png")
screenshot_donut = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda\!@#Mapfy_2026\scratch\subsolagem_donut.png")
screenshot_evo = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda\!@#Mapfy_2026\scratch\subsolagem_evolution.png")

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(file_url, wait_until="networkidle")
    page.wait_for_timeout(1500)
    
    # 1. Check Period Buttons
    has_today = page.locator("#btnToday").count() > 0
    badge_latest = page.locator("#badgeLatest").inner_text()
    print(f"Has btnToday: {has_today} (Expected: False)")
    print(f"Badge Latest: {badge_latest}")
    
    # 2. Check Date Select
    date_options = page.locator("#filterDate option").all_inner_texts()
    print(f"Date Options count: {len(date_options)}, first 3: {date_options[:3]}")
    
    # 3. Check Evolution Filter toggle
    sync_text = page.locator("#syncText").inner_text()
    print(f"Sync text: {sync_text} (Expected: Filtro Local (7D))")
    
    # 4. Check Donut Center Values
    center_perc = page.locator("#donutCenterPerc").inner_text()
    center_count = page.locator("#donutCenterCount").inner_text()
    print(f"Donut Center: Perc={center_perc}, Count={center_count}")
    
    # 5. Check Horizontal Legend
    val_dentro = page.locator("#donutValDentro").inner_text()
    val_abaixo = page.locator("#donutValAbaixo").inner_text()
    val_acima = page.locator("#donutValAcima").inner_text()
    val_total = page.locator("#donutValTotal").inner_text()
    print(f"Horizontal Legend -> Dentro: {val_dentro} | Abaixo: {val_abaixo} | Acima: {val_acima} | Total: {val_total}")
    
    # 6. Capture Screenshots
    card_donut = page.locator("#donutDataContainer").locator("xpath=..")
    card_donut.screenshot(path=str(screenshot_donut))
    print(f"Captured Donut: {screenshot_donut}")
    
    card_evo = page.locator("#chartEvolutionCard")
    card_evo.screenshot(path=str(screenshot_evo))
    print(f"Captured Evolution: {screenshot_evo}")
    
    page.screenshot(path=str(screenshot_page), full_page=False)
    print(f"Captured Dashboard View: {screenshot_page}")
    
    browser.close()
