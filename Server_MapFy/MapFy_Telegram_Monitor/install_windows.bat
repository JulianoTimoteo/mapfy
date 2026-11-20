@echo off
chcp 65001 > nul
title MapFy Sentinel v2 [127.0.0.1:8765]
cd /d "%~dp0"

echo ==========================================================
echo    CONFIGURACAO E INICIALIZACAO - MAPFY SENTINEL v2
echo ==========================================================

REM Detecta interpretador Python
set "PYTHON_EXE="
if exist "..\server\runtime\python.exe" (
    set "PYTHON_EXE=..\server\runtime\python.exe"
) else if exist "%~dp0..\server\runtime\python.exe" (
    set "PYTHON_EXE=%~dp0..\server\runtime\python.exe"
) else (
    set PYTHON_EXE=python
)

echo [INFO] Interpretador Python: %PYTHON_EXE%
echo [INFO] Criando pastas data/ e logs/ se necessario...
if not exist "data" mkdir data
if not exist "logs" mkdir logs

if not exist ".env" (
    copy .env.example .env > nul
    echo [OK] Arquivo .env criado a partir de .env.example.
)

echo.
echo ==========================================================
echo [OK] AMBIENTE PRONTO! INICIANDO SENTINEL v2 AGORA...
echo O monitor ficara ativo nesta janela. Nao feche.
echo Endereco: http://127.0.0.1:8765/dashboard
echo ==========================================================
echo.

%PYTHON_EXE% run_server.py
pause
