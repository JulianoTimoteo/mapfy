"""
runtime_paths.py
================
Centralização de caminhos de execução do Server_MapFy no Raspberry Pi (Linux / ARMv6).
Totalmente compatível com systemd autostart, caminhos POSIX e diretórios relativos.
Usina Pitangueiras • Safra 2026
"""

from __future__ import annotations
import os
import sys
from pathlib import Path

# Diretório base do servidor
SERVER_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SERVER_DIR.parent
PROJECT_DIR = SERVER_DIR

REPORTS_DIR = SERVER_DIR / "relatorios"
ENV_FILE = SERVER_DIR / ".env"
LEGACY_ENV_FILE = PROJECT_ROOT / ".env"
SESSION_FILE = SERVER_DIR / "session_state.json"
CONFIG_FILE = SERVER_DIR / "config_rotina.json"
DATA_SUMMARY_FILE = SERVER_DIR / "data_summary.json"

# Diretório do Dashboard (Interface Web servida pelo API Gateway)
if (PROJECT_ROOT / "DashBoard").is_dir():
    DASHBOARD_DIR = PROJECT_ROOT / "DashBoard"
elif (SERVER_DIR / "DashBoard").is_dir():
    DASHBOARD_DIR = SERVER_DIR / "DashBoard"
else:
    DASHBOARD_DIR = PROJECT_ROOT / "DashBoard"
    DASHBOARD_DIR.mkdir(parents=True, exist_ok=True)

# Diretório de Mapas (vetores GeoJSON e MBTiles)
if (SERVER_DIR / "Maps").is_dir():
    MAPS_DIR = SERVER_DIR / "Maps"
elif (DASHBOARD_DIR / "Maps").is_dir():
    MAPS_DIR = DASHBOARD_DIR / "Maps"
else:
    MAPS_DIR = SERVER_DIR / "Maps"
    MAPS_DIR.mkdir(parents=True, exist_ok=True)

# Garante criação dos diretórios essenciais
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
