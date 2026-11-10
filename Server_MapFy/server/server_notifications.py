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
            if len(message) > 4000:
                message = message[:3997] + "..."
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
        while True:
            message = self._messages.get()
            try:
                if message is None:
                    return
                self._send_message(message)
            finally:
                self._messages.task_done()

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
