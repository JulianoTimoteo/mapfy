import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

SESSION_FILE = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\session_state.json")

def test_actual_dl():
    with open(SESSION_FILE, "r", encoding="utf-8") as f:
        state = json.load(f)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(accept_downloads=True)
        cookies = state.get("cookies", [])
        context.add_cookies(cookies)
        page = context.new_page()

        downloads = []
        context.on("download", lambda dl: downloads.append(dl))

        print("1. Refreshing session via Home/Map...")
        page.goto("https://app.mapfy.com.br/Home/Map", wait_until="domcontentloaded", timeout=45000)
        print("Home/Map reached:", page.url)

        print("2. Navigating to Form 1266 (CHECK LIST VEICULAR)...")
        page.goto("https://app.mapfy.com.br/FormEntry?formId=1266", wait_until="domcontentloaded", timeout=45000)
        print("FormEntry reached:", page.url)

        # Click CSV
        btn_csv = page.locator('[data-testid="formentry-button-csv"], #csv, button:has-text("CSV")').first
        btn_csv.wait_for(state="visible", timeout=15000)
        print("Clicking CSV button to open modal...")
        btn_csv.click()

        page.wait_for_selector("#StartDate", state="visible", timeout=15000)
        page.wait_for_selector("#FinishDate", state="visible", timeout=15000)
        page.wait_for_selector("#btnConfirm", state="visible", timeout=15000)

        # Set dates
        start_date = "30/10/2026"
        finish_date = "12/11/2026"
        print(f"Setting dates: {start_date} to {finish_date}...")
        page.evaluate("""([sDate, fDate]) => {
            function parseBRDate(str) {
                var p = str.split('/');
                return new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
            }
            var dStart = parseBRDate(sDate);
            var dFinish = parseBRDate(fDate);

            var dpStart = $("#StartDate").data("kendoDatePicker");
            if (dpStart) {
                dpStart.value(dStart);
                dpStart.trigger("change");
            }
            $("#StartDate").val(sDate).trigger("input").trigger("change").trigger("blur");

            var dpFinish = $("#FinishDate").data("kendoDatePicker");
            if (dpFinish) {
                dpFinish.value(dFinish);
                dpFinish.trigger("change");
            }
            $("#FinishDate").val(fDate).trigger("input").trigger("change").trigger("blur");

            var form = $("form#entry-filter-form");
            if (form.length && form.valid) {
                form.valid();
            }
        }""", [start_date, finish_date])

        time.sleep(1)

        print("Clicking #btnConfirm...")
        with page.expect_download(timeout=30000) as download_info:
            page.locator("#btnConfirm").click()
            print("Clicked #btnConfirm, waiting for expect_download...")

        download = download_info.value
        print("DOWNLOAD SUCCESSFUL!")
        print("Filename:", download.suggested_filename)
        save_path = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\relatorios\CHECK LIST VEICULAR\historico\test_download.csv")
        save_path.parent.mkdir(parents=True, exist_ok=True)
        download.save_as(str(save_path))
        print("Saved to:", save_path, "Size:", save_path.stat().st_size)

        # Let's save the refreshed session state back to session_state.json!
        context.storage_state(path=str(SESSION_FILE))
        print("Updated session_state.json with active refreshed cookies!")

        browser.close()

if __name__ == "__main__":
    test_actual_dl()
