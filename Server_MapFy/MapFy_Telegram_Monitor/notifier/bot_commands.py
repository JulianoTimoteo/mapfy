"""
Módulo de Comandos do Bot Telegram - Sentinel v2.
Implementa a lógica de atendimento e formatação para todos os comandos operacionais.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

try:
    import psutil  # type: ignore
except ImportError:
    psutil = None

from notifier.config import Config, redact_token
from notifier.database import DatabaseManager, now_utc, to_local_str

logger = logging.getLogger("mapfy.bot_commands")

START_TIME_PROCESS = time.time()


class BotCommandHandler:
    """Gerenciador central de comandos e respostas do Telegram Bot."""

    def __init__(self, db: DatabaseManager, monitor_engine: Any, telegram_client: Any) -> None:
        self.db = db
        self.monitor = monitor_engine
        self.telegram = telegram_client

    def is_user_admin(self, user_id: str | int) -> bool:
        """Verifica se o usuário possui permissão de administrador."""
        role = Config.AUTHORIZED_USERS.get(str(user_id), "").lower()
        return role == "admin"

    def is_user_authorized(self, user_id: str | int, username: str = "") -> bool:
        """Verifica se o usuário tem acesso (admin ou viewer)."""
        uid = str(user_id)
        if uid in Config.AUTHORIZED_USERS:
            return True
        if username and f"@{username.lstrip('@')}" in Config.AUTHORIZED_USERS:
            return True
        # Se nenhuma lista foi definida, aceita o primeiro que parear
        return len(Config.AUTHORIZED_USERS) == 0

    def handle_command(self, user_id: str | int, text: str, username: str = "") -> dict[str, Any]:
        """Roteia e executa um comando vindo do chat do Telegram."""
        clean_text = text.strip()
        parts = clean_text.split()
        if not parts:
            return {"text": "Comando não reconhecido. Digite /ajuda para ver as opções."}

        cmd = parts[0].split("@")[0].lower()  # Remove menção @botname se houver
        args = parts[1:]

        # Validação de acesso
        if not self.is_user_authorized(user_id, username):
            if cmd in ("/start", "/parear"):
                return self.cmd_pair(user_id, args)
            return {
                "text": (
                    f"⛔ <b>Acesso Negado</b>\n\n"
                    f"Seu ID (<code>{user_id}</code>) não está autorizado no Sentinel.\n"
                    f"Solicite liberação ao administrador do sistema."
                ),
                "parse_mode": "HTML"
            }

        # Comandos de Leitura (Admin e Viewer)
        if cmd in ("/start", "/ajuda", "/help"):
            return self.cmd_help()
        elif cmd == "/status":
            return self.cmd_status()
        elif cmd == "/ultimo":
            return self.cmd_ultimo()
        elif cmd == "/historico":
            return self.cmd_historico()
        elif cmd == "/erros":
            return self.cmd_erros()
        elif cmd == "/logs":
            return self.cmd_logs(args)
        elif cmd == "/proxima":
            return self.cmd_proxima()
        elif cmd == "/saude":
            return self.cmd_saude()
        elif cmd == "/silenciar":
            return self.cmd_silenciar(user_id, args)
        elif cmd == "/retomar":
            return self.cmd_retomar(user_id)

        # Comandos de Ação / Escrita (Somente Admin)
        elif cmd == "/rodar_agora":
            if not self.is_user_admin(user_id):
                return {"text": "⛔ <b>Ação restrita</b>: Apenas administradores podem disparar extrações.", "parse_mode": "HTML"}
            return self.cmd_rodar_agora()
        elif cmd == "/parar":
            if not self.is_user_admin(user_id):
                return {"text": "⛔ <b>Ação restrita</b>: Apenas administradores podem parar execuções.", "parse_mode": "HTML"}
            return self.cmd_parar()

        return {"text": f"Comando '{cmd}' desconhecido. Use /ajuda para ver os comandos disponíveis."}

    def handle_callback_query(self, user_id: str | int, data: str, cq_id: str) -> dict[str, Any]:
        """Processa cliques em botões inline (callbacks)."""
        # Responde o pop-up do Telegram
        try:
            self.telegram.answer_callback_query(cq_id)
        except Exception:
            pass

        if not self.is_user_authorized(user_id):
            return {"text": "⛔ Ação não permitida para o seu usuário.", "show_alert": True}

        if data.startswith("ack:"):
            incident_id = data.split(":", 1)[1]
            try:
                self.db.close_incident(int(incident_id))
                return {"text": f"✅ Incidente #{incident_id} reconhecido e encerrado."}
            except Exception as e:
                return {"text": f"Falha ao reconhecer incidente: {e}"}

        elif data.startswith("silence:"):
            mins_str = data.split(":", 1)[1]
            mins = int(mins_str) if mins_str.isdigit() else 30
            return self.cmd_silenciar(user_id, [str(mins)])

        elif data.startswith("cmd:"):
            command = data.split(":", 1)[1]
            return self.handle_command(user_id, f"/{command}")

        return {"text": "Ação recebida com sucesso."}

    # --- Implementação dos Comandos ---

    def cmd_help(self) -> dict[str, Any]:
        """Exibe o menu de comandos do Sentinel v2."""
        text = (
            "🛡️ <b>MapFy Sentinel v2 — Painel Operacional</b>\n\n"
            "<b>📊 Observabilidade & Consulta:</b>\n"
            "• /status — Estado atual, estágio e progresso\n"
            "• /ultimo — Relatório analítico da última extração\n"
            "• /historico — Últimas 5 execuções com taxa de sucesso\n"
            "• /erros — Últimos 5 erros com traceback resumido\n"
            "• /logs — Últimas 15 linhas de log operacional\n"
            "• /proxima — Estimativa da próxima execução agendada\n"
            "• /saude — CPU, memória, disco e status do SQLite\n\n"
            "<b>⚙️ Controle & Ações:</b>\n"
            "• /silenciar [min] — Suspende alertas sonoros (padrão 30m)\n"
            "• /retomar — Reativa todos os alertas do Sentinel\n"
            "• /rodar_agora — Dispara a extração manualmente <i>(Admin)</i>\n"
            "• /parar — Encerra o processo de extração ativo <i>(Admin)</i>\n"
        )
        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "📊 Status", "callback_data": "cmd:status"},
                    {"text": "📜 Última", "callback_data": "cmd:ultimo"},
                    {"text": "📈 Histórico", "callback_data": "cmd:historico"}
                ],
                [
                    {"text": "🖥️ Saúde", "callback_data": "cmd:saude"},
                    {"text": "📑 Logs", "callback_data": "cmd:logs"},
                    {"text": "🚀 Rodar Agora", "callback_data": "cmd:rodar_agora"}
                ]
            ]
        }
        return {"text": text, "parse_mode": "HTML", "reply_markup": keyboard}

    def cmd_status(self) -> dict[str, Any]:
        """Retorna o estado detalhado atual do extrator e do monitor."""
        active = self.db.get_active_extraction()
        state = self.monitor.current_state if hasattr(self.monitor, "current_state") else "UNKNOWN"

        if active:
            run_id = active.get("run_id", "N/A")
            start_str = to_local_str(active.get("start_time"))
            stage = active.get("stage", "PROCESSANDO")
            progress = active.get("progress", 0.0)
            rows = active.get("rows", 0)
            errors = active.get("error_count", 0)

            badge = "🟢 EM EXECUÇÃO"
            if state == "RUNNING_WITH_ERRORS":
                badge = "🟡 EM EXECUÇÃO (COM ERROS)"
            elif state == "NO_HEARTBEAT":
                badge = "🔴 SEM SINAL (HEARTBEAT EXPIRADO)"
            elif state == "STALLED":
                badge = "⚠️ TRAVADO (SEM PROGRESSO NO ESTÁGIO)"

            text = (
                f"🛡️ <b>Status Atual do Sentinel:</b> {badge}\n\n"
                f"<b>ID da Execução:</b> <code>{run_id}</code>\n"
                f"<b>Início:</b> {start_str}\n"
                f"<b>Estágio Atual:</b> <code>{stage}</code>\n"
                f"<b>Progresso:</b> {progress:.1f}%\n"
                f"<b>Linhas Coletadas:</b> {rows:,}\n"
                f"<b>Erros Ocorridos:</b> {errors}\n"
            )
        else:
            latest = self.db.get_latest_extraction()
            last_run_text = "Nenhuma registrada"
            if latest:
                end_str = to_local_str(latest.get("end_time") or latest.get("start_time"))
                last_run_text = f"{end_str} ({latest.get('status', 'N/A')})"

            silenced_until = self.db.get_bot_state("silenced_until", "")
            silence_badge = ""
            if silenced_until:
                silence_badge = f"\n🔕 <i>Alertas silenciados até: {to_local_str(silenced_until)}</i>\n"

            text = (
                f"🛡️ <b>Status Atual do Sentinel:</b> ⚪ AGUARDANDO (IDLE)\n\n"
                f"O extrator não está em execução no momento.{silence_badge}\n"
                f"<b>Última execução:</b> {last_run_text}\n"
                f"<b>Servidor:</b> {Config.SERVER_NAME}"
            )

        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "🔄 Atualizar", "callback_data": "cmd:status"},
                    {"text": "📜 Ver Logs", "callback_data": "cmd:logs"}
                ]
            ]
        }
        return {"text": text, "parse_mode": "HTML", "reply_markup": keyboard}

    def cmd_ultimo(self) -> dict[str, Any]:
        """Apresenta o relatório analítico completo da última execução finalizada."""
        latest = self.db.get_latest_extraction()
        if not latest:
            return {"text": "Nenhuma extração foi registrada no histórico ainda."}

        status = latest.get("status", "N/A")
        badge = "✅ CONCLUÍDA COM SUCESSO" if status == "COMPLETED" else f"❌ {status}"
        start_str = to_local_str(latest.get("start_time"))
        end_str = to_local_str(latest.get("end_time"))
        dur_secs = latest.get("duration_seconds", 0.0) or 0.0
        dur_str = f"{int(dur_secs // 60)}m {int(dur_secs % 60)}s"

        summary = latest.get("summary") or {}
        linhas = summary.get("total_registros") or summary.get("linhas_extraidas") or latest.get("rows", 0)
        novos = summary.get("novos_registros", 0)
        duplicados = summary.get("duplicados", 0)
        tamanho_xlsx = summary.get("tamanho_xlsx_mb", "N/A")
        taxa = f"{(linhas / dur_secs):.1f} lin/s" if dur_secs > 0 and linhas else "N/A"

        text = (
            f"📋 <b>Relatório da Última Extração</b>\n\n"
            f"<b>Resultado:</b> {badge}\n"
            f"<b>ID:</b> <code>{latest.get('run_id')}</code>\n"
            f"<b>Início:</b> {start_str}\n"
            f"<b>Término:</b> {end_str}\n"
            f"<b>Duração Total:</b> {dur_str}\n"
            f"<b>Total de Linhas:</b> {linhas:,}\n"
            f"<b>Novos Registros:</b> {novos:,}\n"
            f"<b>Duplicados/Ignorados:</b> {duplicados:,}\n"
            f"<b>Velocidade Média:</b> {taxa}\n"
            f"<b>Arquivo XLSX:</b> {tamanho_xlsx} MB\n"
            f"<b>Erros Registrados:</b> {latest.get('error_count', 0)}"
        )
        return {"text": text, "parse_mode": "HTML"}

    def cmd_historico(self) -> dict[str, Any]:
        """Retorna as últimas 5 execuções em formato resumido e claro."""
        rows = self.db.get_recent_extractions(limit=5)
        if not rows:
            return {"text": "Nenhum histórico disponível no banco de dados."}

        lines = ["📈 <b>Histórico das Últimas Execuções:</b>\n"]
        for r in rows:
            status = r.get("status", "N/A")
            icon = "✅" if status == "COMPLETED" and r.get("error_count", 0) == 0 else ("⚠️" if status == "COMPLETED" else "❌")
            start = to_local_str(r.get("start_time"))
            dur = int(r.get("duration_seconds") or 0)
            dur_txt = f"{dur//60}m {dur%60}s"
            rows_cnt = r.get("rows", 0)
            lines.append(f"{icon} <code>{r.get('run_id')}</code> — {start}\n   Duração: {dur_txt} | Linhas: {rows_cnt:,} | Erros: {r.get('error_count', 0)}")

        return {"text": "\n".join(lines), "parse_mode": "HTML"}

    def cmd_erros(self) -> dict[str, Any]:
        """Retorna os últimos erros registrados com traceback resumido."""
        events = self.db.get_recent_errors(limit=5)
        if not events:
            return {"text": "🎉 Nenhum erro recente registrado no sistema!"}

        lines = ["⚠️ <b>Últimos Erros Registrados:</b>\n"]
        for ev in events:
            ev_time = to_local_str(ev.get("created_at"))
            origin = ev.get("origin", "sistema")
            msg = ev.get("message", "Erro sem mensagem")[:150]
            lines.append(f"• <b>[{ev_time}]</b> <code>{origin}</code>:\n  <i>{msg}</i>")

        return {"text": "\n\n".join(lines), "parse_mode": "HTML"}

    def cmd_logs(self, args: list[str]) -> dict[str, Any]:
        """Recupera as últimas linhas do arquivo de log operacional ativo."""
        count = 15
        if args and args[0].isdigit():
            count = min(50, max(5, int(args[0])))

        log_path = Config.DATA_DIR.parent / "logs" / "sentinel.log"
        if not log_path.exists():
            # Tenta log alternativo
            log_path = Config.DATA_DIR.parent / "logs" / "monitor.log"

        if not log_path.exists():
            return {"text": "Arquivo de log ainda não encontrado em disco."}

        try:
            with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                all_lines = f.readlines()
                recent = all_lines[-count:]
                snippet = redact_token("".join(recent))
                if not snippet.strip():
                    return {"text": "Arquivo de log está vazio no momento."}
                return {"text": f"📜 <b>Últimas {len(recent)} linhas de Log:</b>\n<pre>{snippet[:3500]}</pre>", "parse_mode": "HTML"}
        except Exception as e:
            return {"text": f"Falha ao ler arquivo de log: {e}"}

    def cmd_proxima(self) -> dict[str, Any]:
        """Estima a próxima execução com base no agendador e intervalo esperado."""
        latest = self.db.get_latest_extraction()
        interval_mins = Config.EXPECTED_INTERVAL_MINUTES
        if not latest or not latest.get("end_time"):
            return {
                "text": f"⏱️ <b>Previsão de Execução:</b>\nO intervalo padrão configurado é a cada <b>{interval_mins} minutos</b>.",
                "parse_mode": "HTML"
            }

        try:
            end_dt = datetime.strptime(latest["end_time"], "%Y-%m-%d %H:%M:%S")
            next_dt = end_dt + timedelta(minutes=interval_mins)
            diff_mins = int((next_dt - now_utc()).total_seconds() // 60)

            if diff_mins > 0:
                msg = f"Próxima execução estimada em aproximadamente <b>{diff_mins} minutos</b> ({to_local_str(next_dt)})."
            else:
                msg = f"A execução já deveria ter iniciado há {-diff_mins} minutos (esperada em {to_local_str(next_dt)})."

            return {
                "text": f"⏱️ <b>Agendamento Sentinel:</b>\n• Intervalo: {interval_mins} minutos\n• Previsão: {msg}",
                "parse_mode": "HTML"
            }
        except Exception as e:
            return {"text": f"Falha ao calcular estimativa: {e}"}

    def cmd_saude(self) -> dict[str, Any]:
        """Diagnóstico de infraestrutura, recursos do host e SQLite."""
        uptime_secs = int(time.time() - START_TIME_PROCESS)
        uptime_txt = f"{uptime_secs // 3600}h {(uptime_secs % 3600) // 60}m {uptime_secs % 60}s"

        # Discos
        disco_c = shutil.disk_usage("C:\\")
        c_livre_gb = disco_c.free / (1024 ** 3)
        c_total_gb = disco_c.total / (1024 ** 3)

        d_txt = "N/A"
        if os.path.exists("D:\\"):
            try:
                disco_d = shutil.disk_usage("D:\\")
                d_livre_gb = disco_d.free / (1024 ** 3)
                d_total_gb = disco_d.total / (1024 ** 3)
                d_txt = f"{d_livre_gb:.1f} GB livres de {d_total_gb:.1f} GB"
            except Exception:
                pass

        # CPU e Memória via psutil
        cpu_txt = "N/A"
        ram_txt = "N/A"
        if psutil:
            try:
                cpu_txt = f"{psutil.cpu_percent(interval=0.1)}%"
                ram = psutil.virtual_memory()
                ram_txt = f"{ram.percent}% (Livre: {ram.available / (1024**3):.1f} GB)"
            except Exception:
                pass

        # SQLite
        db_size_mb = 0.0
        try:
            if self.db.db_path.exists():
                db_size_mb = self.db.db_path.stat().st_size / (1024 * 1024)
        except Exception:
            pass

        pending_outbox = len(self.db.get_pending_outbox(limit=100))

        text = (
            "🖥️ <b>Saúde Operacional do Sentinel v2</b>\n\n"
            f"<b>Tempo em Operação (Uptime):</b> {uptime_txt}\n"
            f"<b>CPU:</b> {cpu_txt}\n"
            f"<b>Memória RAM:</b> {ram_txt}\n"
            f"<b>Disco C:</b> {c_livre_gb:.1f} GB livres de {c_total_gb:.1f} GB\n"
            f"<b>Disco D:</b> {d_txt}\n"
            f"<b>Banco SQLite:</b> {db_size_mb:.2f} MB (WAL Ativo)\n"
            f"<b>Mensagens na Fila Outbox:</b> {pending_outbox} pendentes\n"
            f"<b>Servidor Host:</b> {Config.SERVER_NAME}"
        )
        return {"text": text, "parse_mode": "HTML"}

    def cmd_silenciar(self, user_id: str | int, args: list[str]) -> dict[str, Any]:
        """Suspende alertas sonoros de incidentes por período determinado."""
        mins = 30
        if args and args[0].isdigit():
            mins = min(1440, max(5, int(args[0])))

        until_dt = now_utc() + timedelta(minutes=mins)
        until_str = until_dt.strftime("%Y-%m-%d %H:%M:%S")
        self.db.set_bot_state("silenced_until", until_str)

        return {
            "text": f"🔕 <b>Alertas Silenciados</b>\nO Sentinel não enviará notificações de erro pelos próximos <b>{mins} minutos</b> (até {to_local_str(until_dt)}).\nUse /retomar para reativar antes.",
            "parse_mode": "HTML"
        }

    def cmd_retomar(self, user_id: str | int) -> dict[str, Any]:
        """Reativa as notificações imediatamente."""
        self.db.set_bot_state("silenced_until", "")
        return {"text": "🔔 <b>Alertas Reativados</b>\nAs notificações do Sentinel voltaram ao modo ativo normal.", "parse_mode": "HTML"}

    def cmd_rodar_agora(self) -> dict[str, Any]:
        """Dispara a execução manual do extrator sob demanda."""
        active = self.db.get_active_extraction()
        if active:
            return {"text": f"⚠️ Já existe uma extração em andamento (<code>{active.get('run_id')}</code>). Aguarde a conclusão.", "parse_mode": "HTML"}

        # Localiza o script de extração
        script_paths = [
            Config.DATA_DIR.parent / "automacao_mapfy.py",
            Config.DATA_DIR.parent.parent / "automacao_mapfy.py",
            Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\automacao_mapfy.py"),
            Path(r"c:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda\!@#Mapfy_2026\automacao_mapfy.py")
        ]

        target_script = None
        for p in script_paths:
            if p.exists():
                target_script = p
                break

        if not target_script:
            return {"text": "❌ Script <code>automacao_mapfy.py</code> não foi encontrado para disparo automático.", "parse_mode": "HTML"}

        try:
            # Dispara em processo independente (desacoplado)
            python_bin = sys.executable
            subprocess.Popen(
                [python_bin, str(target_script)],
                cwd=str(target_script.parent),
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
            )
            return {
                "text": f"🚀 <b>Extração disparada com sucesso!</b>\nO processo foi iniciado em segundo plano com o script:\n<code>{target_script.name}</code>.",
                "parse_mode": "HTML"
            }
        except Exception as e:
            logger.error("Erro ao disparar extrator via Telegram: %s", e)
            return {"text": f"❌ Falha ao iniciar processo do extrator: {e}"}

    def cmd_parar(self) -> dict[str, Any]:
        """Solicita interrupção do processo ativo."""
        active = self.db.get_active_extraction()
        if not active:
            return {"text": "Nenhuma extração ativa em execução para interromper."}

        # Atualiza status no banco para solicitar cancelamento
        self.db.update_status(active["run_id"], "CANCELLED")
        return {
            "text": f"🛑 Solicitação de cancelamento registrada para a execução <code>{active['run_id']}</code>.",
            "parse_mode": "HTML"
        }

    def cmd_pair(self, user_id: str | int, args: list[str]) -> dict[str, Any]:
        """Gerencia o pareamento seguro do primeiro administrador do Telegram."""
        saved_code = self.db.get_bot_state("pair_code", "")

        if args and saved_code and args[0] == saved_code:
            # Pareamento bem-sucedido!
            Config.AUTHORIZED_USERS[str(user_id)] = "admin"
            self.db.set_bot_state(f"user_role_{user_id}", "admin")
            self.db.set_bot_state("pair_code", "")  # Invalida o código usado
            return {
                "text": (
                    f"🎉 <b>Pareamento Concluído com Sucesso!</b>\n\n"
                    f"Seu usuário (<code>{user_id}</code>) foi promovido a <b>Administrador</b> do MapFy Sentinel v2.\n"
                    f"Digite /ajuda para visualizar todas as opções disponíveis."
                ),
                "parse_mode": "HTML"
            }

        # Se não há código ou o código não foi fornecido
        import secrets
        if not saved_code:
            new_code = f"{secrets.randbelow(900000) + 100000}"
            self.db.set_bot_state("pair_code", new_code)
            logger.info("CÓDIGO DE PAREAMENTO DO TELEGRAM GERADO: %s", new_code)
            print(f"\n[SENTINEL TELEGRAM] CÓDIGO DE PAREAMENTO: {new_code}\n")

        return {
            "text": (
                "🔐 <b>Autenticação de Segurança Sentinel</b>\n\n"
                f"Seu ID do Telegram é: <code>{user_id}</code>.\n"
                "Para confirmar seu acesso administrativo, digite:\n"
                "<code>/parear &lt;CÓDIGO_DE_6_DÍGITOS&gt;</code>\n\n"
                "<i>O código foi exibido no console do servidor ou pode ser obtido via API.</i>"
            ),
            "parse_mode": "HTML"
        }
