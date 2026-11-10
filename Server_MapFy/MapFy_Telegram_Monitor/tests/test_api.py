import gc
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from notifier.app import app
from notifier.config import Config
from notifier.database import DatabaseManager
from notifier.monitor import ExtractionMonitor
from notifier.telegram import TelegramClient


class ApiEndpointsTests(unittest.TestCase):
    """Testes dos endpoints HTTP da MicroAPI do MapFy Telegram Monitor."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.db_path = Path(self.temp_dir.name) / "test_api_monitor.db"
        self.db = DatabaseManager(db_path=self.db_path)
        self.telegram = TelegramClient(token="123456789:ABC_TEST_TOKEN_1234567890123456")
        self.monitor = ExtractionMonitor(db=self.db, telegram=self.telegram)

        # Sobrescreve as instâncias globais na app para isolar os testes
        import notifier.app as app_module
        app_module.db_manager = self.db
        app_module.telegram_client = self.telegram
        app_module.monitor_engine = self.monitor

        self.client = TestClient(app)
        self.api_key = "mapfy_monitor_secret_key_2026"
        Config.MONITOR_API_KEY = self.api_key

    def tearDown(self):
        gc.collect()
        self.temp_dir.cleanup()

    def test_health_endpoint_is_public(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["service"], "MapFy Telegram Monitor")

    def test_protected_endpoints_reject_missing_or_invalid_api_key(self):
        # Sem chave
        res_no_key = self.client.get("/status")
        self.assertEqual(res_no_key.status_code, 401)

        # Com chave errada
        res_bad_key = self.client.get("/status", headers={"X-API-Key": "chave_incorreta"})
        self.assertEqual(res_bad_key.status_code, 401)

    def test_complete_extraction_flow_via_api(self):
        headers = {"X-API-Key": self.api_key}

        # 1. Início da extração
        with patch.object(self.telegram, "send_extraction_started"):
            res_start = self.client.post("/extraction/start", json={"run_id": "test_api_run_1"}, headers=headers)
            self.assertEqual(res_start.status_code, 200)
            data_start = res_start.json()
            self.assertTrue(data_start["success"])
            self.assertEqual(data_start["run_id"], "test_api_run_1")

        # 2. Status atual
        res_status = self.client.get("/status", headers=headers)
        self.assertEqual(res_status.status_code, 200)
        self.assertEqual(res_status.json()["state"], "RUNNING")

        # 3. Heartbeat
        res_hb = self.client.post("/extraction/heartbeat", json={"run_id": "test_api_run_1"}, headers=headers)
        self.assertEqual(res_hb.status_code, 200)
        self.assertTrue(res_hb.json()["success"])

        # 4. Registro de Evento de Erro
        with patch.object(self.telegram, "send_extraction_error"):
            res_ev = self.client.post("/extraction/event", json={
                "run_id": "test_api_run_1",
                "level": "ERROR",
                "origin": "mapfy_extractor",
                "message": "Falha de seletor na central de formulários"
            }, headers=headers)
            self.assertEqual(res_ev.status_code, 200)
            self.assertTrue(res_ev.json()["success"])

        # Confere status após erro
        res_status2 = self.client.get("/status", headers=headers)
        self.assertEqual(res_status2.json()["state"], "RUNNING_WITH_ERRORS")

        # 5. Finalização
        with patch.object(self.telegram, "send_extraction_finished"):
            res_fin = self.client.post("/extraction/finish", json={
                "run_id": "test_api_run_1",
                "status": "COMPLETED",
                "summary": {"formularios_processados": 5}
            }, headers=headers)
            self.assertEqual(res_fin.status_code, 200)
            self.assertTrue(res_fin.json()["success"])

        # 6. Relatório Mais Recente
        res_rep = self.client.get("/report/latest", headers=headers)
        self.assertEqual(res_rep.status_code, 200)
        rep_data = res_rep.json()
        self.assertEqual(rep_data["extraction"]["run_id"], "test_api_run_1")
        self.assertEqual(rep_data["extraction"]["error_count"], 1)
        self.assertEqual(len(rep_data["events"]), 1)


if __name__ == "__main__":
    unittest.main()
