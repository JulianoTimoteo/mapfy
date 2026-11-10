import gc
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

from notifier.config import Config
from notifier.database import DatabaseManager
from notifier.monitor import ExtractionMonitor, ExtractionState
from notifier.telegram import TelegramClient
from integration.notifier_client import ExtractionReporter


class MonitorEngineTests(unittest.TestCase):
    """Testes da máquina de estados, detecção de interrupção de heartbeat e recuperação."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.db_path = Path(self.temp_dir.name) / "test_engine_monitor.db"
        self.db = DatabaseManager(db_path=self.db_path)
        self.telegram = TelegramClient(token="123456789:ABC_TEST_TOKEN_1234567890123456")
        self.monitor = ExtractionMonitor(db=self.db, telegram=self.telegram)
        Config.HEARTBEAT_TIMEOUT_SECONDS = 180

    def tearDown(self):
        gc.collect()
        self.temp_dir.cleanup()

    def test_state_transitions_happy_path(self):
        self.assertEqual(self.monitor.current_state, ExtractionState.IDLE)

        with patch.object(self.telegram, "send_extraction_started"):
            self.monitor.start_extraction("run_h1")
            self.assertEqual(self.monitor.current_state, ExtractionState.RUNNING)

        with patch.object(self.telegram, "send_extraction_finished"):
            self.monitor.finish_extraction("run_h1", ExtractionState.COMPLETED)
            self.assertEqual(self.monitor.current_state, ExtractionState.COMPLETED)

    def test_state_transitions_to_running_with_errors(self):
        with patch.object(self.telegram, "send_extraction_started"):
            self.monitor.start_extraction("run_err1")

        with patch.object(self.telegram, "send_extraction_error"):
            self.monitor.register_event("run_err1", "ERROR", "worker", "Falha temporária de rede")
            self.assertEqual(self.monitor.current_state, ExtractionState.RUNNING_WITH_ERRORS)

    def test_heartbeat_timeout_detects_interruption_and_sends_single_alert(self):
        with patch.object(self.telegram, "send_extraction_started"):
            self.monitor.start_extraction("run_timeout")

        # Simula que o último heartbeat foi há 200 segundos atrás
        past_time = datetime.now() - timedelta(seconds=200)
        self.db.update_heartbeat("run_timeout", past_time)

        # 1ª Checagem: deve detectar interrupção, abrir incidente e enviar alerta
        with patch.object(self.telegram, "send_extraction_interrupted") as mock_alert:
            self.monitor.check_heartbeats()
            self.assertEqual(self.monitor.current_state, ExtractionState.NO_HEARTBEAT)
            mock_alert.assert_called_once()

        # 2ª Checagem: não deve reenviar o alerta (sem duplicação / anti-spam)
        with patch.object(self.telegram, "send_extraction_interrupted") as mock_alert_again:
            self.monitor.check_heartbeats()
            mock_alert_again.assert_not_called()

    def test_recovery_flow_when_heartbeat_returns(self):
        with patch.object(self.telegram, "send_extraction_started"):
            self.monitor.start_extraction("run_rec")

        # Força estado NO_HEARTBEAT
        past_time = datetime.now() - timedelta(seconds=250)
        self.db.update_heartbeat("run_rec", past_time)
        with patch.object(self.telegram, "send_extraction_interrupted"):
            self.monitor.check_heartbeats()

        self.assertEqual(self.monitor.current_state, ExtractionState.NO_HEARTBEAT)

        # Heartbeat volta!
        with patch.object(self.telegram, "send_recovery_notification") as mock_rec:
            updated = self.monitor.register_heartbeat("run_rec")
            self.assertTrue(updated)
            mock_rec.assert_called_once()
            self.assertEqual(self.monitor.current_state, ExtractionState.RUNNING)

    def test_delayed_heartbeat_does_not_reactivate_completed_extraction(self):
        with patch.object(self.telegram, "send_extraction_started"):
            self.monitor.start_extraction("run_done")

        with patch.object(self.telegram, "send_extraction_finished"):
            self.monitor.finish_extraction("run_done", ExtractionState.COMPLETED)

        # Tenta enviar heartbeat após finalização
        success = self.monitor.register_heartbeat("run_done")
        self.assertFalse(success)
        self.assertNotEqual(self.monitor.current_state, ExtractionState.RUNNING)


class NotifierClientIntegrationTests(unittest.TestCase):
    """Testes do cliente ExtractionReporter da pasta integration."""

    def test_reporter_resilience_when_server_is_offline(self):
        # Aponta para uma porta onde nada está escutando
        reporter = ExtractionReporter(base_url="http://127.0.0.1:59999", auto_heartbeat=False)

        # Nenhuma dessas chamadas deve lançar exceção!
        run_id = reporter.start()
        self.assertIsNotNone(run_id)

        res_event = reporter.event(level="ERROR", message="Falha de teste")
        self.assertFalse(res_event)

        res_hb = reporter.heartbeat()
        self.assertFalse(res_hb)

        res_fin = reporter.finish(status="COMPLETED")
        self.assertFalse(res_fin)


if __name__ == "__main__":
    unittest.main()
