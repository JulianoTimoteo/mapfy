import os
import urllib.request
from playwright.sync_api import sync_playwright

edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

def test_page(html_rel_path, name_prefix):
    path = os.path.abspath(html_rel_path)
    url = 'file:' + urllib.request.pathname2url(path)

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=edge_path, headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 900})
        page.goto(url)
        page.wait_for_timeout(2500)

        # 1. Light Mode
        page.evaluate("""() => {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('mapfy_theme', 'light');
            localStorage.setItem('pitangueiras_theme', 'light');
            if (window.updateChartsTheme) window.updateChartsTheme();
        }""")
        page.wait_for_timeout(800)

        donut_card = page.locator('#chartDonut').locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]')
        if donut_card.count() > 0:
            donut_card.first.screenshot(path=f'scratch/{name_prefix}_donut_light.png')
        
        evo_card = page.locator('#chartEvolutionCard')
        if evo_card.count() > 0:
            evo_card.first.screenshot(path=f'scratch/{name_prefix}_evo_light.png')

        # 2. Dark Mode
        page.evaluate("""() => {
            document.documentElement.classList.add('dark');
            localStorage.setItem('mapfy_theme', 'dark');
            localStorage.setItem('pitangueiras_theme', 'dark');
            if (window.updateChartsTheme) window.updateChartsTheme();
        }""")
        page.wait_for_timeout(800)

        if donut_card.count() > 0:
            donut_card.first.screenshot(path=f'scratch/{name_prefix}_donut_dark.png')
        if evo_card.count() > 0:
            evo_card.first.screenshot(path=f'scratch/{name_prefix}_evo_dark.png')

        browser.close()

test_page('DashBoard/subsolagem/index.html', 'subsolagem')
test_page('DashBoard/canteirizacao/index.html', 'canteirizacao')
print('ALL SCREENSHOTS CAPTURED SUCCESSFULLY!')
