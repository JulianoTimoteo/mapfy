import os
import re
import sys
from pathlib import Path

# Diretórios base com detecção de executável compilado PyInstaller (sys.frozen)
if getattr(sys, "frozen", False):
    ROOT_DIR = Path(sys.executable).resolve().parent
else:
    ROOT_DIR = Path(__file__).resolve().parent.parent

PACKAGE_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
LOGS_DIR = ROOT_DIR / "logs"

# Garante a existência dos diretórios
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)


def load_dotenv(dotenv_path: Path | str | None = None) -> dict[str, str]:
    """
    Parser robusto e autônomo para arquivos .env sem dependência de bibliotecas externas.
    """
    if dotenv_path is None:
        dotenv_path = ROOT_DIR / ".env"
    else:
        dotenv_path = Path(dotenv_path)

    loaded = {}
    if not dotenv_path.exists():
        return loaded

    try:
        with open(dotenv_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    loaded[key] = val
                    if key not in os.environ:
                        os.environ[key] = val
    except Exception:
        pass
    return loaded


# Carrega o .env inicial
load_dotenv()


class Config:
    """Configurações centralizadas do MapFy Telegram Monitor."""
    
    # Identidade do Bot Telegram (com credenciais de produção como fallback seguro)
    TELEGRAM_BOT_USERNAME: str = os.getenv("TELEGRAM_BOT_USERNAME", "MapfySentinelBot")
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "9201062822:AAE9oZcB4QyHQE8kz9ZNUk_kSZNMCk4HnWU").strip()
    TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "5222686657").strip()

    # Servidor REST
    MONITOR_HOST: str = os.getenv("MONITOR_HOST", "127.0.0.1")
    MONITOR_PORT: int = int(os.getenv("MONITOR_PORT", "8765"))
    MONITOR_API_KEY: str = os.getenv("MONITOR_API_KEY", "mapfy_monitor_secret_key_2026").strip()

    # Timeout e Intervalos
    HEARTBEAT_TIMEOUT_SECONDS: int = int(os.getenv("HEARTBEAT_TIMEOUT_SECONDS", "180"))
    HEARTBEAT_CHECK_INTERVAL_SECONDS: int = int(os.getenv("HEARTBEAT_CHECK_INTERVAL_SECONDS", "15"))
    SERVER_NAME: str = os.getenv("SERVER_NAME", "MAPFY-EXTRACTOR")

    # Arquivos
    DATABASE_PATH: Path = DATA_DIR / "monitor.db"
    LOG_FILE_PATH: Path = LOGS_DIR / "monitor.log"

    @classmethod
    def reload(cls, dotenv_path: Path | str | None = None) -> None:
        """Recarrega as configurações a partir do arquivo .env."""
        load_dotenv(dotenv_path)
        cls.TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "MapfySentinelBot")
        cls.TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "9201062822:AAE9oZcB4QyHQE8kz9ZNUk_kSZNMCk4HnWU").strip()
        cls.TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "5222686657").strip()
        cls.MONITOR_HOST = os.getenv("MONITOR_HOST", "127.0.0.1")
        cls.MONITOR_PORT = int(os.getenv("MONITOR_PORT", "8765"))
        cls.MONITOR_API_KEY = os.getenv("MONITOR_API_KEY", "mapfy_monitor_secret_key_2026").strip()
        cls.HEARTBEAT_TIMEOUT_SECONDS = int(os.getenv("HEARTBEAT_TIMEOUT_SECONDS", "180"))
        cls.HEARTBEAT_CHECK_INTERVAL_SECONDS = int(os.getenv("HEARTBEAT_CHECK_INTERVAL_SECONDS", "15"))
        cls.SERVER_NAME = os.getenv("SERVER_NAME", "MAPFY-EXTRACTOR")


_TOKEN_PATTERN = re.compile(r"\b\d{8,12}:[A-Za-z0-9_-]{35}\b")


def redact_token(text: str, custom_token: str | None = None) -> str:
    """
    Substitui tokens do Telegram ou credenciais sensíveis por [REDACTED_TOKEN].
    Garante que nenhuma credencial vaze em logs, relatórios ou mensagens.
    """
    if not text:
        return ""
    
    redacted = str(text)
    
    # Redige token passado ou o configurado
    token_to_redact = custom_token or Config.TELEGRAM_BOT_TOKEN
    if token_to_redact and len(token_to_redact) > 8 and token_to_redact in redacted:
        redacted = redacted.replace(token_to_redact, "[REDACTED_TELEGRAM_TOKEN]")
        
    # Redige padrões conhecidos de token Telegram via regex
    redacted = _TOKEN_PATTERN.sub("[REDACTED_TELEGRAM_TOKEN]", redacted)

    # Redige API Key
    if Config.MONITOR_API_KEY and len(Config.MONITOR_API_KEY) > 5 and Config.MONITOR_API_KEY in redacted:
        redacted = redacted.replace(Config.MONITOR_API_KEY, "[REDACTED_API_KEY]")

    return redacted
