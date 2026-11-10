#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mapfy_extractor.py
==================
Robô de extração incremental, estruturação e consolidação de relatórios do Mapfy.

Funcionalidades:
  1. Login transparente via Microsoft Edge (Azure AD SSO / Gatec).
     Salva e reutiliza a sessão em 'session_state.json' automaticamente.
  2. Mapeia todos os formulários da página: https://app.mapfy.com.br/m/FormEntry/List
  3. Para cada formulário:
     - Detecta o histórico local em 'relatorios/<Nome_do_Formulario>/dados.csv'.
     - Se for a primeira vez: Data Inicial = 01/01/2026.
     - Se já houver dados: Data Inicial = última data registrada no relatório.
     - Data Final = data atual (hoje).
     - Abre o formulário, aciona o modal de exportação CSV.
     - Aplica as datas via Kendo DatePicker e confirma o download.
     - Se não houver novos dados no período (count = 0), pula silenciosamente sem erros.
     - Se houver novos dados:
       * Salva o CSV bruto em 'relatorios/<Nome_do_Formulario>/historico/'.
       * Concatena com os dados existentes e deduplica pelo 'Id' (mantendo sempre os dados atualizados).
       * Nunca apaga dados antigos.
       * Salva o consolidado atualizado em 'dados.csv' e 'dados.json'.
  4. Repete o processo para todos os formulários da lista.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import logging
import os
import re
import sys
import time
import zipfile
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

import pandas as pd
from dotenv import load_dotenv
from playwright.sync_api import Page, BrowserContext, sync_playwright, TimeoutError as PlaywrightTimeout
from runtime_paths import (
    ENV_FILE,
    LEGACY_ENV_FILE,
    LEGACY_SESSION_FILE,
    PROJECT_DIR,
    PROJECT_ROOT,
    REPORTS_DIR,
    SESSION_FILE,
)

# =============================================================================
# DIRETÓRIOS E CONFIGURAÇÃO
# =============================================================================
BASE_DIR = PROJECT_DIR
RELATORIOS_DIR = REPORTS_DIR
LOG_FILE = REPORTS_DIR.parent / "mapfy_extractor.log"
EXTRACTION_LOCK_FILE = REPORTS_DIR.parent / ".extraction.lock"

from contextlib import contextmanager

@contextmanager
def _extraction_lock():
    lock_file = EXTRACTION_LOCK_FILE
    if lock_file.exists():
        raise RuntimeError("Já existe outra extração em andamento.")
    try:
        lock_file.touch()
        yield
    finally:
        if lock_file.exists():
            try:
                lock_file.unlink()
            except Exception:
                pass

load_dotenv(ENV_FILE if ENV_FILE.is_file() else LEGACY_ENV_FILE)

MAPFY_HUB_URL = "https://app.mapfy.com.br/m/FormEntry/List"
FIRST_RUN_DATE = "01/01/2026"
FORM_IDS_FILE = BASE_DIR / "form_ids.json"

KNOWN_ACTIVE_FORMS_2026 = [
    "#Check-list área de vivência / Colheita",
    "5S e Gestão - TPL",
    "CHECK LIST VEICULAR",
    "Infestação de Broca - Armadilha",
    "Plantio - 03.1 - Preparo de Solo - Canteirização",
    "Plantio - 03.1 - Preparo de Solo - Subsolagem",
    "Plantio - 04 - Dosagem de Produto - Sulcação",
    "Plantio - 05 - Sulcação",
    "Plantio - 06 - Abertura da Asa",
    "Plantio - 07 - Paralelismo",
    "Plantio - 08 - Qualidade da muda",
    "Plantio - 09 - Quantidade de Gemas",
    "Plantio - 10 - Quantidade de Cana",
    "Plantio - 11 - Dosagem de Produto - Cobrição",
    "Plantio - 12 - Cobrição",
    "Plantio - 13 - Arremate e Acabamento",
    "Tratos - Herbicida",
]


