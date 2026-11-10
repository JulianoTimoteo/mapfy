#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mapfy_server.py
===============
Orquestrador Principal do Servidor MapFy para Raspberry Pi (ARMv6 / Linux).
Inicia e supervisiona o API Gateway, o DashBoard Web e os agentes em background.
Execução contínua 24/7 com reconexão automática e telemetria no Telegram.

Usina Pitangueiras • Safra 2026
"""

from __future__ import annotations

import logging
import os
import signal
import sys
import threading
import time
from pathlib import Path

from dotenv import load_dotenv

from runtime_paths import CONFIG_FILE, ENV_FILE, LEGACY_ENV_FILE, REPORTS_DIR, SERVER_DIR
import api_gateway
import sentinel_agent
import data_sync_worker
from server_notifications import TelegramLogHandler, send_telegram_alert
import uvicorn

load_dotenv(ENV_FILE if ENV_FILE.is_file() else LEGACY_ENV_FILE)

STOP_EVENT = threading.Event()
logger = logging.getLogger("mapfy.server.rpi")


def configure_logging() -> None:
    SERVER_DIR.mkdir(parents=True, exist_ok=True)
    log_path = SERVER_DIR / "mapfy_server.log"
    handlers: list[logging.Handler] = [
        logging.FileHandler(str(log_path), encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ]

    bot_token = os.getenv("MAPFY_TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("MAPFY_TELEGRAM_CHAT_ID", "").strip()
    if bot_token and chat_id:
        try:
            tg_handler = TelegramLogHandler(bot_token, chat_id)
            tg_handler.setFormatter(
                logging.Formatter("%(asctime)s | %(levelname)-7s | [%(name)s] %(message)s")
            )
            handlers.append(tg_handler)
        except Exception as e:
            print(f"Aviso: Não foi possível anexar handler Telegram: {e}")

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-7s | [%(name)s] %(message)s",
        handlers=handlers,
        force=True,
    )


def request_shutdown(signum: int, _frame: object) -> None:
    logger.info("Encerramento solicitado pelo sistema operacional (sinal %s).", signum)
    STOP_EVENT.set()


def run_server() -> int:
    configure_logging()
    pid_file = SERVER_DIR / "mapfy_server.pid"
    try:
        pid_file.write_text(str(os.getpid()), encoding="utf-8")
    except Exception as e:
        logger.warning("Não foi possível salvar mapfy_server.pid: %s", e)

    host = os.getenv("MAPFY_API_HOST", "0.0.0.0").strip()
    port = int(os.getenv("MAPFY_API_PORT", "8000"))

    # Servidor Uvicorn
    api_server = uvicorn.Server(
        uvicorn.Config(api_gateway.app, host=host, port=port, log_level="info", access_log=False)
    )
    api_thread = threading.Thread(
        target=api_server.run,
        name="mapfy-api-thread",
        daemon=True,
    )

    signal.signal(signal.SIGINT, request_shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, request_shutdown)

    api_thread.start()

    # Inicia Data Sync Worker em thread secundária
    sync_thread = threading.Thread(
        target=data_sync_worker.run_worker_loop,
        name="mapfy-sync-thread",
        daemon=True,
    )
    sync_thread.start()

    # Inicia Sentinel Agent em thread secundária
    sentinel_thread = threading.Thread(
        target=sentinel_agent.run_agent_loop,
        name="mapfy-sentinel-thread",
        daemon=True,
    )
    sentinel_thread.start()

    startup_deadline = time.monotonic() + 30
    while not api_server.started and api_thread.is_alive() and time.monotonic() < startup_deadline:
        time.sleep(0.1)

    ip_addr = sentinel_agent.get_ip_address()
    logger.info("=================================================================")
    logger.info("🚀 MAPFY SERVER 24/7 INICIADO NO RASPBERRY PI COM SUCESSO!")
    logger.info(f"📡 Conectividade: Cabo de Rede Ethernet (eth0)")
    logger.info(f"🌐 IP da Placa: {ip_addr}")
    logger.info(f"🔗 URL do Dashboard: http://{ip_addr}:{port}/")
    logger.info(f"📊 Relatórios Ativos: {len(api_gateway.get_report_catalog())}")
    logger.info("=================================================================")

    send_telegram_alert(
        f"🚀 *[MapFy Server Online]*\n"
        f"O servidor MapFy 24/7 foi iniciado no Raspberry Pi!\n\n"
        f"📡 *Rede:* Cabo Ethernet\n"
        f"🌐 *IP:* `{ip_addr}`\n"
        f"🔗 *Dashboard:* http://{ip_addr}:{port}/\n"
        f"⚡ *Hardware:* ARMv6 Single-Core 700MHz | 512MB RAM\n"
        f"✅ *Status:* Todos os serviços operacionais em tempo real."
    )

    try:
        while not STOP_EVENT.is_set() and api_thread.is_alive():
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Interrupção via teclado recebida.")

    logger.info("Encerrando serviços do servidor MapFy...")
    api_server.should_exit = True
    api_thread.join(timeout=5)

    try:
        if pid_file.exists():
            pid_file.unlink()
    except Exception:
        pass

    logger.info("Servidor MapFy encerrado.")
    return 0


if __name__ == "__main__":
    sys.exit(run_server())
