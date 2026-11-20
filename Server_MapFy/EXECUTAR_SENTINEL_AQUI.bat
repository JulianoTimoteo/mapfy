@echo off
chcp 65001 > nul
title MapFy Sentinel v2 [127.0.0.1:8765]
cd /d "%~dp0MapFy_Telegram_Monitor"

echo ==========================================================
echo    INICIANDO MAPFY SENTINEL v2 (CENTRO DE CONTROLE)
echo ==========================================================

set "PYTHON_EXE=%~dp0server\runtime\python.exe"
if not exist "%PYTHON_EXE%" (
    set PYTHON_EXE=python
)

echo [INFO] Interpretador Python: %PYTHON_EXE%
echo [INFO] Endereco: http://127.0.0.1:8765
echo [INFO] O servidor Sentinel ficara ativo nesta janela.
echo ==========================================================
echo.

%PYTHON_EXE% run_server.py
pause
