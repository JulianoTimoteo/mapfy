"""
Testes Unitários Abrangentes das Novas Capacidades do Sentinel v2:
- Fila durável Outbox e workers em background
- Comandos do Telegram e controle de acesso (RBAC)
- Anti-flood e agrupamento de repetições
- Dead Man's Switch e detecção de travamento (STALLED)
- Context manager de estágios e métricas do client
"""

import gc
import json
import tempfile
import time
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

from notifier.bot_commands import BotCommandHandler
from notifier.config import Config
from notifier.database import DatabaseManager
from notifier.monitor import ExtractionMonitor, ExtractionState
from notifier.telegram import TelegramClient
from integration.notifier_client import ExtractionReporter


class SentinelV2Tests(unittest.TestCase):
    """Bateria de testes das funcionalidades avançadas do Sentinel v2."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.db_path = Path(self.temp_dir.name) / "test_sentinel_v2.db"
        self.db = DatabaseManager(db_path=self.db_path)
        self.fake_token = "123456789:ABC_TEST_SENTINEL_TOKEN_12345"
        self.fake_chat_id = "12345678"
        self.telegram = TelegramClient(token=self.fake_token, chat_id=self.fake_chat_id, db=self.db)
        self.monitor = ExtractionMonitor(db=self.db, telegram=self.telegram)

        Config.TELEGRAM_BOT_TOKEN = self.fake_token
        Config.TELEGRAM_CHAT_ID = self.fake_chat_id
        Config.AUTHORIZED_USERS = {self.fake_chat_id: "admin", "87654321": "viewer"}
        Config.STAGE_STALL_SECONDS = 2
        Config.EXPECTED_INTERVAL_MINUTES = 60
        Config.DEAD_MAN_GRACE_MINUTES = 15

    def tearDown(self):
        gc.collect()
        self.temp_dir.cleanup()

    # --- Testes de Outbox Durável ---

    def test_outbox_queue_and_lifecycle(self):
        """Testa o enfileiramento, recuperação e conclusão de mensagens na outbox."""
        outbox_id = self.db.enqueue_outbox(
            chat_id=self.fake_chat_id,
            text="Mensagem de teste outbox",
            parse_mode="HTML",
            fingerprint="test_fp_01"
        )
        self.assertGreater(outbox_id, 0)

        pending = self.db.get_pending_outbox()
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["text"], "Mensagem de teste outbox")
        self.assertEqual(pending[0]["status"], "PENDING")

        # Marca como enviada
        ok = self.db.mark_outbox_sent(outbox_id, message_id=999)
        self.assertTrue(ok)

        # Não deve mais constar como pendente
        pending_after = self.db.get_pending_outbox()
        self.assertEqual(len(pending_after), 0)

    def test_anti_flood_fingerprint_and_repeat_count(self):
        """Valida que mensagens de erro repetidas dentro da janela são agrupadas."""
        run_id = "run_flood_01"
        self.monitor.start_extraction(run_id)

        with patch.object(self.telegram, "send_extraction_error") as mock_err:
            # 1º Erro: deve criar o incidente e disparar o alerta
            self.monitor.register_event(run_id, "ERROR", "downloader", "Connection timeout ao baixar planilha")
            self.assertEqual(mock_err.call_count, 1)

            # Simula que o alerta foi salvo na outbox com fingerprint
            fp = self.db.find_recent_fingerprint(
                fingerprint=self.db.get_open_incidents()[0]["description"][:10],  # Mock
                window_seconds=300
            )

            # 2º Erro idêntico logo em seguida: não deve re-chamar send_extraction_error
            self.monitor.register_event(run_id, "ERROR", "downloader", "Connection timeout ao baixar planilha")
            # call_count continua 1 (anti-flood atuou)
            self.assertEqual(mock_err.call_count, 1)

    # --- Testes de Detecção de STALLED ---

    def test_stalled_stage_detection(self):
        """Testa a transição para STALLED quando um estágio excede o tempo limite tolerável."""
        run_id = "run_stall_test"
        self.monitor.start_extraction(run_id)

        # Entra no estágio PROCESSAMENTO e simula passagem do tempo
        self.monitor.register_heartbeat(run_id, stage="PROCESSAMENTO")
        self.monitor._stage_entered_at = time.time() - 10  # 10s atrás (limite configurado: 2s)

        with patch.object(self.telegram, "send_stalled_alert") as mock_stall:
            self.monitor.check_heartbeats()
            self.assertEqual(self.monitor.current_state, ExtractionState.STALLED)
            mock_stall.assert_called_once()

    # --- Testes de Dead Man's Switch ---

    def test_dead_man_switch_triggers_on_prolonged_idle(self):
        """Testa se o Dead Man's Switch detecta quando nenhuma extração rodou no período esperado."""
        run_id = "run_past_done"
        past_start = datetime.now() - timedelta(minutes=100)
        past_end = datetime.now() - timedelta(minutes=80)  # Término há 80min (limite: 60+15 = 75min)

        self.db.create_extraction(run_id, "MAPFY-SERVER", past_start)
        self.db.finish_extraction(run_id, "COMPLETED", past_end)

        with patch.object(self.telegram, "send_dead_man_alert") as mock_dms:
            self.monitor.check_heartbeats()
            mock_dms.assert_called_once()
            # Incidente deve ter sido aberto no banco
            inc = self.db.get_open_incident(run_id, "DEAD_MAN_TRIGGERED")
            self.assertIsNotNone(inc)

    # --- Testes de Comandos e Permissões do Bot ---

    def test_bot_commands_access_control(self):
        """Verifica regras de autorização para comandos de consulta e ação."""
        handler = BotCommandHandler(db=self.db, monitor_engine=self.monitor, telegram_client=self.telegram)

        # 1. Usuário desconhecido (sem acesso)
        resp = handler.handle_command(user_id="999999", text="/status")
        self.assertIn("Acesso Negado", resp["text"])

        # 2. Viewer executando comando de leitura: permitido
        resp_view = handler.handle_command(user_id="87654321", text="/status")
        self.assertIn("Status Atual do Sentinel", resp_view["text"])

        # 3. Viewer tentando rodar comando restrito (/rodar_agora): proibido
        resp_act = handler.handle_command(user_id="87654321", text="/rodar_agora")
        self.assertIn("Ação restrita", resp_act["text"])

        # 4. Admin executando /ajuda: lista completa
        resp_admin = handler.handle_command(user_id=self.fake_chat_id, text="/ajuda")
        self.assertIn("MapFy Sentinel v2", resp_admin["text"])
        self.assertIn("reply_markup", resp_admin)

    def test_bot_silence_and_resume_flow(self):
        """Testa o silenciamento e reativação de notificações operacionais."""
        handler = BotCommandHandler(db=self.db, monitor_engine=self.monitor, telegram_client=self.telegram)

        # Silenciar por 15 minutos
        resp_silence = handler.handle_command(user_id=self.fake_chat_id, text="/silenciar 15")
        self.assertIn("Alertas Silenciados", resp_silence["text"])
        saved_silence = self.db.get_bot_state("silenced_until")
        self.assertTrue(bool(saved_silence))

        # Retomar alertas
        resp_resume = handler.handle_command(user_id=self.fake_chat_id, text="/retomar")
        self.assertIn("Alertas Reativados", resp_resume["text"])
        self.assertEqual(self.db.get_bot_state("silenced_until"), "")

    def test_bot_pairing_flow(self):
        """Valida o mecanismo de pareamento seguro por código de 6 dígitos."""
        handler = BotCommandHandler(db=self.db, monitor_engine=self.monitor, telegram_client=self.telegram)
        new_user = "5551234"

        # 1. Usuário solicita pareamento sem código: bot gera código
        resp_init = handler.handle_command(user_id=new_user, text="/parear")
        self.assertIn("Autenticação de Segurança", resp_init["text"])
        pair_code = self.db.get_bot_state("pair_code")
        self.assertEqual(len(pair_code), 6)

        # 2. Usuário submete o código gerado: promoção a administrador
        resp_confirm = handler.handle_command(user_id=new_user, text=f"/parear {pair_code}")
        self.assertIn("Pareamento Concluído com Sucesso", resp_confirm["text"])
        self.assertTrue(handler.is_user_admin(new_user))

    # --- Testes de Integração do Client (Stage Context Manager) ---

    def test_client_stage_context_manager(self):
        """Verifica o context manager stage e o envio de pulso enriquecido."""
        reporter = ExtractionReporter(base_url="http://127.0.0.1:8765", auto_heartbeat=False)

        with patch.object(reporter, "heartbeat") as mock_hb, patch.object(reporter, "event") as mock_ev:
            reporter.run_id = "run_stage_01"
            reporter._is_running = True

            with reporter.stage("LOGIN_PORTAL", progress=15.0, rows=0):
                pass

            # Heartbeat inicial de entrada no estágio
            mock_hb.assert_any_call(stage="LOGIN_PORTAL", progress=15.0, rows=0)
            # Eventos de entrada e saída
            self.assertGreaterEqual(mock_ev.call_count, 2)


if __name__ == "__main__":
    unittest.main()
