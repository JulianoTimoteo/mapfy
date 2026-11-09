"""
runtime_paths.py
================
Centralização de caminhos de execução do Server_MapFy
Compatível com execução em script e binário compilado PyInstaller (.exe)
Usina Pitangueiras • Safra 2026
"""

from __future__ import annotations
import sys
from pathlib import Path

# Diretório base
IS_FROZEN = getattr(sys, "frozen", False)

if IS_FROZEN:
    SERVER_DIR = Path(sys.executable).resolve().parent
else:
    current_dir = Path(__file__).resolve().parent
    SERVER_DIR = current_dir if current_dir.name.lower() == "server" else current_dir / "server"

# Raiz do projeto (onde reside a pasta DashBoard)
if SERVER_DIR.parent.name.startswith("Server_MapFy"):
    PROJECT_ROOT = SERVER_DIR.parent.parent
else:
    PROJECT_ROOT = SERVER_DIR.parent

PROJECT_DIR = SERVER_DIR

REPORTS_DIR = SERVER_DIR / "relatorios"
ENV_FILE = SERVER_DIR / ".env"
LEGACY_ENV_FILE = SERVER_DIR.parent / ".env"
SESSION_FILE = SERVER_DIR / "session_state.json"
LEGACY_SESSION_FILE = SERVER_DIR.parent / "session_state.json"
CONFIG_FILE = SERVER_DIR / "config_rotina.json"
LEGACY_CONFIG_FILE = SERVER_DIR.parent / "config_rotina.json"
DASHBOARD_DIR = PROJECT_ROOT / "DashBoard"
