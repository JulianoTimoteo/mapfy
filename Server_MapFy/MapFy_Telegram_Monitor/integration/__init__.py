"""
MapFy Telegram Monitor - Integration Package
Cliente desacoplado e resiliente para comunicação entre o extrator e o monitor.
"""
from integration.notifier_client import ExtractionReporter
from integration.logging_handler import TelegramMonitorLoggingHandler

__all__ = ["ExtractionReporter", "TelegramMonitorLoggingHandler"]
