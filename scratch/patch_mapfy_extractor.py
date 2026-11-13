import re
import py_compile
from pathlib import Path

SYNC_FUNCTION_CODE = '''

def sync_dashboards_data() -> None:
    """Sincroniza os dados consolidados dos relatorios com as pastas dos Dashboards."""
    try:
        from runtime_paths import DASHBOARD_DIR, SERVER_DIR
        dash_dir = DASHBOARD_DIR if DASHBOARD_DIR.is_dir() else (SERVER_DIR / "DashBoard")
        if not dash_dir.is_dir():
            return
        reports_dir = REPORTS_DIR
        if not reports_dir.is_dir():
            return

        import json
        from datetime import datetime

        slug_config = {
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

        now_str = datetime.now().strftime("%d/%m/%Y %H:%M")
        live_dir = dash_dir / "live_data"
        live_dir.mkdir(parents=True, exist_ok=True)

        for slug, (folder_name, var_name) in slug_config.items():
            rep_folder = reports_dir / folder_name
            if not rep_folder.exists():
                rep_folder = reports_dir / folder_name.replace("/", "_")
            json_file = rep_folder / "dados.json"
            if not json_file.exists():
                continue

            with open(json_file, "r", encoding="utf-8") as f:
                records = json.load(f)

            count = len(records)
            live_payload = {
                "status": "ok",
                "slug": slug,
                "folder": folder_name,
                "updated_at": datetime.now().isoformat(),
                "total_records": count,
                "records": records
            }
            (live_dir / f"{slug}.json").write_text(json.dumps(live_payload, ensure_ascii=False), encoding="utf-8")

            target_js = dash_dir / slug / "js" / "data.js"
            if target_js.parent.exists():
                header = f"/**\\n * Dados Consolidados - {slug}\\n * Total: {count} registros\\n * Atualizado em: {now_str}\\n */\\n"
                body = f"window.{var_name} = " + json.dumps(records, ensure_ascii=False, indent=2) + ";\\n"
                if slug == "checklist_veicular":
                    body += "const CHECKLIST_DATA = window.CHECKLIST_DATA;\\n"
                target_js.write_text(header + body, encoding="utf-8")
        log.info("[DASHBOARD] Dados sincronizados com sucesso em DashBoard/")
    except Exception as e:
        log.warning(f"Aviso ao sincronizar DashBoard: {e}")
'''

