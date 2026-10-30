import json, csv, os
from collections import Counter

json_path = "Server_MapFy/relatorios/CHECK LIST VEICULAR/dados.json"
csv_path = "Server_MapFy/relatorios/CHECK LIST VEICULAR/dados.csv"

print(f"Checking {json_path}...")
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total records in JSON: {len(data)}")
if len(data) > 0:
    first = data[0]
    print("\nKeys in first record:")
    for k, v in first.items():
        print(f"  {k}: {repr(v)[:80]}")

# Collect statistics
frotas = Counter()
criticidades = Counter()
videotelemetria = Counter()
abrir_os = Counter()
os_values = Counter()
scores = Counter()
status_list = Counter()
usuarios = Counter()
gestores = Counter()
condutores = Counter()
itens_danificados_raw = Counter()
coordenadas = []
duracoes = []

for r in data:
    frotas[str(r.get("Frota", "")).strip()] += 1
    criticidades[str(r.get("Estado de Criticidade Veículo", "")).strip()] += 1
    videotelemetria[str(r.get("VIDEOTELEMTRIA", "")).strip()] += 1
    abrir_os[str(r.get("Abrir Os", "")).strip()] += 1
    os_val = str(r.get("Os", "")).strip()
    if os_val:
        os_values[os_val] += 1
    scores[str(r.get("Score", "")).strip()] += 1
    status_list[str(r.get("Status", "")).strip()] += 1
    usuarios[str(r.get("Usuário", "")).strip()] += 1
    gestores[str(r.get("GESTORES", "")).strip()] += 1
    condutores[str(r.get("Condutor", "")).strip()] += 1
    
    it = str(r.get("Itens Danificados", "")).strip()
    if it:
        itens_danificados_raw[it] += 1

    try:
        lat = float(str(r.get("Latitude", "0")).replace(",", "."))
        lon = float(str(r.get("Longitude", "0")).replace(",", "."))
        if lat != 0 and lon != 0:
            coordenadas.append((lat, lon))
    except:
        pass

print("\n--- CRITICIDADE VEICULAR ---")
for k, v in criticidades.most_common():
    print(f"  {repr(k)}: {v} ({v/len(data)*100:.1f}%)")

print("\n--- VIDEOTELEMETRIA ---")
for k, v in videotelemetria.most_common():
    print(f"  {repr(k)}: {v}")

print("\n--- ABRIR OS ---")
for k, v in abrir_os.most_common():
    print(f"  {repr(k)}: {v}")

print(f"\n--- OS INFORMADAS: {len(os_values)} distintas (Total preenchidas: {sum(os_values.values())}) ---")
for k, v in os_values.most_common(10):
    print(f"  OS {repr(k)}: {v}")

print("\n--- SCORES ---")
for k, v in scores.most_common():
    print(f"  Score {repr(k)}: {v}")

print("\n--- STATUS ---")
for k, v in status_list.most_common():
    print(f"  Status {repr(k)}: {v}")

print(f"\n--- FROTAS: {len(frotas)} distintas ---")
empty_frotas = frotas.get("", 0)
print(f"  Frotas vazias: {empty_frotas}")
for k, v in frotas.most_common(15):
    if k:
        print(f"  {k}: {v} inspeções")

print(f"\n--- GESTORES: {len(gestores)} distintos ---")
for k, v in gestores.most_common(10):
    print(f"  {k}: {v}")

print(f"\n--- CONDUTORES: {len(condutores)} distintos ---")
for k, v in condutores.most_common(10):
    print(f"  {k}: {v}")

print(f"\n--- COORDENADAS COM GPS: {len(coordenadas)} de {len(data)} ---")
if coordenadas:
    lats = [c[0] for c in coordenadas]
    lons = [c[1] for c in coordenadas]
    print(f"  Lat range: [{min(lats):.6f}, {max(lats):.6f}] (Média: {sum(lats)/len(lats):.6f})")
    print(f"  Lon range: [{min(lons):.6f}, {max(lons):.6f}] (Média: {sum(lons)/len(lons):.6f})")
