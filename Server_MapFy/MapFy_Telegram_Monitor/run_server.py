"""Servidor de controle e monitoramento MapFy Sentinel v2.

Gerencia o centro de observabilidade, alertas Telegram, Dead Man's Switch,
endpoints de telemetria da extração e interface de status.
"""

import argparse
import getpass
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
import sys

# Adiciona o diretório base ao sys.path para garantir imports absolutos
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# pylint: disable=wrong-import-position
import uvicorn
from notifier.config import Config, generate_secure_api_key, redact_token, set_secret

# Configuração de Logs
LOG_FORMAT = "%(asctime)s | %(levelname)-7s | [%(name)s] %(message)s"


class RedactingFormatter(logging.Formatter):
    """Formatador de log customizado que oculta automaticamente tokens e segredos."""

    def format(self, record: logging.LogRecord) -> str:
        original = super().format(record)
        return redact_token(original)


def setup_logging() -> None:
    """Configura o sistema de logs com handlers de arquivo rotativo e console."""
    Config.LOG_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Limpa handlers anteriores para evitar duplicidade
    root_logger.handlers.clear()

    # Handler de Console (apenas se houver console ativo)
    if sys.stdout is not None:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(RedactingFormatter(LOG_FORMAT))
        root_logger.addHandler(console_handler)

    # Handler Rotativo de Arquivo
    file_handler = RotatingFileHandler(
        str(Config.LOG_FILE_PATH),
        maxBytes=Config.LOG_MAX_BYTES,
        backupCount=Config.LOG_BACKUP_COUNT,
        encoding="utf-8"
    )
    file_handler.setFormatter(RedactingFormatter(LOG_FORMAT))
    root_logger.addHandler(file_handler)


def main() -> None:
    """Ponto de entrada principal da CLI do Sentinel v2."""
    parser = argparse.ArgumentParser(
        description="MapFy Telegram Monitor v2 (Sentinel)"
    )
    parser.add_argument(
        "--generate-key",
        action="store_true",
        help="Gera uma nova chave de API criptograficamente segura"
    )
    parser.add_argument(
        "--set-secret",
        metavar="KEY_NAME",
        help="Grava um segredo no cofre do Windows de forma segura"
    )
    parser.add_argument(
        "--value",
        help="Valor do segredo para --set-secret (se omitido, solicita via prompt seguro)"
    )
    parser.add_argument(
        "--persist-env",
        action="store_true",
        help="Persiste o segredo também no arquivo .env local"
    )
    parser.add_argument(
        "--allow-remote",
        action="store_true",
        help="Permite bind em outros endereços além de 127.0.0.1"
    )
    parser.add_argument(
        "--selfcheck",
        action="store_true",
        help="Executa diagnóstico completo de configuração e ambiente"
    )
    parser.add_argument(
        "--host",
        default=None,
        help="Host para o servidor FastAPI"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="Porta para o servidor FastAPI"
    )

    args = parser.parse_args()

    # 1. Geração de chave
    if args.generate_key:
        new_key = generate_secure_api_key()
        print("\n=================================================")
        print("NOVA CHAVE DE API SEGURA (32 BYTES):")
        print(f"MONITOR_API_KEY={new_key}")
        print("=================================================")
        print("Para salvar no cofre seguro do sistema, execute:")
        print(f"python run_server.py --set-secret MONITOR_API_KEY --value {new_key}\n")
        sys.exit(0)

    # 2. Gravação de segredo
    if args.set_secret:
        key_name = args.set_secret.strip()
        val = args.value
        if not val:
            val = getpass.getpass(f"Digite o valor seguro para {key_name} (sem eco): ")
        if not val.strip():
            print(f"Erro: O valor para {key_name} não pode ser vazio.")
            sys.exit(1)
        set_secret(key_name, val.strip(), persist_env=args.persist_env)
        print(f"[OK] Segredo '{key_name}' gravado com sucesso no cofre seguro.")
        sys.exit(0)

    # 3. Diagnóstico --selfcheck
    if args.selfcheck:
        setup_logging()
        # pylint: disable=import-outside-toplevel
        from notifier.database import DatabaseManager
        from notifier.telegram import TelegramClient
        print("\n=================================================")
        print("DIAGNÓSTICO MAPFY SENTINEL (--selfcheck)")
        print("=================================================")
        print(f"Python: {sys.version.split()[0]} ({sys.executable})")
        print(f"Host: {Config.MONITOR_HOST}:{Config.MONITOR_PORT}")
        print(f"API Key configurada: {'SIM' if Config.MONITOR_API_KEY else 'NÃO'}")
        print(f"Telegram Bot Token: {'SIM' if Config.TELEGRAM_BOT_TOKEN else 'NÃO'}")
        print(f"Telegram Chat ID: {Config.TELEGRAM_CHAT_ID or 'NÃO DEFINIDO'}")

        # Testa banco
        # pylint: disable=broad-exception-caught
        try:
            _ = DatabaseManager()
            print("[OK] Banco de dados SQLite operacional (WAL mode ativo).")
        except Exception as e:
            print(f"[ERRO] Falha no banco de dados: {e}")

        # Testa Telegram
        # pylint: disable=broad-exception-caught
        tg = TelegramClient()
        if tg.is_configured:
            try:
                me = tg.test_connection()
                print(f"[OK] Conexão Telegram estabelecida: @{me.get('username')}")
            except Exception as e:
                print(f"[AVISO] Falha ao testar conexão Telegram: {e}")
        else:
            print("[INFO] Bot Telegram não configurado ou pendente de token.")

        print("=================================================\n")
        sys.exit(0)

    # 4. Inicialização normal do servidor
    setup_logging()
    logger = logging.getLogger("MapFySentinelRunner")

    if args.allow_remote:
        Config.ALLOW_REMOTE_BIND = True
    if args.host:
        Config.MONITOR_HOST = args.host
    if args.port:
        Config.MONITOR_PORT = args.port

    # Validação de segurança pré-vôo
    Config.validate_production()

    logger.info("=================================================================")
    logger.info("INICIANDO MAPFY SENTINEL v2 (CENTRO DE CONTROLE)")
    logger.info("Endereço: http://%s:%d", Config.MONITOR_HOST, Config.MONITOR_PORT)
    logger.info(
        "Bot Telegram: @%s (ativo: %s)",
        Config.TELEGRAM_BOT_USERNAME,
        bool(Config.TELEGRAM_BOT_TOKEN)
    )
    logger.info(
        "Timeout de Heartbeat: %d segundos",
        Config.HEARTBEAT_TIMEOUT_SECONDS
    )
    logger.info(
        "Dead Man's Switch: %d minutos",
        Config.EXPECTED_INTERVAL_MINUTES + Config.DEAD_MAN_GRACE_MINUTES
    )
    logger.info("Banco de dados: %s", Config.DATABASE_PATH)
    logger.info("=================================================================")

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
