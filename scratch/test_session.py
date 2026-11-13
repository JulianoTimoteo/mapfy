import json
from pathlib import Path
from playwright.sync_api import sync_playwright

SESSION_FILE = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\session_state.json")

def test_session():
    with open(SESSION_FILE, "r", encoding="utf-8") as f:
        state = json.load(f)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context()
        cookies = state.get("cookies", [])
        context.add_cookies(cookies)
        page = context.new_page()

        print("Navigating to https://app.mapfy.com.br/ with session_state cookies...")
        page.goto("https://app.mapfy.com.br/", timeout=45000)
        print("Final URL:", page.url)
        print("Title:", page.title())

        browser.close()

if __name__ == "__main__":
    test_session()
