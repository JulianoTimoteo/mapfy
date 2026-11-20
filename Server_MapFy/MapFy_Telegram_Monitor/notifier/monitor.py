"""
Motor Central de Monitoramento e Máquina de Estados da Extração - Sentinel v2.
Inclui detecção de STALLED, Dead Man's Switch, Anti-Flood de Erros e Métricas Comparativas.
"""

from __future__ import annotations

import hashlib
import json
import logging
import statistics
import threading
import time
from datetime import datetime, timedelta
from typing import Any, Optional

from notifier.config import Config
from notifier.database import DatabaseManager, now_utc
from notifier.telegram import TelegramClient

logger = logging.getLogger("mapfy.monitor")


class ExtractionState:
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    RUNNING_WITH_ERRORS = "RUNNING_WITH_ERRORS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    NO_HEARTBEAT = "NO_HEARTBEAT"
    STALLED = "STALLED"
    RECOVERED = "RECOVERED"


class ExtractionMonitor:
    """Motor de observabilidade operacional da extração Mapfy."""

    def __init__(self, db: Optional[DatabaseManager] = None, telegram: Optional[TelegramClient] = None):
        self.db = db or DatabaseManager()
        self.telegram = telegram or TelegramClient()
        self._current_run_id: Optional[str] = None
        self._state: str = ExtractionState.IDLE
        self._watcher_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()

        # Rastreamento de estágio para detecção de STALLED
        self._current_stage: str = "START"
        self._stage_entered_at: float = time.time()

        # Restaura estado a partir do banco de dados (se houver extração ativa prévia)
        active = self.db.get_active_extraction()
        if active:
            self._current_run_id = active["run_id"]
            self._state = active["status"]
            self._current_stage = active.get("stage") or "START"
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
            self._current_stage = "START"
            self._stage_entered_at = time.time()
            ext_data = self.db.create_extraction(run_id, srv, start_dt)

        # Dispara notificação Telegram
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
        """
        Registra um evento ou erro com deduplicação anti-flood e enriquecimento de incidentes.
        """
        with self._lock:
            event_id = self.db.add_event(run_id, level, origin, message, details)
            if level.upper() in ("ERROR", "CRITICAL"):
                if self._state == ExtractionState.RUNNING:
                    self._state = ExtractionState.RUNNING_WITH_ERRORS

        if level.upper() in ("ERROR", "CRITICAL"):
            try:
                # Anti-flood: gera fingerprint (SHA-256 reduzido)
                raw_sig = f"{origin}:{message[:120]}"
                fingerprint = hashlib.sha256(raw_sig.encode("utf-8")).hexdigest()[:16]

                # Abre incidente no banco
                incident_id = self.db.open_incident(
                    run_id=run_id,
                    incident_type=f"ERROR_{origin.upper()}",
                    description=message[:200]
                )

                # Verifica se houve ocorrência recente na janela de 5 minutos
                recent = self.db.find_recent_fingerprint(fingerprint, window_seconds=300)
                if recent:
                    # Mensagem repetida: incrementa contador de repetições
                    repeat_cnt = recent.get("repeat_count", 1) + 1
                    updated_txt = (
                        f"{recent['text']}\n\n"
                        f"<i>🔁 [Ocorreu mais {repeat_cnt - 1}x — Última: {datetime.now().strftime('%H:%M:%S')}]</i>"
                    )
                    self.db.increment_outbox_repeat(recent["id"], updated_txt)

                    # Se já havia sido entregue, atualiza a mensagem original no Telegram
                    if recent.get("message_id") and self.telegram.is_configured:
                        try:
                            self.telegram.edit_message_text(
                                chat_id=recent["chat_id"],
                                message_id=recent["message_id"],
                                text=updated_txt,
                                parse_mode="HTML"
                            )
                        except Exception:
                            pass
                else:
                    # Registra ocorrência na tabela outbox com o fingerprint para deduplicação
                    outbox_id = self.db.enqueue_outbox(
                        chat_id=Config.TELEGRAM_CHAT_ID or "0",
                        text=f"MAPFY — ERRO: {origin} - {message[:120]}",
                        fingerprint=fingerprint
                    )
                    if self.telegram.is_configured:
                        send_res = self.telegram.send_extraction_error(
                            origin=origin,
                            message=message,
                            error_type="EXCEÇÃO PYTHON" if "Traceback" in (details or "") else "ERRO OPERACIONAL",
                            is_interrupted=False,
                            incident_id=incident_id
                        )
                        self.db.mark_incident_alert_sent(incident_id)
                        if isinstance(send_res, dict) and "result" in send_res:
                            msg_id = send_res.get("result", {}).get("message_id")
                            if msg_id:
                                self.db.mark_outbox_sent(outbox_id, msg_id)

            except Exception as e:
                logger.warning("Falha ao processar notificação de erro: %s", e)

        return event_id

    def register_heartbeat(
        self,
        run_id: str,
        stage: Optional[str] = None,
        progress: Optional[float] = None,
        rows: Optional[int] = None
    ) -> bool:
        """
        Registra o pulso de vida, dados de progresso e detecta recuperação de falhas.
        """
        with self._lock:
            run_data = self.db.get_extraction(run_id)
            if not run_data or run_data["status"] in (ExtractionState.COMPLETED, ExtractionState.FAILED):
                logger.warning("Heartbeat descartado para execução já finalizada ou inexistente: %s", run_id)
                return False

            now = datetime.now()

            # Rastreamento de estágio
            if stage and stage != self._current_stage:
                self._current_stage = stage
                self._stage_entered_at = time.time()

            updated = self.db.update_heartbeat(
                run_id=run_id,
                heartbeat_time=now,
                stage=stage,
                progress=progress,
                rows=rows
            )

            # Recuperação de NO_HEARTBEAT ou STALLED
            if self._state in (ExtractionState.NO_HEARTBEAT, ExtractionState.STALLED):
                # Fecha incidentes correspondentes
                for inc_type in ("NO_HEARTBEAT", "STAGE_STALLED"):
                    inc = self.db.get_open_incident(run_id, inc_type)
                    if inc:
                        self.db.close_incident(inc["id"], now)

                self._state = ExtractionState.RECOVERED
                self.db.update_status(run_id, ExtractionState.RECOVERED)
                logger.info("Execução %s recuperada com sucesso!", run_id)

                try:
                    if self.telegram.is_configured:
                        self.telegram.send_recovery_notification(now)
                except Exception as e:
                    logger.warning("Falha ao enviar notificação de recuperação: %s", e)

                # Retorna ao estado RUNNING (ou RUNNING_WITH_ERRORS se houve erros prévios)
                has_errors = run_data.get("error_count", 0) > 0
                new_state = ExtractionState.RUNNING_WITH_ERRORS if has_errors else ExtractionState.RUNNING
                self._state = new_state
                self.db.update_status(run_id, new_state)

            return updated

    def finish_extraction(
        self,
        run_id: str,
        status: str = ExtractionState.COMPLETED,
        summary: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        """Finaliza a extração e envia relatório analítico comparativo."""
        end_dt = datetime.now()

        # Normaliza status
        normalized_status = status.upper()
        if normalized_status not in (ExtractionState.COMPLETED, ExtractionState.FAILED):
            normalized_status = ExtractionState.COMPLETED

        with self._lock:
            ext_data = self.db.finish_extraction(run_id, normalized_status, end_dt, summary=summary)
            self._state = normalized_status
            self._current_run_id = None

        # Fecha eventuais incidentes que tenham ficado abertos nesta execução
        for inc in self.db.get_open_incidents():
            if inc.get("run_id") == run_id:
                self.db.close_incident(inc["id"], end_dt)

        # Cálculo de mediana histórica para contextualizar volume de dados
        enrich_summary = dict(summary or {})
        try:
            recent_runs = self.db.get_recent_extractions(limit=10)
            rows_history = [
                r.get("rows", 0) for r in recent_runs
                if r.get("status") == ExtractionState.COMPLETED and r.get("rows", 0) > 0
            ]
            if len(rows_history) >= 3:
                median_rows = statistics.median(rows_history)
                current_rows = ext_data.get("rows") or enrich_summary.get("total_registros", 0)
                if median_rows > 0 and current_rows > 0:
                    diff_pct = ((current_rows - median_rows) / median_rows) * 100
                    signal = "+" if diff_pct >= 0 else ""
                    enrich_summary["comparativo_mediana"] = f"{signal}{diff_pct:.1f}% em relação à mediana histórica ({int(median_rows):,} linhas)"
        except Exception:
            pass

        # Dispara relatório final ao Telegram
        try:
            if self.telegram.is_configured:
                start_dt = datetime.strptime(ext_data["start_time"], "%Y-%m-%d %H:%M:%S")
                duration = ext_data.get("duration_seconds", 0.0)
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
                    result_override=result_text,
                    summary=enrich_summary
                )
        except Exception as e:
            logger.warning("Falha ao enviar relatório de finalização: %s", e)

        return ext_data

    def check_heartbeats(self) -> None:
        """
        Verifica a expiração de heartbeat, travamento de estágio (STALLED) e Dead Man's Switch.
        """
        active = self.db.get_active_extraction()

        # 1. Se nenhuma execução estiver ativa, valida Dead Man's Switch
        if not active:
            with self._lock:
                if self._state not in (ExtractionState.COMPLETED, ExtractionState.FAILED):
                    self._state = ExtractionState.IDLE
                    self._current_run_id = None

            self._check_dead_man_switch()
            return

        run_id = active["run_id"]
        status = active["status"]
        last_hb_str = active["last_heartbeat"]

        try:
            last_hb_dt = datetime.strptime(last_hb_str, "%Y-%m-%d %H:%M:%S")
        except Exception:
            return

        now = datetime.now()
        elapsed_hb = (now - last_hb_dt).total_seconds()

        # 2. Checagem de Timeout de Heartbeat (Interrupção)
        if elapsed_hb > Config.HEARTBEAT_TIMEOUT_SECONDS:
            if status in (ExtractionState.RUNNING, ExtractionState.RUNNING_WITH_ERRORS, ExtractionState.RECOVERED):
                with self._lock:
                    self._state = ExtractionState.NO_HEARTBEAT
                    self.db.update_status(run_id, ExtractionState.NO_HEARTBEAT)

                desc = f"Heartbeat ausente há {int(elapsed_hb)}s (limite: {Config.HEARTBEAT_TIMEOUT_SECONDS}s)"
                incident_id = self.db.open_incident(run_id, "NO_HEARTBEAT", desc)

                incident = self.db.get_open_incident(run_id, "NO_HEARTBEAT")
                if incident and incident.get("alert_sent") == 0:
                    try:
                        if self.telegram.is_configured:
                            self.telegram.send_extraction_interrupted(
                                last_heartbeat=last_hb_dt,
                                elapsed_seconds=elapsed_hb,
                                incident_id=incident_id
                            )
                            self.db.mark_incident_alert_sent(incident_id)
                            logger.warning("Alerta de interrupção enviado ao Telegram para run_id: %s", run_id)
                    except Exception as e:
                        logger.warning("Falha ao enviar alerta de interrupção ao Telegram: %s", e)
            return

        # 3. Checagem de Estagnação de Estágio (STALLED)
        if status in (ExtractionState.RUNNING, ExtractionState.RUNNING_WITH_ERRORS):
            elapsed_stage = time.time() - self._stage_entered_at
            if elapsed_stage > Config.STAGE_STALL_SECONDS:
                with self._lock:
                    self._state = ExtractionState.STALLED
                    self.db.update_status(run_id, ExtractionState.STALLED)

                desc = f"Estágio '{self._current_stage}' estagnado há {int(elapsed_stage)}s (limite: {Config.STAGE_STALL_SECONDS}s)"
                incident_id = self.db.open_incident(run_id, "STAGE_STALLED", desc)

                incident = self.db.get_open_incident(run_id, "STAGE_STALLED")
                if incident and incident.get("alert_sent") == 0:
                    try:
                        if self.telegram.is_configured:
                            self.telegram.send_stalled_alert(run_id, self._current_stage, elapsed_stage)
                            self.db.mark_incident_alert_sent(incident_id)
                            logger.warning("Alerta de estágio STALLED enviado ao Telegram para run_id: %s", run_id)
                    except Exception as e:
                        logger.warning("Falha ao enviar alerta de STALLED: %s", e)

    def _check_dead_man_switch(self) -> None:
        """Verifica se o tempo sem nenhuma execução excedeu o limite tolerável."""
        latest = self.db.get_latest_extraction()
        if not latest or not latest.get("end_time"):
            return

        try:
            end_dt = datetime.strptime(latest["end_time"], "%Y-%m-%d %H:%M:%S")
            elapsed_mins = int((datetime.now() - end_dt).total_seconds() // 60)
            threshold_mins = Config.EXPECTED_INTERVAL_MINUTES + Config.DEAD_MAN_GRACE_MINUTES

            if elapsed_mins > threshold_mins:
                # Abre incidente DEAD_MAN_TRIGGERED se já não estiver aberto
                inc = self.db.get_open_incident(latest["run_id"], "DEAD_MAN_TRIGGERED")
                if not inc:
                    desc = f"Inatividade de {elapsed_mins}m excede limite de {threshold_mins}m"
                    inc_id = self.db.open_incident(latest["run_id"], "DEAD_MAN_TRIGGERED", desc)
                    if self.telegram.is_configured:
                        try:
                            self.telegram.send_dead_man_alert(elapsed_mins, Config.EXPECTED_INTERVAL_MINUTES)
                            self.db.mark_incident_alert_sent(inc_id)
                            logger.critical("Alerta de Dead Man's Switch disparado ao Telegram!")
                        except Exception as e:
                            logger.warning("Falha ao enviar alerta de Dead Man's Switch: %s", e)
        except Exception as e:
            logger.debug("Erro na checagem do Dead Man's Switch: %s", e)

    def _watcher_loop(self) -> None:
        """Loop contínuo em thread secundária que monitora heartbeats periodicamente."""
        logger.info(
            "Iniciando watcher de monitoramento (intervalo: %ds, timeout: %ds, stall: %ds)",
            Config.HEARTBEAT_CHECK_INTERVAL_SECONDS,
            Config.HEARTBEAT_TIMEOUT_SECONDS,
            Config.STAGE_STALL_SECONDS
        )
        while not self._stop_event.is_set():
            try:
                self.check_heartbeats()
            except Exception as e:
                logger.error("Erro inesperado no ciclo de checagem do monitor: %s", e)

            self._stop_event.wait(Config.HEARTBEAT_CHECK_INTERVAL_SECONDS)

    def start_watcher(self) -> None:
        """Inicia a thread de monitoramento contínuo em background."""
        with self._lock:
            if self._watcher_thread and self._watcher_thread.is_alive():
                return
            self._stop_event.clear()
            self._watcher_thread = threading.Thread(
                target=self._watcher_loop,
                name="SentinelWatcher",
                daemon=True
            )
            self._watcher_thread.start()
            logger.info("Watcher do monitor iniciado com sucesso.")

    def stop_watcher(self) -> None:
        """Sinaliza parada ordenada da thread de monitoramento."""
        with self._lock:
            self._stop_event.set()
            if self._watcher_thread and self._watcher_thread.is_alive():
                self._watcher_thread.join(timeout=2.0)
            logger.info("Watcher do monitor encerrado.")
