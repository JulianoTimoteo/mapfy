import hmac
import time
from collections import defaultdict
from threading import Lock
from typing import Optional

from fastapi import Header, HTTPException, Request, status
from notifier.config import Config, redact_token

MAX_TELEGRAM_MESSAGE_LENGTH = 4000


class IPRateLimiter:
    """Controlador de taxa e bloqueio temporário de força bruta por IP."""

    def __init__(self, max_failures: int = 5, ban_seconds: int = 300, window_seconds: int = 60):
        self.max_failures = max_failures
        self.ban_seconds = ban_seconds
        self.window_seconds = window_seconds
        self._failures: dict[str, list[float]] = defaultdict(list)
        self._bans: dict[str, float] = {}
        self._lock = Lock()

    def is_banned(self, ip: str) -> bool:
        with self._lock:
            now = time.time()
            if ip in self._bans:
                if now < self._bans[ip]:
                    return True
                else:
                    del self._bans[ip]
            return False

    def record_failure(self, ip: str) -> bool:
        """Registra falha de autenticação. Retorna True se o IP foi banido."""
        with self._lock:
            now = time.time()
            # Limpa falhas fora da janela
            self._failures[ip] = [t for t in self._failures[ip] if now - t < self.window_seconds]
            self._failures[ip].append(now)

            if len(self._failures[ip]) >= self.max_failures:
                self._bans[ip] = now + self.ban_seconds
                self._failures[ip].clear()
                return True
            return False

    def record_success(self, ip: str) -> None:
        with self._lock:
            if ip in self._failures:
                del self._failures[ip]


# Instância global do RateLimiter
auth_limiter = IPRateLimiter(
    max_failures=Config.MAX_FAILED_AUTH_ATTEMPTS,
    ban_seconds=Config.AUTH_BAN_SECONDS,
)


def verify_api_key(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> bool:
    """
    Valida a chave de API em tempo constante (hmac.compare_digest)
    com rate limiting e bloqueio anti-força bruta por IP.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"

    if auth_limiter.is_banned(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas inválidas. IP temporariamente bloqueado por segurança.",
        )

    provided_key = None
    if x_api_key:
        provided_key = x_api_key.strip()
    elif authorization and authorization.lower().startswith("bearer "):
        provided_key = authorization[7:].strip()

    expected_key = Config.MONITOR_API_KEY.strip()
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="MONITOR_API_KEY não configurada no servidor.",
        )

    if not provided_key or not hmac.compare_digest(provided_key.encode("utf-8"), expected_key.encode("utf-8")):
        was_banned = auth_limiter.record_failure(client_ip)
        if was_banned:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Limite de falhas excedido. IP temporariamente bloqueado.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave de API inválida ou ausente.",
        )

    auth_limiter.record_success(client_ip)
    return True


def sanitize_message_length(text: str, max_length: int = MAX_TELEGRAM_MESSAGE_LENGTH) -> str:
    """
    Garante que o texto da mensagem não ultrapasse o limite suportado pelo Telegram.
    Se ultrapassar, trunca preservando o início e adiciona aviso.
    """
    if not text:
        return ""

    # Aplica redação preventiva de credenciais antes de medir
    text = redact_token(text)

    if len(text) <= max_length:
        return text

    truncated_notice = "\n\n... [Mensagem truncada pelo monitor por exceder limite de tamanho]"
    cut_length = max_length - len(truncated_notice)
    return text[:cut_length] + truncated_notice


def validate_authorized_chat_id(target_chat_id: Optional[str | int] = None) -> str:
    """
    Garante que as notificações sejam enviadas exclusivamente para o CHAT_ID autorizado.
    Não permite que chamadas externas escolham destinatários arbitrários.
    """
    configured_id = str(Config.TELEGRAM_CHAT_ID).strip()

    if not configured_id or configured_id in ("OBTER_AUTOMATICAMENTE_OU_CONFIGURAR", "None", ""):
        raise ValueError(
            "TELEGRAM_CHAT_ID não está configurado. Configure no .env ou realize o pareamento com o bot."
        )

    if target_chat_id is not None:
        target_str = str(target_chat_id).strip()
        if target_str and target_str != configured_id:
            raise PermissionError(
                f"Destinatário {target_str} não autorizado. Apenas o CHAT_ID configurado tem permissão."
            )

    return configured_id