def load_form_ids() -> dict[str, int]:
    if FORM_IDS_FILE.exists():
        try:
            with open(FORM_IDS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_form_id(form_name: str, form_id: int) -> None:
    try:
        data = load_form_ids()
        data[form_name] = int(form_id)
        with open(FORM_IDS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        log.info(f"[CACHE] FormId {form_id} memorizado para '{form_name}'.")
    except Exception as e:
        log.warning(f"Aviso ao salvar form_id para '{form_name}': {e}")


RELATORIOS_DIR.mkdir(parents=True, exist_ok=True)

# =============================================================================
# LOGGING
# =============================================================================
log = logging.getLogger("mapfy_extractor")
logger = log
log.setLevel(logging.INFO)

fmt = logging.Formatter("%(asctime)s | %(levelname)-7s | %(message)s", "%Y-%m-%d %H:%M:%S")
file_handler = RotatingFileHandler(LOG_FILE, maxBytes=5_000_000, backupCount=5, encoding="utf-8")
file_handler.setFormatter(fmt)
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(fmt)

if not log.handlers:
    log.addHandler(file_handler)
    log.addHandler(console_handler)


# =============================================================================
# UTILITÁRIOS DE ARQUIVOS E DADOS
# =============================================================================
def sanitize_name(name: str) -> str:
    """Higieniza o nome do formulário para uso seguro em pastas do Windows."""
    clean = re.sub(r'[\\/*?:"<>|]', '_', name)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


def read_csv_smart(filepath: Path) -> pd.DataFrame:
    """Lê CSV testando ZIP compactado ou CSV direto com múltiplos encodings e delimitadores."""
    if not filepath.exists() or filepath.stat().st_size == 0:
        return pd.DataFrame()

    raw_bytes: bytes | None = None
    if zipfile.is_zipfile(filepath):
        try:
            with zipfile.ZipFile(filepath, "r") as zf:
                csv_names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
                target_name = csv_names[0] if csv_names else zf.namelist()[0]
                raw_bytes = zf.read(target_name)
        except Exception as e:
            log.warning(f"Erro ao descompactar {filepath.name}: {e}")
            return pd.DataFrame()
    else:
        raw_bytes = filepath.read_bytes()

    if not raw_bytes:
        return pd.DataFrame()

    encodings = ["utf-8-sig", "utf-8", "latin-1", "cp1252"]
    separators = [";", ",", "\t"]

    for enc in encodings:
        for sep in separators:
            try:
                df = pd.read_csv(io.BytesIO(raw_bytes), sep=sep, encoding=enc, dtype=str)
                if df.shape[1] > 1:
                    return df
            except Exception:
                continue

    # Fallback automático
    try:
        return pd.read_csv(io.BytesIO(raw_bytes), sep=None, engine="python", encoding="latin-1", dtype=str)
    except Exception as e:
        log.warning(f"Erro ao ler CSV {filepath.name}: {e}")
        return pd.DataFrame()


def find_latest_date_in_csv(filepath: Path) -> str | None:
    """
    Inspeciona o CSV consolidado e localiza a maior data registrada.
    Retorna no formato DD/MM/YYYY ou None.
    """
    if not filepath.exists() or filepath.stat().st_size == 0:
        return None

    df = read_csv_smart(filepath)
    if df.empty:
        return None

    # Procura colunas com indicativo de data
    date_cols = [
        c for c in df.columns
        if any(k in c.lower() for k in ["data", "date", "sincronizacao", "criacao", "inicio"])
    ]

    found_dates: list[datetime] = []
    for col in date_cols:
        series = df[col].dropna()
        for raw_val in series:
            val_str = str(raw_val).strip()
            # Formato brasileiro DD/MM/YYYY
            m_br = re.search(r"(\d{2})/(\d{2})/(\d{4})", val_str)
            if m_br:
                d, mth, y = int(m_br.group(1)), int(m_br.group(2)), int(m_br.group(3))
                try:
                    found_dates.append(datetime(y, mth, d))
                except ValueError:
                    pass
                continue
            # Formato ISO YYYY-MM-DD
            m_iso = re.search(r"(\d{4})-(\d{2})-(\d{2})", val_str)
            if m_iso:
                y, mth, d = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
                try:
                    found_dates.append(datetime(y, mth, d))
                except ValueError:
                    pass

    if found_dates:
        latest = max(found_dates)
        return latest.strftime("%d/%m/%Y")

    return None


def safe_atomic_save_df(df: pd.DataFrame, target_path: Path, is_csv: bool = False, is_json: bool = False) -> None:
    """
    Salva DataFrame de forma atomica e resiliente contra locks do OneDrive (WinError 5).
    Usa estrategia de 3 niveis:
    1. Grava no arquivo .tmp e tenta os.replace().
    2. Se os.replace() falhar por WinError 5 / PermissionError, remove target_path e renomeia.
    3. Se ainda assim falhar por lock mantido pelo OneDrive, grava diretamente em target_path.
    """
    tmp_path = target_path.with_suffix(f"{target_path.suffix}.tmp")
    try:
        if is_csv:
            df.to_csv(tmp_path, index=False, encoding="utf-8-sig")
        elif is_json:
            df.to_json(tmp_path, orient="records", force_ascii=False, indent=2)

        try:
            tmp_path.replace(target_path)
        except (PermissionError, OSError):
            time.sleep(0.1)
            try:
                if target_path.exists():
                    target_path.unlink()
                tmp_path.rename(target_path)
            except Exception:
                # Nivel 3: Gravacao direta de contingencia
                if is_csv:
                    df.to_csv(target_path, index=False, encoding="utf-8-sig")
                elif is_json:
                    df.to_json(target_path, orient="records", force_ascii=False, indent=2)
                if tmp_path.exists():
                    try:
                        tmp_path.unlink()
                    except Exception:
                        pass
    except Exception as e:
        logger.error(f"Erro ao salvar com seguranca {target_path.name}: {e}")
        # Ultimo fallback direto
        try:
            if is_csv:
                df.to_csv(target_path, index=False, encoding="utf-8-sig")
            elif is_json:
                df.to_json(target_path, orient="records", force_ascii=False, indent=2)
        except Exception as e_final:
            logger.error(f"Falha critica definitiva ao salvar {target_path.name}: {e_final}")


def merge_and_save_data(
    existing_csv: Path,
    new_csv: Path,
    json_path: Path
) -> tuple[int, int]:
    """
    Mescla o novo CSV com a base existente, deduplicando por 'Id'.
    Retorna (registros_adicionados, total_final).
    """
    new_df = read_csv_smart(new_csv)
    if new_df.empty:
        return 0, 0

    env_id = os.getenv("ID_COLUMN")
    id_col = None
    if env_id:
        for c in new_df.columns:
            if c.strip().lower() == env_id.strip().lower():
                id_col = c
                break
        if not id_col:
            raise ValueError(f"O CSV não contém a coluna identificadora '{env_id}'.")
    else:
        # Localiza coluna de Id para deduplicação
        for c in new_df.columns:
            if c.strip().lower() in ["id", "código", "codigo", "id do formulário", "id_formulario"]:
                id_col = c
                break
        if not id_col:
            id_col = new_df.columns[0]

    if existing_csv.exists() and existing_csv.stat().st_size > 0:
        old_df = read_csv_smart(existing_csv)
        old_id_col = None
        for c in old_df.columns:
            if c.strip().lower() == id_col.strip().lower():
                old_id_col = c
                break
        if not old_id_col:
            raise ValueError(f"O CSV existente não contém a coluna identificadora '{id_col}'.")
        total_before = len(old_df)
        combined_df = pd.concat([old_df, new_df], ignore_index=True)
        # Deduplica pelo Id mantendo a linha mais recente
        combined_df = combined_df.drop_duplicates(subset=[id_col], keep="last")
        added = len(combined_df) - total_before
    else:
        combined_df = new_df.drop_duplicates(subset=[id_col], keep="last")
        added = len(combined_df)

    # Gravação atômica segura do CSV consolidado (com tolerância a locks do OneDrive)
    safe_atomic_save_df(combined_df, existing_csv, is_csv=True)

    # Gravação atômica segura do JSON para consumo ágil em dashboards
    safe_atomic_save_df(combined_df, json_path, is_json=True)

    return added, len(combined_df)


# =============================================================================
# MANIPULAÇÃO DA INTERFACE MAPFY (PLAYWRIGHT)
# =============================================================================
def set_kendo_dates(page: Page, start_str: str, finish_str: str) -> None:
    """
    Define as datas nos componentes Kendo UI DatePicker (#StartDate e #FinishDate)
    usando a API JavaScript do Kendo para garantir validação correta.
    """
    page.evaluate(
        """
        ([sDate, fDate]) => {
            function parseBRDate(str) {
                var p = str.split('/');
                return new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
            }
            var dStart = parseBRDate(sDate);
            var dFinish = parseBRDate(fDate);

            var dpStart = $("#StartDate").data("kendoDatePicker");
            if (dpStart) {
                dpStart.value(dStart);
                dpStart.trigger("change");
            }
            $("#StartDate").val(sDate).trigger("input").trigger("change").trigger("blur");

            var dpFinish = $("#FinishDate").data("kendoDatePicker");
            if (dpFinish) {
                dpFinish.value(dFinish);
                dpFinish.trigger("change");
            }
            $("#FinishDate").val(fDate).trigger("input").trigger("change").trigger("blur");

            var form = $("form#entry-filter-form");
            if (form.length && form.valid) {
                form.valid();
            }
        }
        """,
        [start_str, finish_str]
    )


def ensure_authenticated(
    page: Page,
    context: BrowserContext,
    username: str,
    password: str
) -> None:
    """
    Garante que a sessão está autenticada.
    Se já estiver logado, aproveita os cookies salvos em session_state.json.
    Se redirecionar para a Gatec / Azure AD, realiza o login automático via SSO.
    """
    log.info(f"Navegando para a central de formulários: {MAPFY_HUB_URL}")
    try:
        page.goto(MAPFY_HUB_URL, timeout=45000, wait_until="domcontentloaded")
    except Exception as e:
        log.warning(f"Aviso na navegação inicial: {e}")

    # 1. Verifica se já está na tela principal de formulários
    try:
        page.wait_for_selector(".gm-zr, .gm-vc, h4:has-text('Escolha um formulário')", timeout=15000)
        log.info("[AUTENTICAÇÃO] Sessão ativa e autenticada.")
        context.storage_state(path=str(SESSION_FILE))
        return
    except PlaywrightTimeout:
        pass

    log.info(f"Sessão não autenticada. URL atual: {page.url}")
    log.info("Iniciando fluxo automático de login...")

    # 2. Se estiver na tela da Gatec, tenta Azure AD ou login direto por formulário
    if "gatec.com.br" in page.url or "login" in page.url.lower():
        try:
            # Tenta clicar no botao Azure AD primeiro
            btn_aad = page.query_selector("a.box-auth-aad, a:has-text('Sign in with Azure AD')")
            if btn_aad:
                log.info("Clicando no botão de autenticação Azure AD...")
                btn_aad.click()
                page.wait_for_timeout(3000)
            else:
                # Se não houver Azure AD, tenta preencher campos nativos da Gatec
                user_gatec = page.query_selector("input#Username, input[name='Username']")
                pass_gatec = page.query_selector("input#Password, input[name='Password']")
                if user_gatec and pass_gatec:
                    log.info("Preenchendo credenciais no formulário nativo Gatec...")
                    user_gatec.fill(username)
                    pass_gatec.fill(password)
                    btn_login = page.query_selector("button.button-login, button:has-text('Entrar')")
                    if btn_login:
                        btn_login.click()
                    else:
                        page.keyboard.press("Enter")
                    page.wait_for_timeout(4000)
        except Exception as e:
            log.warning(f"Aviso na etapa inicial da Gatec: {e}")

    # 3. Se redirecionou para Microsoft Azure AD (login.microsoftonline.com)
    if "microsoftonline.com" in page.url or "live.com" in page.url:
        log.info("Detectada tela de autenticação Microsoft Azure AD...")
        try:
            email_inp = page.wait_for_selector("input[name='loginfmt'], input[type='email']", timeout=12000)
            if email_inp:
                email_inp.fill(username)
                page.locator("input[type='submit'], button[type='submit']").click()
                page.wait_for_timeout(2000)
        except Exception:
            pass

        try:
            pass_inp = page.wait_for_selector("input[name='passwd'], input[type='password']", timeout=12000)
            if pass_inp:
                pass_inp.fill(password)
                page.locator("input[type='submit'], button[type='submit']").click()
                page.wait_for_timeout(2000)
        except Exception:
            pass

        try:
            btn_kmsi = page.wait_for_selector("#idSIButton9, input[value='Yes'], input[value='Sim']", timeout=10000)
            if btn_kmsi:
                btn_kmsi.click()
        except Exception:
            pass

    # 4. Aguarda chegada na tela de formulários do Mapfy
    log.info("Aguardando confirmação de acesso na central Mapfy...")
    try:
        page.wait_for_selector(".gm-zr, .gm-vc, h4:has-text('Escolha um formulário')", timeout=45000)
        log.info("[SUCESSO] Login concluído e formulários carregados!")
        context.storage_state(path=str(SESSION_FILE))
        log.info(f"[OK] Sessão salva em {SESSION_FILE.name}")
    except Exception as exc:
        diag_path = REPORTS_DIR / "login_diagnostico.png"
        try:
            page.screenshot(path=str(diag_path))
            log.warning(f"Screenshot de diagnóstico salvo em: {diag_path}")
        except Exception:
            pass
        raise exc


def extract_form_data(
    context: BrowserContext,
    page: Page,
    form_name: str,
    form_folder: Path,
    start_date: str,
    finish_date: str
) -> dict[str, Any]:
    """
    Executa o fluxo completo de extração para um formulário específico:
    1. Se o formId for conhecido, navega diretamente via URL (https://app.mapfy.com.br/FormEntry?formId=...).
    2. Caso contrário, busca na central via campo de pesquisa, clica em 'Visualizar' e memoriza o formId.
    3. Clica em 'CSV'.
    4. Configura o filtro de datas.
    5. Clica em 'Download'.
    6. Trata a resposta de forma assíncrona e resiliente (download vs count=0).
    7. Atualiza o banco de dados local consolidado.
    """
    result = {
        "form": form_name,
        "start_date": start_date,
        "finish_date": finish_date,
        "status": "INICIANDO",
        "added": 0,
        "total": 0,
        "mensagem": ""
    }

    log.info("-" * 65)
    log.info(f"PROCESSANDO FORMULÁRIO: {form_name}")
    log.info(f"Intervalo solicitado: {start_date} até {finish_date}")

    form_ids = load_form_ids()
    form_id = form_ids.get(form_name)

    detail_page: Page = page
    is_new_tab = False

    try:
        if form_id:
            target_url = f"https://app.mapfy.com.br/FormEntry?formId={form_id}"
            log.info(f"Navegando diretamente via FormId ({form_id}): {target_url}")
            detail_page.goto(target_url, wait_until="domcontentloaded", timeout=35000)
        else:
            log.info(f"FormId não memorizado para '{form_name}'. Localizando na central de formulários...")
            if "FormEntry/List" not in page.url:
                page.goto(MAPFY_HUB_URL, wait_until="domcontentloaded", timeout=35000)

            # Aguarda a tela carregar
            page.wait_for_selector(".gm-w8, input[placeholder='Pesquisar']", timeout=15000)

            # Digita no campo de pesquisa
            search_input = page.locator(".gm-w8, input[placeholder='Pesquisar']").first
            search_input.fill("")
            time.sleep(0.3)
            search_input.fill(form_name)
            time.sleep(1)

            card = page.locator(".gm-zr, .gm-vc").filter(has_text=form_name).first
            try:
                card.wait_for(state="visible", timeout=12000)
            except Exception:
                # Tenta palavra-chave se nome longo não achar
                keywords = [w for w in form_name.split() if len(w) > 3 and not w.startswith("#")]
                found = False
                for kw in keywords:
                    search_input.fill(kw)
                    time.sleep(1)
                    card = page.locator(".gm-zr, .gm-vc").filter(has_text=form_name).first
                    if card.count() > 0:
                        found = True
                        break
                if not found:
                    msg = f"Card com título '{form_name}' não encontrado na página de pesquisa."
                    log.error(msg)
                    result["status"] = "ERRO"
                    result["mensagem"] = msg
                    return result

            card.scroll_into_view_if_needed()
            btn_visualizar = card.locator(".gm-zv, .gm-vi, button:has-text('Visualizar')").first

            try:
                with context.expect_page(timeout=5000) as new_page_info:
                    btn_visualizar.click()
                detail_page = new_page_info.value
                is_new_tab = True
                log.info("Página de detalhes aberta em nova aba.")
            except Exception:
                detail_page = page
                is_new_tab = False
                log.info("Página de detalhes aberta na mesma aba.")

            # Aguarda navegação e detecta o formId
            try:
                detail_page.wait_for_url(lambda u: "formId=" in u or "FormEntry" in u, timeout=15000)
                url_match = re.search(r"formId=(\d+)", detail_page.url)
                if url_match:
                    detected_id = int(url_match.group(1))
                    save_form_id(form_name, detected_id)
            except Exception:
                pass

        # Aguarda carregamento da página de detalhes (botão CSV visível)
        btn_csv = detail_page.locator('[data-testid="formentry-button-csv"], #csv, button:has-text("CSV")').first
        btn_csv.wait_for(state="visible", timeout=25000)
        log.info("Botão 'CSV' localizado. Abrindo modal de filtros...")
        btn_csv.click()

        # Aguarda modal de filtro e especificamente os inputs de data e botão de confirmação
        log.info("Aguardando inicialização do modal e dos seletores de data...")
        detail_page.wait_for_selector("#StartDate", state="visible", timeout=20000)
        detail_page.wait_for_selector("#FinishDate", state="visible", timeout=20000)
        detail_page.wait_for_selector("#btnConfirm", state="visible", timeout=20000)
        time.sleep(1)

        # Configura as datas
        log.info(f"Aplicando datas no Kendo DatePicker: Início={start_date}, Fim={finish_date}")
        set_kendo_dates(detail_page, start_date, finish_date)
        time.sleep(1)

        # Monitor de resposta do CanExport e listener de download
        can_export_info: dict[str, Any] = {"checked": False, "count": None, "canExport": None}
        downloads: list[Any] = []

        def on_response(resp):
            if "/FormEntry/CanExport" in resp.url:
                try:
                    data = resp.json()
                    can_export_info["checked"] = True
                    can_export_info["count"] = data.get("count", 0)
                    can_export_info["canExport"] = data.get("canExport", True)
                except Exception:
                    pass

        def on_download(dl):
            downloads.append(dl)

        detail_page.on("response", on_response)
        context.on("download", on_download)

        # Clica no botão 'Download' (#btnConfirm)
        log.info("Acionando botão '#btnConfirm' (Download)...")
        detail_page.locator("#btnConfirm").click()

        # Aguarda desfecho (download ou count=0)
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

            time.sleep(0.5)

        # Remove listeners para evitar vazamento
        try:
            detail_page.remove_listener("response", on_response)
            context.remove_listener("download", on_download)
        except Exception:
            pass

        # Cria pastas locais
        form_folder.mkdir(parents=True, exist_ok=True)
        history_dir = form_folder / "historico"
        history_dir.mkdir(parents=True, exist_ok=True)
        dados_csv = form_folder / "dados.csv"
        dados_json = form_folder / "dados.json"

        if has_new_records and downloads:
            dl = downloads[0]
            timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            raw_file = history_dir / f"download_{timestamp_str}.csv"
            dl.save_as(str(raw_file))
            log.info(f"[OK] Arquivo bruto salvo em: {raw_file.name}")

            # Mescla com dados existentes e deduplica
            added, total = merge_and_save_data(dados_csv, raw_file, dados_json)
            result["status"] = "SUCESSO"
            result["added"] = added
            result["total"] = total
            result["mensagem"] = f"{added} novos registros adicionados. Total consolidado: {total}."
            log.info(f"[DADOS CONSOLIDADOS] {result['mensagem']}")
        elif not has_new_records:
            total = len(read_csv_smart(dados_csv)) if dados_csv.exists() else 0
            result["status"] = "SEM_NOVIDADES"
            result["added"] = 0
            result["total"] = total
            result["mensagem"] = "Nenhum novo registro no período."
            log.info(f"[INFO] Formulário '{form_name}' já está atualizado.")
        else:
            total = len(read_csv_smart(dados_csv)) if dados_csv.exists() else 0
            result["status"] = "TIMEOUT"
            result["mensagem"] = "Tempo limite de download atingido."
            log.warning(f"[TIMEOUT] Não foi possível obter download de '{form_name}'.")

    except Exception as exc:
        log.error(f"Erro durante extração de '{form_name}': {exc}", exc_info=True)
        result["status"] = "ERRO"
        result["mensagem"] = str(exc)
    finally:
        # Limpeza e fechamento de aba se aplicável
        if is_new_tab:
            try:
                detail_page.close()
            except Exception:
                pass

    return result


# =============================================================================
# FLUXO PRINCIPAL / FUNÇÃO EXPORTÁVEL PARA INTERFACE GRÁFICA
# =============================================================================
def run_full_extraction(
    headless: bool = True,
    target_form: str = "",
    force_start: str = "",
    username: str | None = None,
    password: str | None = None,
    log_callback: Any = None,
    progress_callback: Any = None,
    cancel_event: Any = None
) -> list[dict[str, Any]]:
    """
    Executa a rotina completa de extração incremental.
    Pode ser acionada via linha de comando ou pela interface gráfica.
    """
    username = username or os.getenv("MAPFY_USER", "").strip()
    password = password or os.getenv("MAPFY_PASS", "")
    if not username or not password:
        raise RuntimeError(
            "Credenciais ausentes. Configure MAPFY_USER e MAPFY_PASS no arquivo .env."
        )

    today_str = datetime.now().strftime("%d/%m/%Y")

    def emit(message: str, level: str = "INFO"):
        if level == "ERROR":
            log.error(message)
        elif level == "WARNING":
            log.warning(message)
        else:
            log.info(message)
        if log_callback:
            try:
                log_callback(message, level)
            except Exception:
                pass

    emit("=" * 65)
    emit("INICIANDO EXTRATOR MAPFY")
    emit(f"Data de referência: {today_str}")
    emit("=" * 65)

    relatorio_geral: list[dict[str, Any]] = []

    with sync_playwright() as pw:
        # Inicializa o navegador priorizando Google Chrome 64-bit para evitar VirtualAlloc failed de navegadores 32-bit
        launch_args = [
            "--no-sandbox",
            "--mute-audio",
            "--disable-dev-shm-usage",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
        ]
        if headless:
            launch_args.append("--headless=new")
        else:
            launch_args.append("--start-maximized")

        browser = None
        channels_to_try = ["chrome", "msedge"]
        last_browser_err = None

        for ch in channels_to_try:
            try:
                emit(f"Inicializando navegador (canal: {ch})...")
                browser = pw.chromium.launch(
                    channel=ch,
                    headless=headless,
                    args=launch_args
                )
                emit(f"[OK] Navegador ativo via canal '{ch}'.")
                break
            except Exception as e:
                last_browser_err = e
                emit(f"Canal '{ch}' indisponível, tentando próximo...", "WARNING")

        if browser is None:
            try:
                emit("Tentando inicializar com Chromium padrão...")
                browser = pw.chromium.launch(headless=headless, args=launch_args)
                emit("[OK] Navegador ativo via Chromium padrão.")
            except Exception as e:
                emit(f"Erro fatal ao inicializar navegador: {e}", "ERROR")
                raise RuntimeError(f"Nenhum navegador suportado pôde ser iniciado: {e}") from last_browser_err

        context_kwargs = {
            "locale": "pt-BR",
            "viewport": {"width": 1440, "height": 900},
            "accept_downloads": True
        }
        session_file = SESSION_FILE if SESSION_FILE.exists() else LEGACY_SESSION_FILE
        if session_file.exists():
            emit(f"Carregando sessão prévia de {session_file.name}")
            context_kwargs["storage_state"] = str(session_file)

        context = browser.new_context(**context_kwargs)
        page = context.new_page()

        # Garante autenticação
        try:
            ensure_authenticated(page, context, username, password)
        except Exception as e:
            emit(f"Falha de autenticação: {e}", "ERROR")
            browser.close()
            raise RuntimeError(f"Falha de autenticação: {e}") from e

        # Obtém lista de formulários disponíveis na tela filtrando por atividade em 2026
        emit("Identificando formulários disponíveis no painel...")
        form_names: list[str] = []
        try:
            page.wait_for_selector(".gm-zr, .gm-vc, h4:has-text('Escolha um formulário')", timeout=25000)
            page.wait_for_timeout(2000)  # Breve pausa para estabilização de cards
            cards = page.locator(".gm-zr, .gm-vc")
            total_cards = cards.count()

            for i in range(total_cards):
                card = cards.nth(i)
                title_elem = card.locator(".gm-zs, .gm-vf, p, h5")
                if title_elem.count() == 0:
                    continue

                name = title_elem.first.inner_text().strip()
                if not name:
                    continue

                # Inspeciona data da última sincronia no card
                subtitles = card.locator(".gm-zt, .gm-vg, p").all_inner_texts()
                sub_text = " ".join(subtitles)
                years = [int(y) for y in re.findall(r"\b\d{2}/\d{2}/(\d{4})\b", sub_text)]
                latest_year = max(years) if years else None

                # Regra: Se a última sincronia for anterior a 2026, ignora
                if latest_year is not None and latest_year < 2026:
                    emit(f"  [IGNORADO] {name} (Última sincronia em {latest_year}, sem movimentação em 2026)")
                    continue

                if name not in form_names:
                    form_names.append(name)
        except Exception as e:
            emit(f"Aviso ao ler cards da tela: {e}", "WARNING")

        # Garante que todos os formulários operacionais de 2026 estejam na lista de execução
        for known_form in KNOWN_ACTIVE_FORMS_2026:
            if known_form not in form_names:
                form_names.append(known_form)

        emit(f"\nTotal de formulários aptos com movimentação em 2026: {len(form_names)}")
        for idx, name in enumerate(form_names, start=1):
            emit(f"  [{idx:02d}] {name}")

        if target_form:
            target_name = target_form.strip().lower()
            form_names = [f for f in form_names if target_name in f.lower()]
            emit(f"Filtro aplicado: executando apenas '{form_names}'")

        # Processamento iterativo de cada formulário
        total_forms = len(form_names)
        for idx, form_name in enumerate(form_names, start=1):
            if cancel_event and cancel_event.is_set():
                emit("Execução cancelada pelo usuário.", "WARNING")
                break

            form_folder = RELATORIOS_DIR / sanitize_name(form_name)
            dados_csv = form_folder / "dados.csv"

            # Determina a data inicial:
            # 1. Se informada via linha de comando/interface
            # 2. Se já houver dados.csv, busca a última data
            # 3. Caso contrário, primeira carga = 01/01/2026
            if force_start:
                start_date = force_start
            else:
                latest_date = find_latest_date_in_csv(dados_csv)
                if latest_date:
                    start_date = latest_date
                else:
                    start_date = FIRST_RUN_DATE

            finish_date = today_str

            emit(f"\n>>> [{idx}/{total_forms}] Preparando: {form_name}")
            res = extract_form_data(
                context=context,
                page=page,
                form_name=form_name,
                form_folder=form_folder,
                start_date=start_date,
                finish_date=finish_date
            )
            relatorio_geral.append(res)

            if progress_callback:
                try:
                    progress_callback(idx, total_forms, form_name, res)
                except Exception:
                    pass

            time.sleep(1.5)  # Pausa de estabilização entre formulários

        # Resumo final da extração
        emit("\n" + "=" * 65)
        emit("RESUMO FINAL DA EXECUÇÃO")
        emit("=" * 65)
        for r in relatorio_geral:
            emit(f"• {r['form']} | Status: {r['status']} | Novos: {r['added']} | Total: {r['total']} | {r['mensagem']}")

        browser.close()
        emit("\nExecução concluída com sucesso.")

        try:
            export_dashboard_summary()
        except Exception:
            pass

    return relatorio_geral




def export_dashboard_summary() -> Path | None:
    """Gera/atualiza DashBoard/data_summary.json com contagem dinamica em tempo real de todos os relatorios."""
    try:
        from runtime_paths import DASHBOARD_DIR, SERVER_DIR
        dashboard_dir = DASHBOARD_DIR if DASHBOARD_DIR.is_dir() else (SERVER_DIR / "DashBoard")
        dashboard_dir.mkdir(parents=True, exist_ok=True)
        reports_dir = REPORTS_DIR
        if not reports_dir.is_dir():
            return None

        import csv
        forms_catalog = [
            {"folder": "Plantio - 03.1 - Preparo de Solo - Subsolagem", "slug": "subsolagem", "name": "Subsolagem", "category": "Preparo de Solo"},
            {"folder": "Plantio - 03.1 - Preparo de Solo - Canteirização", "slug": "canteirizacao", "name": "Canteirização", "category": "Preparo de Solo"},
            {"folder": "Plantio - 05 - Sulcação", "slug": "sulcacao", "name": "Sulcação", "category": "Operação de Plantio"},
            {"folder": "Plantio - 04 - Dosagem de Produto - Sulcação", "slug": "dosagem_sulco", "name": "Dosagem de Produto - Sulcação", "category": "Operação de Plantio"},
            {"folder": "Plantio - 06 - Abertura da Asa", "slug": "abertura_asa", "name": "Abertura da Asa", "category": "Operação de Plantio"},
            {"folder": "Plantio - 07 - Paralelismo", "slug": "paralelismo", "name": "Paralelismo", "category": "Agricultura de Precisão"},
            {"folder": "Plantio - 08 - Qualidade da muda", "slug": "qualidade_muda", "name": "Qualidade da Muda", "category": "Material Genético"},
            {"folder": "Plantio - 09 - Quantidade de Gemas", "slug": "viabilidade_gemas", "name": "Quantidade de Gemas", "category": "Amostragem de Campo"},
            {"folder": "Plantio - 10 - Quantidade de Cana", "slug": "qualidade_cana", "name": "Quantidade de Cana", "category": "Consumo de Muda"},
            {"folder": "Plantio - 11 - Dosagem de Produto - Cobrição", "slug": "dosagem_cobricao", "name": "Dosagem de Produto - Cobrição", "category": "Proteção de Cultivo"},
            {"folder": "Plantio - 12 - Cobrição", "slug": "cobricao", "name": "Cobrição", "category": "Operação de Plantio"},
            {"folder": "Plantio - 13 - Arremate e Acabamento", "slug": "arremate_acabamento", "name": "Arremate e Acabamento", "category": "Acabamento Operacional"},
            {"folder": "Tratos - Herbicida", "slug": "herbicida", "name": "Tratos - Herbicida", "category": "Tratos Culturais"},
            {"folder": "Infestação de Broca - Armadilha", "slug": "broca_armadilha", "name": "Infestação de Broca - Armadilha", "category": "Fitossanidade"},
            {"folder": "CHECK LIST VEICULAR", "slug": "checklist_veicular", "name": "CHECK LIST VEICULAR", "category": "Frotas & Logística"},
            {"folder": "#Check-list área de vivência _ Colheita", "slug": "area_vivencia", "name": "Check-list área de vivência _ Colheita", "category": "SSOMA & Segurança"},
            {"folder": "5S e Gestão - TPL", "slug": "tpl_5s", "name": "5S e Gestão - TPL", "category": "Gestão & Qualidade"},
        ]

        reports_data = {}
        total_records = 0

        for item in forms_catalog:
            csv_file = reports_dir / item["folder"] / "dados.csv"
            rows = 0
            latest_date = "28/10/2026"
            if csv_file.exists():
                with open(csv_file, "r", encoding="utf-8-sig", errors="ignore") as f:
                    reader = csv.reader(f, delimiter=";")
                    headers = next(reader, None)
                    date_idx = -1
                    if headers:
                        for idx, h in enumerate(headers):
                            if "data" in h.lower() and "início" not in h.lower() and "fim" not in h.lower() and "lançamento" not in h.lower():
                                date_idx = idx
                                break
                        if date_idx == -1:
                            for idx, h in enumerate(headers):
                                if "data" in h.lower():
                                    date_idx = idx
                                    break
                    for r in reader:
                        rows += 1
                        if date_idx != -1 and len(r) > date_idx and r[date_idx].strip():
                            latest_date = r[date_idx].strip().split(" ")[0]
            reports_data[item["slug"]] = {
                "folder": item["folder"],
                "name": item["name"],
                "slug": item["slug"],
                "rows": rows,
                "latest_date": latest_date,
                "category": item["category"],
            }
            total_records += rows

        import json
        summary_payload = {
            "status": "ok",
            "total_records": total_records,
            "total_k": f"+{round(total_records / 1000)}k Registros",
            "total_formatted": f"+{total_records:,} Registros".replace(",", "."),
            "updated_at": datetime.now().isoformat(timespec="seconds"),
            "reports": reports_data,
        }

        summary_json_path = dashboard_dir / "data_summary.json"
        temp_path = summary_json_path.with_suffix(".tmp")
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(summary_payload, f, indent=2, ensure_ascii=False)
        temp_path.replace(summary_json_path)

        # Copia de redundancia direta em SERVER_DIR para compatibilidade universal
        try:
            backup_path = SERVER_DIR / "data_summary.json"
            if backup_path != summary_json_path:
                with open(backup_path, "w", encoding="utf-8") as f:
                    json.dump(summary_payload, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

        logger.info(f"Sumário do Dashboard sincronizado com sucesso: {total_records} registros totais.")
        return summary_json_path
    except Exception as e:
        logger.warning(f"Aviso ao sincronizar sumário do Dashboard: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Extração automatizada dos formulários Mapfy.")
    parser.add_argument("--form", type=str, default="", help="Nome exato de um formulário para executar apenas ele.")
    parser.add_argument("--visible", action="store_true", help="Executa o navegador com janela visível.")
    parser.add_argument("--headless", action="store_true", help="Executa o navegador em segundo plano (padrão).")
    parser.add_argument("--force-start", type=str, default="", help="Força data inicial customizada (DD/MM/YYYY).")
    args = parser.parse_args()

    # O padrão profissional é SEMPRE segundo plano (headless=True)
    is_headless = not args.visible

    run_full_extraction(
        headless=is_headless,
        target_form=args.form,
        force_start=args.force_start
    )


if __name__ == "__main__":
    main()
