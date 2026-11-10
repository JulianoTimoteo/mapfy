#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
server_notifications.py
=======================
Notificador Resiliente do Telegram para o MapFy Raspberry Pi Server.
Envia alertas formatados, mascarando credenciais automaticamente.
Usina Pitangueiras • Safra 2026
"""

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

            payload = {
                "chat_id": self._chat_id,
                "text": message,
                "disable_web_page_preview": True,
            }
            request = Request(
                self._url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urlopen(request, timeout=10) as response:
                    if response.status != 200:
                        pending = message
                        continue
            except Exception:
                pending = message
                continue
            self._messages.task_done()


def send_telegram_alert(text: str) -> bool:
    """Função direta para envio imediato de mensagem ao Telegram."""
    bot_token = os.getenv("MAPFY_TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("MAPFY_TELEGRAM_CHAT_ID", "").strip()
    if not bot_token or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
        "disable_web_page_preview": True,
    }
    try:
        req = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception:
        return False
