import zipfile, io, re, pandas as pd
from datetime import datetime
from pathlib import Path

zpath = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\relatorios\CHECK LIST VEICULAR\historico\full_2026_download.zip")
with zipfile.ZipFile(zpath, "r") as zf:
    df = pd.read_csv(io.BytesIO(zf.read(zf.namelist()[0])), sep=None, engine="python", dtype=str)

print("Columns:", df.columns.tolist())

# Clean BOM in column names
df.columns = [c.replace("\ufeff", "").strip() for c in df.columns]

# Check sample dates
for col in ["Date", "Start date", "End date", "Data Hora"]:
    if col in df.columns:
        print(f"\n--- {col} sample ---")
        for val in df[col].dropna().head(10):
            print(" ", val)
