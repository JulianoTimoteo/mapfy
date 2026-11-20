@echo off
chcp 65001 > nul
title Iniciar Sentinel v2 em Segundo Plano
cd /d "%~dp0MapFy_Telegram_Monitor"

call INICIAR_SEGUNDO_PLANO.bat
