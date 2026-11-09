@echo off
chcp 65001 > nul
title MapFy 2026 - Suite de Testes do Servidor
color 0F

echo ===============================================================================
echo                MAPFY 2026 • SUITE DE TESTES DO SERVIDOR
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

echo [INFO] Executando testes unitarios em server\tests...
"%PYTHON_CMD%" -m unittest discover -s tests -p "test_*.py"

echo.
pause
