@echo off
chcp 65001 > nul
title MapFy 2026 - Extrator Manual de Relatórios
color 0E

echo ===============================================================================
echo            MAPFY 2026 • EXTRATOR MANUAL DE RELATÓRIOS (USINA)
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

echo [INFO] Iniciando ciclo de extração manual...
"%PYTHON_CMD%" mapfy_extractor.py

echo.
echo [INFO] Processo concluído.
pause
