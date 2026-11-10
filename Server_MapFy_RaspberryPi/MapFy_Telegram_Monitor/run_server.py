#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
run_server.py
=============
Serviço do MapFy Telegram Monitor para Raspberry Pi.
Recebe heartbeats do Sentinel Agent e despacha alertas ao Telegram Bot.
Usina Pitangueiras • Safra 2026
"""

import logging
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import uvicorn
from notifier.config import Config, redact_token

LOG_FORMAT = "%(asctime)s | %(levelname)-7s | [%(name)s] %(message)s"


class RedactingFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        original = super().format(record)
        return redact_token(original)


def setup_logging():
    Config.LOG_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(RedactingFormatter(LOG_FORMAT))
    root_logger.addHandler(console_handler)

    file_handler = logging.FileHandler(str(Config.LOG_FILE_PATH), encoding="utf-8")
    file_handler.setFormatter(RedactingFormatter(LOG_FORMAT))
    root_logger.addHandler(file_handler)


def main():
    setup_logging()
    logger = logging.getLogger("MapFyMonitorRPi")

    logger.info("=================================================================")
    logger.info("INICIANDO MAPFY TELEGRAM MONITOR (RASPBERRY PI)")
    logger.info("Endereço: http://%s:%d", Config.MONITOR_HOST, Config.MONITOR_PORT)
    logger.info("Bot configurado: @%s (ativo: %s)", Config.TELEGRAM_BOT_USERNAME, bool(Config.TELEGRAM_BOT_TOKEN))
    logger.info("Timeout de Heartbeat: %d segundos", Config.HEARTBEAT_TIMEOUT_SECONDS)
    logger.info("=================================================================")

    uvicorn.run(
        "notifier.app:app",
        host=Config.MONITOR_HOST,
        port=Config.MONITOR_PORT,
        log_level="info",
        access_log=False,
        workers=1,
    )


if __name__ == "__main__":
    main()
