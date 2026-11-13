import pandas as pd
from pathlib import Path

csv_path = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\relatorios\CHECK LIST VEICULAR\dados.csv")
df = pd.read_csv(csv_path, sep=",", encoding="utf-8-sig", dtype=str)
for col in ["Data", "Data início", "Data Fim"]:
    if col in df.columns:
        s = df[col].dropna().tolist()
        print(f"Col {col}: first 3 = {s[:3]}, last 3 = {s[-3:]}")
