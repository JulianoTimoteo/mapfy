import zipfile, io, pandas as pd
from pathlib import Path

zpath = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\relatorios\CHECK LIST VEICULAR\historico\full_2026_download.zip")
with zipfile.ZipFile(zpath, "r") as zf:
    df = pd.read_csv(io.BytesIO(zf.read(zf.namelist()[0])), sep=None, engine="python", dtype=str)

for i in range(15):
    row = df.iloc[i]
    print(f"Row {i:02d}: ID={row.iloc[0]} | Date={row.get('Date')} | Data Hora={row.get('Data Hora')} | Frota={row.get('Frota')[:40] if row.get('Frota') else ''}")
