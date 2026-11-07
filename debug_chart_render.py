import os
from pathlib import Path
from playwright.sync_api import sync_playwright

url = Path('DashBoard/broca_armadilha/index.html').resolve().as_uri()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    
    page.on('pageerror', lambda err: print('PAGE ERROR:', err))
    page.on('console', lambda msg: print(f'[{msg.type}] {msg.text}'))
    
    page.goto(url)
    page.wait_for_timeout(3000)
    
    # check canvas exists
    has_canvas = page.evaluate('() => !!document.getElementById("chartTimeline")')
    print('Has chartTimeline element:', has_canvas)
    
    # check chart instance
    chart_info = page.evaluate('''() => {
        const c = window.Chart ? Chart.getChart('chartTimeline') : null;
        if (!c) return { error: 'No chart' };
        return {
            type: c.config.type,
            datasets: c.data.datasets.map(d => ({ label: d.label, len: d.data.length, data: d.data })),
            labels: c.data.labels,
            plugins: Object.keys(c.options.plugins || {}),
            registered: Object.keys(Chart.registry.plugins.items)
        };
    }''')
    print('Chart info:', chart_info)
    
    # Take screenshot of the chartTimeline
    card = page.locator('#chartTimeline')
    out_dir = 'D:/Jarvis' if os.path.exists('D:/Jarvis') else '.'
    out_path = os.path.join(out_dir, 'chart_debug.png')
    card.screenshot(path=out_path)
    print('Screenshot saved to:', out_path)
    
    browser.close()
