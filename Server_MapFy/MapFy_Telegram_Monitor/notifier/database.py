from contextlib import contextmanager
import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator, Optional
from zoneinfo import ZoneInfo

from notifier.config import Config

_db_lock = threading.Lock()
LOCAL_TZ = ZoneInfo("America/Sao_Paulo")
CURRENT_SCHEMA_VERSION = 2


def now_utc() -> datetime:
    """Retorna datetime atual com fuso horário UTC consciente."""
    return datetime.now(timezone.utc)


def now_utc_iso() -> str:
    """Retorna timestamp ISO 8601 UTC formatado para persistência padronizada."""
    return now_utc().strftime("%Y-%m-%d %H:%M:%S")


def format_brazil_time(dt_or_str: Optional[datetime | str] = None) -> str:
    """Converte datetime UTC ou string ISO para horário de Brasília (America/Sao_Paulo)."""
    if not dt_or_str:
        dt = now_utc()
    elif isinstance(dt_or_str, str):
        try:
            # Tenta parsing ISO
            dt = datetime.fromisoformat(dt_or_str.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            try:
                dt = datetime.strptime(dt_or_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            except Exception:
                return dt_or_str
    else:
        dt = dt_or_str
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

    local_dt = dt.astimezone(LOCAL_TZ)
    return local_dt.strftime("%d/%m/%Y %H:%M:%S")


to_local_str = format_brazil_time


def get_db_connection(db_path: Optional[Path | str] = None) -> sqlite3.Connection:
    """Cria e configura uma conexão com o SQLite de alta resiliência e concorrência."""
    path = db_path or Config.DATABASE_PATH
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA busy_timeout = 30000;")
    return conn


def migrate_db(conn: sqlite3.Connection) -> None:
    """Executa migrações estruturadas e idempotentes utilizando PRAGMA user_version."""
    cur = conn.cursor()
    version = cur.execute("PRAGMA user_version;").fetchone()[0]

    # Versão 1: Esquema base
    if version < 1:
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
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

        conn.execute("CREATE INDEX IF NOT EXISTS idx_extractions_status ON extractions(status);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_extractions_start_time ON extractions(start_time);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_incidents_run_id_open ON incidents(run_id, closed_at);")
        conn.execute("PRAGMA user_version = 1;")
        version = 1

    # Versão 2: Outbox durável, estágios de heartbeat e estado do bot
    if version < 2:
        # Colunas opcionais para estágios e métricas do extrator em extractions
        cols = [r[1] for r in conn.execute("PRAGMA table_info(extractions);").fetchall()]
        if "stage" not in cols:
            conn.execute("ALTER TABLE extractions ADD COLUMN stage TEXT DEFAULT 'IDLE';")
        if "progress" not in cols:
            conn.execute("ALTER TABLE extractions ADD COLUMN progress REAL DEFAULT 0.0;")
        if "rows" not in cols:
            conn.execute("ALTER TABLE extractions ADD COLUMN rows INTEGER DEFAULT 0;")

        # Tabela Outbox para envio assíncrono e tolerante a falhas do Telegram
        conn.execute("""
            CREATE TABLE IF NOT EXISTS outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                text TEXT NOT NULL,
                parse_mode TEXT DEFAULT 'HTML',
                reply_markup TEXT,
                status TEXT NOT NULL DEFAULT 'PENDING',
                attempts INTEGER NOT NULL DEFAULT 0,
                max_attempts INTEGER NOT NULL DEFAULT 15,
                next_retry_at TEXT NOT NULL,
                error_message TEXT,
                created_at TEXT NOT NULL,
                sent_at TEXT,
                message_id INTEGER,
                edit_message_id INTEGER,
                fingerprint TEXT,
                repeat_count INTEGER NOT NULL DEFAULT 1
            );
        """)

        # Tabela para estados persistentes do bot (offset do long-polling, token do chat, código de pareamento)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS bot_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        conn.execute("CREATE INDEX IF NOT EXISTS idx_outbox_queue ON outbox(status, next_retry_at);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_outbox_fingerprint ON outbox(fingerprint, status);")
        conn.execute("PRAGMA user_version = 2;")
        version = 2


def init_db(db_path: Optional[Path | str] = None) -> None:
    """Inicializa as tabelas, índices e migrações do banco de dados de monitoramento."""
    with _db_lock:
        conn = get_db_connection(db_path)
        try:
            with conn:
                migrate_db(conn)
        finally:
            conn.close()


class DatabaseManager:
    """Interface de acesso e persistência do monitor no SQLite com suporte a Outbox e Transações."""

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

    # --- Ciclo de Vida da Extração ---

    def create_extraction(
        self,
        run_id: str,
        server_name: str,
        start_time: Optional[datetime] = None
    ) -> dict[str, Any]:
        """Registra o início de uma nova execução de extração."""
        now_dt = start_time or now_utc()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")

        with _db_lock, self._conn() as conn:
            conn.execute("""
                INSERT INTO extractions (run_id, server_name, start_time, status, error_count, last_heartbeat, stage, progress, rows)
                VALUES (?, ?, ?, 'RUNNING', 0, ?, 'START', 0.0, 0);
            """, (run_id, server_name, now_str, now_str))

        return {
            "run_id": run_id,
            "server_name": server_name,
            "start_time": now_str,
            "status": "RUNNING",
            "error_count": 0,
            "last_heartbeat": now_str,
            "stage": "START",
            "progress": 0.0,
            "rows": 0
        }

    def update_heartbeat(
        self,
        run_id: str,
        heartbeat_time: Optional[datetime] = None,
        stage: Optional[str] = None,
        progress: Optional[float] = None,
        rows: Optional[int] = None
    ) -> bool:
        """Atualiza o último heartbeat e dados de estágio de uma execução."""
        now_dt = heartbeat_time or now_utc()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")

        query = """
            UPDATE extractions
            SET last_heartbeat = ?,
                stage = COALESCE(?, stage),
                progress = COALESCE(?, progress),
                rows = COALESCE(?, rows)
            WHERE run_id = ? AND status IN ('RUNNING', 'RUNNING_WITH_ERRORS', 'NO_HEARTBEAT', 'RECOVERED', 'STALLED');
        """
        with _db_lock, self._conn() as conn:
            cur = conn.execute(query, (now_str, stage, progress, rows, run_id))
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
        now_dt = event_time or now_utc()
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
        now_dt = end_time or now_utc()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
        summary_str = json.dumps(summary, ensure_ascii=False) if summary else None

        with _db_lock, self._conn() as conn:
            row = conn.execute("SELECT start_time FROM extractions WHERE run_id = ?;", (run_id,)).fetchone()
            if not row:
                return None

            try:
                start_dt = datetime.strptime(row["start_time"], "%Y-%m-%d %H:%M:%S")
                duration = max(0.0, (now_dt - start_dt).total_seconds())
            except Exception:
                duration = 0.0

            conn.execute("""
                UPDATE extractions
                SET end_time = ?,
                    duration_seconds = ?,
                    status = ?,
                    summary_json = ?,
                    stage = 'FINISHED'
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
                WHERE status IN ('RUNNING', 'RUNNING_WITH_ERRORS', 'NO_HEARTBEAT', 'RECOVERED', 'STALLED')
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

    def get_recent_extractions(self, limit: int = 10) -> list[dict[str, Any]]:
        """Retorna as N extrações mais recentes para histórico e estatísticas."""
        with _db_lock, self._conn() as conn:
            rows = conn.execute("SELECT * FROM extractions ORDER BY start_time DESC LIMIT ?;", (limit,)).fetchall()
            results = []
            for r in rows:
                item = dict(r)
                if item.get("summary_json"):
                    try:
                        item["summary"] = json.loads(item["summary_json"])
                    except Exception:
                        item["summary"] = item["summary_json"]
                results.append(item)
            return results

    def get_events_for_run(self, run_id: str) -> list[dict[str, Any]]:
        """Retorna todos os eventos associados a uma execução."""
        with _db_lock, self._conn() as conn:
            rows = conn.execute("SELECT * FROM events WHERE run_id = ? ORDER BY id ASC;", (run_id,)).fetchall()
            return [dict(r) for r in rows]

    def get_recent_errors(self, limit: int = 10) -> list[dict[str, Any]]:
        """Retorna os N erros mais recentes de todas as extrações."""
        with _db_lock, self._conn() as conn:
            rows = conn.execute("""
                SELECT e.*, ex.server_name
                FROM events e
                JOIN extractions ex ON e.run_id = ex.run_id
                WHERE e.level IN ('ERROR', 'CRITICAL')
                ORDER BY e.id DESC
                LIMIT ?;
            """, (limit,)).fetchall()
            return [dict(r) for r in rows]

    # --- Gestão de Incidentes ---

    def open_incident(
        self,
        run_id: str,
        incident_type: str,
        description: str,
        opened_at: Optional[datetime] = None
    ) -> int:
        """Abre um incidente para acompanhamento ou retorna o id se já existir aberto."""
        existing = self.get_open_incident(run_id, incident_type)
        if existing:
            return existing["id"]

        now_dt = opened_at or now_utc()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
        with _db_lock, self._conn() as conn:
            cur = conn.execute("""
                INSERT INTO incidents (run_id, opened_at, incident_type, description, alert_sent, recovery_sent)
                VALUES (?, ?, ?, ?, 0, 0);
            """, (run_id, now_str, incident_type, description))
            return cur.lastrowid or 0

    def mark_incident_alert_sent(self, incident_id: int) -> None:
        """Marca que o alerta inicial deste incidente foi disparado ao operador."""
        with _db_lock, self._conn() as conn:
            conn.execute("UPDATE incidents SET alert_sent = 1 WHERE id = ?;", (incident_id,))

    def close_incident(self, incident_id: int, closed_at: Optional[datetime] = None) -> bool:
        """Fecha um incidente e marca como recuperado."""
        now_dt = closed_at or now_utc()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")

        with _db_lock, self._conn() as conn:
            cur = conn.execute("""
                UPDATE incidents
                SET closed_at = ?, recovery_sent = 1
                WHERE id = ? AND closed_at IS NULL;
            """, (now_str, incident_id))
            return cur.rowcount > 0

    def get_open_incident(self, run_id: str, incident_type: str) -> Optional[dict[str, Any]]:
        """Retorna incidente aberto de determinado tipo para uma execução."""
        with _db_lock, self._conn() as conn:
            row = conn.execute("""
                SELECT * FROM incidents
                WHERE run_id = ? AND incident_type = ? AND closed_at IS NULL
                ORDER BY id DESC LIMIT 1;
            """, (run_id, incident_type)).fetchone()
            return dict(row) if row else None

    def get_open_incidents(self) -> list[dict[str, Any]]:
        """Retorna todos os incidentes que permanecem abertos no sistema."""
        with _db_lock, self._conn() as conn:
            rows = conn.execute("""
                SELECT * FROM incidents
                WHERE closed_at IS NULL
                ORDER BY opened_at DESC;
            """).fetchall()
            return [dict(r) for r in rows]

    # --- Outbox Durável (Fase 1) ---

    def enqueue_outbox(
        self,
        chat_id: str | int,
        text: str,
        parse_mode: str = "HTML",
        reply_markup: Optional[dict[str, Any]] = None,
        edit_message_id: Optional[int] = None,
        fingerprint: Optional[str] = None
    ) -> int:
        """Enfileira uma mensagem de forma atômica e persistente na tabela Outbox."""
        now_str = now_utc_iso()
        markup_str = json.dumps(reply_markup, ensure_ascii=False) if reply_markup else None

        with _db_lock, self._conn() as conn:
            cur = conn.execute("""
                INSERT INTO outbox (
                    chat_id, text, parse_mode, reply_markup, status, attempts,
                    max_attempts, next_retry_at, created_at, edit_message_id, fingerprint, repeat_count
                )
                VALUES (?, ?, ?, ?, 'PENDING', 0, 15, ?, ?, ?, ?, 1);
            """, (str(chat_id), text, parse_mode, markup_str, now_str, now_str, edit_message_id, fingerprint))
            return cur.lastrowid or 0

    def get_pending_outbox(self, limit: int = 10) -> list[dict[str, Any]]:
        """Recupera mensagens pendentes de envio cujo horário de retry já foi atingido."""
        now_str = now_utc_iso()
        with _db_lock, self._conn() as conn:
            rows = conn.execute("""
                SELECT * FROM outbox
                WHERE status IN ('PENDING', 'FAILED')
                  AND attempts < max_attempts
                  AND next_retry_at <= ?
                ORDER BY id ASC
                LIMIT ?;
            """, (now_str, limit)).fetchall()
            return [dict(r) for r in rows]

    def mark_outbox_sent(self, outbox_id: int, message_id: Optional[int] = None) -> bool:
        """Marca mensagem como entregue com sucesso à API do Telegram."""
        now_str = now_utc_iso()
        with _db_lock, self._conn() as conn:
            cur = conn.execute("""
                UPDATE outbox
                SET status = 'SENT',
                    sent_at = ?,
                    message_id = COALESCE(?, message_id),
                    error_message = NULL
                WHERE id = ?;
            """, (now_str, message_id, outbox_id))
            return cur.rowcount > 0

    def mark_outbox_failed(
        self,
        outbox_id: int,
        error_message: str,
        retry_delay_seconds: float = 15.0,
        permanent: bool = False
    ) -> bool:
        """Atualiza a tentativa falha e calcula o próximo momento de entrega."""
        now_dt = now_utc()
        import datetime as dt_mod
        next_retry = (now_dt + dt_mod.timedelta(seconds=retry_delay_seconds)).strftime("%Y-%m-%d %H:%M:%S")

        status_val = "PERMANENT_FAILED" if permanent else "FAILED"
        with _db_lock, self._conn() as conn:
            cur = conn.execute("""
                UPDATE outbox
                SET status = ?,
                    attempts = attempts + 1,
                    next_retry_at = ?,
                    error_message = ?
                WHERE id = ?;
            """, (status_val, next_retry, error_message, outbox_id))
            return cur.rowcount > 0

    def find_recent_fingerprint(self, fingerprint: str, window_seconds: int = 600) -> Optional[dict[str, Any]]:
        """Localiza mensagem enviada ou enfileirada recentemente com a mesma assinatura (anti-flood)."""
        if not fingerprint:
            return None
        import datetime as dt_mod
        cutoff = (now_utc() - dt_mod.timedelta(seconds=window_seconds)).strftime("%Y-%m-%d %H:%M:%S")

        with _db_lock, self._conn() as conn:
            row = conn.execute("""
                SELECT * FROM outbox
                WHERE fingerprint = ?
                  AND created_at >= ?
                ORDER BY id DESC LIMIT 1;
            """, (fingerprint, cutoff)).fetchone()
            return dict(row) if row else None

    def increment_outbox_repeat(self, outbox_id: int, updated_text: str) -> bool:
        """Incrementa o contador de repetições e atualiza o texto para edição in-place no Telegram."""
        with _db_lock, self._conn() as conn:
            cur = conn.execute("""
                UPDATE outbox
                SET repeat_count = repeat_count + 1,
                    text = ?
                WHERE id = ?;
            """, (updated_text, outbox_id))
            return cur.rowcount > 0

    # --- Estado Persistente do Bot (Fase 2) ---

    def get_bot_state(self, key: str, default: str = "") -> str:
        """Recupera valor de estado do bot (ex: offset de polling)."""
        with _db_lock, self._conn() as conn:
            row = conn.execute("SELECT value FROM bot_state WHERE key = ?;", (key,)).fetchone()
            return row["value"] if row else default

    def set_bot_state(self, key: str, value: str) -> None:
        """Grava ou atualiza estado do bot de forma durável."""
        now_str = now_utc_iso()
        with _db_lock, self._conn() as conn:
            conn.execute("""
                INSERT INTO bot_state (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
            """, (key, str(value), now_str))
