import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

SESSION_FILE = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\session_state.json")

def inspect():
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
        page.wait_for_selector("#StartDate", state="visible", timeout=15000)
        page.wait_for_selector("#FinishDate", state="visible", timeout=15000)
        time.sleep(2)  # Wait for EntryFilter to load completely

        html = page.evaluate("""() => {
            const m = document.querySelector("#filterModal");
            const forms = Array.from(document.querySelectorAll("form")).map(f => ({
                id: f.id,
                action: f.action,
                method: f.method,
                inputs: Array.from(f.querySelectorAll("input, select, button")).map(i => ({ id: i.id, name: i.name, type: i.type, value: i.value }))
            }));
            return {
                modalHtml: m ? m.innerHTML.substring(0, 1500) : null,
                forms: forms
            };
        }""")
        print("MODAL HTML:", html["modalHtml"])
        print("FORMS:", json.dumps(html["forms"], indent=2))
        browser.close()

if __name__ == "__main__":
    inspect()
