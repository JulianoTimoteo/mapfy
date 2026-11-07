import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import watchdog_service


class WatchdogServiceTests(unittest.TestCase):
    def test_status_is_written_as_valid_json(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            status_file = Path(directory) / "watchdog_status.json"
            with patch.object(watchdog_service, "STATUS_FILE", status_file):
                watchdog_service.update_status(
                    gateway_pid=1234,
                    restarts=2,
                    status="ONLINE",
                    last_extract="2026-01-01T10:00:00+00:00",
                    last_extract_result="SUCESSO",
                )

            status = json.loads(status_file.read_text(encoding="utf-8"))
            self.assertEqual(status["status"], "ONLINE")
            self.assertEqual(status["gateway_pid"], 1234)
            self.assertEqual(status["restarts_count"], 2)
            self.assertEqual(status["last_extract_result"], "SUCESSO")
            self.assertFalse(status_file.with_suffix(".tmp").exists())


if __name__ == "__main__":
    unittest.main()
