@echo off
chcp 65001 > nul
title MapFy 2026 - API Gateway Local
color 0D

echo ===============================================================================
echo                 MAPFY 2026 • API GATEWAY LOCAL (PORTA 8000)
echo ===============================================================================
echo.

cd /d "%~dp0\server"

set "PYTHON_CMD="
if exist "%~dp0\.venv\Scripts\python.exe" (
    set "PYTHON_CMD=%~dp0\.venv\Scripts\python.exe"
) else if exist "C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe" (
    set "PYTHON_CMD=C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe"
) else (
    set "PYTHON_CMD=python"
)

echo [INFO] Iniciando API Gateway FastAPI na porta 8000...
"%PYTHON_CMD%" api_gateway.py

pause
