from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx
from dotenv import load_dotenv

from api_gateway import DASHBOARD_FOLDER_MAP, _read_csv_page
from runtime_paths import DASHBOARD_DIR, ENV_FILE, LEGACY_ENV_FILE, REPORTS_DIR, SERVER_DIR

logger = logging.getLogger("mapfy.github")

GITHUB_API_URL = "https://api.github.com"
DEFAULT_REPOSITORY = "JulianoTimoteo/mapfy"
DEFAULT_BRANCH = "main"


class GitHubDashboardPublisher:
    def __init__(
        self,
        repository: str | None = None,
        branch: str | None = None,
        token: str | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        load_dotenv(ENV_FILE if ENV_FILE.is_file() else LEGACY_ENV_FILE)
        self.repository = repository or os.getenv("MAPFY_GITHUB_REPO", DEFAULT_REPOSITORY)
        self.branch = branch or os.getenv("MAPFY_GITHUB_BRANCH", DEFAULT_BRANCH)
        self.token = token or os.getenv("MAPFY_GITHUB_TOKEN", "").strip()
        self.transport = transport

        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", self.repository):
            raise ValueError("MAPFY_GITHUB_REPO precisa usar o formato proprietário/repositório.")
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", self.branch):
            raise ValueError("MAPFY_GITHUB_BRANCH contém caracteres inválidos.")

        self.api_repository = quote(self.repository, safe="/")
        self.api_branch = quote(self.branch, safe="")
        self.state_file = SERVER_DIR / "github_publish_state.json"

    def _files_to_publish(self) -> dict[str, bytes]:
        files: dict[str, bytes] = {}
        latest_report_mtime: float | None = None

        for slug, folder_name in sorted(DASHBOARD_FOLDER_MAP.items()):
            report_folder = REPORTS_DIR / folder_name
            json_path = report_folder / "dados.json"
            csv_path = report_folder / "dados.csv"
            if not json_path.is_file() and not csv_path.is_file():
                continue

            if json_path.is_file():
                records: Any = json.loads(json_path.read_text(encoding="utf-8"))
                report_mtime = json_path.stat().st_mtime
            else:
                records, _ = _read_csv_page(csv_path, 0, 1_000_000)
                report_mtime = csv_path.stat().st_mtime

            if not isinstance(records, list):
                raise ValueError(f"O consolidado de {folder_name} não contém uma lista de registros.")

            updated_at = datetime.fromtimestamp(report_mtime).astimezone().isoformat(timespec="seconds")
            latest_report_mtime = (
                report_mtime
                if latest_report_mtime is None
                else max(latest_report_mtime, report_mtime)
            )
            payload = {
                "status": "ok",
                "slug": slug,
                "folder": folder_name,
                "updated_at": updated_at,
                "total_records": len(records),
                "records": records,
            }
            target_path = f"DashBoard/live_data/{slug}.json"
            files[target_path] = json.dumps(
                payload,
                ensure_ascii=False,
                separators=(",", ":"),
            ).encode("utf-8")

        summary_path = DASHBOARD_DIR / "data_summary.json"
        if not summary_path.is_file():
            raise FileNotFoundError(f"Resumo do Dashboard não encontrado: {summary_path}")

        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        if not isinstance(summary, dict):
            raise ValueError("O resumo do Dashboard precisa ser um objeto JSON.")
        if latest_report_mtime is not None:
            summary["updated_at"] = datetime.fromtimestamp(latest_report_mtime).astimezone().isoformat(
                timespec="seconds"
            )
        files["DashBoard/data_summary.json"] = json.dumps(
            summary,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        return files

    def _load_state(self) -> dict[str, str]:
        if not self.state_file.is_file():
            return {}

        state = json.loads(self.state_file.read_text(encoding="utf-8"))
        if (
            not isinstance(state, dict)
            or state.get("repository") != self.repository
            or state.get("branch") != self.branch
            or not isinstance(state.get("files"), dict)
        ):
            logger.warning("O estado de publicação foi reiniciado por incompatibilidade de configuração.")
            return {}

        return {
            path: digest
            for path, digest in state["files"].items()
            if isinstance(path, str) and isinstance(digest, str)
        }

    def _save_state(self, hashes: dict[str, str]) -> None:
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        temporary_file = self.state_file.with_suffix(".tmp")
        temporary_file.write_text(
            json.dumps(
                {
                    "repository": self.repository,
                    "branch": self.branch,
                    "files": hashes,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        temporary_file.replace(self.state_file)

    def _request(
        self,
        client: httpx.Client,
        method: str,
        endpoint: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        response = client.request(method, endpoint, **kwargs)
        if response.is_error:
            try:
                detail = response.json().get("message", response.reason_phrase)
            except (ValueError, AttributeError):
                detail = response.reason_phrase
            raise RuntimeError(
                f"GitHub recusou a publicação ({response.status_code}): {detail}. "
                "Confira a validade da chave e a permissão de conteúdo do repositório."
            )
        if response.status_code == 204:
            return {}
        return response.json()

    def publish(self) -> int:
        if not self.token:
            raise RuntimeError(
                "MAPFY_GITHUB_TOKEN não configurado. Configure uma chave com acesso de escrita "
                "ao conteúdo do repositório mapfy."
            )

        files = self._files_to_publish()
        hashes = {
            path: hashlib.sha256(content).hexdigest()
            for path, content in files.items()
        }
        previous_hashes = self._load_state()
        changed_paths = sorted(
            path
            for path, digest in hashes.items()
            if previous_hashes.get(path) != digest
        )
        if not changed_paths:
            logger.info("Os dados publicados no GitHub Pages já estão atualizados.")
            return 0

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        repository_url = f"/repos/{self.api_repository}"
        with httpx.Client(
            base_url=GITHUB_API_URL,
            headers=headers,
            timeout=httpx.Timeout(120.0, connect=20.0),
            transport=self.transport,
        ) as client:
            reference = self._request(
                client,
                "GET",
                f"{repository_url}/git/ref/heads/{self.api_branch}",
            )
            base_commit_sha = reference["object"]["sha"]
            base_commit = self._request(
                client,
                "GET",
                f"{repository_url}/git/commits/{base_commit_sha}",
            )

            tree_entries = []
            for path in changed_paths:
                blob = self._request(
                    client,
                    "POST",
                    f"{repository_url}/git/blobs",
                    json={
                        "content": base64.b64encode(files[path]).decode("ascii"),
                        "encoding": "base64",
                    },
                )
                tree_entries.append({
                    "path": path,
                    "mode": "100644",
                    "type": "blob",
                    "sha": blob["sha"],
                })

            tree = self._request(
                client,
                "POST",
                f"{repository_url}/git/trees",
                json={
                    "base_tree": base_commit["tree"]["sha"],
                    "tree": tree_entries,
                },
            )
            commit = self._request(
                client,
                "POST",
                f"{repository_url}/git/commits",
                json={
                    "message": "Atualiza os dados públicos do Dashboard MapFy",
                    "tree": tree["sha"],
                    "parents": [base_commit_sha],
                },
            )
            self._request(
                client,
                "PATCH",
                f"{repository_url}/git/refs/heads/{self.api_branch}",
                json={"sha": commit["sha"], "force": False},
            )

        self._save_state(hashes)
        logger.info(
            "GitHub Pages atualizado: %s arquivo(s), commit %s.",
            len(changed_paths),
            commit["sha"][:12],
        )
        return len(changed_paths)
