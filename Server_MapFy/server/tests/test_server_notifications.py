from __future__ import annotations

import json
import logging
import os
import sys
import threading
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

SERVER_DIR = Path(__file__).resolve().parent.parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from server_notifications import create_telegram_handler, send_sentinel_summary, send_telegram_direct


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

    def test_handler_batches_queued_logs_without_losing_messages(self) -> None:
        first_request_started = threading.Event()
        release_first_request = threading.Event()

        def send_request(*_args: object, **_kwargs: object) -> BytesIO:
            if not first_request_started.is_set():
                first_request_started.set()
                release_first_request.wait(timeout=5)
            return BytesIO(b'{"ok":true}')

        with patch.dict(
            os.environ,
            {
                "MAPFY_TELEGRAM_BOT_TOKEN": "test-token",
                "MAPFY_TELEGRAM_CHAT_ID": "12345",
            },
            clear=True,
        ), patch("server_notifications.urlopen", side_effect=send_request) as urlopen:
            handler = create_telegram_handler()
            self.assertIsNotNone(handler)
            assert handler is not None
            handler.setFormatter(logging.Formatter("%(message)s"))

            def emit(message: str) -> None:
                handler.emit(
                    logging.LogRecord(
                        "mapfy.server",
                        logging.INFO,
                        __file__,
                        1,
                        message,
                        (),
                        None,
                    )
                )

            emit("primeiro")
            self.assertTrue(first_request_started.wait(timeout=5))
            emit("segundo")
            emit("terceiro")
            release_first_request.set()
            handler.flush()
            handler.close()

            self.assertEqual(urlopen.call_count, 2)
            batched_body = json.loads(urlopen.call_args_list[1].args[0].data.decode("utf-8"))
            self.assertEqual(batched_body["text"], "segundo\nterceiro")

    def test_send_sentinel_summary_with_updated_reports(self) -> None:
        response = BytesIO(b'{"ok":true}')
        relatorio = [
            {"form": "Subsolagem", "status": "OK", "added": 15, "total": 1200, "mensagem": "Novos dados"},
            {"form": "Sulcação", "status": "OK", "added": 0, "total": 800, "mensagem": "Sem dados"}
        ]
        with patch.dict(
            os.environ,
            {
                "MAPFY_TELEGRAM_BOT_TOKEN": "token-test",
                "MAPFY_TELEGRAM_CHAT_ID": "chat-999",
            }
        ), patch("server_notifications.urlopen", return_value=response) as mock_url:
            success = send_sentinel_summary(relatorio, duration_seconds=125.0)
            self.assertTrue(success)
            req = mock_url.call_args.args[0]
            body = json.loads(req.data.decode("utf-8"))
            text = body["text"]
            self.assertIn("MAPFY SENTINEL — EXTRAÇÃO CONCLUÍDA", text)
            self.assertIn("Relatórios concluídos atualizados:", text)
            self.assertIn("Subsolagem: +15 novos registros", text)
            self.assertIn("Total geral inserido: +15 novos registros", text)

    def test_send_sentinel_summary_with_no_updates(self) -> None:
        response = BytesIO(b'{"ok":true}')
        relatorio = [
            {"form": "Subsolagem", "status": "OK", "added": 0, "total": 1200, "mensagem": "Sem dados"},
            {"form": "Sulcação", "status": "OK", "added": 0, "total": 800, "mensagem": "Sem dados"}
        ]
        with patch.dict(
            os.environ,
            {
                "MAPFY_TELEGRAM_BOT_TOKEN": "token-test",
                "MAPFY_TELEGRAM_CHAT_ID": "chat-999",
            }
        ), patch("server_notifications.urlopen", return_value=response) as mock_url:
            success = send_sentinel_summary(relatorio, duration_seconds=60.0)
            self.assertTrue(success)
            req = mock_url.call_args.args[0]
            body = json.loads(req.data.decode("utf-8"))
            text = body["text"]
            self.assertIn("Nenhuma nova atualização:", text)
            self.assertIn("Não houve novos lançamentos na plataforma MapFy", text)


if __name__ == "__main__":
    unittest.main()
