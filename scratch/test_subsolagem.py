import os
from playwright.sync_api import sync_playwright

path = os.path.abspath('DashBoard/subsolagem/index.html')
edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=edge_path, headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    page.on('console', lambda msg: print('CONSOLE:', msg.text))
    page.on('pageerror', lambda err: print('ERROR:', err))
    url = 'file:///' + path.replace('\\', '/')
    print('Navigating to:', url)
    page.goto(url)
    page.wait_for_timeout(3000)
    print('Current URL:', page.url)
    print('Title:', page.title())
    
    # Check elements
    canvas = page.locator('#chartDonut')
    print('Donut canvas count:', canvas.count())
    
    valDentro = page.locator('#donutValDentro')
    print('valDentro count:', valDentro.count())
    if valDentro.count() > 0:
        print('valDentro text:', valDentro.text_content())
        print('valDentro style:', page.evaluate('el => window.getComputedStyle(el).color', valDentro.element_handle()))

    browser.close()
