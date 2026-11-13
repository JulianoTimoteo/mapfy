import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

SESSION_FILE = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\session_state.json")

def test_download():
    print(f"Loading session from {SESSION_FILE}...")
    with open(SESSION_FILE, "r", encoding="utf-8") as f:
        state = json.load(f)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(accept_downloads=True)
        
        # Add cookies from session state
        cookies = state.get("cookies", [])
        if cookies:
            context.add_cookies(cookies)
            print(f"Loaded {len(cookies)} cookies.")

        page = context.new_page()

        # Listeners
        def on_req(req):
            if "Download" in req.url or "CanExport" in req.url or "FormEntry" in req.url:
                print(f"[REQ] {req.method} {req.url}")
        def on_resp(resp):
            if "Download" in resp.url or "CanExport" in resp.url or "FormEntry" in resp.url:
                print(f"[RESP] {resp.status} {resp.url}")
                if "CanExport" in resp.url:
                    try:
                        print(f"  CanExport Body: {resp.text()}")
                    except Exception as e:
                        print(f"  CanExport Error reading body: {e}")
        def on_dl(dl):
            print(f"[DOWNLOAD EVENT] URL={dl.url}, suggested_filename={dl.suggested_filename}")

        page.on("request", on_req)
        page.on("response", on_resp)
        context.on("download", on_dl)
        page.on("console", lambda msg: print(f"[CONSOLE] {msg.type}: {msg.text}"))

        target_url = "https://app.mapfy.com.br/FormEntry?formId=1266"
        print(f"Navigating to {target_url}...")
        page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_selector('[data-testid="formentry-button-csv"], #csv', timeout=15000)
        print(f"Current URL: {page.url}")

        if "Login" in page.url:
            print("Session expired or redirected to login!")
            browser.close()
            return

        print("Page title:", page.title())
        btn_csv = page.locator('[data-testid="formentry-button-csv"], #csv, button:has-text("CSV")').first
        print("CSV button count:", btn_csv.count())
        btn_csv.click()
        time.sleep(2)

        print("Checking modal selectors...")
        has_start = page.locator("#StartDate").count()
        has_finish = page.locator("#FinishDate").count()
        has_confirm = page.locator("#btnConfirm").count()
        print(f"#StartDate count={has_start}, #FinishDate count={has_finish}, #btnConfirm count={has_confirm}")

        if has_confirm:
            btn_confirm = page.locator("#btnConfirm")
            print("btnConfirm visible:", btn_confirm.is_visible(), "enabled:", btn_confirm.is_enabled())
            print("btnConfirm text/html:", btn_confirm.inner_html())

            # Evaluate what kendo dates are set
            kendo_info = page.evaluate("""() => {
                var dpS = $("#StartDate").data("kendoDatePicker");
                var dpF = $("#FinishDate").data("kendoDatePicker");
                return {
                    sVal: $("#StartDate").val(),
                    fVal: $("#FinishDate").val(),
                    dpSVal: dpS ? dpS.value() : null,
                    dpFVal: dpF ? dpF.value() : null,
                    formAction: $("form#entry-filter-form").attr("action"),
                    formHtml: $("form#entry-filter-form").html() ? $("form#entry-filter-form").html().substring(0, 300) : null
                };
            }""")
            print(f"Kendo Info BEFORE setting dates: {kendo_info}")

            # Let's set the dates to 30/10/2026 to 12/11/2026
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
            }""", ["30/10/2026", "12/11/2026"])

            time.sleep(1)

            kendo_info2 = page.evaluate("""() => {
                return {
                    sVal: $("#StartDate").val(),
                    fVal: $("#FinishDate").val(),
                    btnConfirmOnClick: $("#btnConfirm").attr("onclick"),
                    btnConfirmType: $("#btnConfirm").attr("type")
                };
            }""")
            print(f"Kendo Info AFTER setting dates: {kendo_info2}")

            print("Clicking #btnConfirm...")
            btn_confirm.click()
            print("Clicked #btnConfirm! Waiting 15s to observe requests / responses / downloads...")
            for i in range(15):
                time.sleep(1)
                print(f"Wait {i+1}s...")

        browser.close()

if __name__ == "__main__":
    test_download()
