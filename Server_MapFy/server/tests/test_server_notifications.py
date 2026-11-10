from __future__ import annotations

import json
import logging
import os
import sys
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

SERVER_DIR = Path(__file__).resolve().parent.parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from server_notifications import create_telegram_handler


class TelegramNotificationTests(unittest.TestCase):
    def test_handler_sends_formatted_logs_to_configured_chat(self) -> None:
        response = BytesIO(b'{"ok":true}')
        with patch.dict(
            os.environ,
            {
                "MAPFY_TELEGRAM_BOT_TOKEN": "test-token",
                "MAPFY_TELEGRAM_CHAT_ID": "12345",
            },
            clear=True,
        ), patch("server_notifications.urlopen", return_value=response) as urlopen:
            handler = create_telegram_handler()
            self.assertIsNotNone(handler)
            assert handler is not None
            handler.setFormatter(logging.Formatter("%(message)s"))
            handler.emit(
                logging.LogRecord(
                    "mapfy.server",
                    logging.INFO,
                    __file__,
                    1,
                    "Servidor MapFy iniciado.",
                    (),
                    None,
                )
            )
            handler.flush()
            handler.close()

            request = urlopen.call_args.args[0]
            body = json.loads(request.data.decode("utf-8"))
            self.assertEqual(body["chat_id"], "12345")
            self.assertEqual(body["text"], "Servidor MapFy iniciado.")
            self.assertIn("test-token", request.full_url)

    def test_partial_telegram_configuration_is_rejected(self) -> None:
        with patch.dict(
            os.environ,
            {"MAPFY_TELEGRAM_BOT_TOKEN": "test-token"},
            clear=True,
        ):
            with self.assertRaisesRegex(ValueError, "Configure MAPFY_TELEGRAM"):
                create_telegram_handler()

    def test_handler_redacts_credentials_from_log_messages(self) -> None:
        response = BytesIO(b'{"ok":true}')
        with patch.dict(
            os.environ,
            {
                "MAPFY_TELEGRAM_BOT_TOKEN": "bot-test-token",
                "MAPFY_TELEGRAM_CHAT_ID": "12345",
                "MAPFY_GITHUB_TOKEN": "github-secret",
            },
            clear=True,
        ), patch("server_notifications.urlopen", return_value=response) as urlopen:
            handler = create_telegram_handler()
            self.assertIsNotNone(handler)
            assert handler is not None
            handler.setFormatter(logging.Formatter("%(message)s"))
            handler.emit(
                logging.LogRecord(
                    "mapfy.server",
                    logging.INFO,
                    __file__,
                    1,
                    "token=github-secret",
                    (),
                    None,
                )
            )
            handler.flush()
            handler.close()

            body = json.loads(urlopen.call_args.args[0].data.decode("utf-8"))
            self.assertEqual(body["text"], "token=[REDACTED]")


if __name__ == "__main__":
    unittest.main()