def patch_file(filepath: Path):
    print(f"Patching {filepath}...")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add direct API extraction
    old_block = '''    try:
        if form_id:
            target_url = f"https://app.mapfy.com.br/FormEntry?formId={form_id}"
            log.info(f"Navegando diretamente via FormId ({form_id}): {target_url}")
            detail_page.goto(target_url, wait_until="domcontentloaded", timeout=35000)
        else:'''

    new_block = '''    try:
        if form_id:
            # 1. Tentativa de extração direta de alta velocidade via API Mapfy
            try:
                log.info(f"Tentando extração direta via API Mapfy para '{form_name}' (FormId: {form_id})...")
                post_data = {
                    "FormId": str(form_id),
                    "StartDate": start_date,
                    "FinishDate": finish_date,
                    "Username": "",
                    "ExpandGeoList": "true"
                }
                api_resp = context.request.post("https://app.mapfy.com.br/FormEntry/DownloadCSV", form=post_data, timeout=90000)
                if api_resp.status == 200:
                    body = api_resp.body()
                    if body and len(body) > 100:
                        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
                        form_folder.mkdir(parents=True, exist_ok=True)
                        history_dir = form_folder / "historico"
                        history_dir.mkdir(parents=True, exist_ok=True)
                        is_zip = body.startswith(b"PK") or "zip" in api_resp.headers.get("content-type", "").lower()
                        raw_ext = "zip" if is_zip else "csv"
                        raw_file = history_dir / f"download_{timestamp_str}.{raw_ext}"
                        raw_file.write_bytes(body)
                        log.info(f"[OK] Download via API concluído ({len(body)} bytes). Salvo em: {raw_file.name}")

                        dados_csv = form_folder / "dados.csv"
                        dados_json = form_folder / "dados.json"
                        added, total = merge_and_save_data(dados_csv, raw_file, dados_json)
                        if added > 0:
                            result["status"] = "SUCESSO"
                            result["added"] = added
                            result["total"] = total
                            result["mensagem"] = f"{added} novos registros adicionados. Total consolidado: {total}."
                            log.info(f"[DADOS CONSOLIDADOS API] {result['mensagem']}")
                        else:
                            result["status"] = "SEM_NOVIDADES"
                            result["added"] = 0
                            result["total"] = total
                            result["mensagem"] = "Nenhum novo registro no período."
                            log.info(f"[INFO API] Formulário '{form_name}' já está atualizado (0 novos registros).")
                        return result
            except Exception as api_err:
                log.warning(f"Extração direta via API falhou para '{form_name}': {api_err}. Prosseguindo via navegador...")

            target_url = f"https://app.mapfy.com.br/FormEntry?formId={form_id}"
            log.info(f"Navegando diretamente via FormId ({form_id}): {target_url}")
            detail_page.goto(target_url, wait_until="domcontentloaded", timeout=35000)
        else:'''

    if old_block in content:
        content = content.replace(old_block, new_block)
        print("  -> Bloco de API direta inserido com sucesso!")
    else:
        print("  -> Bloco de API já presente ou não encontrado!")

    # 2. Update timeout and wait loop
    old_loop = '''        # Aguarda desfecho (download ou count=0)
        start_wait = time.time()
        max_download_wait = 35  # Timeout seguro de 35s sem chamadas bloqueantes de DOM
        has_new_records = True

        while time.time() - start_wait < max_download_wait:
            if downloads:
                break
            if can_export_info["checked"]:
                if can_export_info["count"] == 0:
                    has_new_records = False
                    log.info(f"[SEM DADOS NOVOS] Mapfy retornou count=0 para '{form_name}'.")
                    break
                if not can_export_info["canExport"]:
                    log.warning(f"Limite de registros excedido ({can_export_info['count']}).")
                    break

            time.sleep(0.5)'''

    new_loop = '''        # Aguarda desfecho (download ou count=0)
        start_wait = time.time()
        max_download_wait = 90  # Timeout seguro estendido para 90s
        has_new_records = True

        while time.time() - start_wait < max_download_wait:
            if downloads:
                break
            if can_export_info["checked"]:
                if can_export_info["count"] == 0:
                    has_new_records = False
                    log.info(f"[SEM DADOS NOVOS] Mapfy retornou count=0 para '{form_name}'.")
                    break
                if not can_export_info["canExport"]:
                    log.warning(f"Limite de registros excedido ({can_export_info['count']}).")
                    break

            try:
                detail_page.wait_for_timeout(500)
            except Exception:
                time.sleep(0.5)'''

    if old_loop in content:
        content = content.replace(old_loop, new_loop)
        print("  -> Loop de download estendido para 90s e wait_for_timeout ativo!")
    else:
        print("  -> Loop já atualizado ou padrão diferente!")

    # 3. Add sync_dashboards_data function and call
    if "def sync_dashboards_data()" not in content:
        content += SYNC_FUNCTION_CODE
        print("  -> Função sync_dashboards_data adicionada!")

    if "sync_dashboards_data()" not in content.split("export_dashboard_summary()")[1]:
        content = content.replace(
            "        try:\n            export_dashboard_summary()\n        except Exception:\n            pass",
            "        try:\n            export_dashboard_summary()\n            sync_dashboards_data()\n        except Exception:\n            pass"
        )
        print("  -> Chamada sync_dashboards_data() adicionada após export_dashboard_summary()!")

    # Write back
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    py_compile.compile(str(filepath), doraise=True)
    print(f"  -> {filepath.name} compilado com sucesso sem erros de sintaxe!")

p1 = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\mapfy_extractor.py")
p2 = Path(r"Server_MapFy\server\mapfy_extractor.py")

patch_file(p1)
patch_file(p2)
print("TODOS OS ARQUIVOS PATCHEADOS COM SUCESSO!")
