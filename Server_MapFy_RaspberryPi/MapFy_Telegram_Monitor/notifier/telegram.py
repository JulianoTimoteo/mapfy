import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Optional

from notifier.config import Config, redact_token
from notifier.security import sanitize_message_length, validate_authorized_chat_id

logger = logging.getLogger("MapFyTelegramNotifier")


class TelegramClient:
    """Cliente oficial para comunicação com a API do Telegram Bot."""

    def __init__(self, token: Optional[str] = None):
        self._token = (token or Config.TELEGRAM_BOT_TOKEN).strip()
        self._base_url = f"https://api.telegram.org/bot{self._token}"

    @property
    def is_configured(self) -> bool:
        """Indica se o token está preenchido e não é o placeholder."""
        return bool(self._token and not self._token.startswith("SUBSTITUIR"))

    def _safe_url(self, endpoint: str) -> str:
        """Retorna a URL do endpoint com o token ocultado para uso seguro em logs."""
        return f"https://api.telegram.org/bot[REDACTED_TOKEN]/{endpoint}"

    def _request(self, endpoint: str, data: Optional[dict[str, Any]] = None, timeout: float = 10.0, max_retries: int = 3) -> dict[str, Any]:
        """Executa requisição HTTP à API do Telegram com retentativas e sanitização de logs."""
        if not self.is_configured:
            raise ValueError("Token do Telegram não está configurado.")

        url = f"{self._base_url}/{endpoint}"
        headers = {"Content-Type": "application/json; charset=utf-8"}
        body = json.dumps(data, ensure_ascii=False).encode("utf-8") if data else None

        last_error = None
        for attempt in range(1, max_retries + 1):
            try:
                req = urllib.request.Request(url, data=body, headers=headers, method="POST" if body else "GET")
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    resp_data = resp.read().decode("utf-8")
                    parsed = json.loads(resp_data)
                    if parsed.get("ok"):
                        return parsed
                    else:
                        description = redact_token(parsed.get("description", "Erro desconhecido na API do Telegram"))
                        raise RuntimeError(f"Telegram API error ({endpoint}): {description}")

            except urllib.error.HTTPError as e:
                error_body = ""
                try:
                    error_body = redact_token(e.read().decode("utf-8"))
                except Exception:
                    pass
                msg = f"HTTP {e.code} ao acessar {self._safe_url(endpoint)}: {error_body or e.reason}"
                last_error = RuntimeError(redact_token(msg))

            except urllib.error.URLError as e:
                msg = f"Falha de rede ao acessar {self._safe_url(endpoint)}: {e.reason}"
                last_error = RuntimeError(redact_token(msg))

            except Exception as e:
                last_error = RuntimeError(redact_token(f"Erro inesperado no Telegram ({endpoint}): {e}"))

            if attempt < max_retries:
                time.sleep(1.0 * attempt)

        raise last_error or RuntimeError("Falha desconhecida após retentativas na API do Telegram.")

    def test_connection(self) -> dict[str, Any]:
        """Verifica a validade do token chamando o endpoint getMe."""
        res = self._request("getMe")
        return res.get("result", {})

    def get_updates(self, offset: Optional[int] = None, timeout: int = 5) -> list[dict[str, Any]]:
        """Recupera as últimas mensagens/atualizações enviadas ao bot."""
        params: dict[str, Any] = {"timeout": timeout}
        if offset is not None:
            params["offset"] = offset
        res = self._request("getUpdates", data=params, timeout=timeout + 5)
        return res.get("result", [])

    def get_chat_id(self) -> Optional[str]:
        """
        Descobre o CHAT_ID do usuário que mais recentemente enviou uma mensagem ao bot (ex: /start).
        Retorna None se nenhuma mensagem recente for encontrada.
        """
        updates = self.get_updates(timeout=3)
        if not updates:
            return None

        # Procura a mensagem mais recente de trás para frente
        for item in reversed(updates):
            msg = item.get("message") or item.get("channel_post") or item.get("my_chat_member")
            if msg and "chat" in msg and "id" in msg["chat"]:
                return str(msg["chat"]["id"])

        return None

    def send_message(self, text: str, chat_id: Optional[str | int] = None) -> dict[str, Any]:
        """
        Envia mensagem ao Telegram, garantindo que vá exclusivamente para o CHAT_ID autorizado.
        """
        target_chat = validate_authorized_chat_id(chat_id)
        sanitized_text = sanitize_message_length(text)

        payload = {
            "chat_id": target_chat,
            "text": sanitized_text,
            "disable_web_page_preview": True
        }

        return self._request("sendMessage", data=payload)

    # --- Modelos Oficiais de Notificação (Seção 5 do Prompt) ---

    def send_extraction_started(self, start_time: Optional[datetime] = None, server_name: Optional[str] = None) -> dict[str, Any]:
        """5.1 Início da extração."""
        dt = start_time or datetime.now()
        srv = server_name or Config.SERVER_NAME

        text = (
            "MAPFY — EXTRAÇÃO INICIADA\n\n"
            f"Servidor: {srv}\n"
            f"Data: {dt.strftime('%d/%m/%Y')}\n"
            f"Horário: {dt.strftime('%H:%M:%S')}\n"
            "Status: EXECUTANDO\n"
            "Monitoramento: ATIVO"
        )
        return self.send_message(text)

    def send_extraction_error(
        self,
        origin: str,
        message: str,
        error_time: Optional[datetime] = None,
        error_type: str = "EXCEÇÃO PYTHON",
        is_interrupted: bool = False,
        server_name: Optional[str] = None
    ) -> dict[str, Any]:
        """5.2 Erro durante a extração."""
        dt = error_time or datetime.now()
        srv = server_name or Config.SERVER_NAME
        status_text = "EXTRAÇÃO INTERROMPIDA" if is_interrupted else "EXTRAÇÃO EM EXECUÇÃO"

        text = (
            "MAPFY — ERRO DETECTADO\n\n"
            f"Servidor: {srv}\n"
            f"Horário: {dt.strftime('%H:%M:%S')}\n"
            f"Tipo: {error_type}\n"
            f"Origem: {origin}\n"
            f"Mensagem: {message}\n"
            f"Status: {status_text}"
        )
        return self.send_message(text)

    def send_extraction_finished(
        self,
        start_time: datetime,
        end_time: Optional[datetime] = None,
        duration_seconds: Optional[float] = None,
        error_count: int = 0,
        result_override: Optional[str] = None,
        server_name: Optional[str] = None
    ) -> dict[str, Any]:
        """5.3 Extração concluída."""
        end_dt = end_time or datetime.now()
        srv = server_name or Config.SERVER_NAME

        if duration_seconds is None:
            dur_secs = max(0, int((end_dt - start_time).total_seconds()))
        else:
            dur_secs = max(0, int(duration_seconds))

        hours, remainder = divmod(dur_secs, 3600)
        minutes, seconds = divmod(remainder, 60)
        duration_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"

        if result_override:
            resultado = result_override
        elif error_count == 0:
            resultado = "SUCESSO"
        else:
            resultado = "CONCLUÍDA COM ERROS"

        text = (
            "MAPFY — RELATÓRIO DE EXTRAÇÃO\n\n"
            f"Servidor: {srv}\n"
            f"Início: {start_time.strftime('%d/%m/%Y %H:%M:%S')}\n"
            f"Término: {end_dt.strftime('%d/%m/%Y %H:%M:%S')}\n"
            f"Duração: {duration_str}\n"
            "Status: CONCLUÍDA\n"
            f"Total de erros: {error_count}\n"
            f"Resultado: {resultado}"
        )
        return self.send_message(text)

    def send_extraction_interrupted(
        self,
        last_heartbeat: datetime,
        elapsed_seconds: float,
        server_name: Optional[str] = None
    ) -> dict[str, Any]:
        """5.4 Processo interrompido (sem heartbeat)."""
        srv = server_name or Config.SERVER_NAME

        mins = int(elapsed_seconds // 60)
        secs = int(elapsed_seconds % 60)
        tempo_str = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"

        text = (
            "MAPFY — ALERTA DE INTERRUPÇÃO\n\n"
            f"Servidor: {srv}\n"
            f"Último heartbeat: {last_heartbeat.strftime('%d/%m/%Y %H:%M:%S')}\n"
            f"Tempo sem comunicação: {tempo_str}\n"
            "Status: SEM COMUNICAÇÃO\n"
            "Ação: VERIFICAR O PROCESSO DE EXTRAÇÃO."
        )
        return self.send_message(text)

    def send_recovery_notification(
        self,
        recovery_time: Optional[datetime] = None,
        server_name: Optional[str] = None
    ) -> dict[str, Any]:
        """5.5 Recuperação do processo."""
        dt = recovery_time or datetime.now()
        srv = server_name or Config.SERVER_NAME

        text = (
            "MAPFY — SISTEMA RECUPERADO\n\n"
            f"Servidor: {srv}\n"
            f"Horário da recuperação: {dt.strftime('%d/%m/%Y %H:%M:%S')}\n"
            "Status: COMUNICAÇÃO RESTABELECIDA."
        )
        return self.send_message(text)
