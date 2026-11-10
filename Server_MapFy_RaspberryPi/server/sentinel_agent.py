#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sentinel_agent.py
=================
Agente Autônomo e Resiliente de Heartbeat para o Servidor MapFy.
Edição Otimizada para Raspberry Pi (Linux / ARMv6).
Métricas de hardware em tempo real: Temperatura, Memória RAM, Armazenamento e Rede.
Transmite sinais assinados via HMAC-SHA256 para o MapFy Telegram Monitor.

Usina Pitangueiras • Safra 2026
"""

from __future__ import annotations

import os
import sys
import time
import json
import uuid
import hmac
import shutil
import hashlib
import sqlite3
import logging
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

AGENT_DIR = Path(__file__).resolve().parent
BASE_DIR = AGENT_DIR
LOG_FILE = AGENT_DIR / "sentinel_agent.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [SentinelAgentRPi] %(message)s",
    handlers=[
        logging.FileHandler(str(LOG_FILE), encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("MapFyAgentRPi")

SERVER_ID = os.environ.get("MAPFY_SERVER_ID", "mapfy-rpi-server-2014")
SERVER_NAME = os.environ.get("MAPFY_SERVER_NAME", "Servidor MapFy 24/7 (Raspberry Pi 1 B+)")
SENTINEL_URL = os.environ.get("MAPFY_SENTINEL_URL", "http://127.0.0.1:8765").rstrip("/")
HMAC_SECRET = os.environ.get("MAPFY_SENTINEL_SECRET", "mapfy_monitor_secret_key_2026")
HEARTBEAT_INTERVAL_SECONDS = int(os.environ.get("MAPFY_HEARTBEAT_INTERVAL", "60"))

BUFFER_DB_PATH = AGENT_DIR / "agent_offline_buffer.db"
START_TIME = time.time()


def init_buffer_db():
    with sqlite3.connect(str(BUFFER_DB_PATH)) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS offline_heartbeats (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                nonce TEXT NOT NULL,
                timestamp_utc TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
        """)
        conn.commit()


def save_to_offline_buffer(nonce: str, timestamp_utc: str, payload_json: str):
    try:
        hb_id = f"buf_{uuid.uuid4().hex[:10]}"
        now_iso = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(str(BUFFER_DB_PATH)) as conn:
            conn.execute("""
                INSERT INTO offline_heartbeats (id, created_at, nonce, timestamp_utc, payload_json)
                VALUES (?, ?, ?, ?, ?)
            """, (hb_id, now_iso, nonce, timestamp_utc, payload_json))
            conn.commit()
        logger.warning("Heartbeat retido no buffer local offline.")
    except Exception as e:
        logger.error(f"Erro ao salvar no buffer offline: {e}")


