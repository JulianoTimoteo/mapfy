import shutil
from pathlib import Path

src_dir = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\relatorios")
dst_dir = Path(r"Server_MapFy\server\relatorios")

print(f"Copiando relatórios de {src_dir} para {dst_dir}...")
dst_dir.mkdir(parents=True, exist_ok=True)

copied_count = 0
for folder in src_dir.iterdir():
    if folder.is_dir():
        dst_folder = dst_dir / folder.name
        dst_folder.mkdir(parents=True, exist_ok=True)
        for f in folder.glob("*"):
            if f.is_file():
                dst_file = dst_folder / f.name
                shutil.copy2(f, dst_file)
                copied_count += 1
            elif f.is_dir() and f.name == "historico":
                dst_hist = dst_folder / "historico"
                dst_hist.mkdir(parents=True, exist_ok=True)
                for hf in f.glob("*"):
                    if hf.is_file():
                        shutil.copy2(hf, dst_hist / hf.name)
                        copied_count += 1

# Also copy data_summary.json and form_ids.json
for extra in ["data_summary.json", "form_ids.json"]:
    extra_src = src_dir.parent / extra
    extra_dst = dst_dir.parent / extra
    if extra_src.exists():
        shutil.copy2(extra_src, extra_dst)
        print(f"Copiado {extra} para {extra_dst}")

print(f"Total de {copied_count} arquivos sincronizados com sucesso para o backup Server_MapFy!")
