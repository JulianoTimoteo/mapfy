import sys
from pathlib import Path

server_dir = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server")
sys.path.insert(0, str(server_dir))

from mapfy_extractor import merge_and_save_data

folder = server_dir / "relatorios" / "CHECK LIST VEICULAR"
dl = folder / "historico" / "direct_post_test.csv"
csv_file = folder / "dados.csv"
json_file = folder / "dados.json"

print(f"Merging {dl} into {csv_file} and {json_file}...")
added, total = merge_and_save_data(csv_file, dl, json_file)
print(f"SUCCESS! Added: {added}, Total: {total}")
