import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

SESSION_FILE = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\session_state.json")

def test_download_form(form_id, form_name, start_date, finish_date):
    print(f"\n==========================================")
    print(f"Testando download para: {form_name} (formId={form_id})")
    print(f"Intervalo: {start_date} até {finish_date}")
    print(f"==========================================")

    with open(SESSION_FILE, "r", encoding="utf-8") as f:
        state = json.load(f)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(accept_downloads=True)
        context.add_cookies(state.get("cookies", []))
        page = context.new_page()

        can_export_info = {"checked": False, "count": None, "canExport": None}
        downloads = []

        def on_resp(resp):
            if "/FormEntry/CanExport" in resp.url:
                try:
                    data = resp.json()
                    can_export_info["checked"] = True
                    can_export_info["count"] = data.get("count", 0)
                    can_export_info["canExport"] = data.get("canExport", True)
                    print(f"  [CanExport Response] count={can_export_info['count']}, canExport={can_export_info['canExport']}")
                except Exception as e:
                    print(f"  [CanExport Parse Error] {e}")

        def on_dl(dl):
            print(f"  [DOWNLOAD CAPTURADO] filename={dl.suggested_filename}")
            downloads.append(dl)

        page.on("response", on_resp)
        context.on("download", on_dl)
        page.on("download", on_dl)

        url = f"https://app.mapfy.com.br/FormEntry?formId={form_id}"
        print(f"Navegando para: {url}...")
        page.goto(url, wait_until="domcontentloaded", timeout=45000)

        # Clica no botão CSV
        btn_csv = page.locator('[data-testid="formentry-button-csv"], #csv, button:has-text("CSV")').first
        btn_csv.wait_for(state="visible", timeout=15000)
        btn_csv.click()

        page.wait_for_selector("#StartDate", state="visible", timeout=15000)
        page.wait_for_selector("#FinishDate", state="visible", timeout=15000)
        page.wait_for_selector("#btnConfirm", state="visible", timeout=15000)

        # Configura as datas
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

        print("Clicando em #btnConfirm...")
        page.locator("#btnConfirm").click()

        start_time = time.time()
        timeout = 120
        while time.time() - start_time < timeout:
            if downloads:
                break
            if can_export_info["checked"]:
                if can_export_info["count"] == 0:
                    print("  -> Mapfy retornou count=0 (sem dados novos no período).")
                    break
                if not can_export_info["canExport"]:
                    print(f"  -> Limite excedido: {can_export_info['count']}")
                    break
            time.sleep(1)
            elapsed = int(time.time() - start_time)
            if elapsed % 5 == 0:
                print(f"  ... aguardando {elapsed}s (downloads={len(downloads)}, canExport={can_export_info})")

        if downloads:
            dl = downloads[0]
            save_path = Path("scratch") / dl.suggested_filename
            dl.save_as(str(save_path))
            print(f"SUCESSO! Arquivo salvo em: {save_path} (Tamanho: {save_path.stat().st_size} bytes)")
        elif can_export_info["count"] == 0:
            print("OK: Nenhum dado novo no período.")
        else:
            print(f"FALHA / TIMEOUT após {timeout}s!")

        context.storage_state(path=str(SESSION_FILE))
        browser.close()

if __name__ == "__main__":
    # Test Subsolagem
    test_download_form(874, "Subsolagem", "01/10/2026", "13/11/2026")
    # Test Canteirização
    test_download_form(1180, "Canteirização", "29/10/2026", "13/11/2026")
