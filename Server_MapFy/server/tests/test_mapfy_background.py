import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SERVER_DIR = Path(__file__).resolve().parent.parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

import mapfy_background


class MapFyBackgroundTests(unittest.TestCase):
    def test_process_running_checks_current_and_invalid_pids(self) -> None:
        import os

        self.assertTrue(mapfy_background.is_process_running(os.getpid()))
        self.assertFalse(mapfy_background.is_process_running(0))

    def test_read_pid_rejects_invalid_values(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            pid_file = Path(directory) / "service.pid"
            pid_file.write_text("not-a-pid", encoding="ascii")
            self.assertIsNone(mapfy_background.read_pid(pid_file))

            pid_file.write_text("0", encoding="ascii")
            self.assertIsNone(mapfy_background.read_pid(pid_file))

    def test_sentinel_is_disabled_without_a_receiver_url(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(mapfy_background.sentinel_endpoint_configured())
        with patch.dict(os.environ, {"MAPFY_SENTINEL_URL": "http://localhost:8099"}):
            self.assertTrue(mapfy_background.sentinel_endpoint_configured())

    def test_api_base_url_uses_configured_port(self) -> None:
        with patch.dict(os.environ, {"MAPFY_API_PORT": "8123"}):
            self.assertEqual(mapfy_background.api_base_url(), "http://127.0.0.1:8123")

    def test_api_base_url_rejects_invalid_port(self) -> None:
        with patch.dict(os.environ, {"MAPFY_API_PORT": "70000"}):
            with self.assertRaisesRegex(ValueError, "entre 1 e 65535"):
                mapfy_background.api_base_url()

    def test_instance_lock_prevents_a_second_supervisor(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            lock_file = Path(directory) / "supervisor.lock"
            with patch.object(mapfy_background, "LOCK_FILE", lock_file):
                first_lock = mapfy_background._acquire_instance_lock()
                self.assertIsNotNone(first_lock)
                try:
                    self.assertIsNone(mapfy_background._acquire_instance_lock())
                finally:
                    first_lock.close()

                second_lock = mapfy_background._acquire_instance_lock()
                self.assertIsNotNone(second_lock)
                second_lock.close()


if __name__ == "__main__":
    unittest.main()
