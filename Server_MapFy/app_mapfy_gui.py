#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
app_mapfy_gui.py
================
Interface Gráfica Minimalista e Agendador em Segundo Plano para o Mapfy.
Desenvolvido para Usina Pitangueiras com visual limpo (Clean White & Black).

Design:
  - Fundo branco/claro com tipografia preta elegante e acabamentos modernos.
  - Campos diretos: Usuário, Senha e Intervalo (Timer).
  - Botão START: inicia a rotina automática contínua em segundo plano e minimiza para a bandeja.
  - Ícone na bandeja do sistema (System Tray) para restaurar, pausar ou encerrar a qualquer momento.
"""

from __future__ import annotations

import json
import logging
import os
import queue
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import customtkinter as ctk
from dotenv import set_key
from PIL import Image, ImageDraw
import pystray

# Importa o extrator do Mapfy
import mapfy_extractor

# =============================================================================
# DIRETÓRIOS E CONFIGURAÇÕES
# =============================================================================
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
CONFIG_FILE = BASE_DIR / "config_rotina.json"
RELATORIOS_DIR = BASE_DIR / "relatorios"
SESSION_FILE = BASE_DIR / "session_state.json"

RELATORIOS_DIR.mkdir(parents=True, exist_ok=True)

# Configuração de Tema: Modo Claro (Branco e Preto com acabamentos perfeitos)
ctk.set_appearance_mode("Light")
ctk.set_default_color_theme("green")

# Paleta de Cores Minimalista (Clean White & Slate)
COLOR_BG = "#f8fafc"           # Fundo geral cinza gelo claríssimo
COLOR_CARD = "#ffffff"         # Cartão branco puro
COLOR_BORDER = "#e2e8f0"       # Borda sutil e elegante
COLOR_TEXT = "#0f172a"         # Texto principal preto carvão
COLOR_TEXT_MUTED = "#64748b"   # Texto secundário cinza médio
COLOR_INPUT_BG = "#ffffff"     # Fundo dos campos
COLOR_INPUT_BORDER = "#cbd5e1" # Borda dos campos

COLOR_PRIMARY = "#16a34a"      # Verde vibrante START
COLOR_PRIMARY_HOVER = "#15803d"
COLOR_DANGER = "#dc2626"       # Vermelho STOP
COLOR_DANGER_HOVER = "#b91c1c"
COLOR_SECONDARY = "#f1f5f9"    # Botão cinza claro
COLOR_SECONDARY_HOVER = "#e2e8f0"


# =============================================================================
# PERSISTÊNCIA DE DADOS
# =============================================================================
def load_config() -> dict[str, Any]:
    defaults = {
        "email": os.getenv("MAPFY_USER", ""),
        "password": "",
        "interval_minutes": 60,
        "auto_minimize": True,
        "last_run": ""
    }

    defaults["password"] = os.getenv("MAPFY_PASS", "")

    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                defaults.update(json.load(f))
        except Exception:
            pass

    return defaults


def save_config(cfg: dict[str, Any], password: str) -> None:
    to_save = {
        "email": cfg.get("email", ""),
        "interval_minutes": cfg.get("interval_minutes", 60),
        "auto_minimize": cfg.get("auto_minimize", True),
        "last_run": cfg.get("last_run", "")
    }
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(to_save, f, indent=2, ensure_ascii=False)

    ENV_FILE.touch(exist_ok=True)
    set_key(str(ENV_FILE), "MAPFY_USER", cfg.get("email", ""), quote_mode="always")
    set_key(str(ENV_FILE), "MAPFY_PASS", password, quote_mode="always")
    os.environ["MAPFY_USER"] = cfg.get("email", "")
    os.environ["MAPFY_PASS"] = password


# =============================================================================
# ÍCONE DA BANDEJA (SYSTEM TRAY)
# =============================================================================
def create_tray_icon_image(active: bool = True):
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Fundo circular ou arredondado
    bg_color = (22, 163, 74, 255) if active else (100, 116, 139, 255)
    d.rounded_rectangle([2, 2, 62, 62], radius=16, fill=bg_color)
    # Letra M em branco
    d.polygon([(16, 48), (16, 16), (26, 32), (32, 40), (38, 32), (48, 16), (48, 48), (42, 48), (42, 26), (34, 40), (30, 40), (22, 26), (22, 48)], fill=(255, 255, 255, 255))
    return img


# =============================================================================
# CLASSE DA INTERFACE (CLEAN WHITE)
# =============================================================================
class MapfyCleanApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Mapfy 2026 • Automação de Relatórios")
        self.geometry("540x680")
        self.minsize(500, 640)
        self.configure(fg_color=COLOR_BG)

        # Configurações
        self.config = load_config()

        # Variáveis de Estado
        self.routine_running = False
        self.is_extracting = False
        self.seconds_left = 0
        self.cancel_event = threading.Event()
        self.scheduler_thread: threading.Thread | None = None
        self.tray_icon = None

        # Fila de Logs
        self.log_queue = queue.Queue()

        # Constrói UI
        self.build_ui()

        # Processamento contínuo de mensagens da fila
        self.check_log_queue()

        # Configuração do Tray Icon (inicializa em background)
        self.init_tray_icon()

        # Intercepta o 'X' da janela para minimizar para a bandeja
        self.protocol("WM_DELETE_WINDOW", self.on_close_clicked)

        # Garante foco e primeiro plano ao abrir
        self.lift()
        self.attributes("-topmost", True)
        self.after(600, lambda: self.attributes("-topmost", False))
        self.focus_force()

    # -------------------------------------------------------------------------
    # CONSTRUÇÃO VISUAL
    # -------------------------------------------------------------------------
    def build_ui(self):
        # Container Central com Cartão Branco e Sombra/Borda Elegante
        self.card = ctk.CTkFrame(
            self,
            fg_color=COLOR_CARD,
            corner_radius=16,
            border_width=1,
            border_color=COLOR_BORDER
        )
        self.card.pack(fill="both", expand=True, padx=25, pady=25)

        # 1. CABEÇALHO
        header_frame = ctk.CTkFrame(self.card, fg_color="transparent")
        header_frame.pack(fill="x", padx=25, pady=(24, 15))

        lbl_logo = ctk.CTkLabel(
            header_frame,
            text="MAPFY 2026",
            font=ctk.CTkFont(size=22, weight="bold"),
            text_color=COLOR_TEXT
        )
        lbl_logo.pack(anchor="w")

        lbl_subtitle = ctk.CTkLabel(
            header_frame,
            text="Usina Pitangueiras • Relatórios Automáticos de Campo",
            font=ctk.CTkFont(size=12),
            text_color=COLOR_TEXT_MUTED
        )
        lbl_subtitle.pack(anchor="w", pady=(1, 0))

        # Badge de Estado Atual
        self.badge_status = ctk.CTkLabel(
            self.card,
            text="● AGUARDANDO INÍCIO",
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#f1f5f9",
            text_color=COLOR_TEXT_MUTED,
            corner_radius=12,
            height=28
        )
        self.badge_status.pack(fill="x", padx=25, pady=(0, 18))

        # 2. SEÇÃO DE CREDENCIAIS
        form_frame = ctk.CTkFrame(self.card, fg_color="transparent")
        form_frame.pack(fill="x", padx=25, pady=0)

        # Email
        lbl_email = ctk.CTkLabel(form_frame, text="Email de Usuário:", font=ctk.CTkFont(size=12, weight="bold"), text_color=COLOR_TEXT)
        lbl_email.pack(anchor="w", pady=(0, 4))

        self.txt_email = ctk.CTkEntry(
            form_frame,
            placeholder_text="seu.email@usinapitangueiras.com.br",
            height=40,
            corner_radius=8,
            border_color=COLOR_INPUT_BORDER,
            fg_color=COLOR_INPUT_BG,
            text_color=COLOR_TEXT
        )
        self.txt_email.insert(0, self.config.get("email", ""))
        self.txt_email.pack(fill="x", pady=(0, 14))

        # Senha
        lbl_pass = ctk.CTkLabel(form_frame, text="Senha de Acesso:", font=ctk.CTkFont(size=12, weight="bold"), text_color=COLOR_TEXT)
        lbl_pass.pack(anchor="w", pady=(0, 4))

        pass_box = ctk.CTkFrame(form_frame, fg_color="transparent")
        pass_box.pack(fill="x", pady=(0, 14))

        self.txt_pass = ctk.CTkEntry(
            pass_box,
            placeholder_text="Digite sua senha",
            show="•",
            height=40,
            corner_radius=8,
            border_color=COLOR_INPUT_BORDER,
            fg_color=COLOR_INPUT_BG,
            text_color=COLOR_TEXT
        )
        self.txt_pass.insert(0, self.config.get("password", ""))
        self.txt_pass.pack(side="left", fill="x", expand=True)

        self.btn_eye = ctk.CTkButton(
            pass_box,
            text="👁",
            width=42,
            height=40,
            corner_radius=8,
            fg_color=COLOR_SECONDARY,
            hover_color=COLOR_SECONDARY_HOVER,
            text_color=COLOR_TEXT,
            command=self.toggle_password
        )
        self.btn_eye.pack(side="left", padx=(6, 0))

        # 3. SEÇÃO DE CONFIGURAÇÃO DE TEMPO (TIMER)
        lbl_time = ctk.CTkLabel(form_frame, text="Intervalo de Repetição Automática:", font=ctk.CTkFont(size=12, weight="bold"), text_color=COLOR_TEXT)
        lbl_time.pack(anchor="w", pady=(0, 4))

        timer_box = ctk.CTkFrame(form_frame, fg_color="transparent")
        timer_box.pack(fill="x", pady=(0, 18))

        self.interval_options = [
            "A cada 15 minutos",
            "A cada 30 minutos",
            "A cada 1 hora",
            "A cada 2 horas",
            "A cada 4 horas",
            "A cada 8 horas",
            "A cada 12 horas",
            "A cada 24 horas"
        ]
        self.combo_interval = ctk.CTkComboBox(
            timer_box,
            values=self.interval_options,
            height=40,
            corner_radius=8,
            border_color=COLOR_INPUT_BORDER,
            fg_color=COLOR_INPUT_BG,
            text_color=COLOR_TEXT,
            dropdown_text_color=COLOR_TEXT,
            dropdown_fg_color="#ffffff",
            dropdown_hover_color="#f1f5f9"
        )
        # Seleciona de acordo com o configurado
        initial_mins = self.config.get("interval_minutes", 60)
        selected_text = "A cada 1 hora"
        for opt in self.interval_options:
            if f"{initial_mins} minutos" in opt or (initial_mins == 60 and "1 hora" in opt):
                selected_text = opt
                break
        self.combo_interval.set(selected_text)
        self.combo_interval.pack(fill="x")

        # 4. BOTÕES DE CONTROLE PRINCIPAIS
        self.btn_start = ctk.CTkButton(
            self.card,
            text="▶ START (INICIAR ROTINA EM SEGUNDO PLANO)",
            font=ctk.CTkFont(size=13, weight="bold"),
            height=46,
            corner_radius=10,
            fg_color=COLOR_PRIMARY,
            hover_color=COLOR_PRIMARY_HOVER,
            text_color="#ffffff",
            command=self.toggle_start_stop
        )
        self.btn_start.pack(fill="x", padx=25, pady=(0, 10))

        # Botões Secundários em Linha (Executar Agora / Abrir Pasta)
        row_btns = ctk.CTkFrame(self.card, fg_color="transparent")
        row_btns.pack(fill="x", padx=25, pady=(0, 16))
        row_btns.grid_columnconfigure((0, 1), weight=1)

        self.btn_run_now = ctk.CTkButton(
            row_btns,
            text="⚡ Executar Agora",
            font=ctk.CTkFont(size=12, weight="bold"),
            height=36,
            corner_radius=8,
            fg_color=COLOR_SECONDARY,
            hover_color=COLOR_SECONDARY_HOVER,
            text_color=COLOR_TEXT,
            command=self.run_now_action
        )
        self.btn_run_now.grid(row=0, column=0, sticky="ew", padx=(0, 5))

        btn_folder = ctk.CTkButton(
            row_btns,
            text="📁 Abrir Relatórios",
            font=ctk.CTkFont(size=12, weight="bold"),
            height=36,
            corner_radius=8,
            fg_color=COLOR_SECONDARY,
            hover_color=COLOR_SECONDARY_HOVER,
            text_color=COLOR_TEXT,
            command=self.open_reports_dir
        )
        btn_folder.grid(row=0, column=1, sticky="ew", padx=(5, 0))

        # 5. LINHA DE STATUS DO CRONÔMETRO E RESUMO
        status_box = ctk.CTkFrame(self.card, fg_color="#f8fafc", corner_radius=10, border_width=1, border_color="#e2e8f0")
        status_box.pack(fill="both", expand=True, padx=25, pady=(0, 20))

        self.lbl_countdown = ctk.CTkLabel(
            status_box,
            text="⏳ Rotina Parada",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color=COLOR_TEXT
        )
        self.lbl_countdown.pack(anchor="w", padx=15, pady=(12, 2))

        self.lbl_last_info = ctk.CTkLabel(
            status_box,
            text="Total em disco: 22.210 registros consolidados em 17 formulários.",
            font=ctk.CTkFont(size=11),
            text_color=COLOR_TEXT_MUTED
        )
        self.lbl_last_info.pack(anchor="w", padx=15, pady=(0, 6))

        self.lbl_live_log = ctk.CTkLabel(
            status_box,
            text="Pronto para iniciar.",
            font=ctk.CTkFont(size=11),
            text_color=COLOR_TEXT_MUTED,
            anchor="w"
        )
        self.lbl_live_log.pack(anchor="w", padx=15, pady=(0, 12))

    # -------------------------------------------------------------------------
    # COMPORTAMENTO DOS BOTÕES E ROTINA
    # -------------------------------------------------------------------------
    def toggle_password(self):
        if self.txt_pass.cget("show") == "":
            self.txt_pass.configure(show="•")
            self.btn_eye.configure(text="👁")
        else:
            self.txt_pass.configure(show="")
            self.btn_eye.configure(text="🔒")

    def get_selected_minutes(self) -> int:
        val = self.combo_interval.get()
        mapping = {
            "15 minutos": 15,
            "30 minutos": 30,
            "1 hora": 60,
            "2 horas": 120,
            "4 horas": 240,
            "8 horas": 480,
            "12 horas": 720,
            "24 horas": 1440
        }
        for k, v in mapping.items():
            if k in val:
                return v
        return 60

    def toggle_start_stop(self):
        if self.routine_running:
            self.stop_routine()
        else:
            self.start_routine()

    def start_routine(self):
        email = self.txt_email.get().strip()
        pwd = self.txt_pass.get()
        if not email:
            self.lbl_live_log.configure(text="Aviso: Preencha o email antes de iniciar.")
            return

        mins = self.get_selected_minutes()

        # Atualiza e salva configurações
        self.config["email"] = email
        self.config["interval_minutes"] = mins
        save_config(self.config, pwd)

        self.routine_running = True
        self.cancel_event.clear()
        self.seconds_left = mins * 60

        # Atualiza Botão e Badge
        self.btn_start.configure(
            text="⏹ STOP (PARAR ROTINA AUTOMÁTICA)",
            fg_color=COLOR_DANGER,
            hover_color=COLOR_DANGER_HOVER
        )
        self.badge_status.configure(
            text="● ROTINA ATIVA EM SEGUNDO PLANO",
            fg_color="#dcfce7",
            text_color="#166534"
        )
        self.lbl_countdown.configure(
            text=f"⏳ Próxima execução em: {timedelta(seconds=self.seconds_left)}",
            text_color="#166534"
        )
        self.lbl_live_log.configure(text=f"Rotina ativa a cada {mins} min. Minimizando para a bandeja...")

        # Dispara thread do temporizador
        if not self.scheduler_thread or not self.scheduler_thread.is_alive():
            self.scheduler_thread = threading.Thread(target=self._scheduler_loop, daemon=True)
            self.scheduler_thread.start()

        # Atualiza ícone do tray
        if self.tray_icon:
            self.tray_icon.icon = create_tray_icon_image(active=True)

        # Minimiza automaticamente para a bandeja após 1 segundo
        self.after(1200, self.minimize_to_tray)

    def stop_routine(self):
        self.routine_running = False
        self.cancel_event.set()

        self.btn_start.configure(
            text="▶ START (INICIAR ROTINA EM SEGUNDO PLANO)",
            fg_color=COLOR_PRIMARY,
            hover_color=COLOR_PRIMARY_HOVER
        )
        self.badge_status.configure(
            text="● PAUSADO",
            fg_color="#f1f5f9",
            text_color=COLOR_TEXT_MUTED
        )
        self.lbl_countdown.configure(
            text="⏳ Rotina Pausada",
            text_color=COLOR_TEXT_MUTED
        )
        self.lbl_live_log.configure(text="Rotina pausada pelo usuário.")

        if self.tray_icon:
            self.tray_icon.icon = create_tray_icon_image(active=False)

    def _scheduler_loop(self):
        while self.routine_running:
            if not self.is_extracting:
                if self.seconds_left <= 0:
                    mins = self.get_selected_minutes()
                    self.seconds_left = mins * 60
                    self.trigger_extraction()
                else:
                    self.seconds_left -= 1
                    td_str = str(timedelta(seconds=self.seconds_left))
                    self.lbl_countdown.configure(
                        text=f"⏳ Próxima execução em: {td_str}"
                    )
            time.sleep(1)

    def run_now_action(self):
        if self.is_extracting:
            self.lbl_live_log.configure(text="Uma extração já está ocorrendo. Aguarde.")
            return

        email = self.txt_email.get().strip()
        pwd = self.txt_pass.get()
        if email:
            self.config["email"] = email
            save_config(self.config, pwd)

        self.lbl_live_log.configure(text="Disparo imediato iniciado...")
        self.trigger_extraction()

    def trigger_extraction(self):
        if self.is_extracting:
            return
        self.is_extracting = True
        self.btn_run_now.configure(state="disabled")
        self.badge_status.configure(
            text="● EXTRAINDO DADOS EM SEGUNDO PLANO...",
            fg_color="#e0f2fe",
            text_color="#0369a1"
        )
        t = threading.Thread(target=self._worker_thread, daemon=True)
        t.start()

    def _worker_thread(self):
        try:
            def log_callback(msg: str, level: str):
                self.log_queue.put(msg)

            def progress_callback(idx: int, total: int, form_name: str, res: dict):
                short = form_name[:32] + "..." if len(form_name) > 32 else form_name
                self.log_queue.put(f"[{idx}/{total}] {short}")

            # Roda o motor em modo invisível (headless=True)
            mapfy_extractor.run_full_extraction(
                headless=True,
                log_callback=log_callback,
                progress_callback=progress_callback,
                cancel_event=self.cancel_event
            )

            now_str = datetime.now().strftime("%d/%m/%Y %H:%M")
            self.config["last_run"] = now_str
            self.lbl_last_info.configure(text=f"Última execução: {now_str} • Base atualizada.")

        except Exception as e:
            self.log_queue.put(f"Erro: {e}")
        finally:
            self.is_extracting = False
            self.btn_run_now.configure(state="normal")
            if self.routine_running:
                self.badge_status.configure(
                    text="● ROTINA ATIVA EM SEGUNDO PLANO",
                    fg_color="#dcfce7",
                    text_color="#166534"
                )
            else:
                self.badge_status.configure(
                    text="● AGUARDANDO INÍCIO",
                    fg_color="#f1f5f9",
                    text_color=COLOR_TEXT_MUTED
                )

    def check_log_queue(self):
        while not self.log_queue.empty():
            try:
                msg = self.log_queue.get_nowait()
                # Exibe a última mensagem de status
                self.lbl_live_log.configure(text=str(msg)[:70])
            except queue.Empty:
                break
        self.after(300, self.check_log_queue)

    def open_reports_dir(self):
        if sys.platform == "win32":
            os.startfile(str(RELATORIOS_DIR))
        else:
            subprocess.Popen(["xdg-open", str(RELATORIOS_DIR)])

    # -------------------------------------------------------------------------
    # BANDEJA DO SISTEMA (SYSTEM TRAY)
    # -------------------------------------------------------------------------
    def init_tray_icon(self):
        img = create_tray_icon_image(active=False)
        menu = (
            pystray.MenuItem("Abrir Painel", self.restore_from_tray, default=True),
            pystray.MenuItem("Executar Agora", lambda: self.run_now_action()),
            pystray.MenuItem("Parar / Retomar", lambda: self.toggle_start_stop()),
            pystray.MenuItem("Sair", self.quit_application)
        )
        self.tray_icon = pystray.Icon("Mapfy2026", img, "Mapfy 2026 Automation", menu)
        threading.Thread(target=self.tray_icon.run, daemon=True).start()

    def minimize_to_tray(self):
        self.withdraw()

    def restore_from_tray(self, icon=None, item=None):
        self.deiconify()
        self.lift()
        self.attributes("-topmost", True)
        self.after(500, lambda: self.attributes("-topmost", False))
        self.focus_force()

    def on_close_clicked(self):
        # Se a rotina estiver rodando, minimiza para a bandeja
        if self.routine_running:
            self.minimize_to_tray()
        else:
            self.quit_application()

    def quit_application(self, icon=None, item=None):
        self.routine_running = False
        self.cancel_event.set()
        if self.tray_icon:
            try:
                self.tray_icon.stop()
            except Exception:
                pass
        self.destroy()
        sys.exit(0)


# =============================================================================
# INICIALIZAÇÃO
# =============================================================================
if __name__ == "__main__":
    app = MapfyCleanApp()
    app.mainloop()
