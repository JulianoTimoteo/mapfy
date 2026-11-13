import io
import json
import os
import re
import time
import zipfile
from datetime import datetime
from pathlib import Path
import pandas as pd
from playwright.sync_api import sync_playwright

SERVER_DIR = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server")
REPORTS_DIR = SERVER_DIR / "relatorios"
SESSION_FILE = SERVER_DIR / "session_state.json"
FORM_IDS_FILE = SERVER_DIR / "form_ids.json"

def read_csv_smart(raw_bytes: bytes) -> pd.DataFrame:
    if not raw_bytes:
        return pd.DataFrame()
    encodings = ["utf-8-sig", "utf-8", "latin-1", "cp1252"]
    separators = [";", ",", "\t"]
    for enc in encodings:
        for sep in separators:
            try:
                df = pd.read_csv(io.BytesIO(raw_bytes), sep=sep, encoding=enc, dtype=str)
                if df.shape[1] > 1:
                    return df
            except Exception:
                continue
    try:
        return pd.read_csv(io.BytesIO(raw_bytes), sep=None, engine="python", encoding="latin-1", dtype=str)
    except Exception:
        return pd.DataFrame()

def read_file_smart(filepath: Path) -> pd.DataFrame:
    if not filepath.exists() or filepath.stat().st_size == 0:
        return pd.DataFrame()
    if zipfile.is_zipfile(filepath):
        try:
            with zipfile.ZipFile(filepath, "r") as zf:
                csv_names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
                target = csv_names[0] if csv_names else zf.namelist()[0]
                return read_csv_smart(zf.read(target))
        except Exception:
            return pd.DataFrame()
    return read_csv_smart(filepath.read_bytes())

def merge_and_save(existing_csv: Path, new_df: pd.DataFrame, json_path: Path):
    if new_df.empty:
        old_df = read_file_smart(existing_csv) if existing_csv.exists() else pd.DataFrame()
        return 0, len(old_df)

    # Identifica coluna de ID
    id_col = None
    for c in new_df.columns:
        clean = c.strip().lower().replace("ï»¿", "")
        if clean in ["id", "código", "codigo", "id do formulário", "id_formulario"]:
            id_col = c
            break
    if not id_col:
        id_col = new_df.columns[0]

    if existing_csv.exists() and existing_csv.stat().st_size > 0:
        old_df = read_file_smart(existing_csv)
        if not old_df.empty:
            old_id_col = None
            for c in old_df.columns:
                if c.strip().lower().replace("ï»¿", "") == id_col.strip().lower().replace("ï»¿", ""):
                    old_id_col = c
                    break
            if old_id_col:
                total_before = len(old_df)
                combined = pd.concat([old_df, new_df], ignore_index=True)
                combined = combined.drop_duplicates(subset=[id_col], keep="last")
                added = len(combined) - total_before
            else:
                combined = new_df.drop_duplicates(subset=[id_col], keep="last")
                added = len(combined)
        else:
            combined = new_df.drop_duplicates(subset=[id_col], keep="last")
            added = len(combined)
    else:
        combined = new_df.drop_duplicates(subset=[id_col], keep="last")
        added = len(combined)

    # Salva CSV
    existing_csv.parent.mkdir(parents=True, exist_ok=True)
    combined.to_csv(existing_csv, sep=";", index=False, encoding="latin-1")
    
    # Salva JSON
    records = combined.to_dict(orient="records")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    return added, len(combined)

