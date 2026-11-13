import json
from pathlib import Path
from playwright.sync_api import sync_playwright

SESSION_FILE = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\session_state.json")

def inspect_form_submit():
    with open(SESSION_FILE, "r", encoding="utf-8") as f:
        state = json.load(f)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(accept_downloads=True)
        context.add_cookies(state.get("cookies", []))
        page = context.new_page()

        page.goto("https://app.mapfy.com.br/Home/Map", wait_until="domcontentloaded", timeout=45000)
        page.goto("https://app.mapfy.com.br/FormEntry?formId=1266", wait_until="domcontentloaded", timeout=45000)

        page.locator('[data-testid="formentry-button-csv"], #csv').first.click()
        page.wait_for_selector("#btnConfirm", state="visible", timeout=15000)

        form_events = page.evaluate("""() => {
            const form = document.querySelector("#entry-filter-form");
            let events = {};
            if (window.$ && $._data && form) {
                const ev = $._data(form, "events");
                if (ev) {
                    events = Object.keys(ev).reduce((acc, k) => {
                        acc[k] = ev[k].map(h => h.handler.toString());
                        return acc;
                    }, {});
                }
            }
            return {
                formEvents: events,
                formAction: form ? form.action : null,
                formMethod: form ? form.method : null,
                target: form ? form.target : null
            };
        }""")

        print(json.dumps(form_events, indent=2))
        browser.close()

if __name__ == "__main__":
    inspect_form_submit()
