# -*- coding: utf-8 -*-
"""
normalize_data.py
Script to reliably export clean UTF-8 data.js for Canteirização and Sulcação.
"""
import pandas as pd
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent # workspace root
REPORTS_DIR = BASE_DIR / "Server_MapFy" / "relatorios"

# Find folders dynamically to avoid encoding mismatch in folder names
cant_dir = None
sulc_dir = None
for p in REPORTS_DIR.iterdir():
    if p.is_dir():
        name_lower = p.name.lower()
        if "canteiriz" in name_lower:
            cant_dir = p
        elif "sulca" in name_lower:
            sulc_dir = p

print("Found Canteirização dir:", cant_dir)
print("Found Sulcação dir:", sulc_dir)

# 1. Canteirização
p_cant = cant_dir / "dados.csv"
df_cant = pd.read_csv(p_cant, sep=';', encoding='utf-8-sig', dtype=str)

cols_cant = [
    'ID', 'Usuário', 'Data', 'Latitude', 'Longitude', 'Data início', 'Data Fim',
    'Status', 'Score', 'Score perc.', 'Score desc.', 'Data Lançamento',
    'Local (Fazenda - Talhão)', 'OS', 'Frente', 'Responsável', 'Canteirização', 'Unnamed: 17'
]
df_cant.columns = cols_cant[:len(df_cant.columns)]

records_cant = df_cant.where(pd.notnull(df_cant), None).to_dict(orient='records')
for r in records_cant:
    if r.get('Frente'):
        r['Frente'] = r['Frente'].replace('MOTOMECANIZAO', 'MOTOMECANIZAÇÃO').replace('PITAA', 'PITANGA').strip()
    if r.get('Responsável'):
        r['Responsável'] = r['Responsável'].strip()

out_cant = BASE_DIR / "DashBoard" / "canteirizacao" / "js" / "data.js"
with open(out_cant, 'w', encoding='utf-8') as f:
    f.write('/**\n * Base de Dados Consolidada - Canteirização\n')
    f.write(f' * Total: {len(records_cant)} medições reais\n')
    f.write(' * Usina Pitangueiras - Safra 2026\n */\n\n')
    f.write('window.CANTEIRIZACAO_RAW_DATA = ')
    json.dump(records_cant, f, ensure_ascii=False, indent=2)
    f.write(';\n')

print(f"Canteirização: {len(records_cant)} records written to {out_cant}")

# 2. Sulcação
p_sulc = sulc_dir / "dados.csv"
df_sulc = pd.read_csv(p_sulc, sep=';', encoding='utf-8-sig', dtype=str)

cols_sulc = [
    'ID', 'Usuário', 'Data', 'Latitude', 'Longitude', 'Data início', 'Data Fim',
    'Status', 'Score', 'Data Lançamento', 'Responsável', 'Local (Fazenda - Talhão)',
    'OS', 'Frente', 'Profundidade do Sulco', 'Unnamed: 15'
]
df_sulc.columns = cols_sulc[:len(df_sulc.columns)]

records_sulc = df_sulc.where(pd.notnull(df_sulc), None).to_dict(orient='records')
for r in records_sulc:
    if r.get('Frente'):
        r['Frente'] = r['Frente'].replace('PRPRIA', 'PRÓPRIA').replace('MOTOMECANIZAO', 'MOTOMECANIZAÇÃO').strip()
    if r.get('Responsável'):
        r['Responsável'] = r['Responsável'].strip()

out_sulc = BASE_DIR / "DashBoard" / "sulcacao" / "js" / "data.js"
with open(out_sulc, 'w', encoding='utf-8') as f:
    f.write('/**\n * Base de Dados Consolidada - Sulcação\n')
    f.write(f' * Total: {len(records_sulc)} medições reais\n')
    f.write(' * Usina Pitangueiras - Safra 2026\n */\n\n')
    f.write('window.SULCACAO_RAW_DATA = ')
    json.dump(records_sulc, f, ensure_ascii=False, indent=2)
    f.write(';\n')

print(f"Sulcação: {len(records_sulc)} records written to {out_sulc}")
