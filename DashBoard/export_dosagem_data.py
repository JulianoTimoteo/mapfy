# -*- coding: utf-8 -*-
"""
export_dosagem_data.py
Exports clean UTF-8 data.js for Plantio - 04 - Dosagem de Produto - Sulcação.
"""
import pandas as pd
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent # workspace root
REPORTS_DIR = BASE_DIR / "Server_MapFy" / "relatorios"

# Find folder
dos_dir = None
for p in REPORTS_DIR.iterdir():
    if p.is_dir() and "04" in p.name and "dosagem" in p.name.lower():
        dos_dir = p
        break

print("Found Dosagem dir:", dos_dir)

csv_path = dos_dir / "dados.csv"
df = pd.read_csv(csv_path, sep=';', encoding='utf-8-sig', dtype=str)

cols = [
    'ID', 'Usuário', 'Data', 'Latitude', 'Longitude', 'Data início', 'Data Fim',
    'Status', 'Score', 'Data Lançamento', 'Local (Fazenda - Talhão)', 'OS', 'Frente',
    'Responsável', 'Produto', 'Dosagem de Produto - Sulcação', 'Unnamed: 16'
]
df.columns = cols[:len(df.columns)]

records = df.where(pd.notnull(df), None).to_dict(orient='records')
for r in records:
    if r.get('Frente'):
        r['Frente'] = r['Frente'].replace('PRPRIA', 'PRÓPRIA').replace('MOTOMECANIZAO', 'MOTOMECANIZAÇÃO').strip()
    if r.get('Responsável'):
        r['Responsável'] = r['Responsável'].strip()
    if r.get('Produto'):
        r['Produto'] = r['Produto'].strip()

out_file = BASE_DIR / "DashBoard" / "dosagem_sulco" / "js" / "data.js"
with open(out_file, 'w', encoding='utf-8') as f:
    f.write('/**\n * Base de Dados Consolidada - Dosagem de Produto na Sulcação\n')
    f.write(f' * Total: {len(records)} medições reais\n')
    f.write(' * Usina Pitangueiras - Safra 2026\n */\n\n')
    f.write('window.DOSAGEM_RAW_DATA = ')
    json.dump(records, f, ensure_ascii=False, indent=2)
    f.write(';\n')

print(f"Exported {len(records)} records to {out_file}")
