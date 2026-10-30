#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gateway somente de leitura para os relatórios consolidados do Mapfy."""

from __future__ import annotations

import csv
import hashlib
import hmac
import io
import logging
import os
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any

import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import json

BASE_DIR = Path(__file__).resolve().parent
REPORTS_DIR = BASE_DIR / "relatorios"
load_dotenv(BASE_DIR / ".env")

logger = logging.getLogger("mapfy.api")

DEFAULT_CORS_ORIGINS = [
    "*",
    "https://julianotimoteo.github.io",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
]

app = FastAPI(
    title="Mapfy Relatórios API",
    description="Gateway somente de leitura para os relatórios consolidados do Mapfy.",
    version="1.0.0",
)

configured_origins = os.getenv("MAPFY_CORS_ORIGINS", "").strip()
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        [origin.strip() for origin in configured_origins.split(",") if origin.strip()]
        if configured_origins
        else DEFAULT_CORS_ORIGINS
    ),
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Content-Type", "X-API-Key"],
)


def report_id_for(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_name).strip("-").lower()
    suffix = hashlib.sha256(name.encode("utf-8")).hexdigest()[:8]
    return f"{slug or 'relatorio'}-{suffix}"


def _is_inside_reports(path: Path, reports_root: Path) -> bool:
    try:
        return path.resolve(strict=True).is_relative_to(reports_root.resolve(strict=True))
    except (OSError, ValueError):
        return False


def get_report_catalog() -> list[dict[str, Any]]:
    if not REPORTS_DIR.is_dir():
        return []

    reports = []
    for folder in REPORTS_DIR.iterdir():
        if not folder.is_dir() or not _is_inside_reports(folder, REPORTS_DIR):
            continue

        csv_path = folder / "dados.csv"
        if not csv_path.is_file() or not _is_inside_reports(csv_path, REPORTS_DIR):
            continue

        modified_at = datetime.fromtimestamp(csv_path.stat().st_mtime).astimezone()
        reports.append({
            "id": report_id_for(folder.name),
            "name": folder.name,
            "updated_at": modified_at.isoformat(timespec="seconds"),
        })

    return sorted(reports, key=lambda report: report["name"].casefold())


def _get_report(report_id: str) -> tuple[dict[str, Any], Path]:
    for report in get_report_catalog():
        if report["id"] == report_id:
            csv_path = REPORTS_DIR / report["name"] / "dados.csv"
            if _is_inside_reports(csv_path, REPORTS_DIR):
                return report, csv_path
    raise HTTPException(status_code=404, detail="Relatório não encontrado.")


def require_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    expected_key = os.getenv("MAPFY_API_KEY", "")
    if expected_key and (
        not x_api_key or not hmac.compare_digest(x_api_key, expected_key)
    ):
        raise HTTPException(status_code=401, detail="Chave de API inválida ou ausente.")


def _read_csv_page(csv_path: Path, offset: int, limit: int) -> tuple[list[dict[str, str]], bool]:
    try:
        with csv_path.open("r", encoding="utf-8-sig", newline="") as stream:
            sample = stream.read(8192)
            stream.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=";,\t")
            except csv.Error:
                dialect = csv.excel
                dialect.delimiter = ";"

            reader = csv.DictReader(stream, dialect=dialect)
            for _ in range(offset):
                if next(reader, None) is None:
                    return [], False

            records = []
            for _ in range(limit + 1):
                row = next(reader, None)
                if row is None:
                    break
                records.append({
                    str(key): value or ""
                    for key, value in row.items()
                    if key is not None
                })

            has_more = len(records) > limit
            return records[:limit], has_more
    except (OSError, UnicodeError, csv.Error):
        logger.exception("Falha ao ler o CSV consolidado: %s", csv_path.name)
        raise HTTPException(
            status_code=500,
            detail="Não foi possível ler os dados consolidados do relatório.",
        ) from None


@app.get("/", tags=["Sistema"])
def root() -> dict[str, str]:
    return {"servico": "Mapfy Relatórios API", "documentacao": "/docs"}


@app.get("/api/v1/health", tags=["Sistema"])
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "reports_available": len(get_report_catalog()),
    }


@app.get("/api/v1/reports", tags=["Relatórios"], dependencies=[Depends(require_api_key)])
def list_reports() -> dict[str, Any]:
    reports = get_report_catalog()
    return {"items": reports, "total": len(reports)}


@app.get(
    "/api/v1/reports/{report_id}",
    tags=["Relatórios"],
    dependencies=[Depends(require_api_key)],
)
def report_details(report_id: str) -> dict[str, Any]:
    report, _ = _get_report(report_id)
    return report


