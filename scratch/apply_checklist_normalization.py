import io
import json
import re
import zipfile
import pandas as pd
from datetime import datetime
from pathlib import Path

SERVER_DIR = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server")
WORKSPACE_DIR = Path(".")
BACKUP_DIR = Path("Server_MapFy")
RPI_DIR = Path("Server_MapFy_RaspberryPi")

zpath = SERVER_DIR / "relatorios" / "CHECK LIST VEICULAR" / "historico" / "full_2026_download.zip"

print(f"Lendo dados de {zpath}...")
with zipfile.ZipFile(zpath, "r") as zf:
    raw = zf.read(zf.namelist()[0])
    df = pd.read_csv(io.BytesIO(raw), sep=None, engine="python", dtype=str)

print(f"Total lido: {len(df)} registros")

# 1. Normaliza nomes das colunas
clean_cols = {}
for c in df.columns:
    clean = c.replace("\ufeff", "").strip()
    if clean == "Date":
        clean = "Data"
    elif clean == "User":
        clean = "Usuário"
    elif clean == "Start date":
        clean = "Data início"
    elif clean == "End date":
        clean = "Data Fim"
    clean_cols[c] = clean
df = df.rename(columns=clean_cols)

# Drop any Unnamed column if empty
unnamed = [c for c in df.columns if c.startswith("Unnamed")]
if unnamed:
    df = df.drop(columns=unnamed)

# 2. Função de conversão de datas para DD/MM/YYYY HH:MM
def convert_to_br_date(val):
    if not val or pd.isna(val):
        return ""
    val_str = str(val).strip()
    # Padrões comuns
    for fmt in [
        "%m/%d/%Y %I:%M %p",
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M"
    ]:
        try:
            dt = datetime.strptime(val_str, fmt)
            return dt.strftime("%d/%m/%Y %H:%M")
        except ValueError:
            pass
    return val_str

for dcol in ["Data", "Data início", "Data Fim", "Data Hora"]:
    if dcol in df.columns:
        df[dcol] = df[dcol].apply(convert_to_br_date)

# Ordena por Data decrescente (mais recente primeiro)
def parse_sort_key(dstr):
    if not dstr:
        return datetime.min
    try:
        parts = dstr.split()[0].split("/")
        return datetime(int(parts[2]), int(parts[1]), int(parts[0]))
    except Exception:
        return datetime.min

df["_sort"] = df["Data"].apply(parse_sort_key)
df = df.sort_values(by="_sort", ascending=False).drop(columns=["_sort"])

print("\n--- Amostra das datas normalizadas (mais recentes): ---")
print(df[["ID", "Data", "Data início", "Data Fim", "Frota"]].head(10).to_string())

records = df.to_dict(orient="records")
count = len(records)
now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

# 3. Salva em todos os destinos oficiais
destinations = [
    SERVER_DIR / "relatorios" / "CHECK LIST VEICULAR",
    BACKUP_DIR / "server" / "relatorios" / "CHECK LIST VEICULAR"
]

for d in destinations:
    d.mkdir(parents=True, exist_ok=True)
    csv_file = d / "dados.csv"
    json_file = d / "dados.json"
    df.to_csv(csv_file, sep=";", index=False, encoding="utf-8-sig")
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print(f"Salvo CSV e JSON em {d}")

# 4. Atualiza DashBoard
for dash_root in [WORKSPACE_DIR / "DashBoard", SERVER_DIR / "DashBoard", RPI_DIR / "DashBoard"]:
    if not dash_root.exists():
        continue
    # live_data
    live_file = dash_root / "live_data" / "checklist_veicular.json"
    live_file.parent.mkdir(parents=True, exist_ok=True)
    live_payload = {
        "status": "ok",
        "slug": "checklist_veicular",
        "folder": "CHECK LIST VEICULAR",
        "updated_at": datetime.now().isoformat(),
        "total_records": count,
        "records": records
    }
    live_file.write_text(json.dumps(live_payload, ensure_ascii=False), encoding="utf-8")

    # js/data.js
    data_js = dash_root / "checklist_veicular" / "js" / "data.js"
    if data_js.parent.exists():
        header = f"/**\n * Dados Consolidados - checklist_veicular\n * Total: {count} registros\n * Atualizado em: {now_str}\n */\n"
        body = "window.CHECKLIST_DATA = " + json.dumps(records, ensure_ascii=False, indent=2) + ";\n"
        body += "const CHECKLIST_DATA = window.CHECKLIST_DATA;\n"
        data_js.write_text(header + body, encoding="utf-8")
        print(f"Atualizado {data_js}")

print("\nCONCLUÍDO COM SUCESSO!")
