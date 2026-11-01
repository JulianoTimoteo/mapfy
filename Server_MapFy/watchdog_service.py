#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
watchdog_service.py
===================
Supervisor e guardião de alta disponibilidade para o Server_MapFy 24/7.
Mantém o API Gateway rodando continuamente e dispara a extração incremental
programada sem travar o serviço.

Usina Pitangueiras • Safra 2026
"""

import datetime
import json
import logging
import os
import subprocess
import sys
import time
from pathlib import Path

# Garante saída UTF-8 no Windows para evitar crash com charmap / cp1252
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent
LOG_FILE = BASE_DIR / "watchdog.log"
STATUS_FILE = BASE_DIR / "watchdog_status.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8", errors="replace"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("WatchdogMapfy")

# Intervalo padrão de extração periódica em minutos (pode ser sobrescrito por MAPFY_EXTRACT_INTERVAL_MIN)
EXTRACT_INTERVAL_MIN = int(os.getenv("MAPFY_EXTRACT_INTERVAL_MIN", "60"))

def update_status(gateway_pid: int | None, restarts: int, status: str, last_extract: str | None = None):
    try:
        data = {
            "status": status,
            "gateway_pid": gateway_pid,
            "restarts_count": restarts,
            "updated_at": datetime.datetime.now().isoformat(),
            "last_extract": last_extract or "Aguardando próximo ciclo",
            "extract_interval_min": EXTRACT_INTERVAL_MIN
        }
        with open(STATUS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Erro ao atualizar status: {e}")

def run_watchdog():
    logger.info("==================================================")
    logger.info("INICIANDO SERVIÇO GUARDIÃO MAPFY 24/7")
    logger.info("Usina Pitangueiras • Alta Disponibilidade")
    logger.info("==================================================")

    venv_python = BASE_DIR / ".venv" / "Scripts" / "python.exe"
    python_exe = str(venv_python) if venv_python.is_file() else sys.executable
    gateway_script = BASE_DIR / "api_gateway.py"
    extractor_script = BASE_DIR / "mapfy_extractor.py"

    # Sincroniza malha de talhões em DashBoard/Maps/ se necessário
    try:
        sync_script = BASE_DIR.parent / "DashBoard" / "Maps" / "sync_maps.py"
        if sync_script.is_file():
            logger.info("Verificando integridade das camadas de talhões em DashBoard/Maps...")
            subprocess.run([str(python_exe), str(sync_script)], cwd=str(sync_script.parent), capture_output=True, timeout=30)
    except Exception as e:
        logger.warning(f"Aviso ao checar mapas: {e}")

    gateway_proc = None
    restarts = 0
    last_extract_time = 0.0

    while True:
        try:
            # 1. Checa ou inicia o API Gateway
            if gateway_proc is None or gateway_proc.poll() is not None:
                if gateway_proc is not None:
                    exit_code = gateway_proc.poll()
                    logger.warning(f"API Gateway finalizado inesperadamente (código {exit_code}). Reiniciando em 3s...")
                    restarts += 1
                    time.sleep(3)
                
                logger.info(f"Iniciando API Gateway: {python_exe} {gateway_script}")
                gateway_proc = subprocess.Popen(
                    [python_exe, str(gateway_script)],
                    cwd=str(BASE_DIR),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                logger.info(f"API Gateway ativo com PID {gateway_proc.pid}")
                update_status(gateway_proc.pid, restarts, "ONLINE")

            # 2. Checa agendamento de extração do Mapfy
            now = time.time()
            if (now - last_extract_time) >= (EXTRACT_INTERVAL_MIN * 60):
                logger.info(f"Disparando ciclo de extração incremental do Mapfy...")
                try:
                    ext_proc = subprocess.Popen(
                        [python_exe, str(extractor_script), "--headless"],
                        cwd=str(BASE_DIR),
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        encoding="utf-8",
                        errors="replace"
                    )
                    # Lê a saída em tempo real para evitar deadlock no pipe do Windows e registrar no log
                    if ext_proc.stdout:
                        for line in iter(ext_proc.stdout.readline, ""):
                            clean_line = line.strip()
                            if clean_line:
                                safe_line = clean_line.encode("ascii", "backslashreplace").decode("ascii")
                                logger.info(f"[extrator] {safe_line}")
                    ext_proc.wait(timeout=1800)
                    last_extract_str = datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S")
                    last_extract_time = time.time()
                    logger.info(f"Ciclo de extração concluído com sucesso em {last_extract_str}")
                    update_status(gateway_proc.pid, restarts, "ONLINE", last_extract=last_extract_str)
                except subprocess.TimeoutExpired:
                    logger.error("Extração excedeu 30 minutos e foi abortada para segurança.")
                    ext_proc.kill()
                except Exception as ex:
                    logger.error(f"Erro no ciclo de extração: {ex}")

            time.sleep(5)

        except KeyboardInterrupt:
            logger.info("Encerramento solicitado pelo usuário.")
            if gateway_proc and gateway_proc.poll() is None:
                gateway_proc.terminate()
            update_status(None, restarts, "OFFLINE")
            break
        except Exception as e:
            logger.error(f"Erro no loop do watchdog: {e}")
            time.sleep(5)

if __name__ == "__main__":
    run_watchdog()
