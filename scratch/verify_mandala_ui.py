import json
from pathlib import Path
from playwright.sync_api import sync_playwright

html_path = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda\!@#Mapfy_2026\DashBoard\index.html").resolve()
file_url = html_path.as_uri()

screenshot_idle = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda\!@#Mapfy_2026\scratch\mandala_idle.png")
screenshot_subsolagem = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda\!@#Mapfy_2026\scratch\mandala_subsolagem.png")
screenshot_checklist = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda\!@#Mapfy_2026\scratch\mandala_checklist.png")

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(file_url, wait_until="networkidle")
    
    # Wait for mandala intro animation to settle
    page.wait_for_timeout(2000)
    
    # 1. Capture Idle Mandala Center
    center_el = page.locator("#centerHud")
    center_el.screenshot(path=str(screenshot_idle))
    print(f"Captured idle center: {screenshot_idle}")
    
    # 2. Trigger Subsolagem (node 0)
    page.evaluate("highlightNode(0)")
    page.wait_for_timeout(500)
    center_el.screenshot(path=str(screenshot_subsolagem))
    print(f"Captured Subsolagem hover: {screenshot_subsolagem}")
    
    active_date = page.locator("#activeDate").inner_text()
    active_name = page.locator("#activeName").inner_text()
    active_rows = page.locator("#activeRows").inner_text()
    active_details = page.locator("#activeDetails").inner_text()
    print(f"Subsolagem -> Name: {active_name} | Rows: {active_rows} | Date: {active_date} | Details: {active_details}")
    
    # 3. Find index for CHECK LIST VEICULAR
    idx_chk = page.evaluate("formsData.findIndex(f => f.folder === 'CHECK LIST VEICULAR')")
    print(f"CHECK LIST VEICULAR index: {idx_chk}")
    page.evaluate(f"highlightNode({idx_chk})")
    page.wait_for_timeout(500)
    center_el.screenshot(path=str(screenshot_checklist))
    print(f"Captured Checklist hover: {screenshot_checklist}")
    
    active_date_chk = page.locator("#activeDate").inner_text()
    active_name_chk = page.locator("#activeName").inner_text()
    active_rows_chk = page.locator("#activeRows").inner_text()
    active_details_chk = page.locator("#activeDetails").inner_text()
    print(f"Checklist -> Name: {active_name_chk} | Rows: {active_rows_chk} | Date: {active_date_chk} | Details: {active_details_chk}")
    
    browser.close()