def run_extraction():
    with open(SESSION_FILE, "r", encoding="utf-8") as f:
        state = json.load(f)

    with open(FORM_IDS_FILE, "r", encoding="utf-8") as f:
        form_ids = json.load(f)

    today_str = datetime.now().strftime("%d/%m/%Y")
    print(f"=== INICIANDO EXTRAÇÃO DE DADOS MAPFY ATÉ {today_str} ===")

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context()
        context.add_cookies(state.get("cookies", []))
        page = context.new_page()

        print("Garantindo autenticação ativa via Home/Map...")
        page.goto("https://app.mapfy.com.br/Home/Map", wait_until="domcontentloaded", timeout=45000)
        print("Sessão validada com sucesso!")

        resumo = []

        for idx, (form_name, form_id) in enumerate(form_ids.items(), 1):
            folder_name = form_name.replace("/", "_")
            form_folder = REPORTS_DIR / folder_name
            form_folder.mkdir(parents=True, exist_ok=True)
            hist_folder = form_folder / "historico"
            hist_folder.mkdir(parents=True, exist_ok=True)
            dados_csv = form_folder / "dados.csv"
            dados_json = form_folder / "dados.json"

            # Busca última data no CSV local existente
            start_date = "01/01/2026"
            if dados_csv.exists() and dados_csv.stat().st_size > 0:
                old_df = read_file_smart(dados_csv)
                if not old_df.empty:
                    date_cols = [c for c in old_df.columns if any(k in c.lower() for k in ["data", "date", "lancamento"])]
                    found = []
                    for col in date_cols:
                        for v in old_df[col].dropna():
                            m = re.search(r"(\d{2})/(\d{2})/(\d{4})", str(v))
                            if m:
                                try:
                                    found.append(datetime(int(m.group(3)), int(m.group(2)), int(m.group(1))))
                                except ValueError:
                                    pass
                    if found:
                        start_date = max(found).strftime("%d/%m/%Y")

            print(f"\n[{idx}/17] {form_name} (ID: {form_id})")
            print(f"   Intervalo: {start_date} até {today_str}")

            try:
                resp = context.request.post(
                    "https://app.mapfy.com.br/FormEntry/DownloadCSV",
                    form={
                        "FormId": str(form_id),
                        "StartDate": start_date,
                        "FinishDate": today_str,
                        "Username": "",
                        "ExpandGeoList": "true"
                    },
                    timeout=90000
                )

                if resp.status == 200:
                    body = resp.body()
                    new_df = pd.DataFrame()
                    if zipfile.is_zipfile(io.BytesIO(body)):
                        with zipfile.ZipFile(io.BytesIO(body), "r") as zf:
                            csv_names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
                            target = csv_names[0] if csv_names else zf.namelist()[0]
                            raw_csv = zf.read(target)
                            new_df = read_csv_smart(raw_csv)
                            # Salva zip no histórico
                            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                            (hist_folder / f"download_{ts}.zip").write_bytes(body)
                    else:
                        new_df = read_csv_smart(body)
                        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                        (hist_folder / f"download_{ts}.csv").write_bytes(body)

                    added, total = merge_and_save(dados_csv, new_df, dados_json)
                    msg = f"+{added} novos registros. Total: {total}"
                    print(f"   -> SUCESSO: {msg}")
                    resumo.append({"form": form_name, "status": "SUCESSO", "added": added, "total": total})
                else:
                    print(f"   -> ERRO HTTP {resp.status}")
                    resumo.append({"form": form_name, "status": f"HTTP {resp.status}", "added": 0, "total": 0})
            except Exception as e:
                print(f"   -> EXCEÇÃO: {e}")
                resumo.append({"form": form_name, "status": f"ERRO: {e}", "added": 0, "total": 0})

            time.sleep(1)

        # Salva cookies atualizados
        context.storage_state(path=str(SESSION_FILE))
        browser.close()

    print("\n" + "="*60)
    print("RESUMO DA EXTRAÇÃO:")
    print("="*60)
    total_novos = sum(r["added"] for r in resumo)
    total_geral = sum(r["total"] for r in resumo)
    for r in resumo:
        print(f"  {r['form'][:40]:<40} | Status: {r['status']:<10} | Novos: {r['added']:<5} | Total: {r['total']}")
    print(f"\nTOTAL GERAL: {total_novos} novos registros inseridos. Base com {total_geral} registros.")

if __name__ == "__main__":
    run_extraction()
