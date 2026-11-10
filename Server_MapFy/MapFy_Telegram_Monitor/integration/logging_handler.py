import logging
import traceback
from typing import Optional
from integration.notifier_client import ExtractionReporter


class TelegramMonitorLoggingHandler(logging.Handler):
    """
    Handler para integração com o logging padrão do Python.
    Intercepta automaticamente logs com nível ERROR e CRITICAL e os envia ao monitor.
    """

    def __init__(self, reporter: ExtractionReporter, level: int = logging.ERROR):
        super().__init__(level=level)
        self.reporter = reporter
        self._in_emit = False

    def emit(self, record: logging.LogRecord) -> None:
        # Previne recursão infinita se o envio gerar log
        if self._in_emit:
            return

        # Ignora logs gerados pelo próprio módulo de monitoramento
        if record.name.startswith("MapFy") or record.name.startswith("urllib"):
            return

        self._in_emit = True
        try:
            details: Optional[str] = None
            if record.exc_info:
                details = "".join(traceback.format_exception(*record.exc_info))

            level_name = "CRITICAL" if record.levelno >= logging.CRITICAL else "ERROR"
            message = record.getMessage()

            self.reporter.event(
                level=level_name,
                origin=record.name or "mapfy_extractor",
                message=message,
                details=details
            )
        except Exception:
            # Nunca propaga exceção a partir do logging handler
            self.handleError(record)
        finally:
            self._in_emit = False
