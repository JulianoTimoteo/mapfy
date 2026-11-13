import zipfile, io
import pandas as pd
from pathlib import Path

zpath = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\relatorios\CHECK LIST VEICULAR\historico\download_20261113_083519.zip")
with zipfile.ZipFile(zpath, "r") as zf:
    name = zf.namelist()[0]
    raw = zf.read(name)
    df_new = pd.read_csv(io.BytesIO(raw), sep=None, engine="python", dtype=str)
    print("New DF shape:", df_new.shape)
    print("New DF columns:", df_new.columns.tolist())
    print("New DF IDs:", df_new["ID"].tolist())
    print("New DF Dates:", df_new["Date"].tolist())

# Now check existing CSV
csv_path = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\relatorios\CHECK LIST VEICULAR\dados.csv")
df_old = pd.read_csv(csv_path, sep=",", encoding="utf-8-sig", dtype=str)
print("Old DF shape:", df_old.shape)
print("Old DF columns:", df_old.columns.tolist()[:10])

# Check if any new IDs are in old DF
new_ids = set(df_new["ID"].tolist())
old_ids = set(df_old["ID"].tolist())
overlap = new_ids.intersection(old_ids)
print("Overlap IDs count:", len(overlap))
print("NEW IDs count:", len(new_ids - old_ids))
