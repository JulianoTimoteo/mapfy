import json
from pathlib import Path
from playwright.sync_api import sync_playwright

SESSION_FILE = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\session_state.json")

def test_direct_post():
    with open(SESSION_FILE, "r", encoding="utf-8") as f:
        state = json.load(f)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context()
        context.add_cookies(state.get("cookies", []))
        page = context.new_page()

        print("1. Refreshing session via Home/Map...")
        page.goto("https://app.mapfy.com.br/Home/Map", wait_until="domcontentloaded", timeout=45000)

        print("2. Making direct POST request to /FormEntry/DownloadCSV ...")
        # Post directly using Playwright's APIRequestContext (which shares cookies!)
        resp = context.request.post(
            "https://app.mapfy.com.br/FormEntry/DownloadCSV",
            form={
                "FormId": "1266",
                "StartDate": "30/10/2026",
                "FinishDate": "12/11/2026",
                "Username": "",
                "ExpandGeoList": "true"
            },
            timeout=60000
        )

        print(f"Response Status: {resp.status}")
        print(f"Headers: {resp.headers}")
        body = resp.body()
        print(f"Body length: {len(body)} bytes")
        if len(body) > 0:
            preview = body[:500].decode("latin1", errors="replace")
            print(f"Preview:\n{preview}")
            save_test = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\relatorios\CHECK LIST VEICULAR\historico\direct_post_test.csv")
            save_test.write_bytes(body)
            print(f"Saved {len(body)} bytes to {save_test}!")

        browser.close()

if __name__ == "__main__":
    test_direct_post()
