import logging
import sys
from pathlib import Path

# Adiciona o diretório base ao sys.path para garantir imports absolutos
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import uvicorn
from notifier.config import Config, redact_token

# Configuração de Logs
LOG_FORMAT = "%(asctime)s | %(levelname)-7s | [%(name)s] %(message)s"


class RedactingFormatter(logging.Formatter):
    """Formatador de log customizado que oculta automaticamente tokens e segredos."""
    def format(self, record: logging.LogRecord) -> str:
        original = super().format(record)
        return redact_token(original)


def setup_logging():
    Config.LOG_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Handler de Console
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(RedactingFormatter(LOG_FORMAT))
    root_logger.addHandler(console_handler)

    # Handler de Arquivo
    file_handler = logging.FileHandler(str(Config.LOG_FILE_PATH), encoding="utf-8")
    file_handler.setFormatter(RedactingFormatter(LOG_FORMAT))
    root_logger.addHandler(file_handler)


def main():
    setup_logging()
    logger = logging.getLogger("MapFyMonitorRunner")

    logger.info("=================================================================")
    logger.info("INICIANDO MAPFY TELEGRAM MONITOR")
    logger.info("Endereço: http://%s:%d", Config.MONITOR_HOST, Config.MONITOR_PORT)
    logger.info("Bot configurado: @%s (ativo: %s)", Config.TELEGRAM_BOT_USERNAME, bool(Config.TELEGRAM_BOT_TOKEN))
    logger.info("Timeout de Heartbeat: %d segundos", Config.HEARTBEAT_TIMEOUT_SECONDS)
    logger.info("Banco de dados: %s", Config.DATABASE_PATH)
    logger.info("=================================================================")

    # Inicia Uvicorn
    uvicorn.run(
        "notifier.app:app",
        host=Config.MONITOR_HOST,
        port=Config.MONITOR_PORT,
        log_level="info",
        access_log=True,
        workers=1
    )


if __name__ == "__main__":
    main()
