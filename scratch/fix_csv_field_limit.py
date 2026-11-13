from pathlib import Path

p1 = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\mapfy_extractor.py")
p2 = Path(r"Server_MapFy\server\mapfy_extractor.py")

for p in [p1, p2]:
    text = p.read_text(encoding="utf-8")
    old = "        import csv\n        forms_catalog = ["
    new = "        import csv\n        try:\n            csv.field_size_limit(100_000_000)\n        except Exception:\n            pass\n        forms_catalog = ["
    if old in text:
        text = text.replace(old, new)
        p.write_text(text, encoding="utf-8")
        print(f"Updated csv.field_size_limit in {p.name}")
    else:
        print(f"Pattern not found in {p.name}")
