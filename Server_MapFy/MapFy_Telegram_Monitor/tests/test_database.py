import gc
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

from notifier.database import DatabaseManager


class DatabaseManagerTests(unittest.TestCase):
    """Testes de integridade, persistência e índices do banco SQLite de monitoramento."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.db_path = Path(self.temp_dir.name) / "test_monitor.db"
        self.db = DatabaseManager(db_path=self.db_path)

    def tearDown(self):
        gc.collect()
        self.temp_dir.cleanup()

    def test_database_initialization_creates_tables_and_indices(self):
        with self.db._conn() as conn:
            tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
            table_names = {r["name"] for r in tables}
            self.assertIn("extractions", table_names)
            self.assertIn("events", table_names)
            self.assertIn("incidents", table_names)

            indices = conn.execute("SELECT name FROM sqlite_master WHERE type='index';").fetchall()
            index_names = {r["name"] for r in indices}
            self.assertIn("idx_extractions_status", index_names)
            self.assertIn("idx_extractions_start_time", index_names)
            self.assertIn("idx_events_run_id", index_names)

    def test_create_and_get_extraction(self):
        start = datetime(2026, 11, 10, 8, 0, 0)
        ext = self.db.create_extraction("run_001", "MAPFY-EXTRACTOR", start)
        self.assertEqual(ext["run_id"], "run_001")
        self.assertEqual(ext["status"], "RUNNING")
        self.assertEqual(ext["error_count"], 0)

        saved = self.db.get_extraction("run_001")
        self.assertIsNotNone(saved)
        self.assertEqual(saved["server_name"], "MAPFY-EXTRACTOR")

    def test_update_heartbeat(self):
        self.db.create_extraction("run_002", "MAPFY-EXTRACTOR")
        hb_time = datetime(2026, 11, 10, 8, 5, 0)
        success = self.db.update_heartbeat("run_002", hb_time)
        self.assertTrue(success)

        saved = self.db.get_extraction("run_002")
        self.assertEqual(saved["last_heartbeat"], "2026-11-10 08:05:00")

    def test_add_event_increments_error_count_on_error(self):
        self.db.create_extraction("run_003", "MAPFY-EXTRACTOR")
        self.db.add_event("run_003", "INFO", "extractor", "Iniciando download")
        ext = self.db.get_extraction("run_003")
        self.assertEqual(ext["error_count"], 0)
        self.assertEqual(ext["status"], "RUNNING")

        self.db.add_event("run_003", "ERROR", "extractor", "Falha de conexão com servidor MapFy")
        ext = self.db.get_extraction("run_003")
        self.assertEqual(ext["error_count"], 1)
        self.assertEqual(ext["status"], "RUNNING_WITH_ERRORS")

        events = self.db.get_events_for_run("run_003")
        self.assertEqual(len(events), 2)
        self.assertEqual(events[1]["level"], "ERROR")

    def test_finish_extraction_calculates_duration(self):
        start = datetime(2026, 11, 10, 8, 0, 0)
        end = datetime(2026, 11, 10, 8, 2, 30)  # 150 segundos
        self.db.create_extraction("run_004", "MAPFY-EXTRACTOR", start)

        finished = self.db.finish_extraction("run_004", "COMPLETED", end, summary={"total_registros": 450})
        self.assertIsNotNone(finished)
        self.assertEqual(finished["status"], "COMPLETED")
        self.assertEqual(finished["duration_seconds"], 150.0)
        self.assertEqual(finished["summary"]["total_registros"], 450)

    def test_incident_lifecycle(self):
        self.db.create_extraction("run_005", "MAPFY-EXTRACTOR")
        t_open = datetime(2026, 11, 10, 8, 10, 0)
        inc_id = self.db.open_incident("run_005", "NO_HEARTBEAT", "Sem sinal por 180s", t_open)
        self.assertGreater(inc_id, 0)

        # Não deve duplicar se o incidente estiver aberto
        inc_id_2 = self.db.open_incident("run_005", "NO_HEARTBEAT", "Tentativa repetida", t_open)
        self.assertEqual(inc_id, inc_id_2)

        open_inc = self.db.get_open_incident("run_005", "NO_HEARTBEAT")
        self.assertIsNotNone(open_inc)
        self.assertEqual(open_inc["alert_sent"], 0)

        # Marca alerta enviado
        self.db.mark_incident_alert_sent(inc_id)
        open_inc = self.db.get_open_incident("run_005", "NO_HEARTBEAT")
        self.assertEqual(open_inc["alert_sent"], 1)

        # Fecha incidente
        t_close = datetime(2026, 11, 10, 8, 12, 0)
        self.db.close_incident(inc_id, t_close)
        self.assertIsNone(self.db.get_open_incident("run_005", "NO_HEARTBEAT"))


if __name__ == "__main__":
    unittest.main()
