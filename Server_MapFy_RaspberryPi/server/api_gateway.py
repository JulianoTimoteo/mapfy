#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
api_gateway.py
==============
Gateway de API e Servidor Web em Tempo Real para o MapFy.
Edição Otimizada para Raspberry Pi 1 Model B+ (ARMv6 / 512MB RAM).
Executa 24/7 conectado via Cabo de Rede Ethernet.

Funcionalidades:
  1. API RESTful de alta performance para consulta de relatórios consolidados.
  2. Hospedagem direta da interface web DashBoard em tempo real.
  3. Servidor de mapas vetoriais (GeoJSON e MBTiles).
  4. Endpoint de sincronização PUSH em tempo real (/api/v1/sync/push).
  5. Telemetria e diagnóstico de hardware (CPU, temperatura, memória RAM).

Usina Pitangueiras • Safra 2026
"""

from __future__ import annotations

import csv
import hashlib
import hmac
import io
import json
import logging
import os
import re
import sqlite3
import time
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from runtime_paths import (
    DASHBOARD_DIR,
    DATA_SUMMARY_FILE,
    ENV_FILE,
    LEGACY_ENV_FILE,
    MAPS_DIR,
    PROJECT_DIR,
    REPORTS_DIR,
)

# Carrega variáveis de ambiente
load_dotenv(ENV_FILE if ENV_FILE.is_file() else LEGACY_ENV_FILE)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | [%(name)s] %(message)s",
)
logger = logging.getLogger("mapfy.api.rpi")

START_TIME = time.time()

app = FastAPI(
    title="MapFy Servidor 24/7 - Raspberry Pi",
    description="Servidor de Relatórios e Dashboard em Tempo Real para a Usina Pitangueiras.",
    version="2.0.0-rpi",
)

# Configuração de CORS
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def get_cpu_temp() -> Optional[float]:
    """Obtém a temperatura física do processador Broadcom do Raspberry Pi."""
    try:
        thermal_file = Path("/sys/class/thermal/thermal_zone0/temp")
        if thermal_file.is_file():
            temp_raw = thermal_file.read_text().strip()
            return round(float(temp_raw) / 1000.0, 1)
    except Exception:
        pass
    return None


def get_memory_info() -> Dict[str, Any]:
    """Lê estatísticas de uso de memória RAM via /proc/meminfo."""
    mem_info: Dict[str, Any] = {}
    try:
        meminfo_file = Path("/proc/meminfo")
        if meminfo_file.is_file():
            for line in meminfo_file.read_text().splitlines():
                parts = line.split(":")
                if len(parts) == 2:
                    key = parts[0].strip()
                    val = parts[1].strip().split()[0]
                    if key in ("MemTotal", "MemFree", "MemAvailable", "Buffers", "Cached"):
                        mem_info[key] = int(val)
            total = mem_info.get("MemTotal", 1)
            avail = mem_info.get("MemAvailable", mem_info.get("MemFree", 0))
            used = total - avail
            mem_info["total_mb"] = round(total / 1024, 1)
            mem_info["used_mb"] = round(used / 1024, 1)
            mem_info["free_mb"] = round(avail / 1024, 1)
            mem_info["percent_used"] = round((used / total) * 100, 1)
    except Exception:
        pass
    return mem_info


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
        json_path = folder / "dados.json"

        target_file = csv_path if csv_path.is_file() else (json_path if json_path.is_file() else None)
        if target_file is None:
            continue

        modified_at = datetime.fromtimestamp(target_file.stat().st_mtime).astimezone()
        reports.append({
            "id": report_id_for(folder.name),
            "name": folder.name,
            "has_csv": csv_path.is_file(),
            "has_json": json_path.is_file(),
            "updated_at": modified_at.isoformat(timespec="seconds"),
        })

    return sorted(reports, key=lambda report: report["name"].casefold())


def _get_report(report_id: str) -> tuple[dict[str, Any], Path]:
    for report in get_report_catalog():
        if report["id"] == report_id:
            csv_path = REPORTS_DIR / report["name"] / "dados.csv"
            if csv_path.is_file() and _is_inside_reports(csv_path, REPORTS_DIR):
                return report, csv_path
            json_path = REPORTS_DIR / report["name"] / "dados.json"
            if json_path.is_file() and _is_inside_reports(json_path, REPORTS_DIR):
                return report, json_path
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
    except Exception as exc:
        logger.warning(f"Falha ao ler CSV {csv_path.name}: {exc}")
        return [], False


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


# --- Rotas do Sistema e Telemetria ---

@app.get("/api/v1/health", tags=["Sistema"])
def health() -> dict[str, Any]:
    uptime_seconds = int(time.time() - START_TIME)
    catalog = get_report_catalog()
    return {
        "status": "online",
        "servidor": "MapFy 24/7 Raspberry Pi",
        "uptime_seconds": uptime_seconds,
        "uptime_formatted": f"{uptime_seconds // 3600}h {(uptime_seconds % 3600) // 60}m {uptime_seconds % 60}s",
        "cpu_temp_celsius": get_cpu_temp(),
        "memory": get_memory_info(),
        "reports_available": len(catalog),
        "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
    }


# --- Rotas de Relatórios ---

@app.get("/api/v1/reports", tags=["Relatórios"])
def list_reports() -> dict[str, Any]:
    reports = get_report_catalog()
    return {"items": reports, "total": len(reports)}


@app.get("/api/v1/reports/{report_id}", tags=["Relatórios"])
def report_details(report_id: str) -> dict[str, Any]:
    report, _ = _get_report(report_id)
    return report


@app.get("/api/v1/reports/{report_id}/records", tags=["Relatórios"])
def report_records(
    report_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    report, file_path = _get_report(report_id)
    if file_path.suffix.lower() == ".csv":
        items, has_more = _read_csv_page(file_path, offset, limit)
    elif file_path.suffix.lower() == ".json":
        try:
            with open(file_path, "r", encoding="utf-8") as jf:
                all_records = json.load(jf)
            items = all_records[offset: offset + limit]
            has_more = len(all_records) > offset + limit
        except Exception:
            items, has_more = [], False
    else:
        items, has_more = [], False

    return {
        "report": report,
        "items": items,
        "limit": limit,
        "offset": offset,
        "has_more": has_more,
    }


# --- Rotas do Dashboard ---

@app.get("/api/v1/summary", tags=["Dashboard"])
@app.get("/api/v1/dashboard/summary", tags=["Dashboard"])
def get_dashboard_summary() -> dict[str, Any]:
    """Retorna o consolidado dinâmico com contagem de registros em tempo real."""
    catalog = get_report_catalog()
    reports_map: dict[str, Any] = {}
    total_records = 0

    folder_to_slug = {v.casefold(): k for k, v in DASHBOARD_FOLDER_MAP.items()}

    for item in catalog:
        folder_name = item["name"]
        slug = folder_to_slug.get(folder_name.casefold(), report_id_for(folder_name))
        csv_path = REPORTS_DIR / folder_name / "dados.csv"
        json_path = REPORTS_DIR / folder_name / "dados.json"
        rows = 0

        if csv_path.is_file():
            try:
                with open(csv_path, "rb") as f:
                    rows = max(0, sum(1 for _ in f) - 1)
            except Exception:
                pass
        elif json_path.is_file():
            try:
                with open(json_path, "r", encoding="utf-8") as jf:
                    data = json.load(jf)
                    rows = len(data) if isinstance(data, list) else 0
            except Exception:
                pass

        reports_map[slug] = {
            "id": item["id"],
            "slug": slug,
            "folder": folder_name,
            "rows": rows,
            "updated_at": item["updated_at"],
        }
        total_records += rows

    return {
        "status": "ok",
        "total_records": total_records,
        "total_k": f"+{round(total_records / 1000)}k Registros",
        "total_formatted": f"+{total_records:,} Registros".replace(",", "."),
        "reports": reports_map,
        "updated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
    }


@app.get("/api/v1/dashboard/{report_slug}/data", tags=["Dashboard"])
def get_dashboard_data(report_slug: str) -> dict[str, Any]:
    slug = report_slug.strip().lower()
    folder_name = DASHBOARD_FOLDER_MAP.get(slug)

    target_folder = None
    if folder_name:
        f = REPORTS_DIR / folder_name
        if f.is_dir() and _is_inside_reports(f, REPORTS_DIR):
            target_folder = f

    if not target_folder:
        for f in REPORTS_DIR.iterdir():
            if f.is_dir() and _is_inside_reports(f, REPORTS_DIR):
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
        items, _ = _read_csv_page(csv_path, 0, 50000)
        records = items

    mtime = datetime.fromtimestamp(
        json_path.stat().st_mtime if json_path.is_file() else csv_path.stat().st_mtime
    ).astimezone()

    return {
        "status": "ok",
        "slug": report_slug,
        "folder": target_folder.name,
        "updated_at": mtime.isoformat(timespec="seconds"),
        "total_records": len(records),
        "records": records,
    }


# --- Rota de Ingestão e Sincronização em Tempo Real ---

@app.post("/api/v1/sync/push", tags=["Sincronização"])
async def sync_push(request: Request, x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> dict[str, Any]:
    """
    Recebe atualizações de relatórios em tempo real via HTTP POST (push do PC extrator).
    Atualiza dados.csv e dados.json no Raspberry Pi instantaneamente.
    """
    require_api_key(x_api_key)
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="JSON inválido.")

    report_name = payload.get("report_name")
    records = payload.get("records")
    csv_content = payload.get("csv_content")

    if not report_name or (records is None and csv_content is None):
        raise HTTPException(status_code=400, detail="Parâmetros 'report_name' e 'records' ou 'csv_content' obrigatórios.")

    target_dir = REPORTS_DIR / report_name
    target_dir.mkdir(parents=True, exist_ok=True)

    updated_count = 0
    if records is not None and isinstance(records, list):
        json_file = target_dir / "dados.json"
        with open(json_file, "w", encoding="utf-8") as jf:
            json.dump(records, jf, ensure_ascii=False, indent=2)
        updated_count = len(records)

    if csv_content:
        csv_file = target_dir / "dados.csv"
        with open(csv_file, "w", encoding="utf-8") as cf:
            cf.write(csv_content)

    logger.info(f"Sincronização em tempo real recebida para '{report_name}' ({updated_count} registros)")
    return {
        "status": "success",
        "report": report_name,
        "records_synced": updated_count,
        "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
    }


# --- Rotas de Mapas e Camadas Cartográficas ---

RAW_GEOJSON = MAPS_DIR / "PITANGUEIRAS.geojson"
OPT_GEOJSON = MAPS_DIR / "pitangueiras_shapes.geojson"
MANIFEST_FILE = MAPS_DIR / "manifest.json"
MBTILES_FILE = MAPS_DIR / "fields.mbtiles"


@app.get("/api/v1/maps/manifest", tags=["Mapas"])
def get_maps_manifest() -> dict[str, Any]:
    if MANIFEST_FILE.is_file():
        try:
            with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=404, detail="Manifesto de mapas não encontrado.")


@app.get("/api/v1/maps/shapes", tags=["Mapas"])
def get_maps_shapes():
    if OPT_GEOJSON.is_file():
        return FileResponse(OPT_GEOJSON, media_type="application/geo+json")
    if RAW_GEOJSON.is_file():
        return FileResponse(RAW_GEOJSON, media_type="application/geo+json")
    raise HTTPException(status_code=404, detail="Shapes de talhões não encontrados.")


@app.get("/api/v1/maps/tiles/{z}/{x}/{y}.pbf", tags=["Mapas"])
def get_map_vector_tile(z: int, x: int, y: int):
    if not MBTILES_FILE.is_file():
        raise HTTPException(status_code=404, detail="Arquivo MBTiles não encontrado.")
    tms_y = (1 << z) - 1 - y
    try:
        conn = sqlite3.connect(str(MBTILES_FILE))
        cur = conn.cursor()
        cur.execute(
            "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?",
            (z, x, tms_y),
        )
        row = cur.fetchone()
        conn.close()
        if not row or not row[0]:
            raise HTTPException(status_code=404, detail="Tile não encontrado.")
        return Response(
            content=row[0],
            media_type="application/x-protobuf",
            headers={
                "Content-Encoding": "gzip",
                "Cache-Control": "public, max-age=86400",
                "Access-Control-Allow-Origin": "*",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Servir a Interface Web do DashBoard ---

if DASHBOARD_DIR.is_dir():
    app.mount("/dashboard", StaticFiles(directory=str(DASHBOARD_DIR), html=True), name="dashboard_app")
    # Redireciona a raiz / para o Dashboard se acessado via navegador
    @app.get("/", include_in_schema=False)
    def root_dashboard():
        index_file = DASHBOARD_DIR / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)
        return {"status": "MapFy Server RPi Online", "dashboard": "/dashboard/", "docs": "/docs"}


def main() -> None:
    host = os.getenv("MAPFY_API_HOST", "0.0.0.0").strip()
    port = int(os.getenv("MAPFY_API_PORT", "8000"))
    logger.info(f"Iniciando MapFy API Gateway & Dashboard no Raspberry Pi em {host}:{port}...")
    uvicorn.run(app, host=host, port=port, log_level="info", access_log=False)


if __name__ == "__main__":
    main()