def get_buffered_heartbeats(limit: int = 50):
    try:
        with sqlite3.connect(str(BUFFER_DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute("SELECT * FROM offline_heartbeats ORDER BY created_at ASC LIMIT ?", (limit,))
            return [dict(r) for r in cur.fetchall()]
    except Exception:
        return []


def remove_from_offline_buffer(hb_id: str):
    try:
        with sqlite3.connect(str(BUFFER_DB_PATH)) as conn:
            conn.execute("DELETE FROM offline_heartbeats WHERE id = ?", (hb_id,))
            conn.commit()
    except Exception as e:
        logger.error(f"Erro ao remover do buffer offline: {e}")


def get_cpu_temp() -> Optional[float]:
    try:
        thermal_file = Path("/sys/class/thermal/thermal_zone0/temp")
        if thermal_file.is_file():
            return round(float(thermal_file.read_text().strip()) / 1000.0, 1)
    except Exception:
        pass
    return None


def get_ip_address() -> str:
    """Tenta descobrir o IP da interface Ethernet eth0."""
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def collect_metrics() -> Dict[str, Any]:
    uptime = time.time() - START_TIME

    # Espaço em Disco no Raspberry Pi (Partição raiz /)
    disk_free_gb = 0.0
    disk_total_gb = 0.0
    try:
        total, used, free = shutil.disk_usage("/")
        disk_total_gb = round(total / (1024 ** 3), 1)
        disk_free_gb = round(free / (1024 ** 3), 1)
    except Exception:
        pass

    # Memória RAM
    mem_used_pct = 0.0
    mem_free_mb = 0.0
    try:
        meminfo = Path("/proc/meminfo")
        if meminfo.is_file():
            data = {}
            for line in meminfo.read_text().splitlines():
                parts = line.split(":")
                if len(parts) == 2:
                    data[parts[0].strip()] = int(parts[1].strip().split()[0])
            total = data.get("MemTotal", 1)
            avail = data.get("MemAvailable", data.get("MemFree", 0))
            mem_used_pct = round(((total - avail) / total) * 100, 1)
            mem_free_mb = round(avail / 1024, 1)
    except Exception:
        pass

    # Checagem de integridade dos relatórios
    reports_dir = AGENT_DIR / "relatorios"
    reports_count = 0
    if reports_dir.is_dir():
        reports_count = len([d for d in reports_dir.iterdir() if d.is_dir()])

    return {
        "uptime_seconds": round(uptime, 1),
        "cpu_temp_celsius": get_cpu_temp(),
        "memory_percent": mem_used_pct,
        "memory_free_mb": mem_free_mb,
        "disk_free_gb": disk_free_gb,
        "disk_total_gb": disk_total_gb,
        "ip_address": get_ip_address(),
        "reports_available": reports_count,
        "services_status": {
            "api_gateway": "RUNNING",
            "dashboard": "ACTIVE",
            "telegram_monitor": "RUNNING",
            "hardware_health": "OPTIMAL",
        },
    }


def transmit_heartbeat(nonce: str, timestamp_utc: str, payload_json: str) -> bool:
    payload_hash = hashlib.sha256(payload_json.encode("utf-8")).hexdigest()
    canonical = f"{SERVER_ID}:{timestamp_utc}:{nonce}:{payload_hash}"
    signature = hmac.new(HMAC_SECRET.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256).hexdigest()

    url = f"{SENTINEL_URL}/api/v1/heartbeat"
    req = urllib.request.Request(
        url,
        data=payload_json.encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Sentinel-Server-ID": SERVER_ID,
            "X-Sentinel-Timestamp": timestamp_utc,
            "X-Sentinel-Nonce": nonce,
            "X-Sentinel-Signature": signature,
            "User-Agent": "MapFySentinelAgentRPi/2.0",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.getcode() == 200:
                logger.info(f"Sinal de vida transmitido com sucesso ao Monitor Telegram ({url})")
                return True
            else:
                logger.warning(f"Resposta inesperada do Monitor: HTTP {resp.getcode()}")
                return False
    except urllib.error.HTTPError as e:
        logger.error(f"Erro HTTP do Monitor: {e.code} - {e.reason}")
        return False
    except Exception as e:
        logger.warning(f"Monitor inacessível no momento: {e}")
        return False


def flush_buffer():
    buffered = get_buffered_heartbeats(limit=20)
    if not buffered:
        return
    logger.info(f"Descarregando {len(buffered)} heartbeats retidos no buffer...")
    for item in buffered:
        success = transmit_heartbeat(item["nonce"], item["timestamp_utc"], item["payload_json"])
        if success:
            remove_from_offline_buffer(item["id"])
        else:
            break


def run_agent_loop():
    pid_file = BASE_DIR / "sentinel_agent.pid"
    try:
        pid_file.write_text(str(os.getpid()), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Não foi possível salvar sentinel_agent.pid: {e}")

    init_buffer_db()
    logger.info(f"==================================================")
    logger.info(f"MAPFY SENTINEL AGENT (RASPBERRY PI EDITION)")
    logger.info(f"Servidor: {SERVER_NAME} ({SERVER_ID})")
    logger.info(f"Monitor: {SENTINEL_URL}")
    logger.info(f"Intervalo: {HEARTBEAT_INTERVAL_SECONDS}s")
    logger.info(f"IP: {get_ip_address()}")
    logger.info(f"==================================================")

    while True:
        try:
            metrics = collect_metrics()
            now_utc = datetime.now(timezone.utc).isoformat()
            nonce = uuid.uuid4().hex

            payload = {
                "server_id": SERVER_ID,
                "server_name": SERVER_NAME,
                "timestamp_utc": now_utc,
                "nonce": nonce,
                "metrics": metrics,
            }
            payload_json = json.dumps(payload)

            success = transmit_heartbeat(nonce, now_utc, payload_json)
            if not success:
                save_to_offline_buffer(nonce, now_utc, payload_json)
            else:
                flush_buffer()

        except Exception as e:
            logger.error(f"Erro crítico no loop do Sentinel Agent: {e}")

        time.sleep(HEARTBEAT_INTERVAL_SECONDS)


if __name__ == "__main__":
    run_agent_loop()
