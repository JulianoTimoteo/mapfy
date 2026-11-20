"""
Cliente de Integração e Observabilidade do Extrator Mapfy - Sentinel v2.
Fornece rastreamento de ciclo de vida, estágios, métricas e heartbeat tolerante a falhas.
"""

from __future__ import annotations

import functools
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
import uuid
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Callable, Generator, Optional

logger = logging.getLogger("mapfy.reporter_client")


class ExtractionReporter:
    """
    Cliente desacoplado e tolerante a falhas para comunicação com o MapFy Sentinel.
    Garante que eventuais falhas de rede ou no monitor jamais interrompam a extração real.
    """

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8765",
        api_key: Optional[str] = None,
        server_name: str = "MAPFY-EXTRACTOR",
        auto_heartbeat: bool = True,
        heartbeat_interval: int = 60
    ) -> None:
        self.base_url = base_url.rstrip("/")
        # Resolução de chave com fallback retrocompatível para a automação
        self.api_key = (api_key or os.getenv("MONITOR_API_KEY", "mapfy_monitor_secret_key_2026")).strip()
        self.server_name = server_name
        self.auto_heartbeat = auto_heartbeat
        self.heartbeat_interval = heartbeat_interval

        self.run_id: Optional[str] = None
        self._is_running = False
        self._current_stage: str = "START"
        self._current_progress: float = 0.0
        self._current_rows: int = 0

        self._heartbeat_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self._sent_errors: set[str] = set()

    def _post(self, endpoint: str, payload: dict[str, Any], timeout: float = 5.0) -> Optional[dict[str, Any]]:
        """Executa POST HTTP para o Sentinel com tolerância absoluta a falhas."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {
            "Content-Type": "application/json; charset=utf-8",
            "X-API-Key": self.api_key
        }
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

        try:
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = resp.read().decode("utf-8")
                return json.loads(data)
        except Exception as e:
            # Nunca propaga exceção para proteger o processo crítico de extração do Mapfy
            logger.debug("Monitoramento indisponível ou erro na requisição (%s): %s", endpoint, e)
            return None

    def start(self, run_id: Optional[str] = None) -> str:
        """Inicia o ciclo de monitoramento da extração."""
        with self._lock:
            if self._is_running and self.run_id:
                logger.warning("Reporter já está em execução para o run_id: %s", self.run_id)
                return self.run_id

            self.run_id = run_id or f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
            self._is_running = True
            self._current_stage = "START"
            self._sent_errors.clear()

        # Envia evento de início para a API
        payload = {
            "run_id": self.run_id,
            "server_name": self.server_name
        }
        self._post("/extraction/start", payload)

        # Inicia thread de heartbeat automático se solicitado
        if self.auto_heartbeat:
            self._stop_event.clear()
            self._heartbeat_thread = threading.Thread(
                target=self._heartbeat_loop,
                daemon=True,
                name="SentinelClientHeartbeat"
            )
            self._heartbeat_thread.start()

        return self.run_id

    def event(
        self,
        level: str = "INFO",
        message: str = "",
        origin: str = "mapfy_extractor",
        details: Optional[str] = None
    ) -> bool:
        """Registra um evento ou erro ocorrido durante a extração."""
        with self._lock:
            if not self._is_running or not self.run_id:
                return False

            # Prevenção de flood local em memória
            if level.upper() in ("ERROR", "CRITICAL"):
                fingerprint = f"{origin}::{message[:100]}"
                if fingerprint in self._sent_errors:
                    return False
                self._sent_errors.add(fingerprint)

            current_run_id = self.run_id

        payload = {
            "run_id": current_run_id,
            "level": level.upper(),
            "origin": origin,
            "message": message,
            "details": details
        }
        res = self._post("/extraction/event", payload)
        return bool(res and res.get("success"))

    def heartbeat(
        self,
        stage: Optional[str] = None,
        progress: Optional[float] = None,
        rows: Optional[int] = None
    ) -> bool:
        """
        Dispara pulso de vida da extração, informando opcionalmente estágio, progresso e linhas.
        """
        with self._lock:
            if not self._is_running or not self.run_id:
                return False
            current_run_id = self.run_id
            if stage:
                self._current_stage = stage
            if progress is not None:
                self._current_progress = progress
            if rows is not None:
                self._current_rows = rows

            current_stage = self._current_stage
            current_prog = self._current_progress
            current_rw = self._current_rows

        payload: dict[str, Any] = {
            "run_id": current_run_id,
            "stage": current_stage,
            "progress": current_prog,
            "rows": current_rw
        }
        res = self._post("/extraction/heartbeat", payload, timeout=3.0)
        return bool(res and res.get("success"))

    @contextmanager
    def stage(
        self,
        stage_name: str,
        progress: Optional[float] = None,
        rows: Optional[int] = None
    ) -> Generator[ExtractionReporter, None, None]:
        """
        Context manager para marcar o início e encerramento de um estágio da automação.
        Garante que o monitor Sentinel saiba exatamente qual etapa está em andamento.
        """
        prev_stage = self._current_stage
        self.heartbeat(stage=stage_name, progress=progress, rows=rows)
        self.event(level="INFO", message=f"Entrando no estágio: {stage_name}")
        t0 = time.time()
        try:
            yield self
        except Exception as exc:
            import traceback
            tb = traceback.format_exc()
            self.event(
                level="ERROR",
                message=f"Falha no estágio '{stage_name}': {exc}",
                details=tb
            )
            raise
        finally:
            elapsed = time.time() - t0
            self.event(level="INFO", message=f"Estágio concluído: {stage_name} ({elapsed:.1f}s)")
            self.heartbeat(stage=prev_stage)

    def finish(self, status: str = "COMPLETED", summary: Optional[dict[str, Any]] = None) -> bool:
        """Encerra o monitoramento da extração e envia relatório analítico final."""
        with self._lock:
            if not self._is_running or not self.run_id:
                return False
            current_run_id = self.run_id
            self._is_running = False

        # Para o loop de heartbeat
        self._stop_event.set()
        if self._heartbeat_thread and self._heartbeat_thread.is_alive():
            self._heartbeat_thread.join(timeout=2.0)

        payload = {
            "run_id": current_run_id,
            "status": status.upper(),
            "summary": summary
        }
        res = self._post("/extraction/finish", payload)
        return bool(res and res.get("success"))

    def _heartbeat_loop(self) -> None:
        """Loop em background que envia pulsos periódicos de vida."""
        while not self._stop_event.is_set():
            for _ in range(int(self.heartbeat_interval * 2)):
                if self._stop_event.is_set():
                    return
                time.sleep(0.5)

            if not self._stop_event.is_set():
                self.heartbeat()

    def monitored(self, func: Callable[..., Any]) -> Callable[..., Any]:
        """Decorator para monitorar automaticamente a execução de uma função."""
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            with self:
                return func(*args, **kwargs)
        return wrapper

    def __enter__(self) -> ExtractionReporter:
        self.start()
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        if exc_type:
            import traceback
            tb_str = "".join(traceback.format_exception(exc_type, exc_val, exc_tb))
            self.event(
                level="ERROR",
                message=str(exc_val) or "Exceção não tratada na extração",
                details=tb_str
            )
            self.finish(status="FAILED")
        else:
            self.finish(status="COMPLETED")
        return False
