#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
data_sync_worker.py
===================
Trabalhador Autônomo de Sincronização em Tempo Real para o Raspberry Pi.
Monitora atualizações remotas (GitHub / Webhook / Pasta de Rede) e sincroniza
os relatórios para manter o servidor MapFy sempre atualizado 24/7.

Usina Pitangueiras • Safra 2026
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

from runtime_paths import (
    DATA_SUMMARY_FILE,
    ENV_FILE,
    LEGACY_ENV_FILE,
    REPORTS_DIR,
    SERVER_DIR,
)
from server_notifications import send_telegram_alert

load_dotenv(ENV_FILE if ENV_FILE.is_file() else LEGACY_ENV_FILE)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [SyncWorkerRPi] %(message)s",
    handlers=[
        logging.FileHandler(str(SERVER_DIR / "data_sync_worker.log"), encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("MapFySyncWorkerRPi")

GITHUB_TOKEN = os.getenv("MAPFY_GITHUB_TOKEN", "").strip()
GITHUB_REPO = os.getenv("MAPFY_GITHUB_REPO", "julianotimoteo/mapfy-reports").strip()
SYNC_INTERVAL = int(os.getenv("MAPFY_SYNC_INTERVAL_MINUTES", "5")) * 60

last_known_sha = ""


def check_github_updates():
    """Consulta a API do GitHub para verificar se há novos commits nos relatórios."""
    global last_known_sha
    if not GITHUB_TOKEN or not GITHUB_REPO:
        return

    url = f"https://api.github.com/repos/{GITHUB_REPO}/commits?per_page=1"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "MapFySyncWorkerRPi/2.0",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                if data and isinstance(data, list):
                    latest_commit = data[0]
                    sha = latest_commit.get("sha", "")
                    commit_msg = latest_commit.get("commit", {}).get("message", "")

                    if last_known_sha and sha != last_known_sha:
                        logger.info(f"Novo commit detectado no GitHub: {sha[:7]} - {commit_msg}")
                        send_telegram_alert(
                            f"🔄 *[MapFy RPi Sync]* Novo commit detectado no GitHub:\n"
                            f"`{sha[:7]}` - _{commit_msg}_\n"
                            f"Sincronizando dados no servidor..."
                        )
                        # Aqui pode-se baixar os novos arquivos via raw.githubusercontent ou tarball
                    last_known_sha = sha
    except Exception as e:
        logger.debug(f"Checagem do GitHub: {e}")


def recalculate_summary():
    """Recalcula e persiste data_summary.json se houver novos dados."""
    total_records = 0
    reports = {}

    if not REPORTS_DIR.is_dir():
        return

    for folder in REPORTS_DIR.iterdir():
        if not folder.is_dir():
            continue
        csv_file = folder / "dados.csv"
        rows = 0
        if csv_file.is_file():
            try:
                with open(csv_file, "rb") as f:
                    rows = max(0, sum(1 for _ in f) - 1)
            except Exception:
                pass
        reports[folder.name] = rows
        total_records += rows

    summary = {
        "updated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "total_records": total_records,
        "reports": reports,
    }

    try:
        with open(DATA_SUMMARY_FILE, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Erro ao salvar data_summary.json: {e}")


def run_worker_loop():
    logger.info(f"Iniciando Data Sync Worker (Intervalo: {SYNC_INTERVAL}s)...")
    while True:
        try:
            check_github_updates()
            recalculate_summary()
        except Exception as e:
            logger.error(f"Erro no loop de sincronização: {e}")
        time.sleep(SYNC_INTERVAL)


if __name__ == "__main__":
    run_worker_loop()
