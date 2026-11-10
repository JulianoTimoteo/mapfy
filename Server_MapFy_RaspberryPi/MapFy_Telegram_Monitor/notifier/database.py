from contextlib import contextmanager
import json
import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Generator, Optional
from notifier.config import Config

_db_lock = threading.Lock()


def get_db_connection(db_path: Optional[Path | str] = None) -> sqlite3.Connection:
    """Cria e configura uma conexão com o SQLite."""
    path = db_path or Config.DATABASE_PATH
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=20.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path: Optional[Path | str] = None) -> None:
    """Inicializa as tabelas e índices do banco de dados de monitoramento."""
    with _db_lock:
        conn = get_db_connection(db_path)
        try:
            with conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS extractions (
                        run_id TEXT PRIMARY KEY,
                        server_name TEXT NOT NULL,
                        start_time TEXT NOT NULL,
                        end_time TEXT,
                        duration_seconds REAL,
                        status TEXT NOT NULL,
                        error_count INTEGER NOT NULL DEFAULT 0,
                        last_heartbeat TEXT NOT NULL,
                        summary_json TEXT,
                        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
                    );
                """)

                conn.execute("""
                    CREATE TABLE IF NOT EXISTS events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        run_id TEXT NOT NULL,
                        timestamp TEXT NOT NULL,
                        level TEXT NOT NULL,
                        origin TEXT NOT NULL,
                        message TEXT NOT NULL,
                        details TEXT,
                        FOREIGN KEY (run_id) REFERENCES extractions(run_id) ON DELETE CASCADE
                    );
                """)

                conn.execute("""
                    CREATE TABLE IF NOT EXISTS incidents (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        run_id TEXT NOT NULL,
                        opened_at TEXT NOT NULL,
                        closed_at TEXT,
                        incident_type TEXT NOT NULL,
                        description TEXT NOT NULL,
                        alert_sent INTEGER NOT NULL DEFAULT 0,
                        recovery_sent INTEGER NOT NULL DEFAULT 0,
                        FOREIGN KEY (run_id) REFERENCES extractions(run_id) ON DELETE CASCADE
                    );
                """)

                # Índices para alta performance e integridade
                conn.execute("CREATE INDEX IF NOT EXISTS idx_extractions_status ON extractions(status);")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_extractions_start_time ON extractions(start_time);")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id);")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_incidents_run_id_open ON incidents(run_id, closed_at);")
        finally:
            conn.close()


class DatabaseManager:
    """Interface de acesso e persistência do monitor no SQLite."""

    def __init__(self, db_path: Optional[Path | str] = None):
        self.db_path = db_path or Config.DATABASE_PATH
        init_db(self.db_path)

    @contextmanager
    def _conn(self) -> Generator[sqlite3.Connection, None, None]:
        """Context manager que garante abertura, commit e fechamento estrito da conexão."""
        conn = get_db_connection(self.db_path)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def create_extraction(self, run_id: str, server_name: str, start_time: Optional[datetime] = None) -> dict[str, Any]:
        """Registra o início de uma nova execução de extração."""
        now_dt = start_time or datetime.now()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")

        with _db_lock, self._conn() as conn:
            conn.execute("""
                INSERT INTO extractions (run_id, server_name, start_time, status, error_count, last_heartbeat)
                VALUES (?, ?, ?, 'RUNNING', 0, ?);
            """, (run_id, server_name, now_str, now_str))

        return {
            "run_id": run_id,
            "server_name": server_name,
            "start_time": now_str,
            "status": "RUNNING",
            "error_count": 0,
            "last_heartbeat": now_str
        }

    def update_heartbeat(self, run_id: str, heartbeat_time: Optional[datetime] = None) -> bool:
        """Atualiza o último heartbeat de uma execução."""
        now_dt = heartbeat_time or datetime.now()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")

        with _db_lock, self._conn() as conn:
            cur = conn.execute("""
                UPDATE extractions
                SET last_heartbeat = ?
                WHERE run_id = ? AND status IN ('RUNNING', 'RUNNING_WITH_ERRORS', 'NO_HEARTBEAT', 'RECOVERED');
            """, (now_str, run_id))
            return cur.rowcount > 0

    def update_status(self, run_id: str, new_status: str) -> bool:
        """Atualiza o status de uma execução."""
        with _db_lock, self._conn() as conn:
            cur = conn.execute("""
                UPDATE extractions
                SET status = ?
                WHERE run_id = ?;
            """, (new_status, run_id))
            return cur.rowcount > 0

    def add_event(
        self,
        run_id: str,
        level: str,
        origin: str,
        message: str,
        details: Optional[str] = None,
        event_time: Optional[datetime] = None
    ) -> int:
        """Registra um evento ou erro na execução."""
        now_dt = event_time or datetime.now()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
        is_error = level.upper() in ("ERROR", "CRITICAL")

        with _db_lock, self._conn() as conn:
            cur = conn.execute("""
                INSERT INTO events (run_id, timestamp, level, origin, message, details)
                VALUES (?, ?, ?, ?, ?, ?);
            """, (run_id, now_str, level.upper(), origin, message, details))
            event_id = cur.lastrowid or 0

            if is_error:
                conn.execute("""
                    UPDATE extractions
                    SET error_count = error_count + 1,
                        status = CASE WHEN status = 'RUNNING' THEN 'RUNNING_WITH_ERRORS' ELSE status END
                    WHERE run_id = ?;
                """, (run_id,))

            return event_id

    def finish_extraction(
        self,
        run_id: str,
        status: str,
        end_time: Optional[datetime] = None,
        summary: Optional[dict[str, Any]] = None
    ) -> Optional[dict[str, Any]]:
        """Registra o término de uma extração e calcula sua duração."""
        now_dt = end_time or datetime.now()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
        summary_str = json.dumps(summary, ensure_ascii=False) if summary else None

        with _db_lock, self._conn() as conn:
            row = conn.execute("SELECT start_time FROM extractions WHERE run_id = ?;", (run_id,)).fetchone()
            if not row:
                return None

            start_dt = datetime.strptime(row["start_time"], "%Y-%m-%d %H:%M:%S")
            duration = max(0.0, (now_dt - start_dt).total_seconds())

            conn.execute("""
                UPDATE extractions
                SET end_time = ?,
                    duration_seconds = ?,
                    status = ?,
                    summary_json = ?
                WHERE run_id = ?;
            """, (now_str, duration, status, summary_str, run_id))

        return self.get_extraction(run_id)

    def get_extraction(self, run_id: str) -> Optional[dict[str, Any]]:
        """Retorna os dados completos de uma extração."""
        with _db_lock, self._conn() as conn:
            row = conn.execute("SELECT * FROM extractions WHERE run_id = ?;", (run_id,)).fetchone()
            if not row:
                return None
            data = dict(row)
            if data.get("summary_json"):
                try:
                    data["summary"] = json.loads(data["summary_json"])
                except Exception:
                    data["summary"] = data["summary_json"]
            return data

    def get_active_extraction(self) -> Optional[dict[str, Any]]:
        """Retorna a execução que está atualmente ativa (se houver)."""
        with _db_lock, self._conn() as conn:
            row = conn.execute("""
                SELECT * FROM extractions
                WHERE status IN ('RUNNING', 'RUNNING_WITH_ERRORS', 'NO_HEARTBEAT', 'RECOVERED')
                ORDER BY start_time DESC
                LIMIT 1;
            """).fetchone()
            return dict(row) if row else None

    def get_latest_extraction(self) -> Optional[dict[str, Any]]:
        """Retorna a última execução registrada no sistema."""
        with _db_lock, self._conn() as conn:
            row = conn.execute("SELECT * FROM extractions ORDER BY start_time DESC LIMIT 1;").fetchone()
            if not row:
                return None
            data = dict(row)
            if data.get("summary_json"):
                try:
                    data["summary"] = json.loads(data["summary_json"])
                except Exception:
                    data["summary"] = data["summary_json"]
            return data

    def get_events_for_run(self, run_id: str) -> list[dict[str, Any]]:
        """Retorna todos os eventos associados a uma execução."""
        with _db_lock, self._conn() as conn:
            rows = conn.execute("SELECT * FROM events WHERE run_id = ? ORDER BY id ASC;", (run_id,)).fetchall()
            return [dict(r) for r in rows]

    # --- Gerenciamento de Incidentes ---

    def open_incident(self, run_id: str, incident_type: str, description: str, opened_at: Optional[datetime] = None) -> int:
        """Abre um incidente para uma execução caso não exista um aberto do mesmo tipo."""
        now_dt = opened_at or datetime.now()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")

        with _db_lock, self._conn() as conn:
            existing = conn.execute("""
                SELECT id FROM incidents
                WHERE run_id = ? AND incident_type = ? AND closed_at IS NULL;
            """, (run_id, incident_type)).fetchone()

            if existing:
                return int(existing["id"])

            cur = conn.execute("""
                INSERT INTO incidents (run_id, opened_at, incident_type, description, alert_sent, recovery_sent)
                VALUES (?, ?, ?, ?, 0, 0);
            """, (run_id, now_str, incident_type, description))
            return cur.lastrowid or 0

    def get_open_incident(self, run_id: str, incident_type: str) -> Optional[dict[str, Any]]:
        """Retorna o incidente aberto para o run_id e tipo."""
        with _db_lock, self._conn() as conn:
            row = conn.execute("""
                SELECT * FROM incidents
                WHERE run_id = ? AND incident_type = ? AND closed_at IS NULL;
            """, (run_id, incident_type)).fetchone()
            return dict(row) if row else None

    def mark_incident_alert_sent(self, incident_id: int) -> None:
        """Marca que o alerta de interrupção foi enviado ao Telegram."""
        with _db_lock, self._conn() as conn:
            conn.execute("UPDATE incidents SET alert_sent = 1 WHERE id = ?;", (incident_id,))

    def close_incident(self, incident_id: int, closed_at: Optional[datetime] = None) -> None:
        """Fecha um incidente e marca como recuperado."""
        now_dt = closed_at or datetime.now()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")

        with _db_lock, self._conn() as conn:
            conn.execute("""
                UPDATE incidents
                SET closed_at = ?, recovery_sent = 1
                WHERE id = ?;
            """, (now_str, incident_id))

