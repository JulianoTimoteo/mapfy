from __future__ import annotations
import sys
from pathlib import Path
SERVER_DIR = Path(__file__).resolve().parent.parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

import json
import tempfile
import unittest
from pathlib import Path
from typing import Any

import httpx

import github_publisher


class GitHubPublisherTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name)
        self.reports_dir = root / "relatorios"
        self.dashboard_dir = root / "DashBoard"
        self.server_dir = root / "server"
        self.report_slug, self.report_folder = next(iter(github_publisher.DASHBOARD_FOLDER_MAP.items()))
        report_directory = self.reports_dir / self.report_folder
        report_directory.mkdir(parents=True)
        (report_directory / "dados.json").write_text(
            json.dumps([{"id": 7, "Atividade": "Plantio"}]),
            encoding="utf-8",
        )
        self.dashboard_dir.mkdir()
        (self.dashboard_dir / "data_summary.json").write_text(
            json.dumps({"status": "ok", "reports": {self.report_slug: {"rows": 1}}}),
            encoding="utf-8",
        )
        self.server_dir.mkdir()

        self.original_reports_dir = github_publisher.REPORTS_DIR
        self.original_dashboard_dir = github_publisher.DASHBOARD_DIR
        self.original_server_dir = github_publisher.SERVER_DIR
        github_publisher.REPORTS_DIR = self.reports_dir
        github_publisher.DASHBOARD_DIR = self.dashboard_dir
        github_publisher.SERVER_DIR = self.server_dir
        self.requests: list[tuple[str, str, dict[str, Any]]] = []
        self.authorization_headers: list[str | None] = []
        self.next_blob = 0

        def respond(request: httpx.Request) -> httpx.Response:
            method = request.method
            path = request.url.path
            body = json.loads(request.content) if request.content else {}
            self.requests.append((method, path, body))
            self.authorization_headers.append(request.headers.get("Authorization"))

            if path.endswith("/git/ref/heads/main"):
                return httpx.Response(200, json={"object": {"sha": "base-commit"}})
            if path.endswith("/git/commits/base-commit"):
                return httpx.Response(200, json={"tree": {"sha": "base-tree"}})
            if path.endswith("/git/blobs"):
                self.next_blob += 1
                return httpx.Response(201, json={"sha": f"blob-{self.next_blob}"})
            if path.endswith("/git/trees"):
                return httpx.Response(201, json={"sha": "new-tree"})
            if path.endswith("/git/commits"):
                return httpx.Response(201, json={"sha": "new-commit"})
            if path.endswith("/git/refs/heads/main") and method == "PATCH":
                return httpx.Response(200, json={"object": {"sha": "new-commit"}})
            return httpx.Response(404, json={"message": "rota simulada não encontrada"})

        self.transport = httpx.MockTransport(respond)
        self.publisher = github_publisher.GitHubDashboardPublisher(
            token="token-de-teste",
            transport=self.transport,
        )

    def tearDown(self) -> None:
        github_publisher.REPORTS_DIR = self.original_reports_dir
        github_publisher.DASHBOARD_DIR = self.original_dashboard_dir
        github_publisher.SERVER_DIR = self.original_server_dir
        self.temp_dir.cleanup()

    def test_publishes_only_public_dashboard_files_in_one_commit(self) -> None:
        changed_count = self.publisher.publish()

        tree_request = next(body for method, path, body in self.requests if path.endswith("/git/trees"))
        uploaded_paths = {entry["path"] for entry in tree_request["tree"]}
        self.assertEqual(changed_count, 2)
        self.assertTrue(all(
            authorization == "Bearer token-de-teste"
            for authorization in self.authorization_headers
        ))
        self.assertEqual(uploaded_paths, {
            "DashBoard/data_summary.json",
            f"DashBoard/live_data/{self.report_slug}.json",
        })
        self.assertEqual(
            sum(path.endswith("/git/commits") for _, path, _ in self.requests),
            1,
        )

    def test_unchanged_files_are_not_published_twice(self) -> None:
        self.publisher.publish()
        self.requests.clear()

        changed_count = self.publisher.publish()

        self.assertEqual(changed_count, 0)
        self.assertEqual(self.requests, [])

    def test_github_errors_are_reported(self) -> None:
        def reject(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(403, json={"message": "insufficient permission"})

        publisher = github_publisher.GitHubDashboardPublisher(
            token="token-de-teste",
            transport=httpx.MockTransport(reject),
        )
        with self.assertRaisesRegex(RuntimeError, "403"):
            publisher.publish()


if __name__ == "__main__":
    unittest.main()

