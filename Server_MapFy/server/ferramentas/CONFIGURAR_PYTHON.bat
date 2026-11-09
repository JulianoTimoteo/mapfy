@echo off
title MapFy 2026 - Configurador de Python
color 0E

echo ===============================================================================
echo        MAPFY 2026 - CONFIGURADOR AUTOMATICO DE AMBIENTE PYTHON
echo ===============================================================================
echo.

set SCRIPT_DIR=%~dp0
set SERVER_DIR=%~dp0server

if not exist "%SERVER_DIR%" (
    echo [ERRO] Pasta server nao encontrada em: %SERVER_DIR%
    pause
    exit /b 1
)

cd /d "%SERVER_DIR%"

set SYS_PYTHON=
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set SYS_PYTHON=%LOCALAPPDATA%\Programs\Python\Python312\python.exe
if not defined SYS_PYTHON if exist "%LOCALAPPDATA%\Programs\Python\Python315\python.exe" set SYS_PYTHON=%LOCALAPPDATA%\Programs\Python\Python315\python.exe
if not defined SYS_PYTHON if exist "C:\Python312\python.exe" set SYS_PYTHON=C:\Python312\python.exe
if not defined SYS_PYTHON if exist "%ProgramFiles%\Python312\python.exe" set SYS_PYTHON=%ProgramFiles%\Python312\python.exe

if not defined SYS_PYTHON (
    where py.exe >nul 2>&1
    if %errorlevel% equ 0 set SYS_PYTHON=py -3.12
)

if not defined SYS_PYTHON (
    echo [ERRO] Python 3.10+ nao foi encontrado.
    echo Baixe e instale em: https://www.python.org/downloads/
    pause
    exit /b 2
)

echo [INFO] Python do sistema: %SYS_PYTHON%
if not exist "%SERVER_DIR%\.venv\Scripts\python.exe" (
    echo [INFO] Criando ambiente virtual .venv...
    %SYS_PYTHON% -m venv "%SERVER_DIR%\.venv"
)

if exist "%SERVER_DIR%\.venv\Scripts\python.exe" (
    echo [INFO] Instalando dependencias...
    "%SERVER_DIR%\.venv\Scripts\python.exe" -m pip install --upgrade pip
    "%SERVER_DIR%\.venv\Scripts\python.exe" -m pip install -r requirements.txt
    echo.
    echo [SUCESSO] Ambiente virtual configurado com sucesso!
) else (
    echo [ERRO] Nao foi possivel criar o ambiente virtual.
)
pause
