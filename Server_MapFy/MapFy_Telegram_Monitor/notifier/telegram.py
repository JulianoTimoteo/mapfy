"""
Cliente da API de Bots do Telegram com Fila Outbox Durável e Polling Bidirecional - Sentinel v2.
"""

from __future__ import annotations

import json
import logging
import random
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any, Optional

from notifier.config import Config, redact_token
from notifier.database import DatabaseManager, now_utc
from notifier.security import sanitize_message_length, validate_authorized_chat_id

logger = logging.getLogger("mapfy.telegram")


class TelegramClient:
    """
    Cliente robusto para integração com a API de bots do Telegram.
    Suporta envio direto, envio durável via Outbox em SQLite com backoff e rate limit 429,
    edição de mensagens e botões inline.
    """

    def __init__(
        self,
        token: Optional[str] = None,
        chat_id: Optional[str | int] = None,
        db: Optional[DatabaseManager] = None
    ) -> None:
        self._token = (token or Config.TELEGRAM_BOT_TOKEN).strip()
        self._chat_id = str(chat_id or Config.TELEGRAM_CHAT_ID).strip()
        self._base_url = f"https://api.telegram.org/bot{self._token}"
        self.db = db

        # Workers em segundo plano
        self._outbox_worker_thread: Optional[threading.Thread] = None
        self._polling_worker_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    @property
    def is_configured(self) -> bool:
        """Indica se o token está preenchido e não é o placeholder."""
        return bool(self._token and not self._token.startswith("SUBSTITUIR"))

    def _safe_url(self, endpoint: str) -> str:
        """Retorna a URL do endpoint com o token ocultado para uso seguro em logs."""
        return f"https://api.telegram.org/bot[REDACTED_TELEGRAM_TOKEN]/{endpoint}"

    def _request(
        self,
        endpoint: str,
        data: Optional[dict[str, Any]] = None,
        timeout: float = 10.0,
        max_retries: int = 3
    ) -> dict[str, Any]:
        """
        Executa requisição HTTP à API do Telegram com retentativas e sanitização de logs.
        Trata HTTP 429 capturando o cabeçalho Retry-After ou o campo retry_after do payload JSON.
        """
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
                retry_after = None
                try:
                    raw_err = e.read().decode("utf-8")
                    error_body = redact_token(raw_err)
                    err_json = json.loads(raw_err)
                    # Verifica rate limit 429
                    if e.code == 429 or "retry_after" in err_json.get("parameters", {}):
                        retry_after = err_json.get("parameters", {}).get("retry_after")
                except Exception:
                    pass

                if e.code == 429:
                    wait_time = int(retry_after or e.headers.get("Retry-After", 5))
                    logger.warning("Telegram Rate Limit (HTTP 429). Aguardando %ds antes de retentar...", wait_time)
                    time.sleep(wait_time)
                    continue

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

    def send_message(
        self,
        text: str,
        chat_id: Optional[str | int] = None,
        parse_mode: Optional[str] = None,
        reply_markup: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        """
        Envia mensagem síncrona ao Telegram para o destinatário autorizado.
        """
        target_chat = validate_authorized_chat_id(chat_id)
        sanitized_text = sanitize_message_length(text)

        payload: dict[str, Any] = {
            "chat_id": target_chat,
            "text": sanitized_text,
            "disable_web_page_preview": True
        }
        if parse_mode:
            payload["parse_mode"] = parse_mode
        if reply_markup:
            payload["reply_markup"] = reply_markup

        return self._request("sendMessage", data=payload)

    def edit_message_text(
        self,
        chat_id: str | int,
        message_id: int,
        text: str,
        parse_mode: Optional[str] = None,
        reply_markup: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        """Edita o texto de uma mensagem já enviada no Telegram."""
        payload: dict[str, Any] = {
            "chat_id": str(chat_id),
            "message_id": message_id,
            "text": sanitize_message_length(text),
            "disable_web_page_preview": True
        }
        if parse_mode:
            payload["parse_mode"] = parse_mode
        if reply_markup:
            payload["reply_markup"] = reply_markup

        return self._request("editMessageText", data=payload)

    def answer_callback_query(
        self,
        callback_query_id: str,
        text: Optional[str] = None,
        show_alert: bool = False
    ) -> dict[str, Any]:
        """Responde a uma consulta de callback emitida por botão inline."""
        payload: dict[str, Any] = {"callback_query_id": callback_query_id}
        if text:
            payload["text"] = text
            payload["show_alert"] = show_alert
        return self._request("answerCallbackQuery", data=payload)

    def enqueue_message(
        self,
        text: str,
        chat_id: Optional[str | int] = None,
        parse_mode: str = "HTML",
        reply_markup: Optional[dict[str, Any]] = None,
        edit_message_id: Optional[int] = None,
        fingerprint: Optional[str] = None
    ) -> int:
        """
        Enfileira mensagem na tabela durável outbox.
        Se db não estiver disponível, faz envio direto síncrono como fallback.
        """
        target_chat = chat_id or self._chat_id or Config.TELEGRAM_CHAT_ID
        if not target_chat:
            target_chat = validate_authorized_chat_id(None)

        if self.db:
            return self.db.enqueue_outbox(
                chat_id=target_chat,
                text=text,
                parse_mode=parse_mode,
                reply_markup=reply_markup,
                edit_message_id=edit_message_id,
                fingerprint=fingerprint
            )
        else:
            # Fallback direto caso o cliente não tenha recebido a instância de db
            try:
                res = self.send_message(text, target_chat, parse_mode=parse_mode, reply_markup=reply_markup)
                return res.get("result", {}).get("message_id", 1)
            except Exception as e:
                logger.error("Falha no fallback de envio direto: %s", e)
                return 0

    # --- Modelos Oficiais de Notificação (Compatibilidade v1 + Sentinel v2) ---

    def send_extraction_started(
        self,
        start_time: Optional[datetime] = None,
        server_name: Optional[str] = None
    ) -> dict[str, Any]:
        """Início da extração."""
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
        server_name: Optional[str] = None,
        incident_id: Optional[int] = None
    ) -> dict[str, Any]:
        """Erro durante a extração."""
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

        reply_markup = None
        if incident_id:
            reply_markup = {
                "inline_keyboard": [
                    [
                        {"text": "🔕 Reconhecer", "callback_data": f"ack:{incident_id}"},
                        {"text": "⏱️ Silenciar 30m", "callback_data": "silence:30"}
                    ]
                ]
            }

        return self.send_message(text, reply_markup=reply_markup)

    def send_extraction_finished(
        self,
        start_time: datetime,
        end_time: Optional[datetime] = None,
        duration_seconds: Optional[float] = None,
        error_count: int = 0,
        result_override: Optional[str] = None,
        server_name: Optional[str] = None,
        summary: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        """Extração concluída com relatório analítico enriquecido."""
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

        # Formato texto clássico (mantido estritamente para compatibilidade de testes)
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

        # Se houver métricas detalhadas de extração, adiciona bloco complementar
        if summary:
            total_reg = summary.get("total_registros") or summary.get("linhas_extraidas", 0)
            novos = summary.get("novos_registros", 0)
            dup = summary.get("duplicados", 0)
            xlsx_mb = summary.get("tamanho_xlsx_mb", "")
            vel = f"{(total_reg / dur_secs):.1f} lin/s" if dur_secs > 0 and total_reg else ""

            extra_lines = ["\n\n--- DADOS ANALÍTICOS ---"]
            if total_reg:
                extra_lines.append(f"Registros processados: {total_reg:,}")
            if novos:
                extra_lines.append(f"Novos adicionados: {novos:,}")
            if dup:
                extra_lines.append(f"Duplicados ignorados: {dup:,}")
            if vel:
                extra_lines.append(f"Velocidade média: {vel}")
            if xlsx_mb:
                extra_lines.append(f"Planilha consolidada: {xlsx_mb} MB")

            text += "\n".join(extra_lines)

        return self.send_message(text)

    def send_extraction_interrupted(
        self,
        last_heartbeat: datetime,
        elapsed_seconds: float,
        server_name: Optional[str] = None,
        incident_id: Optional[int] = None
    ) -> dict[str, Any]:
        """Processo interrompido (sem heartbeat)."""
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

        reply_markup = None
        if incident_id:
            reply_markup = {
                "inline_keyboard": [
                    [
                        {"text": "🔕 Reconhecer", "callback_data": f"ack:{incident_id}"},
                        {"text": "📜 Ver Logs", "callback_data": "cmd:logs"}
                    ]
                ]
            }

        return self.send_message(text, reply_markup=reply_markup)

    def send_recovery_notification(
        self,
        recovery_time: Optional[datetime] = None,
        server_name: Optional[str] = None
    ) -> dict[str, Any]:
        """Recuperação do processo."""
        dt = recovery_time or datetime.now()
        srv = server_name or Config.SERVER_NAME

        text = (
            "MAPFY — SISTEMA RECUPERADO\n\n"
            f"Servidor: {srv}\n"
            f"Horário da recuperação: {dt.strftime('%d/%m/%Y %H:%M:%S')}\n"
            "Status: COMUNICAÇÃO RESTABELECIDA."
        )
        return self.send_message(text)

    def send_dead_man_alert(self, elapsed_minutes: int, expected_interval: int) -> dict[str, Any]:
        """Alerta de ponto cego: nenhuma execução iniciou no intervalo programado."""
        text = (
            "🚨 <b>MAPFY SENTINEL — DEAD MAN'S SWITCH DISPARADO</b>\n\n"
            f"<b>Servidor:</b> {Config.SERVER_NAME}\n"
            f"<b>Tempo Inativo:</b> {elapsed_minutes} minutos\n"
            f"<b>Intervalo Esperado:</b> {expected_interval} minutos\n\n"
            "⚠️ <b>Diagnóstico:</b> O extrator não foi iniciado pelo Agendador de Tarefas do Windows.\n"
            "Verifique se o host está ligado ou se o agendamento foi suspenso."
        )
        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "🚀 Rodar Agora", "callback_data": "cmd:rodar_agora"},
                    {"text": "🖥️ Ver Saúde", "callback_data": "cmd:saude"}
                ]
            ]
        }
        return self.send_message(text, parse_mode="HTML", reply_markup=keyboard)

    def send_stalled_alert(self, run_id: str, stage: str, elapsed_seconds: float) -> dict[str, Any]:
        """Alerta de travamento em um estágio específico da automação."""
        mins = int(elapsed_seconds // 60)
        text = (
            "⚠️ <b>MAPFY SENTINEL — EXECUÇÃO ESTAGNADA (STALLED)</b>\n\n"
            f"<b>Execução:</b> <code>{run_id}</code>\n"
            f"<b>Estágio Travado:</b> <code>{stage}</code>\n"
            f"<b>Tempo sem Progresso:</b> {mins} minutos\n\n"
            "O extrator continua enviando heartbeat de processo, mas a tarefa não avança no navegador."
        )
        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "🛑 Parar Execução", "callback_data": "cmd:parar"},
                    {"text": "📜 Ver Logs", "callback_data": "cmd:logs"}
                ]
            ]
        }
        return self.send_message(text, parse_mode="HTML", reply_markup=keyboard)

    # --- Workers em Segundo Plano (Fase 1 e Fase 2) ---

    def start_background_workers(self, db: DatabaseManager, monitor_engine: Any) -> None:
        """Inicia os workers de outbox durável e de polling bidirecional do Telegram."""
        self.db = db
        self._stop_event.clear()

        # 1. Outbox Worker
        if not self._outbox_worker_thread or not self._outbox_worker_thread.is_alive():
            self._outbox_worker_thread = threading.Thread(
                target=self._outbox_loop,
                name="SentinelOutboxWorker",
                daemon=True
            )
            self._outbox_worker_thread.start()
            logger.info("Worker Outbox iniciado com sucesso.")

        # 2. Polling Listener (somente se token for válido)
        if self.is_configured:
            if not self._polling_worker_thread or not self._polling_worker_thread.is_alive():
                self._polling_worker_thread = threading.Thread(
                    target=self._polling_loop,
                    args=(monitor_engine,),
                    name="SentinelTelegramPolling",
                    daemon=True
                )
                self._polling_worker_thread.start()
                logger.info("Listener de polling do Telegram iniciado com sucesso.")

    def stop_background_workers(self) -> None:
        """Sinaliza encerramento ordenado dos workers em background."""
        self._stop_event.set()
        logger.info("Sinal de parada enviado aos workers do Telegram.")

    def _outbox_loop(self) -> None:
        """Loop contínuo de processamento da fila durável Outbox."""
        logger.info("Loop do Outbox Worker ativo.")
        while not self._stop_event.is_set():
            if not self.db:
                time.sleep(2.0)
                continue

            try:
                pending_items = self.db.get_pending_outbox(limit=10)
                for item in pending_items:
                    if self._stop_event.is_set():
                        break

                    outbox_id = item["id"]
                    chat_id = item["chat_id"]
                    text = item["text"]
                    parse_mode = item.get("parse_mode")
                    edit_msg_id = item.get("edit_message_id")
                    markup = None
                    if item.get("reply_markup"):
                        try:
                            markup = json.loads(item["reply_markup"])
                        except Exception:
                            pass

                    # Verifica se alertas estão silenciados
                    silenced_until = self.db.get_bot_state("silenced_until", "")
                    if silenced_until:
                        try:
                            sil_dt = datetime.strptime(silenced_until, "%Y-%m-%d %H:%M:%S")
                            if now_utc() < sil_dt and "ERRO" in text:
                                # Descarta ou adia envio do erro
                                self.db.mark_outbox_sent(outbox_id, 0)
                                continue
                        except Exception:
                            pass

                    try:
                        if edit_msg_id:
                            # Atualização / Edição in-place
                            res = self.edit_message_text(
                                chat_id=chat_id,
                                message_id=edit_msg_id,
                                text=text,
                                parse_mode=parse_mode,
                                reply_markup=markup
                            )
                            self.db.mark_outbox_sent(outbox_id, edit_msg_id)
                        else:
                            # Novo envio
                            res = self.send_message(
                                text=text,
                                chat_id=chat_id,
                                parse_mode=parse_mode,
                                reply_markup=markup
                            )
                            new_msg_id = res.get("result", {}).get("message_id")
                            self.db.mark_outbox_sent(outbox_id, new_msg_id)

                    except Exception as exc:
                        attempts = item.get("attempts", 0) + 1
                        # Backoff exponencial com jitter
                        delay = min(300.0, (2.0 ** min(attempts, 8)) + random.uniform(0.5, 2.5))
                        permanent = attempts >= item.get("max_attempts", 15)
                        self.db.mark_outbox_failed(
                            outbox_id=outbox_id,
                            error_message=str(exc),
                            retry_delay_seconds=delay,
                            permanent=permanent
                        )
                        logger.warning("Falha ao entregar outbox #%d (tentativa %d): %s", outbox_id, attempts, exc)

            except Exception as e:
                logger.error("Erro no processamento da fila outbox: %s", e)

            # Intervalo de verificação
            self._stop_event.wait(2.0)

    def _polling_loop(self, monitor_engine: Any) -> None:
        """Loop contínuo de recepção de comandos via getUpdates."""
        from notifier.bot_commands import BotCommandHandler
        cmd_handler = BotCommandHandler(db=self.db, monitor_engine=monitor_engine, telegram_client=self)

        last_offset = None
        if self.db:
            saved_off = self.db.get_bot_state("telegram_offset", "")
            if saved_off.isdigit():
                last_offset = int(saved_off)

        logger.info("Iniciando polling do Telegram a partir do offset %s...", last_offset)

        while not self._stop_event.is_set():
            try:
                updates = self.get_updates(offset=last_offset, timeout=15)
                for update in updates:
                    update_id = update["update_id"]
                    last_offset = update_id + 1
                    if self.db:
                        self.db.set_bot_state("telegram_offset", str(last_offset))

                    # 1. Tratamento de Mensagem de Texto
                    if "message" in update and "text" in update["message"]:
                        msg = update["message"]
                        chat_id = msg["chat"]["id"]
                        user_info = msg.get("from", {})
                        user_id = user_info.get("id", chat_id)
                        username = user_info.get("username", "")
                        text = msg["text"]

                        # Executa comando
                        resp = cmd_handler.handle_command(user_id=user_id, text=text, username=username)
                        if resp and "text" in resp:
                            self.send_message(
                                text=resp["text"],
                                chat_id=chat_id,
                                parse_mode=resp.get("parse_mode"),
                                reply_markup=resp.get("reply_markup")
                            )

                    # 2. Tratamento de Botão Inline (Callback Query)
                    elif "callback_query" in update:
                        cq = update["callback_query"]
                        cq_id = cq["id"]
                        user_id = cq.get("from", {}).get("id")
                        data = cq.get("data", "")
                        chat_id = cq.get("message", {}).get("chat", {}).get("id")

                        resp = cmd_handler.handle_callback_query(user_id=user_id, data=data, cq_id=cq_id)
                        if resp and "text" in resp and chat_id:
                            self.send_message(
                                text=resp["text"],
                                chat_id=chat_id,
                                parse_mode=resp.get("parse_mode"),
                                reply_markup=resp.get("reply_markup")
                            )

            except Exception as e:
                logger.warning("Falha temporária no polling do Telegram: %s", e)
                self._stop_event.wait(5.0)

            self._stop_event.wait(0.5)
