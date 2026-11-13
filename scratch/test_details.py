import json
from pathlib import Path
from playwright.sync_api import sync_playwright

html_path = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda\!@#Mapfy_2026\DashBoard\index.html").resolve()
file_url = html_path.as_uri()
screenshot_with_details = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda\!@#Mapfy_2026\scratch\mandala_with_details.png")

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(file_url, wait_until="networkidle")
    
    # Wait for dynamic sync
    page.wait_for_timeout(1000)
    
    # Manually trigger hover on node 0
    page.evaluate("""
        formsData[0].latest_date = '3955557,qualidade3@usinapitangueiras.com.br,01/10/2026';
        highlightNode(0);
    """)
    page.wait_for_timeout(300)
    
    center_el = page.locator("#centerHud")
    center_el.screenshot(path=str(screenshot_with_details))
    
    active_date = page.locator("#activeDate").inner_text()
    active_details = page.locator("#activeDetails").inner_text()
    print(f"Date: '{active_date}', Details: '{active_details}'")
    
    browser.close()
