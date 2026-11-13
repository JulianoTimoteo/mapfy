import json
from pathlib import Path
from playwright.sync_api import sync_playwright

SESSION_FILE = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\session_state.json")

def test_refresh():
    with open(SESSION_FILE, "r", encoding="utf-8") as f:
        state = json.load(f)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context()
        cookies = state.get("cookies", [])
        context.add_cookies(cookies)
        page = context.new_page()

        print("Testing direct API call to /FormEntry/CanExport...")
        # First let's see what happens if we navigate to https://app.mapfy.com.br/Home/Map
        page.goto("https://app.mapfy.com.br/Home/Map", timeout=45000)
        print("Home/Map URL:", page.url)

        # Now test navigating to https://app.mapfy.com.br/FormEntry/CanExport directly in browser
        # In browser navigation, 302 redirects ARE followed!
        print("Navigating to https://app.mapfy.com.br/FormEntry?formId=1266 ...")
        page.goto("https://app.mapfy.com.br/FormEntry?formId=1266", wait_until="domcontentloaded", timeout=45000)
        print("FormEntry URL:", page.url)

        # Now let's try a POST to /FormEntry/CanExport using page.evaluate (fetch)
        res = page.evaluate("""async () => {
            try {
                const formData = new URLSearchParams();
                formData.append('FormId', '1266');
                formData.append('StartDate', '30/10/2026');
                formData.append('FinishDate', '12/11/2026');

                const r = await fetch('/FormEntry/CanExport', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: formData.toString()
                });
                return {
                    status: r.status,
                    redirected: r.redirected,
                    url: r.url,
                    text: await r.text()
                };
            } catch (err) {
                return { error: err.toString() };
            }
        }""")
        print("Fetch /FormEntry/CanExport result:", res)

        browser.close()

if __name__ == "__main__":
    test_refresh()
