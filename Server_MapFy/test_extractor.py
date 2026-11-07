import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import mapfy_extractor


class ExtractorTests(unittest.TestCase):
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
