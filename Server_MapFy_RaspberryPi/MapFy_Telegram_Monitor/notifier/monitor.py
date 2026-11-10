import logging
import threading
import time
from datetime import datetime
from typing import Any, Optional

from notifier.config import Config
from notifier.database import DatabaseManager
from notifier.telegram import TelegramClient

logger = logging.getLogger("MapFyMonitorEngine")


class ExtractionState:
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    RUNNING_WITH_ERRORS = "RUNNING_WITH_ERRORS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    NO_HEARTBEAT = "NO_HEARTBEAT"
    RECOVERED = "RECOVERED"


class ExtractionMonitor:
    """Motor central de monitoramento da extração com controle de estados e thread de heartbeat."""

    def __init__(self, db: Optional[DatabaseManager] = None, telegram: Optional[TelegramClient] = None):
        self.db = db or DatabaseManager()
        self.telegram = telegram or TelegramClient()
        self._current_run_id: Optional[str] = None
        self._state: str = ExtractionState.IDLE
        self._watcher_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()

        # Restaura estado a partir do banco de dados (se houver extração ativa prévia)
        active = self.db.get_active_extraction()
        if active:
            self._current_run_id = active["run_id"]
            self._state = active["status"]
            logger.info("Monitor recuperou execução ativa prévia: %s (status: %s)", self._current_run_id, self._state)

    @property
    def current_state(self) -> str:
        with self._lock:
            return self._state

    @property
    def current_run_id(self) -> Optional[str]:
        with self._lock:
            return self._current_run_id

    def start_extraction(self, run_id: str, server_name: Optional[str] = None) -> dict[str, Any]:
        """Inicia o ciclo de monitoramento para uma nova execução."""
        srv = server_name or Config.SERVER_NAME
        start_dt = datetime.now()

        with self._lock:
            self._current_run_id = run_id
            self._state = ExtractionState.RUNNING
            ext_data = self.db.create_extraction(run_id, srv, start_dt)

        # Dispara notificação Telegram de forma não-bloqueante/segura
        try:
            if self.telegram.is_configured:
                self.telegram.send_extraction_started(start_dt, srv)
        except Exception as e:
            logger.warning("Falha ao enviar notificação de início ao Telegram: %s", e)

        return ext_data

    def register_event(
        self,
        run_id: str,
        level: str,
        origin: str,
        message: str,
        details: Optional[str] = None
    ) -> int:
        """Registra um evento ou erro ocorrido durante a extração."""
        with self._lock:
            event_id = self.db.add_event(run_id, level, origin, message, details)
            if level.upper() in ("ERROR", "CRITICAL"):
                if self._state == ExtractionState.RUNNING:
                    self._state = ExtractionState.RUNNING_WITH_ERRORS

        # Se for erro crítico/exceção, dispara alerta de erro ao Telegram
        if level.upper() in ("ERROR", "CRITICAL"):
            try:
                if self.telegram.is_configured:
                    self.telegram.send_extraction_error(
                        origin=origin,
                        message=message,
                        error_type="EXCEÇÃO PYTHON" if "Traceback" in (details or "") else "ERRO OPERACIONAL",
                        is_interrupted=False
                    )
            except Exception as e:
                logger.warning("Falha ao enviar notificação de erro ao Telegram: %s", e)

        return event_id

    def register_heartbeat(self, run_id: str) -> bool:
        """Registra o pulso de vida enviado pelo extrator."""
        with self._lock:
            # Proteção: se o run_id já foi finalizado, não aceita reativação por pulso atrasado
            run_data = self.db.get_extraction(run_id)
            if not run_data or run_data["status"] in (ExtractionState.COMPLETED, ExtractionState.FAILED):
                logger.warning("Heartbeat descartado para execução já finalizada ou inexistente: %s", run_id)
                return False

            now = datetime.now()
            updated = self.db.update_heartbeat(run_id, now)

            # Se estava em NO_HEARTBEAT, houve recuperação!
            if self._state == ExtractionState.NO_HEARTBEAT:
                incident = self.db.get_open_incident(run_id, "NO_HEARTBEAT")
                if incident:
                    self.db.close_incident(incident["id"], now)

                self._state = ExtractionState.RECOVERED
                self.db.update_status(run_id, ExtractionState.RECOVERED)
                logger.info("Execução %s recuperada após interrupção!", run_id)

                try:
                    if self.telegram.is_configured:
                        self.telegram.send_recovery_notification(now)
                except Exception as e:
                    logger.warning("Falha ao enviar notificação de recuperação ao Telegram: %s", e)

                # Volta ao estado de execução (ou com erros caso já tenha havido)
                has_errors = run_data.get("error_count", 0) > 0
                new_state = ExtractionState.RUNNING_WITH_ERRORS if has_errors else ExtractionState.RUNNING
                self._state = new_state
                self.db.update_status(run_id, new_state)

            return updated

    def finish_extraction(
        self,
        run_id: str,
        status: str,
        summary: Optional[dict[str, Any]] = None
    ) -> Optional[dict[str, Any]]:
        """Conclui a extração, calcula métricas e envia relatório consolidado."""
        end_dt = datetime.now()
        normalized_status = status.upper()

        with self._lock:
            # Se havia incidente de NO_HEARTBEAT aberto, encerra-o
            incident = self.db.get_open_incident(run_id, "NO_HEARTBEAT")
            if incident:
                self.db.close_incident(incident["id"], end_dt)

            ext_data = self.db.finish_extraction(run_id, normalized_status, end_dt, summary)
            if not ext_data:
                return None

            self._state = normalized_status
            self._current_run_id = None

        # Dispara relatório final ao Telegram
        try:
            if self.telegram.is_configured:
                start_dt = datetime.strptime(ext_data["start_time"], "%Y-%m-%d %H:%M:%S")
                duration = ext_data.get("duration_seconds")
                errors = ext_data.get("error_count", 0)

                result_text = None
                if normalized_status == ExtractionState.COMPLETED and errors == 0:
                    result_text = "SUCESSO"
                elif normalized_status == ExtractionState.COMPLETED and errors > 0:
                    result_text = "CONCLUÍDA COM ERROS"
                elif normalized_status == ExtractionState.FAILED:
                    result_text = "FALHA"

                self.telegram.send_extraction_finished(
                    start_time=start_dt,
                    end_time=end_dt,
                    duration_seconds=duration,
                    error_count=errors,
                    result_override=result_text
                )
        except Exception as e:
            logger.warning("Falha ao enviar relatório de finalização ao Telegram: %s", e)

        return ext_data

    def check_heartbeats(self) -> None:
        """Verifica a expiração de heartbeat das execuções ativas."""
        active = self.db.get_active_extraction()
        if not active:
            with self._lock:
                if self._state not in (ExtractionState.COMPLETED, ExtractionState.FAILED):
                    self._state = ExtractionState.IDLE
                    self._current_run_id = None
            return

        run_id = active["run_id"]
        status = active["status"]
        last_hb_str = active["last_heartbeat"]

        try:
            last_hb_dt = datetime.strptime(last_hb_str, "%Y-%m-%d %H:%M:%S")
        except Exception:
            return

        elapsed = (datetime.now() - last_hb_dt).total_seconds()

        # Se passou o timeout (180s) e ainda estava em RUNNING ou RUNNING_WITH_ERRORS
        if elapsed > Config.HEARTBEAT_TIMEOUT_SECONDS:
            if status in (ExtractionState.RUNNING, ExtractionState.RUNNING_WITH_ERRORS, ExtractionState.RECOVERED):
                with self._lock:
                    self._state = ExtractionState.NO_HEARTBEAT
                    self.db.update_status(run_id, ExtractionState.NO_HEARTBEAT)

                # Abre incidente no SQLite
                desc = f"Heartbeat ausente há {int(elapsed)} segundos (limite: {Config.HEARTBEAT_TIMEOUT_SECONDS}s)"
                incident_id = self.db.open_incident(run_id, "NO_HEARTBEAT", desc)

                # Se ainda não enviou alerta deste incidente, envia
                incident = self.db.get_open_incident(run_id, "NO_HEARTBEAT")
                if incident and incident.get("alert_sent") == 0:
                    try:
                        if self.telegram.is_configured:
                            self.telegram.send_extraction_interrupted(last_hb_dt, elapsed)
                            self.db.mark_incident_alert_sent(incident_id)
                            logger.warning("Alerta de interrupção enviado ao Telegram para run_id: %s", run_id)
                    except Exception as e:
                        logger.warning("Falha ao enviar alerta de interrupção ao Telegram: %s", e)

    def _watcher_loop(self) -> None:
        """Loop contínuo em thread secundária que monitora heartbeats."""
        logger.info("Iniciando watcher de heartbeat (intervalo: %ds, timeout: %ds)",
                    Config.HEARTBEAT_CHECK_INTERVAL_SECONDS, Config.HEARTBEAT_TIMEOUT_SECONDS)
        while not self._stop_event.is_set():
            try:
                self.check_heartbeats()
            except Exception as e:
                logger.error("Erro no watcher de heartbeat: %s", e)

            # Espera o intervalo em fatias curtas para responder rápido ao shutdown
            interval = Config.HEARTBEAT_CHECK_INTERVAL_SECONDS
            for _ in range(int(interval * 2)):
                if self._stop_event.is_set():
                    break
                time.sleep(0.5)

    def start_background_watcher(self) -> None:
        """Inicia a thread de monitoramento em segundo plano."""
        if self._watcher_thread and self._watcher_thread.is_alive():
            return
        self._stop_event.clear()
        self._watcher_thread = threading.Thread(target=self._watcher_loop, daemon=True, name="MapFyHeartbeatWatcher")
        self._watcher_thread.start()

    def stop_background_watcher(self) -> None:
        """Encerra a thread de monitoramento."""
        self._stop_event.set()
        if self._watcher_thread and self._watcher_thread.is_alive():
            self._watcher_thread.join(timeout=3.0)
