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
        self.original_dashboard_dir = api_gateway.DASHBOARD_DIR
        self.original_dashboard_folder_map = api_gateway.DASHBOARD_FOLDER_MAP.copy()
        self.original_api_key = os.environ.pop("MAPFY_API_KEY", None)
        api_gateway.REPORTS_DIR = Path(self.temp_dir.name)
        api_gateway.DASHBOARD_DIR = Path(self.temp_dir.name) / "dashboard"
        api_gateway.DASHBOARD_FOLDER_MAP = {
            **self.original_dashboard_folder_map,
            "teste": "Relatório de teste",
        }

        report_dir = api_gateway.REPORTS_DIR / "Relatório de teste"
        report_dir.mkdir()
        (report_dir / "dados.csv").write_text(
            "Id;Atividade\n1;Plantio\n2;Colheita\n3;Preparo\n",
            encoding="utf-8-sig",
        )
        dashboard_data = api_gateway.DASHBOARD_DIR / "teste" / "js" / "data.js"
        dashboard_data.parent.mkdir(parents=True)
        dashboard_data.write_text(
            'window.TESTE_DATA = [{"Atividade":"Dados antigos"}];',
            encoding="utf-8",
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
        api_gateway.DASHBOARD_DIR = self.original_dashboard_dir
        api_gateway.DASHBOARD_FOLDER_MAP = self.original_dashboard_folder_map
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

    def test_dashboard_data_prefers_latest_consolidated_report(self) -> None:
        payload = api_gateway.get_dashboard_data("teste")

        self.assertEqual(payload["records"], [
            {"Id": "1", "Atividade": "Plantio"},
            {"Id": "2", "Atividade": "Colheita"},
            {"Id": "3", "Atividade": "Preparo"},
        ])

    def test_configured_api_key_is_required(self) -> None:
        os.environ["MAPFY_API_KEY"] = "chave-de-teste"

        denied = self.request("GET", "/api/v1/reports")
        allowed = self.request(
            "GET",
            "/api/v1/reports",
            headers={"X-API-Key": "chave-de-teste"},
        )
        dashboard_summary = self.request("GET", "/api/v1/summary")

        self.assertEqual(denied.status_code, 401)
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(dashboard_summary.status_code, 200)

    def test_maps_manifest_and_shapes_endpoints(self) -> None:
        manifest_resp = self.request("GET", "/api/v1/maps/manifest")
        self.assertEqual(manifest_resp.status_code, 200)
        data = manifest_resp.json()
        self.assertEqual(data["status"], "ready")
        self.assertIn("total_features", data)
        self.assertGreater(data["total_features"], 0)

        shapes_resp = self.request("GET", "/api/v1/maps/shapes")
        self.assertEqual(shapes_resp.status_code, 200)
        shapes_data = shapes_resp.json()
        self.assertEqual(shapes_data.get("type"), "FeatureCollection")
        self.assertEqual(len(shapes_data.get("features", [])), data["total_features"])


if __name__ == "__main__":
    unittest.main()
