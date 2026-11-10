import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

from notifier.config import Config, redact_token
from notifier.security import sanitize_message_length, validate_authorized_chat_id
from notifier.telegram import TelegramClient


class TelegramClientTests(unittest.TestCase):
    """Testes unitários dos modelos de notificação, redação de credenciais e segurança do Telegram."""

    def setUp(self):
        self.fake_token = "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789"
        self.fake_chat_id = "987654321"
        Config.TELEGRAM_BOT_TOKEN = self.fake_token
        Config.TELEGRAM_CHAT_ID = self.fake_chat_id
        Config.SERVER_NAME = "MAPFY-EXTRACTOR"
        self.client = TelegramClient(token=self.fake_token)

    def test_token_redaction_removes_token_and_keys(self):
        secret_url = f"https://api.telegram.org/bot{self.fake_token}/sendMessage"
        redacted = redact_token(secret_url, custom_token=self.fake_token)
        self.assertNotIn(self.fake_token, redacted)
        self.assertIn("[REDACTED_TELEGRAM_TOKEN]", redacted)

    def test_sanitize_message_length_truncates_oversized_payloads(self):
        huge_text = "A" * 5000
        sanitized = sanitize_message_length(huge_text, max_length=1000)
        self.assertLessEqual(len(sanitized), 1000)
        self.assertTrue(sanitized.endswith("[Mensagem truncada pelo monitor por exceder limite de tamanho]"))

    def test_validate_authorized_chat_id_rejects_unauthorized_recipients(self):
        # Destinatário válido
        valid_id = validate_authorized_chat_id(self.fake_chat_id)
        self.assertEqual(valid_id, self.fake_chat_id)

        # Destinatário arbitrário/não autorizado deve lançar PermissionError
        with self.assertRaises(PermissionError):
            validate_authorized_chat_id("999999999")

    def test_send_extraction_started_model_format(self):
        dt = datetime(2026, 11, 10, 8, 30, 0)
        with patch.object(self.client, "send_message") as mock_send:
            self.client.send_extraction_started(start_time=dt, server_name="MAPFY-EXTRACTOR")
            mock_send.assert_called_once()
            msg = mock_send.call_args[0][0]

            self.assertIn("MAPFY — EXTRAÇÃO INICIADA", msg)
            self.assertIn("Servidor: MAPFY-EXTRACTOR", msg)
            self.assertIn("Data: 10/11/2026", msg)
            self.assertIn("Horário: 08:30:00", msg)
            self.assertIn("Status: EXECUTANDO", msg)
            self.assertIn("Monitoramento: ATIVO", msg)

    def test_send_extraction_error_model_format(self):
        dt = datetime(2026, 11, 10, 8, 35, 12)
        with patch.object(self.client, "send_message") as mock_send:
            self.client.send_extraction_error(
                origin="mapfy_extractor",
                message="Timeout 45000ms exceeded ao carregar central",
                error_time=dt,
                error_type="EXCEÇÃO PYTHON",
                is_interrupted=False
            )
            mock_send.assert_called_once()
            msg = mock_send.call_args[0][0]

            self.assertIn("MAPFY — ERRO DETECTADO", msg)
            self.assertIn("Servidor: MAPFY-EXTRACTOR", msg)
            self.assertIn("Horário: 08:35:12", msg)
            self.assertIn("Tipo: EXCEÇÃO PYTHON", msg)
            self.assertIn("Origem: mapfy_extractor", msg)
            self.assertIn("Mensagem: Timeout 45000ms exceeded ao carregar central", msg)
            self.assertIn("Status: EXTRAÇÃO EM EXECUÇÃO", msg)

    def test_send_extraction_finished_model_format(self):
        t_start = datetime(2026, 11, 10, 8, 0, 0)
        t_end = datetime(2026, 11, 10, 8, 5, 25)
        with patch.object(self.client, "send_message") as mock_send:
            self.client.send_extraction_finished(
                start_time=t_start,
                end_time=t_end,
                duration_seconds=325.0,
                error_count=0
            )
            mock_send.assert_called_once()
            msg = mock_send.call_args[0][0]

            self.assertIn("MAPFY — RELATÓRIO DE EXTRAÇÃO", msg)
            self.assertIn("Início: 10/11/2026 08:00:00", msg)
            self.assertIn("Término: 10/11/2026 08:05:25", msg)
            self.assertIn("Duração: 00:05:25", msg)
            self.assertIn("Status: CONCLUÍDA", msg)
            self.assertIn("Total de erros: 0", msg)
            self.assertIn("Resultado: SUCESSO", msg)

    def test_send_extraction_interrupted_model_format(self):
        t_hb = datetime(2026, 11, 10, 8, 40, 0)
        with patch.object(self.client, "send_message") as mock_send:
            self.client.send_extraction_interrupted(
                last_heartbeat=t_hb,
                elapsed_seconds=185.0
            )
            mock_send.assert_called_once()
            msg = mock_send.call_args[0][0]

            self.assertIn("MAPFY — ALERTA DE INTERRUPÇÃO", msg)
            self.assertIn("Último heartbeat: 10/11/2026 08:40:00", msg)
            self.assertIn("Tempo sem comunicação: 3m 5s", msg)
            self.assertIn("Status: SEM COMUNICAÇÃO", msg)
            self.assertIn("Ação: VERIFICAR O PROCESSO DE EXTRAÇÃO.", msg)

    def test_send_recovery_notification_model_format(self):
        t_rec = datetime(2026, 11, 10, 8, 45, 0)
        with patch.object(self.client, "send_message") as mock_send:
            self.client.send_recovery_notification(recovery_time=t_rec)
            mock_send.assert_called_once()
            msg = mock_send.call_args[0][0]

            self.assertIn("MAPFY — SISTEMA RECUPERADO", msg)
            self.assertIn("Horário da recuperação: 10/11/2026 08:45:00", msg)
            self.assertIn("Status: COMUNICAÇÃO RESTABELECIDA.", msg)


if __name__ == "__main__":
    unittest.main()
