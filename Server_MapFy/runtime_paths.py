from __future__ import annotations

import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
IS_FROZEN = getattr(sys, "frozen", False)
SERVER_DIR = Path(sys.executable).resolve().parent if IS_FROZEN else PROJECT_DIR / "server"
PROJECT_ROOT = SERVER_DIR.parent.parent if IS_FROZEN else PROJECT_DIR.parent

REPORTS_DIR = SERVER_DIR / "relatorios"
ENV_FILE = SERVER_DIR / ".env"
LEGACY_ENV_FILE = PROJECT_DIR / ".env"
SESSION_FILE = SERVER_DIR / "session_state.json"
LEGACY_SESSION_FILE = PROJECT_DIR / "session_state.json"
CONFIG_FILE = SERVER_DIR / "config_rotina.json"
LEGACY_CONFIG_FILE = PROJECT_DIR / "config_rotina.json"
DASHBOARD_DIR = PROJECT_ROOT / "DashBoard"
