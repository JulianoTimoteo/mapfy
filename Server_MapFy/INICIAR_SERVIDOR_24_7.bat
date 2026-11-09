@echo off
chcp 65001 > nul
title [Mapfy 2026 - Servidor 24/7 Ativo - Usina Pitangueiras]
color 0A

echo ==============================================================================
echo       MAPFY 2026 - SERVIÇO EM ALTA DISPONIBILIDADE (24/7)
echo       Usina Pitangueiras • Safra 2026
echo ==============================================================================
echo.
echo [INFO] Servidor configurado para execucao ininterrupta.
echo [INFO] Se o processo sofrer qualquer interrupcao, ele reiniciara automaticamente.
echo [INFO] Para encerrar voluntariamente, feche esta janela ou pressione Ctrl+C.
echo.

cd /d "%~dp0\server"

if exist "MapFyServer.exe" (
    echo [INFO] Executando o Servidor MapFy empacotado...
    MapFyServer.exe
    exit /b %ERRORLEVEL%
)

:: Detecta interpretador Python
set "PYTHON_CMD="
if exist "%~dp0\.venv\Scripts\python.exe" (
    set "PYTHON_CMD=%~dp0\.venv\Scripts\python.exe"
) else if exist "C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe" (
    set "PYTHON_CMD=C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe"
) else (
    set "PYTHON_CMD=python"
)

:loop
echo [%date% %time%] Iniciando Watchdog Guardian do Servidor Mapfy...
"%PYTHON_CMD%" watchdog_service.py

echo.
echo [ALERTA] Processo do Watchdog foi encerrado em %date% as %time%!
echo [INFO] Reiniciando automaticamente em 5 segundos...
echo ==============================================================================
timeout /t 5 /nobreak > nul
goto loop
