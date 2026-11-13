import zipfile, io, re, pandas as pd
from datetime import datetime
from pathlib import Path

zpath = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\relatorios\CHECK LIST VEICULAR\historico\full_2026_download.zip")
with zipfile.ZipFile(zpath, "r") as zf:
    df = pd.read_csv(io.BytesIO(zf.read(zf.namelist()[0])), sep=None, engine="python", dtype=str)

df.columns = [c.replace("\ufeff", "").strip() for c in df.columns]

def parse_and_convert_date(val_str):
    if not val_str or pd.isna(val_str):
        return ""
    val_str = str(val_str).strip()
    
    # Try MM/DD/YYYY hh:mm AM/PM (e.g. 11/11/2026 04:43 PM)
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

# Test on first 10 Date rows
print("Testing date conversion on first 10 Date values:")
for v in df["Date"].head(10):
    converted = parse_and_convert_date(v)
    print(f"  {v} -> {converted}")

# Test on last 5 Date values
print("\nTesting date conversion on last 5 Date values:")
for v in df["Date"].tail(5):
    converted = parse_and_convert_date(v)
    print(f"  {v} -> {converted}")
