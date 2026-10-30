import os
import pandas as pd
import numpy as np
from datetime import datetime

folder = None
for f in os.listdir('Server_MapFy/relatorios'):
    if '12' in f and 'Cobri' in f:
        folder = os.path.join('Server_MapFy/relatorios', f)
        break

csv_path = os.path.join(folder, 'dados.csv')
df = pd.read_csv(csv_path, sep=';', encoding='utf-8-sig')

col_prof = [c for c in df.columns if 'Profundidade' in c][0]
col_resp = [c for c in df.columns if 'Resp' in c][0]
col_loc = [c for c in df.columns if 'Local' in c][0]

df['prof_num'] = pd.to_numeric(df[col_prof].astype(str).str.replace(',', '.'), errors='coerce')

print('--- Statistics of prof_num ---')
print(df['prof_num'].describe())
print('Median:', df['prof_num'].median())

q1 = float(df['prof_num'].quantile(0.25))
q3 = float(df['prof_num'].quantile(0.75))
iqr = q3 - q1
lower_fence = q1 - 1.5 * iqr
upper_fence = q3 + 1.5 * iqr
print(f'Q1={q1}, Q3={q3}, IQR={iqr}, Fences=[{lower_fence}, {upper_fence}]')

outliers = df[(df['prof_num'] < lower_fence) | (df['prof_num'] > upper_fence)]
print(f'Outliers count (IQR 1.5x): {len(outliers)}')
for idx, r in outliers.iterrows():
    print(f"  ID: {r['ID']} | Data: {r['Data']} | Frente: {r['Frente']} | OS: {r['OS']} | Local: {r[col_loc]} | Resp: {r[col_resp]} | Prof: {r[col_prof]}")

def parse_coord(v):
    try: return float(str(v).replace(',', '.'))
    except: return np.nan

df['lat_num'] = df['Latitude'].apply(parse_coord)
df['lon_num'] = df['Longitude'].apply(parse_coord)
valid_coords = df['lat_num'].notna() & df['lon_num'].notna() & (df['lat_num'] != 0) & (df['lon_num'] != 0)
print(f'\nValid Coords: {valid_coords.sum()} out of {len(df)}')
print(f'Lat range: {df["lat_num"].min()} to {df["lat_num"].max()}')
print(f'Lon range: {df["lon_num"].min()} to {df["lon_num"].max()}')

print(f'\nUnique IDs: {df["ID"].nunique()} out of {len(df)}')

def parse_dt(s):
    for fmt in ('%d/%m/%Y %H:%M', '%d/%m/%Y %H:%M:%S', '%d/%m/%Y'):
        try: return datetime.strptime(str(s).strip(), fmt)
        except: pass
    return datetime.min

df['dt'] = df['Data'].apply(parse_dt)
df_sorted = df.sort_values('dt', ascending=False)
print(f'\nLatest record Data: {df_sorted.iloc[0]["Data"]} (ID: {df_sorted.iloc[0]["ID"]})')
print(f'Oldest record Data: {df_sorted.iloc[-1]["Data"]} (ID: {df_sorted.iloc[-1]["ID"]})')

print('\nFrentes breakdown:')
print(df['Frente'].value_counts())

print(f'\nUnique OS: {df["OS"].nunique()}')
print(f'Unique Locais: {df[col_loc].nunique()}')
print(f'Unique Responsaveis: {df[col_resp].nunique()}')
