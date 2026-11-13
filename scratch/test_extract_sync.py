import json
import re
from pathlib import Path

summary_file = Path(r"c:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda\!@#Mapfy_2026\DashBoard\data_summary.json")

with open(summary_file, "r", encoding="utf-8") as f:
    data = json.load(f)

for k, v in data["reports"].items():
    raw = v.get("latest_date", "")
    d_m = re.search(r"\b(\d{2}/\d{2}/\d{4}(?:\s+\d{2}:\d{2})?)\b", raw)
    e_m = re.search(r"([a-zA-Z0-9._%+-]+)@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", raw)
    id_m = re.search(r"\b(\d{6,8})\b", raw)
    date_val = d_m.group(1) if d_m else "N/A"
    op_val = e_m.group(1) if e_m else ""
    reg_val = id_m.group(1) if id_m else ""
    print(f"{k:20} -> Data: {date_val:16} | Op: {op_val:15} | Reg: #{reg_val}")
