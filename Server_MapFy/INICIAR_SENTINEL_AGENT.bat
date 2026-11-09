@echo off
chcp 65001 > nul
title MapFy Sentinel - Agente de Heartbeat (Computador A)
color 0B

echo ===============================================================================
echo            MAPFY SENTINEL • AGENTE DE HEARTBEAT (COMPUTADOR A)
echo                Envia sinal de vida a cada 60s para o Computador B
echo ===============================================================================
echo.

cd /d "%~dp0\server"

if "%MAPFY_SENTINEL_URL%"=="" (
    set "MAPFY_SENTINEL_URL=http://127.0.0.1:8099"
)

echo [CONFIG] Destino do Sentinel: %MAPFY_SENTINEL_URL%
echo [CONFIG] Frequencia: 60 segundos
echo [CONFIG] Criptografia: HMAC-SHA256
echo.

set "PYTHON_CMD="
if exist "%~dp0\.venv\Scripts\python.exe" (
    set "PYTHON_CMD=%~dp0\.venv\Scripts\python.exe"
) else if exist "C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe" (
    set "PYTHON_CMD=C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe"
) else (
    set "PYTHON_CMD=python"
)

"%PYTHON_CMD%" sentinel_agent.py

pause
