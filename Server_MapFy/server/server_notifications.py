from __future__ import annotations

import json
import logging
import os
import queue
import threading
from urllib.request import Request, urlopen


class TelegramLogHandler(logging.Handler):
    def __init__(self, bot_token: str, chat_id: str) -> None:
        super().__init__(level=logging.INFO)
        self._url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        self._chat_id = chat_id
        self._messages: queue.Queue[str | None] = queue.Queue()
        self._worker = threading.Thread(
            target=self._send_messages,
            name="mapfy-telegram-notifications",
            daemon=True,
        )
        self._worker.start()

    def emit(self, record: logging.LogRecord) -> None:
        try:
            if record.name == "mapfy.notifications":
                return
            message = self.format(record)
            for variable in (
                "MAPFY_PASS",
                "MAPFY_GITHUB_TOKEN",
                "MAPFY_API_KEY",
                "MAPFY_TELEGRAM_BOT_TOKEN",
                "MAPFY_USER",
            ):
                secret = os.getenv(variable, "").strip()
                if secret:
                    message = message.replace(secret, "[REDACTED]")
            message = message.replace("\r\n", "\n").replace("\r", "\n")
            if len(message) > 3800:
                message = message[:3797] + "..."
            self._messages.put_nowait(message)
        except Exception:
            self.handleError(record)

    def flush(self) -> None:
        self._messages.join()

    def close(self) -> None:
        if self._worker.is_alive():
            self.flush()
            self._messages.put(None)
            self._worker.join(timeout=10)
        super().close()

    def _send_messages(self) -> None:
        pending: str | None = None
        while True:
            message = pending if pending is not None else self._messages.get()
            pending = None
            if message is None:
                self._messages.task_done()
                return

            batch = [message]
            batch_length = len(message)
            stop_after_batch = False
            while batch_length < 3500:
                try:
                    next_message = self._messages.get_nowait()
                except queue.Empty:
                    break
                if next_message is None:
                    self._messages.task_done()
                    stop_after_batch = True
                    break
                if batch_length + len(next_message) + 1 > 3500:
                    pending = next_message
                    break
                batch.append(next_message)
                batch_length += len(next_message) + 1
            try:
                self._send_message("\n".join(batch))
            finally:
                for _ in batch:
                    self._messages.task_done()
            if stop_after_batch:
                return

    def _send_message(self, message: str) -> None:
        payload = json.dumps(
            {"chat_id": self._chat_id, "text": message},
            ensure_ascii=False,
        ).encode("utf-8")
        request = Request(
            self._url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=5) as response:
                result = json.loads(response.read().decode("utf-8"))
            if not result.get("ok"):
                raise RuntimeError("Telegram API rejected the notification.")
        except Exception as exc:
            logging.getLogger("mapfy.notifications").error(
                "Falha ao enviar notificação ao Telegram (%s).",
                type(exc).__name__,
            )


def create_telegram_handler() -> TelegramLogHandler | None:
    bot_token = os.getenv("MAPFY_TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("MAPFY_TELEGRAM_CHAT_ID", "").strip()
    if not bot_token and not chat_id:
        return None
    if not bot_token or not chat_id:
        raise ValueError(
            "Configure MAPFY_TELEGRAM_BOT_TOKEN e MAPFY_TELEGRAM_CHAT_ID juntos."
        )
    return TelegramLogHandler(bot_token, chat_id)


def send_telegram_direct(
    message: str,
    bot_token: str | None = None,
    chat_id: str | None = None,
    timeout: float = 8.0
) -> bool:
    """Envia uma mensagem direta e imediata ao Telegram."""
    token = (bot_token or os.getenv("MAPFY_TELEGRAM_BOT_TOKEN", "")).strip()
    cid = (chat_id or os.getenv("MAPFY_TELEGRAM_CHAT_ID", "")).strip()

    if not token or not cid or cid == "OBTER_AUTOMATICAMENTE_OU_CONFIGURAR":
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({"chat_id": cid, "text": message}, ensure_ascii=False).encode("utf-8")
    req = Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")

    try:
        with urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return bool(data.get("ok"))
    except Exception as exc:
        logging.getLogger("mapfy.notifications").error(
            "Erro ao enviar mensagem direta Telegram (%s): %s", type(exc).__name__, exc
        )
        return False


def format_duration(seconds: float) -> str:
    secs = int(max(0, seconds))
    h, rem = divmod(secs, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def send_sentinel_summary(
    relatorio_geral: list[dict],
    duration_seconds: float = 0.0,
    server_name: str = "MAPFY-EXTRACTOR"
) -> bool:
    """
    Envia relatório consolidado ao Telegram informando:
    1. Relatórios concluídos com novas atualizações (com contagem de linhas novas).
    2. Nenhuma nova atualização (quando tudo estiver sincronizado sem novos dados).
    3. Alertas de falhas caso ocorram.
    """
    from datetime import datetime
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    dur_str = format_duration(duration_seconds)

    atualizados = [r for r in relatorio_geral if r.get("added", 0) > 0]
    falhas = [r for r in relatorio_geral if r.get("status") == "ERRO"]
    total_novos = sum(r.get("added", 0) for r in atualizados)
    total_formularios = len(relatorio_geral)

    if falhas:
        status_header = "⚠️ MAPFY SENTINEL — EXTRAÇÃO COM ALERTA"
        resultado_str = "CONCLUÍDA COM FALHAS"
    elif atualizados:
        status_header = "📊 MAPFY SENTINEL — EXTRAÇÃO CONCLUÍDA"
        resultado_str = "CONCLUÍDA COM ATUALIZAÇÕES"
    else:
        status_header = "📊 MAPFY SENTINEL — EXTRAÇÃO CONCLUÍDA"
        resultado_str = "CONCLUÍDA (SEM NOVOS DADOS)"

    linhas = [
        status_header,
        "",
        f"Servidor: {server_name}",
        f"Data/Horário: {now_str}",
        f"Duração: {dur_str}",
        f"Status: {resultado_str}",
        f"Formulários verificados: {total_formularios}",
        ""
    ]

    if falhas:
        linhas.append("❌ Formulários com falha na extração:")
        for f in falhas:
            linhas.append(f"• {f.get('form')}: {f.get('mensagem', 'Erro desconhecido')}")
        linhas.append("")

    if atualizados:
        linhas.append("✅ Relatórios concluídos atualizados:")
        for r in atualizados:
            form_name = r.get("form", "Formulário")
            added = r.get("added", 0)
            total = r.get("total", 0)
            linhas.append(f"• {form_name}: +{added} novos registros (Total: {total:,})".replace(",", "."))
        linhas.append("")
        linhas.append(f"📈 Total geral inserido: +{total_novos} novos registros.")
        outros = total_formularios - len(atualizados) - len(falhas)
        if outros > 0:
            linhas.append(f"ℹ️ Os outros {outros} formulários já estavam em dia.")
    else:
        linhas.append("ℹ️ Nenhuma nova atualização:")
        linhas.append("Não houve novos lançamentos na plataforma MapFy para o período consultado.")
        linhas.append(f"Todos os {total_formularios} relatórios permanecem 100% íntegros e sincronizados.")

    linhas.append("")
    linhas.append("Usina Pitangueiras • Monitoramento Autônomo 2026")

    msg = "\n".join(linhas)
    return send_telegram_direct(msg)

