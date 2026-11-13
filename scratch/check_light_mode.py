import os
import json
import urllib.request
from playwright.sync_api import sync_playwright

path = os.path.abspath('DashBoard/subsolagem/index.html')
edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
url = 'file:' + urllib.request.pathname2url(path)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=edge_path, headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    page.goto(url)
    page.wait_for_timeout(2000)

    # Force light mode
    page.evaluate("""() => {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }""")
    page.wait_for_timeout(1000)

    info = page.evaluate("""() => {
        const valDentro = document.getElementById('donutValDentro');
        const spanRange = valDentro ? valDentro.previousElementSibling : null;
        const btnTodos = document.querySelector('.btn-evo-filter[data-evo-range="ALL"]');
        const syncBtn = document.getElementById('btnSyncGlobalFilter');
        return {
            valDentroColor: valDentro ? window.getComputedStyle(valDentro).color : null,
            valDentroHTML: valDentro ? valDentro.outerHTML : null,
            spanRangeColor: spanRange ? window.getComputedStyle(spanRange).color : null,
            spanRangeHTML: spanRange ? spanRange.outerHTML : null,
            btnTodosColor: btnTodos ? window.getComputedStyle(btnTodos).color : null,
            btnTodosBg: btnTodos ? window.getComputedStyle(btnTodos).backgroundColor : null,
            syncBtnColor: syncBtn ? window.getComputedStyle(syncBtn).color : null,
            syncBtnBg: syncBtn ? window.getComputedStyle(syncBtn).backgroundColor : null,
        };
    }""")
    print('Computed Info in Light Mode:', json.dumps(info, indent=2))

    # Take screenshot of donut card and evolution card
    donut_card = page.locator('#chartDonut').locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]')
    if donut_card.count() > 0:
        donut_card.first.screenshot(path='scratch/debug_donut_light.png')
    
    evo_card = page.locator('#chartEvolutionCard')
    if evo_card.count() > 0:
        evo_card.first.screenshot(path='scratch/debug_evo_light.png')

    # Also force dark mode and take screenshots
    page.evaluate("""() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }""")
    page.wait_for_timeout(1000)
    if donut_card.count() > 0:
        donut_card.first.screenshot(path='scratch/debug_donut_dark.png')
    if evo_card.count() > 0:
        evo_card.first.screenshot(path='scratch/debug_evo_dark.png')

    browser.close()
