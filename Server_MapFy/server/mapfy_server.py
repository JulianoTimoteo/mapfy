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
from server_notifications import TelegramLogHandler, create_telegram_handler
import uvicorn

STOP_EVENT = threading.Event()
logger = logging.getLogger("mapfy.server")


def configure_logging() -> None:
    SERVER_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    log_path = SERVER_DIR / "mapfy_server.log"
    handlers: list[logging.Handler] = [
        logging.FileHandler(log_path, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ]
    try:
        telegram_handler = create_telegram_handler()
    except ValueError as exc:
        raise ValueError(f"Configuração de notificações inválida: {exc}") from exc
    if telegram_handler is not None:
        telegram_handler.setFormatter(
            logging.Formatter(
                "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
            )
        )
        handlers.append(telegram_handler)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(message)s",
        handlers=handlers,
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
    pid_file = SERVER_DIR / "mapfy_server.pid"
    try:
        pid_file.write_text(str(os.getpid()), encoding="utf-8")
    except Exception as e:
        logger.warning("Não foi possível salvar mapfy_server.pid: %s", e)

    host = "127.0.0.1"
    port = int(os.getenv("MAPFY_API_PORT", "8000"))
    interval_seconds = extraction_interval_seconds()
    publisher = GitHubDashboardPublisher()
    api_server = uvicorn.Server(
        uvicorn.Config(api_gateway.app, host=host, port=port, log_level="info")
    )
    api_gateway.set_shutdown_callback(STOP_EVENT.set)
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
        try:
            if pid_file.exists():
                pid_file.unlink()
        except Exception:
            pass
        return 1

    logger.info(
        "Servidor MapFy iniciado. API local disponível em http://%s:%s; relatórios em %s.",
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
        try:
            mapfy_extractor.export_dashboard_summary()
            publisher.publish()
        except Exception as pub_err:
            logger.warning(
                "Publicação no GitHub Pages adiada (%s). A API local continuará ativa.",
                pub_err,
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
                try:
                    publisher.publish()
                except Exception as pub_err:
                    logger.warning(
                        "Publicação no GitHub Pages adiada (%s); relatórios locais preservados.",
                        pub_err,
                    )
            except Exception as sum_err:
                logger.warning("Aviso ao sincronizar sumário: %s", sum_err)

            if STOP_EVENT.wait(interval_seconds):
                break
    finally:
        api_server.should_exit = True
        api_thread.join(timeout=15)
        if api_thread.is_alive():
            logger.error("A API não encerrou dentro do prazo de 15 segundos.")
        logger.info("Servidor MapFy encerrado.")
        for handler in logging.getLogger().handlers:
            if hasattr(handler, "flush"):
                handler.flush()
        try:
            if pid_file.exists():
                pid_file.unlink()
        except Exception:
            pass

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Servidor MapFy 24/7.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Valida os diretórios e as configurações sem iniciar os serviços.",
    )
    parser.add_argument(
        "--test-notification",
        action="store_true",
        help="Envia uma mensagem de teste ao Telegram configurado.",
    )
    args = parser.parse_args()

    configure_logging()
    if args.test_notification:
        if not any(
            isinstance(handler, TelegramLogHandler)
            for handler in logging.getLogger().handlers
        ):
            logger.error(
                "Notificação não enviada: configure MAPFY_TELEGRAM_BOT_TOKEN e "
                "MAPFY_TELEGRAM_CHAT_ID em server\\.env."
            )
            return 2
        logger.info("Testando envio do servidor MapFy.")
        for handler in logging.getLogger().handlers:
            handler.flush()
        return 0

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
