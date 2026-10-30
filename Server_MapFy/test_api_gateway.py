import asyncio
import os
import tempfile
import unittest
from pathlib import Path

import httpx

import api_gateway


class GatewayApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_reports_dir = api_gateway.REPORTS_DIR
        self.original_api_key = os.environ.pop("MAPFY_API_KEY", None)
        api_gateway.REPORTS_DIR = Path(self.temp_dir.name)

        report_dir = api_gateway.REPORTS_DIR / "Relatório de teste"
        report_dir.mkdir()
        (report_dir / "dados.csv").write_text(
            "Id;Atividade\n1;Plantio\n2;Colheita\n3;Preparo\n",
            encoding="utf-8-sig",
        )
        self.report_id = api_gateway.report_id_for(report_dir.name)

    def request(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        async def send_request() -> httpx.Response:
            transport = httpx.ASGITransport(app=api_gateway.app)
            async with httpx.AsyncClient(
                transport=transport,
                base_url="http://testserver",
            ) as client:
                return await client.request(method, url, **kwargs)

        return asyncio.run(send_request())

    def tearDown(self) -> None:
        api_gateway.REPORTS_DIR = self.original_reports_dir
        if self.original_api_key is not None:
            os.environ["MAPFY_API_KEY"] = self.original_api_key
        else:
            os.environ.pop("MAPFY_API_KEY", None)
        self.temp_dir.cleanup()

    def test_list_reports_returns_metadata_without_file_paths(self) -> None:
        response = self.request("GET", "/api/v1/reports")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total"], 1)
        self.assertEqual(payload["items"][0]["id"], self.report_id)
        self.assertNotIn("path", payload["items"][0])

    def test_records_are_paginated_from_consolidated_csv(self) -> None:
        response = self.request(
            "GET",
            f"/api/v1/reports/{self.report_id}/records?limit=2&offset=1"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["items"], [
            {"Id": "2", "Atividade": "Colheita"},
            {"Id": "3", "Atividade": "Preparo"},
        ])
        self.assertFalse(payload["has_more"])

    def test_unknown_report_returns_not_found(self) -> None:
        response = self.request("GET", "/api/v1/reports/desconhecido")

        self.assertEqual(response.status_code, 404)

    def test_configured_api_key_is_required(self) -> None:
        os.environ["MAPFY_API_KEY"] = "chave-de-teste"

        denied = self.request("GET", "/api/v1/reports")
        allowed = self.request(
            "GET",
            "/api/v1/reports",
            headers={"X-API-Key": "chave-de-teste"},
        )

        self.assertEqual(denied.status_code, 401)
        self.assertEqual(allowed.status_code, 200)


if __name__ == "__main__":
    unittest.main()
