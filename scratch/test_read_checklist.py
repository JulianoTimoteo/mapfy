import pandas as pd
from pathlib import Path

csv_path = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\relatorios\CHECK LIST VEICULAR\dados.csv")
try:
    df = pd.read_csv(csv_path, sep=",", encoding="utf-8-sig", dtype=str)
    print("SUCCESS with sep=','!")
    print("Shape:", df.shape)
    print("Columns:", df.columns.tolist()[:10])
except Exception as e:
    print("FAILED with sep=',':", e)
