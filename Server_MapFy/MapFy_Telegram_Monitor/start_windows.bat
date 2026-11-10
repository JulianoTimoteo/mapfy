@echo off
chcp 65001 > nul
title MapFy Telegram Monitor [127.0.0.1:8765]
cd /d "%~dp0"

echo ==========================================================
echo    INICIANDO MAPFY TELEGRAM MONITOR
echo ==========================================================

REM Detecta interpretador Python
set PYTHON_EXE=python
if exist "..\server\runtime\python.exe" (
    set "PYTHON_EXE=..\server\runtime\python.exe"
)

echo [INFO] Interpretador: %PYTHON_EXE%
echo [INFO] Endereco: http://127.0.0.1:8765
echo [INFO] Para encerrar, feche esta janela ou execute stop_windows.bat
echo.

%PYTHON_EXE% run_server.py
pause
