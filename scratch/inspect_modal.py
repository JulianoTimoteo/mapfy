import json
from pathlib import Path
from playwright.sync_api import sync_playwright

SESSION_FILE = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\session_state.json")

def inspect_dialog():
    with open(SESSION_FILE, "r", encoding="utf-8") as f:
        state = json.load(f)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(accept_downloads=True)
        context.add_cookies(state.get("cookies", []))
        page = context.new_page()

        page.goto("https://app.mapfy.com.br/Home/Map", wait_until="domcontentloaded", timeout=45000)
        page.goto("https://app.mapfy.com.br/FormEntry?formId=1266", wait_until="domcontentloaded", timeout=45000)

        # Let's inspect window.showFilterDialog
        info = page.evaluate("""() => {
            return {
                showFilterDialogStr: window.showFilterDialog ? window.showFilterDialog.toString() : null
            };
        }""")
        print("showFilterDialog:", info["showFilterDialogStr"])

        # Click CSV
        page.locator('[data-testid="formentry-button-csv"], #csv').first.click()
        page.wait_for_selector("#btnConfirm", state="visible", timeout=15000)

        # Inspect the modal HTML and all scripts inside the modal
        modal_info = page.evaluate("""() => {
            const btn = document.querySelector("#btnConfirm");
            const form = document.querySelector("form#entry-filter-form") || document.querySelector(".modal form");
            
            // Check jQuery event handlers on #btnConfirm
            let btnEvents = {};
            if (window.$ && $._data) {
                const events = $._data(btn, "events");
                if (events) {
                    btnEvents = Object.keys(events).reduce((acc, k) => {
                        acc[k] = events[k].map(h => h.handler.toString());
                        return acc;
                    }, {});
                }
            }

            // Check form onsubmit or action
            return {
                btnHtml: btn ? btn.outerHTML : null,
                formHtml: form ? form.outerHTML : null,
                btnEvents: btnEvents,
                scripts: Array.from(document.querySelectorAll(".modal script, script:not([src])")).map(s => s.innerText).filter(t => t.includes("btnConfirm") || t.includes("CanExport") || t.includes("DownloadCSV"))
            };
        }""")

        print("\n=== BTN HTML ===")
        print(modal_info["btnHtml"])
        print("\n=== BTN EVENTS ===")
        print(json.dumps(modal_info["btnEvents"], indent=2))
        print("\n=== RELEVANT SCRIPTS ===")
        for s in modal_info["scripts"]:
            print("--- SCRIPT ---")
            print(s[:1000])

        browser.close()

if __name__ == "__main__":
    inspect_dialog()
