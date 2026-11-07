import os
from pathlib import Path
from playwright.sync_api import sync_playwright

url = Path('DashBoard/broca_armadilha/index.html').resolve().as_uri()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    
    # Intercept fillText on 2D context of chartTimeline!
    page.add_init_script('''
        const origGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
            const ctx = origGetContext.call(this, type, ...args);
            if (this.id === 'chartTimeline' && type === '2d' && !this._intercepted) {
                this._intercepted = true;
                const origFillText = ctx.fillText;
                window._timelineFillTextCalls = [];
                ctx.fillText = function(text, x, y, ...rest) {
                    window._timelineFillTextCalls.push({ text: String(text), x: Math.round(x), y: Math.round(y), font: ctx.font, fill: ctx.fillStyle });
                    return origFillText.call(this, text, x, y, ...rest);
                };
            }
            return ctx;
        };
    ''')
    
    page.goto(url)
    page.wait_for_timeout(3000)
    
    calls = page.evaluate('() => window._timelineFillTextCalls || []')
    print('Total fillText calls on chartTimeline:', len(calls))
    for c in calls[:30]:
        print(c)
        
    browser.close()
