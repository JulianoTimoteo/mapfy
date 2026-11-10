@echo off
chcp 65001 > nul
title Parar MapFy Telegram Monitor
cd /d "%~dp0"

echo ==========================================================
echo    ENCERRANDO MAPFY TELEGRAM MONITOR
echo ==========================================================

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8765" ^| findstr "LISTENING"') do (
    echo [INFO] Finalizando processo PID %%a na porta 8765...
    taskkill /F /PID %%a > nul 2>&1
)

echo [OK] Monitor encerrado com sucesso.
timeout /t 2 > nul
