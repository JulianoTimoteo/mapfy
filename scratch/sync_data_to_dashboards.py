import json
from pathlib import Path
from datetime import datetime

SERVER_DIR = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server")
REPORTS_DIR = SERVER_DIR / "relatorios"
WORKSPACE_DASH = Path("DashBoard")
SERVER_DASH = SERVER_DIR / "DashBoard"

SLUG_CONFIG = {
    "abertura_asa": ("Plantio - 06 - Abertura da Asa", "ABERTURA_ASA_RAW_DATA"),
    "area_vivencia": ("#Check-list Área de vivência _ Colheita", "RAW_INSPECTIONS"),
    "arremate_acabamento": ("Plantio - 13 - Arremate e Acabamento", "ARREMATE_DATA"),
    "broca_armadilha": ("Infestação de Broca - Armadilha", "BROCA_ARMADILHA_DATA"),
    "canteirizacao": ("Plantio - 03.1 - Preparo de Solo - Canteirização", "CANTEIRIZACAO_RAW_DATA"),
    "checklist_veicular": ("CHECK LIST VEICULAR", "CHECKLIST_DATA"),
    "cobricao": ("Plantio - 12 - Cobrição", "COBRICAO_DATA"),
    "dosagem_cobricao": ("Plantio - 11 - Dosagem de Produto - Cobrição", "DOSAGEM_COBRICAO_DATA"),
    "dosagem_sulco": ("Plantio - 04 - Dosagem de Produto - Sulcação", "DOSAGEM_RAW_DATA"),
    "herbicida": ("Tratos - Herbicida", "HERBICIDA_DATA"),
    "paralelismo": ("Plantio - 07 - Paralelismo", "PARALELISMO_RAW_DATA"),
    "qualidade_cana": ("Plantio - 10 - Quantidade de Cana", "QUALIDADE_CANA_DATA"),
    "qualidade_muda": ("Plantio - 08 - Qualidade da muda", "QUALIDADE_MUDA_DATA"),
    "subsolagem": ("Plantio - 03.1 - Preparo de Solo - Subsolagem", "RAW_SUBSOLAGEM"),
    "sulcacao": ("Plantio - 05 - Sulcação", "SULCACAO_RAW_DATA"),
    "tpl_5s": ("5S e Gestão - TPL", "TPL_5S_DATA"),
    "viabilidade_gemas": ("Plantio - 09 - Quantidade de Gemas", "VIABILIDADE_GEMAS_DATA"),
}

summary = {}
total_all = 0
now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

for slug, (folder_name, var_name) in SLUG_CONFIG.items():
    report_folder = REPORTS_DIR / folder_name
    if not report_folder.exists():
        report_folder = REPORTS_DIR / folder_name.replace("/", "_")

    json_file = report_folder / "dados.json"
    if not json_file.exists():
        print(f"JSON not found for {slug} in {report_folder}")
        continue

    with open(json_file, "r", encoding="utf-8") as f:
        records = json.load(f)

    count = len(records)
    total_all += count
    summary[slug] = {
        "folder": folder_name,
        "count": count,
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    # 1. Update live_data in workspace and server
    live_payload = {
        "status": "ok",
        "slug": slug,
        "folder": folder_name,
        "updated_at": datetime.now().isoformat(),
        "total_records": count,
        "records": records
    }
    
    for dash_root in [WORKSPACE_DASH, SERVER_DASH]:
        live_dir = dash_root / "live_data"
        live_dir.mkdir(parents=True, exist_ok=True)
        (live_dir / f"{slug}.json").write_text(json.dumps(live_payload, ensure_ascii=False), encoding="utf-8")

        # 2. Update js/data.js
        target_js = dash_root / slug / "js" / "data.js"
        if target_js.parent.exists():
            header = f"/**\n * Dados Consolidados - {slug}\n * Total: {count} registros\n * Atualizado em: {now_str}\n */\n"
            body = f"window.{var_name} = " + json.dumps(records, ensure_ascii=False, indent=2) + ";\n"
            if slug == "checklist_veicular":
                body += "const CHECKLIST_DATA = window.CHECKLIST_DATA;\n"
            target_js.write_text(header + body, encoding="utf-8")

    print(f"Sincronizado {slug:<22} -> {count:>5} registros")

print(f"\nTOTAL GERAL CONSOLIDADO: {total_all} registros!")

# Write summary files
sum_content = json.dumps({"total_records": total_all, "updated_at": datetime.now().isoformat(), "dashboards": summary}, indent=2)
(WORKSPACE_DASH / "data_summary.json").write_text(sum_content, encoding="utf-8")
(SERVER_DASH / "data_summary.json").write_text(sum_content, encoding="utf-8")
(SERVER_DIR / "data_summary.json").write_text(sum_content, encoding="utf-8")
