import sys
from pathlib import Path
SERVER_DIR = Path(__file__).resolve().parent.parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import mapfy_extractor


class ExtractorTests(unittest.TestCase):
    def test_auth_location_omits_oauth_query_and_fragment(self) -> None:
        location = mapfy_extractor._safe_auth_location(
            "https://login.microsoftonline.com/common/oauth2?"
            "state=private-state&nonce=private-nonce#token"
        )

        self.assertEqual(
            location,
            "https://login.microsoftonline.com/common/oauth2",
        )

    def test_authenticated_home_redirects_to_forms_hub(self) -> None:
        page = Mock()
        page.url = "https://app.mapfy.com.br/"

        mapfy_extractor._navigate_to_forms_hub(page)

        page.goto.assert_called_once_with(
            mapfy_extractor.MAPFY_HUB_URL,
            timeout=45000,
            wait_until="domcontentloaded",
        )

    def test_forms_hub_is_not_navigated_twice(self) -> None:
        page = Mock()
        page.url = mapfy_extractor.MAPFY_HUB_URL

        mapfy_extractor._navigate_to_forms_hub(page)

        page.goto.assert_not_called()

    def test_external_login_page_is_not_redirected_to_forms(self) -> None:
        page = Mock()
        page.url = "https://auth.gatec.com.br/Account/Login"

        mapfy_extractor._navigate_to_forms_hub(page)

        page.goto.assert_not_called()

    def test_saved_microsoft_account_is_selected_by_configured_username(self) -> None:
        page = Mock()
        account = page.get_by_text.return_value.first
        account.count.return_value = 1
        account.is_visible.return_value = True

        selected = mapfy_extractor._select_saved_microsoft_account(
            page,
            "user@example.com",
        )

        self.assertTrue(selected)
        page.get_by_text.assert_called_once_with("user@example.com", exact=True)
        account.click.assert_called_once_with(timeout=5000)
        page.wait_for_timeout.assert_called_once_with(1500)

    def test_saved_microsoft_account_is_not_clicked_when_not_visible(self) -> None:
        page = Mock()
        account = page.get_by_text.return_value.first
        account.count.return_value = 1
        account.is_visible.return_value = False

        selected = mapfy_extractor._select_saved_microsoft_account(
            page,
            "user@example.com",
        )

        self.assertFalse(selected)
        account.click.assert_not_called()

    def test_authentication_failure_is_reported_to_the_caller(self) -> None:
        with patch("mapfy_extractor.sync_playwright") as playwright_factory:
            browser = playwright_factory.return_value.__enter__.return_value.chromium.launch.return_value
            context = browser.new_context.return_value
            page = context.new_page.return_value

            with patch.object(
                mapfy_extractor,
                "ensure_authenticated",
                side_effect=RuntimeError("login failed"),
            ):
                with self.assertRaisesRegex(RuntimeError, "Falha de autenticação: login failed"):
                    mapfy_extractor.run_full_extraction(
                        username="test-user",
                        password="test-password",
                    )

            browser.close.assert_called_once()

    def test_merge_updates_existing_ids_and_adds_new_records(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            existing_csv = root / "dados.csv"
            new_csv = root / "novo.csv"
            json_path = root / "dados.json"
            existing_csv.write_text(
                "Id;Atividade\n1;Plantio\n",
                encoding="utf-8-sig",
            )
            new_csv.write_text(
                "Id;Atividade\n1;Colheita\n2;Preparo\n",
                encoding="utf-8-sig",
            )

            with patch.dict("os.environ", {"ID_COLUMN": "Id"}):
                added, total = mapfy_extractor.merge_and_save_data(
                    existing_csv,
                    new_csv,
                    json_path,
                )

            merged = mapfy_extractor.read_csv_smart(existing_csv)
            self.assertEqual((added, total), (1, 2))
            self.assertEqual(merged["Id"].tolist(), ["1", "2"])
            self.assertEqual(merged["Atividade"].tolist(), ["Colheita", "Preparo"])
            self.assertTrue(json_path.is_file())

    def test_merge_preserves_existing_csv_when_identifier_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            existing_csv = root / "dados.csv"
            new_csv = root / "novo.csv"
            json_path = root / "dados.json"
            existing_csv.write_text("Codigo;Atividade\n1;Plantio\n", encoding="utf-8")
            original_content = existing_csv.read_text(encoding="utf-8")
            new_csv.write_text("Id;Atividade\n2;Preparo\n", encoding="utf-8")

            with patch.dict("os.environ", {"ID_COLUMN": "Id"}):
                with self.assertRaisesRegex(ValueError, "não contém a coluna identificadora"):
                    mapfy_extractor.merge_and_save_data(
                        existing_csv,
                        new_csv,
                        json_path,
                    )

            self.assertEqual(existing_csv.read_text(encoding="utf-8"), original_content)
            self.assertFalse(json_path.exists())

    def test_extraction_lock_rejects_an_overlapping_extraction(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            lock_path = Path(directory) / ".extraction.lock"
            with patch.object(mapfy_extractor, "EXTRACTION_LOCK_FILE", lock_path):
                with mapfy_extractor._extraction_lock():
                    with self.assertRaisesRegex(RuntimeError, "outra extração"):
                        with mapfy_extractor._extraction_lock():
                            self.fail("A segunda extração não deveria adquirir o lock.")


if __name__ == "__main__":
    unittest.main()
