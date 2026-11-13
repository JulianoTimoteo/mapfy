import json
import zipfile
import io
import time
import pandas as pd
from pathlib import Path
from playwright.sync_api import sync_playwright

SERVER_DIR = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server")
SESSION_FILE = SERVER_DIR / "session_state.json"

with open(SESSION_FILE, "r", encoding="utf-8") as f:
    state = json.load(f)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    context = browser.new_context()
    context.add_cookies(state.get("cookies", []))
    
    page = context.new_page()
    print("Navegando para Home/Map...")
    page.goto("https://app.mapfy.com.br/Home/Map", wait_until="networkidle", timeout=60000)
    time.sleep(3)
    print("URL atual:", page.url)
    
    # Save refreshed cookies
    context.storage_state(path=str(SESSION_FILE))
    print("Cookies atualizados!")
    
    # Query form 1266
    print("Baixando dados completos de CHECK LIST VEICULAR (FormId 1266)...")
    resp = context.request.post(
        "https://app.mapfy.com.br/FormEntry/DownloadCSV",
        form={
            "FormId": "1266",
            "StartDate": "01/01/2026",
            "FinishDate": "13/11/2026",
            "Username": "",
            "ExpandGeoList": "true"
        },
        timeout=90000
    )
    print("Status:", resp.status)
    body = resp.body()
    print("Body length:", len(body))
    
    if body.startswith(b"PK"):
        with zipfile.ZipFile(io.BytesIO(body), "r") as zf:
            name = zf.namelist()[0]
            raw = zf.read(name)
            df = pd.read_csv(io.BytesIO(raw), sep=None, engine="python", dtype=str)
            print("Total rows:", len(df))
            print("Columns:", df.columns.tolist()[:10])
            
            # Save raw zip
            out_zip = SERVER_DIR / "relatorios" / "CHECK LIST VEICULAR" / "historico" / "full_2026_download.zip"
            out_zip.write_bytes(body)
            print("Saved zip to:", out_zip)
            
            for col in df.columns:
                if any(k in col.lower() for k in ["date", "data"]):
                    sample = df[col].dropna().tolist()
                    print(f"Col {col} (first 3, last 5):", sample[:3], sample[-5:])
    else:
        print("Not zip:", body[:200])
        
    browser.close()
