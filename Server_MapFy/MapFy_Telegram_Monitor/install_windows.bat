@echo off
chcp 65001 > nul
title Instalacao MapFy Telegram Monitor
cd /d "%~dp0"

echo ==========================================================
echo    INSTALACAO - MAPFY TELEGRAM MONITOR
echo ==========================================================

REM Detecta interpretador Python
set PYTHON_EXE=python
if exist "..\server\runtime\python.exe" (
    set "PYTHON_EXE=..\server\runtime\python.exe"
)

echo [INFO] Interpretador: %PYTHON_EXE%
%PYTHON_EXE% --version
if errorlevel 1 (
    echo [ERRO] Python nao encontrado!
    pause
    exit /b 1
)

echo.
echo [1/3] Instalando dependencias...
%PYTHON_EXE% -m pip install -r requirements.txt

echo.
echo [2/3] Criando pastas data e logs...
if not exist "data" mkdir data
if not exist "logs" mkdir logs

echo.
echo [3/3] Verificando .env...
if not exist ".env" (
    copy .env.example .env > nul
    echo [AVISO] Arquivo .env criado a partir de .env.example.
) else (
    echo [OK] Arquivo .env ja presente.
)

echo.
echo ==========================================================
echo Instalacao concluida com sucesso!
echo ==========================================================
pause