@app.get(
    "/api/v1/reports/{report_id}/records",
    tags=["Relatórios"],
    dependencies=[Depends(require_api_key)],
)
def report_records(
    report_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    report, csv_path = _get_report(report_id)
    items, has_more = _read_csv_page(csv_path, offset, limit)
    return {
        "report": report,
        "items": items,
        "limit": limit,
        "offset": offset,
        "has_more": has_more,
    }



DASHBOARD_FOLDER_MAP = {
    "abertura_asa": "Plantio - 06 - Abertura da Asa",
    "area_vivencia": "#Check-list Área de vivência _ Colheita",
    "arremate_acabamento": "Plantio - 13 - Arremate e Acabamento",
    "broca_armadilha": "Infestação de Broca - Armadilha",
    "canteirizacao": "Plantio - 03.1 - Preparo de Solo - Canteirização",
    "checklist_veicular": "CHECK LIST VEICULAR",
    "cobricao": "Plantio - 12 - Cobrição",
    "dosagem_cobricao": "Plantio - 11 - Dosagem de Produto - Cobrição",
    "dosagem_sulco": "Plantio - 04 - Dosagem de Produto - Sulcação",
    "herbicida": "Tratos - Herbicida",
    "paralelismo": "Plantio - 07 - Paralelismo",
    "qualidade_cana": "Plantio - 10 - Quantidade de Cana",
    "qualidade_muda": "Plantio - 08 - Qualidade da muda",
    "subsolagem": "Plantio - 03.1 - Preparo de Solo - Subsolagem",
    "sulcacao": "Plantio - 05 - Sulcação",
    "tpl_5s": "5S e Gestão - TPL",
    "viabilidade_gemas": "Plantio - 09 - Quantidade de Gemas",
}

DASHBOARD_DIR = BASE_DIR.parent / "DashBoard"

@app.get("/api/v1/dashboard/{report_slug}/data", tags=["Dashboard"])
def get_dashboard_data(report_slug: str) -> dict[str, Any]:
    slug = report_slug.strip().lower()
    folder_name = DASHBOARD_FOLDER_MAP.get(slug)
    
    # 1. Prioridade Máxima: dataset estruturado e validado de DashBoard/<slug>/js/data.js
    dashboard_js = DASHBOARD_DIR / slug / "js" / "data.js"
    if dashboard_js.is_file():
        try:
            with open(dashboard_js, "r", encoding="utf-8") as f:
                content = f.read()
            match = re.search(r'=\s*(\[[\s\S]*\])\s*;?', content)
            if match:
                records = json.loads(match.group(1))
                mtime = datetime.fromtimestamp(dashboard_js.stat().st_mtime).astimezone()
                return {
                    "status": "ok",
                    "slug": report_slug,
                    "folder": folder_name or slug,
                    "updated_at": mtime.isoformat(timespec="seconds"),
                    "total_records": len(records),
                    "records": records
                }
        except Exception as e:
            logger.warning(f"Erro ao ler data.js de {slug}: {e}")
    
    target_folder = None
    if folder_name:
        f = REPORTS_DIR / folder_name
        if f.is_dir():
            target_folder = f
            
    if not target_folder:
        for f in REPORTS_DIR.iterdir():
            if f.is_dir():
                clean_name = report_id_for(f.name)
                if slug in clean_name or clean_name in slug:
                    target_folder = f
                    break
                    
    if not target_folder:
        raise HTTPException(status_code=404, detail=f"Relatório '{report_slug}' não encontrado.")
        
    json_path = target_folder / "dados.json"
    csv_path = target_folder / "dados.csv"
    
    records = []
    if json_path.is_file():
        try:
            with open(json_path, "r", encoding="utf-8") as jf:
                records = json.load(jf)
        except Exception:
            records = []
            
    if not records and csv_path.is_file():
        items, _ = _read_csv_page(csv_path, 0, 100000)
        records = items
        
    mtime = datetime.fromtimestamp(json_path.stat().st_mtime if json_path.is_file() else csv_path.stat().st_mtime).astimezone()
    
    return {
        "status": "ok",
        "slug": report_slug,
        "folder": target_folder.name,
        "updated_at": mtime.isoformat(timespec="seconds"),
        "total_records": len(records),
        "records": records
    }


def _is_loopback_host(host: str) -> bool:
    return host.strip().lower() in {"127.0.0.1", "localhost", "::1"}


def main() -> None:
    host = os.getenv("MAPFY_API_HOST", "127.0.0.1").strip()
    port = int(os.getenv("MAPFY_API_PORT", "8000"))
    if not _is_loopback_host(host) and not os.getenv("MAPFY_API_KEY", "").strip():
        raise SystemExit(
            "MAPFY_API_KEY é obrigatória quando o gateway escuta em uma interface de rede."
        )

    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
