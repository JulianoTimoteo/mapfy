import json
from collections import Counter
import re

json_path = "Server_MapFy/relatorios/CHECK LIST VEICULAR/dados.json"
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total records: {len(data)}")

# 1. Abrir Os vs Os
abrir_os_counts = Counter()
os_counts = Counter()
cross_abrir_os = Counter()

for r in data:
    # Notice trailing space in key 'Abrir Os '
    abrir_val = str(r.get("Abrir Os ", r.get("Abrir Os", ""))).strip()
    os_val = str(r.get("Os", "")).strip()
    abrir_os_counts[abrir_val] += 1
    os_has = "COM_OS" if os_val and os_val != "None" else "SEM_OS"
    cross_abrir_os[(abrir_val, os_has)] += 1

print("\n--- ABRIR OS (corrigido com chave exata) ---")
for k, v in abrir_os_counts.most_common():
    print(f"  {repr(k)}: {v}")

print("\n--- CRUZAMENTO: ABRIR OS x POSSUI NUMERO DE OS ---")
for (ab, os_h), v in cross_abrir_os.most_common():
    print(f"  Abrir Os='{ab}' + {os_h}: {v}")

# 2. Itens Danificados
itens_split = Counter()
itens_with_num = Counter()
inspecoes_com_itens = 0
total_componentes_danificados = 0

for r in data:
    it = r.get("Itens Danificados")
    if it and str(it).strip() and str(it).strip() != "None":
        inspecoes_com_itens += 1
        # Separar por vírgula ou ponto e vírgula
        parts = [p.strip() for p in str(it).split(",") if p.strip()]
        total_componentes_danificados += len(parts)
        for p in parts:
            itens_split[p] += 1
            # Extrair código se houver (ex: '16. Ar-Condicionado')
            m = re.match(r'^(\d+)\.\s*(.+)$', p)
            if m:
                code, name = m.group(1), m.group(2).strip()
                itens_with_num[(code, name)] += 1
            else:
                itens_with_num[("", p)] += 1

print(f"\n--- ITENS DANIFICADOS ---")
print(f"  Inspeções com itens danificados declarados: {inspecoes_com_itens} ({inspecoes_com_itens/len(data)*100:.1f}%)")
print(f"  Total de ocorrências de componentes: {total_componentes_danificados}")
print(f"  Componentes distintos catalogados: {len(itens_with_num)}")
print("  Top componentes mais frequentes:")
for (code, name), count in itens_with_num.most_common(20):
    code_str = f"[{code}] " if code else ""
    print(f"    {code_str}{name}: {count} ocorrências")

# 3. Observações
obs_counts = Counter()
com_obs = 0
sem_avaria_obs = 0
frota_na_obs = []

for r in data:
    obs = r.get("Observacoes")
    if obs and str(obs).strip() and str(obs).strip() != "None":
        com_obs += 1
        obs_str = str(obs).strip()
        obs_lower = obs_str.lower()
        if "sem avaria" in obs_lower or "sem a avaria" in obs_lower or "sem avarias" in obs_lower:
            sem_avaria_obs += 1
        if "frota" in obs_lower:
            frota_na_obs.append((r.get("ID"), r.get("Frota"), obs_str))

print(f"\n--- OBSERVAÇÕES ---")
print(f"  Registros com observações preenchidas: {com_obs} ({com_obs/len(data)*100:.1f}%)")
print(f"  Observações indicando 'Sem avaria': {sem_avaria_obs}")
print(f"  Observações mencionando palavra 'Frota': {len(frota_na_obs)}")
for fid, frota, obs in frota_na_obs[:5]:
    print(f"    ID {fid} | Frota: {frota} | Obs: {obs}")

# 4. Análise de Frotas (Parsing dos Veículos)
frotas_parsed = {}
for r in data:
    fr = str(r.get("Frota", "")).strip()
    if fr and fr != "None":
        # Formato típico: '462925 - FIAT MOBI TREKKING 1.0 - ALUGADO(TEL2A01)'
        # ou '100221 - CHEVROLET S10 LT FD4(GHO3H41)'
        # ou '100124 - L200 TRITON GLX 2.4 4X4'
        m = re.match(r'^(\d+)\s*-\s*([^(\n]+?)(?:\s*-\s*([^(\n]+?))?(?:\(([^)]+)\))?$', fr)
        if m:
            code = m.group(1).strip()
            part1 = m.group(2).strip() if m.group(2) else ""
            part2 = m.group(3).strip() if m.group(3) else ""
            placa = m.group(4).strip() if m.group(4) else ""
            
            # Verificar se part2 tem ALUGADO ou modelo
            alugado = "ALUGADO" if "ALUGAD" in fr.upper() else "PRÓPRIO"
            modelo = f"{part1} {part2}".replace("ALUGADO", "").replace("ALUGADA", "").strip(" -")
            
            if code not in frotas_parsed:
                frotas_parsed[code] = {
                    "code": code,
                    "raw": fr,
                    "modelo": modelo,
                    "placa": placa,
                    "tipo": alugado,
                    "count": 0
                }
            frotas_parsed[code]["count"] += 1
        else:
            code = fr.split()[0] if fr.split() else fr
            if code not in frotas_parsed:
                frotas_parsed[code] = {"code": code, "raw": fr, "modelo": fr, "placa": "", "tipo": "OUTRO", "count": 0}
            frotas_parsed[code]["count"] += 1

print(f"\n--- FROTAS NORMALIZADAS: {len(frotas_parsed)} veículos únicos identificados ---")
# Tipos de veículos
alugados = sum(1 for f in frotas_parsed.values() if f["tipo"] == "ALUGADO")
proprios = sum(1 for f in frotas_parsed.values() if f["tipo"] != "ALUGADO")
print(f"  Veículos Alugados: {alugados}, Próprios/Outros: {proprios}")

# 5. Datas e Período Histórico
datas = []
for r in data:
    d = str(r.get("Data", "")).strip()
    if d and d != "None":
        datas.append(d)

print(f"\n--- DATAS ---")
print(f"  Primeira data registrada: {datas[-1] if datas else 'N/A'}")
print(f"  Última data registrada: {datas[0] if datas else 'N/A'}")
