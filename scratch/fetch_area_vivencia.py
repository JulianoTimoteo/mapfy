import json
import zipfile
import io
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
    print("Validando sessão...")
    page.goto("https://app.mapfy.com.br/Home/Map", wait_until="networkidle", timeout=60000)
    
    # Query form 1314 (#Check-list área de vivência / Colheita)
    print("Baixando dados de Área de Vivência (FormId 1314) de 01/01/2026 a 13/11/2026...")
    resp = context.request.post(
        "https://app.mapfy.com.br/FormEntry/DownloadCSV",
        form={
            "FormId": "1314",
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
            out_zip = SERVER_DIR / "relatorios" / "#Check-list área de vivência _ Colheita" / "historico" / "full_vivencia_download.zip"
            out_zip.write_bytes(body)
            print("Saved zip to:", out_zip)
            
            # Print top 10 IDs and Dates
            date_col = [c for c in df.columns if any(k in c.lower() for k in ["data", "date"])][0]
            id_col = df.columns[0]
            print("\nTop 10 records:")
            for i in range(min(10, len(df))):
                r = df.iloc[i]
                print(f"  ID={r[id_col]} | {date_col}={r[date_col]} | Resp={r.get('Responsável ') or r.get('Responsável')}")
    else:
        print("Not zip:", body[:300])
        
    browser.close()
