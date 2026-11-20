@echo off
chcp 65001 > nul
title Status do Sentinel v2
cd /d "%~dp0MapFy_Telegram_Monitor"

call STATUS_SENTINEL.bat
