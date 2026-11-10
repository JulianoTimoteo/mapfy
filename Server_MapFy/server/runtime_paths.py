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

# Diretorio do Dashboard (com fallback portatil seguro)
if (PROJECT_ROOT / "DashBoard").is_dir():
    DASHBOARD_DIR = PROJECT_ROOT / "DashBoard"
else:
    fallback_dash = SERVER_DIR / "DashBoard"
    fallback_dash.mkdir(parents=True, exist_ok=True)
    DASHBOARD_DIR = fallback_dash

# Suporte a Mapas: procura em DashBoard/Maps e faz fallback para server/Maps se portátil
MAPS_DIR = DASHBOARD_DIR / "Maps"
if not MAPS_DIR.is_dir() and (SERVER_DIR / "Maps").is_dir():
    MAPS_DIR = SERVER_DIR / "Maps"

# Garante que o Playwright localize o Chromium portátil embutido em runtime/ms-playwright
import os
EMBEDDED_BROWSERS_DIR = SERVER_DIR / "runtime" / "ms-playwright"
if EMBEDDED_BROWSERS_DIR.is_dir():
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(EMBEDDED_BROWSERS_DIR)


