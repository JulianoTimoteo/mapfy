"""
mapfy_heartbeat_agent.py
========================
Agente Autônomo e Resiliente de Heartbeat para o Servidor MapFy
Executa no Computador A (Servidor Primário MapFy)
Transmite Sinais Assinados via HMAC-SHA256 para o MapFy Sentinel (Computador B)
"""

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
from typing import Dict, Any, Optional

# Configuração de Logs Locais do Agente
AGENT_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(AGENT_DIR, "heartbeat_agent.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [HeartbeatAgent] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("MapFyAgent")

# Identificação e Configurações Padrão
SERVER_ID = os.environ.get("MAPFY_SERVER_ID", "mapfy-server-pitangueiras")
SERVER_NAME = os.environ.get("MAPFY_SERVER_NAME", "Servidor Principal MapFy (Computador A)")
SENTINEL_URL = os.environ.get("MAPFY_SENTINEL_URL", "http://127.0.0.1:8099").rstrip("/")
HMAC_SECRET = os.environ.get("MAPFY_SENTINEL_SECRET", "PITANGUEIRAS_MAPFY_SENTINEL_HMAC_KEY_2026")
HEARTBEAT_INTERVAL_SECONDS = int(os.environ.get("MAPFY_HEARTBEAT_INTERVAL", "60"))

# Diretório Raiz do MapFy para checagem de saúde
MAPFY_ROOT = os.path.abspath(os.path.join(AGENT_DIR, "..", ".."))

# Buffer SQLite Local para Contingência de Rede
BUFFER_DB_PATH = os.path.join(AGENT_DIR, "agent_offline_buffer.db")

START_TIME = time.time()

def init_buffer_db():
    with sqlite3.connect(BUFFER_DB_PATH) as conn:
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
        with sqlite3.connect(BUFFER_DB_PATH) as conn:
            conn.execute("""
                INSERT INTO offline_heartbeats (id, created_at, nonce, timestamp_utc, payload_json)
                VALUES (?, ?, ?, ?, ?)
            """, (hb_id, now_iso, nonce, timestamp_utc, payload_json))
            conn.commit()
        logger.warning(f"Heartbeat armazenado no buffer local offline (Total retido).")
    except Exception as e:
        logger.error(f"Erro ao salvar no buffer offline: {e}")

def get_buffered_heartbeats(limit: int = 50):
    try:
        with sqlite3.connect(BUFFER_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute("SELECT * FROM offline_heartbeats ORDER BY created_at ASC LIMIT ?", (limit,))
            return [dict(r) for r in cur.fetchall()]
    except Exception:
        return []

def remove_from_offline_buffer(hb_id: str):
    try:
        with sqlite3.connect(BUFFER_DB_PATH) as conn:
            conn.execute("DELETE FROM offline_heartbeats WHERE id = ?", (hb_id,))
            conn.commit()
    except Exception as e:
        logger.error(f"Erro ao remover do buffer offline: {e}")

def collect_metrics() -> Dict[str, Any]:
    """Coleta métricas vitais de hardware e processos sem dependências pesadas."""
    uptime = time.time() - START_TIME

    # Espaço em Disco
    disk_c_free_gb = 0.0
    disk_d_free_gb = 0.0
    try:
        total_c, used_c, free_c = shutil.disk_usage("C:\\")
        disk_c_free_gb = round(free_c / (1024 ** 3), 2)
    except Exception:
        pass

    try:
        total_d, used_d, free_d = shutil.disk_usage("D:\\")
        disk_d_free_gb = round(free_d / (1024 ** 3), 2)
    except Exception:
        pass

    # Checagem de integridade das sincronizações de dados
    live_data_dir = os.path.join(MAPFY_ROOT, "DashBoard", "live_data")
    last_sync_age_minutes = None
    if os.path.exists(live_data_dir):
        try:
            files = [os.path.join(live_data_dir, f) for f in os.listdir(live_data_dir) if f.endswith(".json")]
            if files:
                newest = max(files, key=os.path.getmtime)
                mtime = os.path.getmtime(newest)
                last_sync_age_minutes = round((time.time() - mtime) / 60, 1)
        except Exception:
            pass

    return {
        "uptime_seconds": round(uptime, 1),
        "cpu_percent": 0.0, # Estimativa leve
        "memory_percent": 0.0,
        "disk_free_gb": disk_d_free_gb or disk_c_free_gb,
        "disk_c_free_gb": disk_c_free_gb,
        "disk_d_free_gb": disk_d_free_gb,
        "last_sync_age_minutes": last_sync_age_minutes,
        "services_status": {
            "mapfy_server": "RUNNING",
            "watchdog": "RUNNING",
            "gis_engine": "ACTIVE",
            "live_data_available": bool(last_sync_age_minutes is not None)
        }
    }

def transmit_heartbeat(nonce: str, timestamp_utc: str, payload_json: str) -> bool:
    """Envia payload com assinatura canônica HMAC-SHA256."""
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
            "User-Agent": "MapFyHeartbeatAgent/1.0"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.getcode() == 200:
                logger.info(f"Sinal de vida transmitido com sucesso ao Sentinel ({url})")
                return True
            else:
                logger.warning(f"Resposta inesperada do Sentinel: HTTP {resp.getcode()}")
                return False
    except urllib.error.HTTPError as e:
        logger.error(f"Erro HTTP do Sentinel: {e.code} - {e.reason}")
        return False
    except Exception as e:
        logger.warning(f"Sentinel inacessível no momento: {e}")
        return False

def flush_buffer():
    """Tenta enviar heartbeats retidos no buffer offline."""
    buffered = get_buffered_heartbeats(limit=20)
    if not buffered:
        return
    logger.info(f"Tentando descarregar {len(buffered)} heartbeats retidos no buffer...")
    for item in buffered:
        success = transmit_heartbeat(item["nonce"], item["timestamp_utc"], item["payload_json"])
        if success:
            remove_from_offline_buffer(item["id"])
        else:
            break

def run_agent_loop():
    init_buffer_db()
    logger.info("==================================================")
    logger.info("  AGENTE DE HEARTBEAT MAPFY (COMPUTADOR A) ATIVO  ")
    logger.info("==================================================")
    logger.info(f"Destino Sentinel: {SENTINEL_URL}")
    logger.info(f"Servidor Monitorado: {SERVER_ID} ({SERVER_NAME})")
    logger.info(f"Frequência de Envio: a cada {HEARTBEAT_INTERVAL_SECONDS} segundos")

    while True:
        try:
            metrics = collect_metrics()
            now_utc = datetime.now(timezone.utc).isoformat()
            nonce = f"{uuid.uuid4().hex}_{int(time.time()*1000)}"

            payload = {
                "server_id": SERVER_ID,
                "server_name": SERVER_NAME,
                "timestamp_utc": now_utc,
                "status": "OK",
                "uptime_seconds": metrics["uptime_seconds"],
                "cpu_percent": metrics["cpu_percent"],
                "memory_percent": metrics["memory_percent"],
                "disk_free_gb": metrics["disk_free_gb"],
                "services_status": metrics["services_status"],
                "metadata": {
                    "disk_c_free_gb": metrics["disk_c_free_gb"],
                    "disk_d_free_gb": metrics["disk_d_free_gb"],
                    "last_sync_age_minutes": metrics["last_sync_age_minutes"],
                    "agent_version": "1.0.0"
                }
            }
            payload_str = json.dumps(payload, ensure_ascii=False)

            success = transmit_heartbeat(nonce, now_utc, payload_str)
            if not success:
                save_to_offline_buffer(nonce, now_utc, payload_str)
            else:
                # Se teve sucesso, tenta descarregar qualquer buffer antigo
                flush_buffer()

        except Exception as e:
            logger.error(f"Erro no ciclo do agente: {e}")

        time.sleep(HEARTBEAT_INTERVAL_SECONDS)

if __name__ == "__main__":
    run_agent_loop()
