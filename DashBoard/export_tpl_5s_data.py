import json, os, re
from datetime import datetime

source_path = 'Server_MapFy/relatorios/5S e Gestão - TPL/dados.json'
out_dir = 'DashBoard/tpl_5s/js'
out_file = os.path.join(out_dir, 'data.js')

os.makedirs(out_dir, exist_ok=True)
os.makedirs('DashBoard/tpl_5s/css', exist_ok=True)
os.makedirs('DashBoard/tpl_5s/assets', exist_ok=True)

# Copy logo
logo_src = 'DashBoard/assets/logo_pitangueiras.png'
logo_dst = 'DashBoard/tpl_5s/assets/logo_pitangueiras.png'
if os.path.exists(logo_src) and not os.path.exists(logo_dst):
    import shutil
    shutil.copyfile(logo_src, logo_dst)

with open(source_path, 'r', encoding='utf-8') as f:
    raw_data = json.load(f)

print(f"Loaded {len(raw_data)} raw records from {source_path}")

processed_records = []

def parse_num(val):
    if val is None:
        return 0.0
    val_str = str(val).replace('.', '').replace(',', '.').strip()
    try:
        return float(val_str)
    except:
        return 0.0

def clean_answer(ans):
    if ans is None:
        return 'N / A'
    s = str(ans).strip().upper()
    if 'NOK' in s or 'NÃO' in s:
        return 'NOK'
    if s == 'OK' or 'SIM' in s:
        return 'OK'
    if 'N' in s and 'A' in s:
        return 'N / A'
    return s if s else 'N / A'

def parse_minutes(d_ini, d_fim):
    if not d_ini or not d_fim:
        return 0
    try:
        fmt = '%d/%m/%Y %H:%M'
        t1 = datetime.strptime(d_ini[:16], fmt)
        t2 = datetime.strptime(d_fim[:16], fmt)
        diff = (t2 - t1).total_seconds() / 60.0
        return max(0, round(diff, 1))
    except:
        return 0

for item in raw_data:
    rec_id = int(item.get('ID', 0)) if str(item.get('ID', '')).isdigit() else item.get('ID', '')
    usuario = str(item.get('Usuário', '') or '').strip()
    data_str = str(item.get('Data', '') or '').strip()
    data_dia = data_str[:10] if len(data_str) >= 10 else ''
    
    lat_val = parse_num(item.get('Latitude'))
    lon_val = parse_num(item.get('Longitude'))
    has_coords = (lat_val != 0.0 and lon_val != 0.0)

    d_ini = str(item.get('Data início', '') or '').strip()
    d_fim = str(item.get('Data Fim', '') or '').strip()
    duracao_min = parse_minutes(d_ini, d_fim)

    status = str(item.get('Status', 'Aberto') or 'Aberto').strip()
    score = str(item.get('Score', '0,00') or '0,00').strip()
    setor = str(item.get('Setor', 'GERAL') or 'GERAL').strip().upper()
    fazenda = str(item.get('Fazenda', '') or '').strip()
    frente = str(item.get('Frente', '') or '').strip()
    resp = str(item.get('Responsável Vistoria', '') or '').strip()
    operacao = str(item.get('Operação', '') or '').strip()

    # Checklist questions
    q01 = clean_answer(item.get('01-Área de vivência está em boas condições de organização e limpeza?'))
    q03 = clean_answer(item.get('03 - Não há itens faltando, quebrados ou com sinais de mal uso?'))
    q04 = clean_answer(item.get('04 - A sinalização está adequada e o acesso ao local é seguro?'))
    q05 = clean_answer(item.get('05 - Boas condições de organização, limpeza e conservação dos equipamentos?'))
    q06 = clean_answer(item.get('06 - Os colaboradores estão utilizando os EPIs adequados?'))
    q07 = clean_answer(item.get('07 - Extintor está válido e carregado?'))

    answers = [q01, q03, q04, q05, q06, q07]
    valid_answers = [a for a in answers if a in ('OK', 'NOK')]
    total_avaliados = len(valid_answers)
    total_ok = sum(1 for a in valid_answers if a == 'OK')
    total_nok = sum(1 for a in valid_answers if a == 'NOK')
    perc_conf = round((total_ok / total_avaliados * 100.0), 1) if total_avaliados > 0 else 100.0
    tem_nok = (total_nok > 0)

    obs = str(item.get('Observação', '') or '').strip()

    # Equipamento detection from obs
    equip_match = re.search(r'(caminh[ãa]o\s*\d+|trator\s*\d+|equip\w*\s*\d+|comboio\s*\d+|ônibus\s*\d+)', obs, re.IGNORECASE)
    equip_str = equip_match.group(1).title() if equip_match else ''

    # Pin color on map
    if not tem_nok:
        pin_color = '#10B981' # Conforme (Verde)
    elif q07 == 'NOK' or q06 == 'NOK':
        pin_color = '#EF4444' # Crítico (Vermelho: Extintor ou EPI NOK)
    else:
        pin_color = '#F59E0B' # Atenção (Âmbar: Outros itens NOK)

    processed_records.append({
        'id': rec_id,
        'usuario': usuario,
        'data': data_str,
        'data_dia': data_dia,
        'lat': lat_val,
        'lon': lon_val,
        'has_coords': has_coords,
        'data_inicio': d_ini,
        'data_fim': d_fim,
        'duracao_min': duracao_min,
        'status': status,
        'score': score,
        'setor': setor,
        'fazenda': fazenda,
        'frente': frente,
        'responsavel': resp,
        'operacao': operacao,
        'q01': q01,
        'q03': q03,
        'q04': q04,
        'q05': q05,
        'q06': q06,
        'q07': q07,
        'total_avaliados': total_avaliados,
        'total_ok': total_ok,
        'total_nok': total_nok,
        'perc_conformidade': perc_conf,
        'tem_nok': tem_nok,
        'obs': obs,
        'equipamento': equip_str,
        'pin_color': pin_color
    })

# Sort by Date descending
def sort_key(r):
    try:
        return datetime.strptime(r['data'][:16], '%d/%m/%Y %H:%M')
    except:
        return datetime.min

processed_records.sort(key=sort_key, reverse=True)

with open(out_file, 'w', encoding='utf-8') as f:
    f.write('/**\n * data.js\n * Registros consolidados de 5S e Gestão - TPL\n * Usina Pitangueiras - Safra 2026\n */\n\n')
    f.write('window.TPL_5S_DATA = ')
    json.dump(processed_records, f, indent=2, ensure_ascii=False)
    f.write(';\n')

print(f"Exported {len(processed_records)} records to {out_file}")
