from __future__ import annotations

import argparse
import json
import logging
import os
import signal
import sys
import threading
import time
from pathlib import Path

if getattr(sys, "frozen", False):
    PROJECT_DIR = Path(sys._MEIPASS)
else:
    PROJECT_DIR = Path(__file__).resolve().parent.parent

sys.path.insert(0, str(PROJECT_DIR))

from runtime_paths import CONFIG_FILE, LEGACY_CONFIG_FILE, REPORTS_DIR, SERVER_DIR

import api_gateway
from github_publisher import GitHubDashboardPublisher
import mapfy_extractor
import uvicorn

STOP_EVENT = threading.Event()
logger = logging.getLogger("mapfy.server")


def configure_logging() -> None:
    SERVER_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    log_path = SERVER_DIR / "mapfy_server.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
        force=True,
    )


def extraction_interval_seconds() -> int:
    configured_interval = os.getenv("MAPFY_EXTRACT_INTERVAL_MIN", "").strip()
    if configured_interval:
        try:
            interval_minutes = int(configured_interval)
        except ValueError as exc:
            raise ValueError("MAPFY_EXTRACT_INTERVAL_MIN deve ser um número inteiro.") from exc
    else:
        config_path = CONFIG_FILE if CONFIG_FILE.is_file() else LEGACY_CONFIG_FILE
        if config_path.is_file():
            with config_path.open("r", encoding="utf-8") as config_file:
                config = json.load(config_file)
            interval_minutes = int(config.get("interval_minutes", 60))
        else:
            interval_minutes = 60

    if interval_minutes < 1:
        raise ValueError("O intervalo de extração precisa ser de pelo menos 1 minuto.")
    return interval_minutes * 60


def request_shutdown(signum: int, _frame: object) -> None:
    logger.info("Encerramento solicitado (sinal %s).", signum)
    STOP_EVENT.set()


def run_server() -> int:
    host = "127.0.0.1"
    port = int(os.getenv("MAPFY_API_PORT", "8000"))
    interval_seconds = extraction_interval_seconds()
    publisher = GitHubDashboardPublisher()
    api_server = uvicorn.Server(
        uvicorn.Config(api_gateway.app, host=host, port=port, log_level="info")
    )
    api_thread = threading.Thread(
        target=api_server.run,
        name="mapfy-api",
        daemon=True,
    )

    signal.signal(signal.SIGINT, request_shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, request_shutdown)

    api_thread.start()
    startup_deadline = time.monotonic() + 30
    while not api_server.started and api_thread.is_alive() and time.monotonic() < startup_deadline:
        time.sleep(0.1)

    if not api_server.started:
        logger.error("A API MapFy não iniciou. Verifique a porta e as configurações.")
        api_server.should_exit = True
        api_thread.join(timeout=10)
        return 1

    logger.info(
        "API local disponível em http://%s:%s; relatórios em %s.",
        host,
        port,
        REPORTS_DIR,
    )
    logger.info(
        "Publicação automática configurada para https://github.com/%s/tree/%s/DashBoard/live_data.",
        publisher.repository,
        publisher.branch,
    )
    logger.info("Próxima extração após cada intervalo de %s minuto(s).", interval_seconds // 60)

    try:
        mapfy_extractor.export_dashboard_summary()
        try:
            publisher.publish()
        except Exception:
            logger.exception(
                "Falha ao publicar os dados iniciais no GitHub Pages; "
                "configure MAPFY_GITHUB_TOKEN em server\\.env."
            )

        while not STOP_EVENT.is_set() and api_thread.is_alive():
            logger.info("Iniciando extração incremental do Mapfy.")
            try:
                results = mapfy_extractor.run_full_extraction(headless=True)
                logger.info("Extração concluída: %s formulário(s) processado(s).", len(results))
            except Exception:
                logger.exception("Falha na extração. A API continuará ativa.")

            try:
                mapfy_extractor.export_dashboard_summary()
                publisher.publish()
            except Exception:
                logger.exception(
                    "Falha ao atualizar o Dashboard publicado; "
                    "os relatórios locais foram preservados."
                )

            if STOP_EVENT.wait(interval_seconds):
                break
    finally:
        api_server.should_exit = True
        api_thread.join(timeout=15)
        if api_thread.is_alive():
            logger.error("A API não encerrou dentro do prazo de 15 segundos.")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Servidor MapFy 24/7.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Valida os diretórios e as configurações sem iniciar os serviços.",
    )
    args = parser.parse_args()

    configure_logging()
    if args.check:
        interval = extraction_interval_seconds()
        logger.info("Validação concluída. Relatórios: %s", REPORTS_DIR)
        logger.info("Intervalo configurado: %s minuto(s).", interval // 60)
        if not os.getenv("MAPFY_GITHUB_TOKEN", "").strip():
            logger.warning(
                "A publicação automática requer MAPFY_GITHUB_TOKEN em server\\.env."
            )
        else:
            logger.info("Chave de publicação do GitHub configurada.")
        return 0

    return run_server()


if __name__ == "__main__":
    raise SystemExit(main())
