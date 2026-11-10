import json
import logging
import threading
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger("MapFyReporterClient")


class ExtractionReporter:
    """
    Cliente desacoplado e tolerante a falhas para comunicação com o MapFy Telegram Monitor.
    Garante que falhas de rede ou monitoramento nunca interrompam a extração do MapFy.
    """

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8765",
        api_key: str = "mapfy_monitor_secret_key_2026",
        server_name: str = "MAPFY-EXTRACTOR",
        auto_heartbeat: bool = True,
        heartbeat_interval: int = 60
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.server_name = server_name
        self.auto_heartbeat = auto_heartbeat
        self.heartbeat_interval = heartbeat_interval

        self.run_id: Optional[str] = None
        self._is_running = False
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self._sent_errors: set[str] = set()

    def _post(self, endpoint: str, payload: dict[str, Any], timeout: float = 5.0) -> Optional[dict[str, Any]]:
        """Executa POST HTTP para o microservidor local com tolerância absoluta a falhas."""
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
            # Nunca propaga exceção para proteger o processo de extração do MapFy
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
                name="MapFyClientHeartbeat"
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

            # Prevenção de duplicidade para mensagens de erro idênticas
            if level.upper() in ("ERROR", "CRITICAL"):
                fingerprint = f"{origin}::{message}"
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

    def heartbeat(self) -> bool:
        """Dispara manualmente um pulso de vida da extração."""
        with self._lock:
            if not self._is_running or not self.run_id:
                return False
            current_run_id = self.run_id

        payload = {"run_id": current_run_id}
        res = self._post("/extraction/heartbeat", payload, timeout=3.0)
        return bool(res and res.get("success"))

    def finish(self, status: str = "COMPLETED", summary: Optional[dict[str, Any]] = None) -> bool:
        """Encerra o monitoramento da extração e envia relatório final."""
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
            # Espera o intervalo em fatias curtas para desligar rápido
            for _ in range(int(self.heartbeat_interval * 2)):
                if self._stop_event.is_set():
                    return
                time.sleep(0.5)

            if not self._stop_event.is_set():
                self.heartbeat()

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
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
