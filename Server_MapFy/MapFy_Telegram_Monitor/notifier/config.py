import hmac
import json
import logging
import os
import re
import secrets
import sys
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("mapfy.config")

# Diretórios base com detecção de executável compilado PyInstaller (sys.frozen)
if getattr(sys, "frozen", False):
    ROOT_DIR = Path(sys.executable).resolve().parent
else:
    ROOT_DIR = Path(__file__).resolve().parent.parent

PACKAGE_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
LOGS_DIR = ROOT_DIR / "logs"

# Garante a existência dos diretórios operacionais
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

VAULT_SERVICE_NAME = "MapFy_Telegram_Monitor"


def load_dotenv(dotenv_path: Path | str | None = None) -> dict[str, str]:
    """
    Parser robusto e autônomo para arquivos .env sem dependência de bibliotecas externas.
    Preenche os valores em os.environ se ainda não estiverem definidos.
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
_ENV_VALUES = load_dotenv()


def is_testing() -> bool:
    """Verifica se a aplicação está rodando sob ambiente de testes automatizados."""
    return (
        os.getenv("TESTING", "").lower() in ("true", "1", "yes")
        or "pytest" in sys.modules
        or "unittest" in sys.modules
        or any("test" in arg.lower() for arg in sys.argv)
    )


def get_secret(key_name: str, default: str = "") -> str:
    """
    Resolve segredos na seguinte ordem de prioridade estrita:
    1. Windows Credential Manager (keyring, se disponível)
    2. Variável de ambiente do sistema operacional (os.environ)
    3. Arquivo .env carregado
    4. Valor default
    """
    # 1. Tenta Keyring (Windows Credential Manager) se instalado
    try:
        import keyring  # type: ignore
        secret_val = keyring.get_password(VAULT_SERVICE_NAME, key_name)
        if secret_val:
            return secret_val.strip()
    except Exception:
        pass

    # 2. Variável de ambiente do sistema
    val = os.getenv(key_name, "").strip()
    if val:
        return val

    # 3. .env em disco
    if key_name in _ENV_VALUES and _ENV_VALUES[key_name].strip():
        return _ENV_VALUES[key_name].strip()

    return default


def set_secret(key_name: str, secret_value: str, persist_env: bool = False) -> bool:
    """
    Grava o segredo no Windows Credential Manager (keyring) e no ambiente de execução.
    Se persist_env=True, também salva no .env local.
    """
    secret_value = secret_value.strip()
    stored_in_keyring = False

    try:
        import keyring  # type: ignore
        keyring.set_password(VAULT_SERVICE_NAME, key_name, secret_value)
        stored_in_keyring = True
    except Exception:
        pass

    os.environ[key_name] = secret_value
    _ENV_VALUES[key_name] = secret_value

    if persist_env:
        env_path = ROOT_DIR / ".env"
        lines = []
        found = False
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith(f"{key_name}="):
                        lines.append(f"{key_name}='{secret_value}'\n")
                        found = True
                    else:
                        lines.append(line)
        if not found:
            lines.append(f"{key_name}='{secret_value}'\n")
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(lines)

    return stored_in_keyring or True


def generate_secure_api_key() -> str:
    """Gera uma chave criptográfica forte com secrets.token_urlsafe(32)."""
    return secrets.token_urlsafe(32)


class Config:
    """Configurações centralizadas do MapFy Telegram Monitor v2 (Sentinel)."""

    # Identidade do Bot Telegram
    TELEGRAM_BOT_USERNAME: str = os.getenv("TELEGRAM_BOT_USERNAME", "MapfySentinelBot")
    TELEGRAM_BOT_TOKEN: str = get_secret("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID: str = get_secret("TELEGRAM_CHAT_ID", "")

    # Servidor REST e Segurança
    MONITOR_HOST: str = os.getenv("MONITOR_HOST", "127.0.0.1")
    MONITOR_PORT: int = int(os.getenv("MONITOR_PORT", "8765"))
    ALLOW_REMOTE_BIND: bool = os.getenv("ALLOW_REMOTE_BIND", "false").lower() in ("true", "1")
    ENABLE_API_DOCS: bool = os.getenv("ENABLE_API_DOCS", "false").lower() in ("true", "1")

    # Chave de API (sem chave padrão fraca em produção)
    MONITOR_API_KEY: str = get_secret(
        "MONITOR_API_KEY",
        "mock_test_key_for_testing_purposes_only" if is_testing() else ""
    )

    # Rate Limit de Autenticação
    MAX_FAILED_AUTH_ATTEMPTS: int = int(os.getenv("MAX_FAILED_AUTH_ATTEMPTS", "5"))
    AUTH_BAN_SECONDS: int = int(os.getenv("AUTH_BAN_SECONDS", "300"))

    # Timeout e Intervalos
    HEARTBEAT_TIMEOUT_SECONDS: int = int(os.getenv("HEARTBEAT_TIMEOUT_SECONDS", "180"))
    HEARTBEAT_CHECK_INTERVAL_SECONDS: int = int(os.getenv("HEARTBEAT_CHECK_INTERVAL_SECONDS", "15"))
    SERVER_NAME: str = os.getenv("SERVER_NAME", "MAPFY-EXTRACTOR")

    # Dead Man's Switch & Validação (Fase 3)
    EXPECTED_INTERVAL_MINUTES: int = int(os.getenv("EXPECTED_INTERVAL_MINUTES", "60"))
    DEAD_MAN_GRACE_MINUTES: int = int(os.getenv("DEAD_MAN_GRACE_MINUTES", "15"))
    STAGE_STALL_SECONDS: int = int(os.getenv("STAGE_STALL_SECONDS", "300"))
    MAX_RUN_SECONDS: int = int(os.getenv("MAX_RUN_SECONDS", "1800"))

    # Auto-Cura (Fase 5 - Opt-in)
    AUTO_HEAL_ENABLED: bool = os.getenv("AUTO_HEAL_ENABLED", "false").lower() in ("true", "1")
    CIRCUIT_BREAKER_MAX_FAILURES: int = int(os.getenv("CIRCUIT_BREAKER_MAX_FAILURES", "3"))

    # Usuários autorizados no Telegram (Fase 2)
    # Formato: {"12345678": "admin", "87654321": "viewer"} ou string no env: "12345:admin,6789:viewer"
    AUTHORIZED_USERS: dict[str, str] = {}

    # Arquivos e Armazenamento
    DATABASE_PATH: Path = DATA_DIR / "monitor.db"
    LOG_FILE_PATH: Path = LOGS_DIR / "monitor.log"
    LOG_MAX_BYTES: int = int(os.getenv("LOG_MAX_BYTES", str(10 * 1024 * 1024)))  # 10 MB
    LOG_BACKUP_COUNT: int = int(os.getenv("LOG_BACKUP_COUNT", "5"))

    @classmethod
    def load_authorized_users(cls) -> dict[str, str]:
        """Carrega o mapa de usuários autorizados do Telegram a partir do ambiente."""
        raw = os.getenv("AUTHORIZED_USERS", "").strip()
        users: dict[str, str] = {}
        if not raw:
            # Se CHAT_ID estiver configurado, ele ganha papel admin por padrão para não quebrar v1
            chat_id = cls.TELEGRAM_CHAT_ID.strip()
            if chat_id and chat_id not in ("OBTER_AUTOMATICAMENTE_OU_CONFIGURAR", ""):
                users[chat_id] = "admin"
            return users

        try:
            if raw.startswith("{"):
                users = json.loads(raw)
            else:
                for pair in raw.split(","):
                    if ":" in pair:
                        uid, role = pair.split(":", 1)
                        users[uid.strip()] = role.strip().lower()
                    elif pair.strip():
                        users[pair.strip()] = "admin"
        except Exception:
            pass

        return users

    @classmethod
    def reload(cls, dotenv_path: Path | str | None = None) -> None:
        """Recarrega as configurações a partir do cofre e do arquivo .env."""
        global _ENV_VALUES
        _ENV_VALUES = load_dotenv(dotenv_path)

        cls.TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "MapfySentinelBot")
        cls.TELEGRAM_BOT_TOKEN = get_secret("TELEGRAM_BOT_TOKEN", "")
        cls.TELEGRAM_CHAT_ID = get_secret("TELEGRAM_CHAT_ID", "")

        cls.MONITOR_HOST = os.getenv("MONITOR_HOST", "127.0.0.1")
        cls.MONITOR_PORT = int(os.getenv("MONITOR_PORT", "8765"))
        cls.ALLOW_REMOTE_BIND = os.getenv("ALLOW_REMOTE_BIND", "false").lower() in ("true", "1")
        cls.ENABLE_API_DOCS = os.getenv("ENABLE_API_DOCS", "false").lower() in ("true", "1")

        cls.MONITOR_API_KEY = get_secret(
            "MONITOR_API_KEY",
            "mock_test_key_for_testing_purposes_only" if is_testing() else ""
        )

        cls.MAX_FAILED_AUTH_ATTEMPTS = int(os.getenv("MAX_FAILED_AUTH_ATTEMPTS", "5"))
        cls.AUTH_BAN_SECONDS = int(os.getenv("AUTH_BAN_SECONDS", "300"))

        cls.HEARTBEAT_TIMEOUT_SECONDS = int(os.getenv("HEARTBEAT_TIMEOUT_SECONDS", "180"))
        cls.HEARTBEAT_CHECK_INTERVAL_SECONDS = int(os.getenv("HEARTBEAT_CHECK_INTERVAL_SECONDS", "15"))
        cls.SERVER_NAME = os.getenv("SERVER_NAME", "MAPFY-EXTRACTOR")

        cls.EXPECTED_INTERVAL_MINUTES = int(os.getenv("EXPECTED_INTERVAL_MINUTES", "60"))
        cls.DEAD_MAN_GRACE_MINUTES = int(os.getenv("DEAD_MAN_GRACE_MINUTES", "15"))
        cls.STAGE_STALL_SECONDS = int(os.getenv("STAGE_STALL_SECONDS", "300"))
        cls.MAX_RUN_SECONDS = int(os.getenv("MAX_RUN_SECONDS", "1800"))

        cls.AUTO_HEAL_ENABLED = os.getenv("AUTO_HEAL_ENABLED", "false").lower() in ("true", "1")
        cls.CIRCUIT_BREAKER_MAX_FAILURES = int(os.getenv("CIRCUIT_BREAKER_MAX_FAILURES", "3"))

        cls.AUTHORIZED_USERS = cls.load_authorized_users()

    @classmethod
    def validate_production(cls) -> None:
        """
        Validações rígidas de segurança pré-inicialização do servidor em produção.
        Lança RuntimeError se houver parâmetros inseguros ou ausentes.
        """
        if is_testing():
            return

        # 1. Bind de Rede
        if cls.MONITOR_HOST not in ("127.0.0.1", "localhost") and not cls.ALLOW_REMOTE_BIND:
            raise RuntimeError(
                f"Configuração insegura de rede: bind solicitado em '{cls.MONITOR_HOST}'. "
                "Por segurança, o Sentinel aceita apenas '127.0.0.1'. "
                "Para permitir bind externo explicitamente, configure ALLOW_REMOTE_BIND=true."
            )

        # 2. Chave de API obrigatória
        if not cls.MONITOR_API_KEY:
            raise RuntimeError(
                "MONITOR_API_KEY ausente! "
                "O servidor Sentinel requer uma chave configurada no .env ou no cofre. "
                "Gere uma chave segura executando: python run_server.py --generate-key"
            )

        if cls.MONITOR_API_KEY in ("mapfy_monitor_secret_key_2026", "CHANGE_ME", "secret", "password"):
            logger.warning(
                "AVISO DE SEGURANÇA: Chave padrão/legada em uso ('%s...'). "
                "Para ambiente de produção estrito, gere uma nova chave forte com: python run_server.py --generate-key",
                cls.MONITOR_API_KEY[:6]
            )


# Inicializa mapa de usuários autorizados
Config.AUTHORIZED_USERS = Config.load_authorized_users()

_TOKEN_PATTERN = re.compile(r"\b\d{8,12}:[A-Za-z0-9_-]{35}\b")


def redact_token(text: str, custom_token: str | None = None) -> str:
    """
    Substitui tokens do Telegram ou credenciais sensíveis por [REDACTED].
    Garante que nenhuma credencial vaze em logs, relatórios, tracebacks ou mensagens.
    """
    if not text:
        return ""

    redacted = str(text)

    # Redige token passado ou configurado
    token_to_redact = custom_token or Config.TELEGRAM_BOT_TOKEN
    if token_to_redact and len(token_to_redact) > 8 and token_to_redact in redacted:
        redacted = redacted.replace(token_to_redact, "[REDACTED_TELEGRAM_TOKEN]")

    # Redige padrões conhecidos de token Telegram via regex
    redacted = _TOKEN_PATTERN.sub("[REDACTED_TELEGRAM_TOKEN]", redacted)

    # Redige API Key
    if Config.MONITOR_API_KEY and len(Config.MONITOR_API_KEY) > 5 and Config.MONITOR_API_KEY in redacted:
        redacted = redacted.replace(Config.MONITOR_API_KEY, "[REDACTED_API_KEY]")

    # Redige segredos conhecidos no ambiente
    for secret_env in ("MAPFY_PASS", "MAPFY_PASS_FALLBACK", "MAPFY_GITHUB_TOKEN", "TELEGRAM_BOT_TOKEN"):
        val = os.getenv(secret_env, "").strip()
        if val and len(val) > 4 and val in redacted:
            redacted = redacted.replace(val, f"[REDACTED_{secret_env}]")

    return redacted
