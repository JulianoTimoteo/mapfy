import os
import pandas as pd
from datetime import datetime

folder = None
for f in os.listdir('Server_MapFy/relatorios'):
    if '13' in f or 'Arremate' in f:
        folder = os.path.join('Server_MapFy/relatorios', f)
        break

csv_path = os.path.join(folder, 'dados.csv')
df = pd.read_csv(csv_path, sep=';', encoding='utf-8-sig')

col_score = [c for c in df.columns if c.strip() == 'Score'][0]
col_score_desc = [c for c in df.columns if 'desc' in c.lower()][0]
col_resp = df.columns[15]
col_local = df.columns[12]

print('--- Score 10,00 analysis ---')
score_10 = df[df[col_score].str.contains('10')]
print('Count of Score 10:', len(score_10))
print(score_10[['ID', 'Data', 'Frente', col_resp, col_score, col_score_desc]].head(10))

print('\nDate distribution of Score 10 vs 0:')
def get_month(d):
    try:
        parts = d.split('/')
        return f"{parts[1]}/{parts[2][:4]}"
    except:
        return 'N/D'

df['mes'] = df['Data'].apply(get_month)
print(pd.crosstab(df['mes'], df[col_score]))

print('\nUnique IDs:', df['ID'].nunique(), 'out of', len(df))

def parse_coord(v):
    try: return float(str(v).replace(',', '.'))
    except: return None

df['lat_num'] = df['Latitude'].apply(parse_coord)
df['lon_num'] = df['Longitude'].apply(parse_coord)
valid_c = df['lat_num'].notna() & df['lon_num'].notna() & (df['lat_num'] != 0)
print(f'Valid Coords: {valid_c.sum()} out of {len(df)}')
print('Lat range:', df['lat_num'].min(), 'to', df['lat_num'].max())
print('Lon range:', df['lon_num'].min(), 'to', df['lon_num'].max())

def parse_dt(s):
    for fmt in ('%d/%m/%Y %H:%M', '%d/%m/%Y %H:%M:%S', '%d/%m/%Y'):
        try: return datetime.strptime(str(s).strip(), fmt)
        except: pass
    return datetime.min

df['dt'] = df['Data'].apply(parse_dt)
df_sorted = df.sort_values('dt', ascending=False)
print('Latest Data:', df_sorted.iloc[0]['Data'], 'ID:', df_sorted.iloc[0]['ID'])
print('Oldest Data:', df_sorted.iloc[-1]['Data'], 'ID:', df_sorted.iloc[-1]['ID'])

print('\nFrentes breakdown:')
print(df['Frente'].value_counts())

print('Unique OS:', df['OS'].nunique())
print('Unique Locais:', df[col_local].nunique())
print('Unique Responsaveis:', df[col_resp].nunique())
