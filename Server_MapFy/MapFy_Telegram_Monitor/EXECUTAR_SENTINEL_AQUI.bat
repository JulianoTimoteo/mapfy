@echo off
chcp 65001 > nul
title MapFy Sentinel v2 [127.0.0.1:8765]
cd /d "%~dp0"

echo ==========================================================
echo    INICIANDO MAPFY SENTINEL v2 (CENTRO DE CONTROLE)
echo ==========================================================

REM Detecta interpretador Python
set "PYTHON_EXE="
if exist "..\server\runtime\python.exe" (
    set "PYTHON_EXE=..\server\runtime\python.exe"
) else if exist "%~dp0..\server\runtime\python.exe" (
    set "PYTHON_EXE=%~dp0..\server\runtime\python.exe"
) else if exist "server\runtime\python.exe" (
    set "PYTHON_EXE=server\runtime\python.exe"
) else (
    set PYTHON_EXE=python
)

echo [INFO] Interpretador Python: %PYTHON_EXE%
echo [INFO] Iniciando Sentinel v2...
echo.

%PYTHON_EXE% run_server.py
pause
