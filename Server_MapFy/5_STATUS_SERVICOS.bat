@echo off
title 5 - Status dos Servicos MapFy
color 0F
echo ===============================================================================
echo           MAPFY 2026 - 5. STATUS DOS SERVICOS EM SEGUNDO PLANO
echo ===============================================================================
echo.
set SERVER_DIR=%~dp0server
if not exist "%SERVER_DIR%" (
    echo [ERRO] Pasta 'server' nao encontrada em: %SERVER_DIR%
    timeout /t 3 >nul
    exit /b 1
)
cd /d "%SERVER_DIR%"
set "PYTHON_EXE="
if exist "%SERVER_DIR%\runtime\python.exe" (
    set "PYTHON_EXE=%SERVER_DIR%\runtime\python.exe"
    goto :PY_RESOLVED
)
if exist "%SERVER_DIR%\.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%SERVER_DIR%\.venv\Scripts\python.exe"
    goto :PY_RESOLVED
)
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    goto :PY_RESOLVED
)
if exist "C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe" (
    set "PYTHON_EXE=C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe"
    goto :PY_RESOLVED
)
if exist "C:\Python312\python.exe" (
    set "PYTHON_EXE=C:\Python312\python.exe"
    goto :PY_RESOLVED
)
:PY_RESOLVED
if not defined PYTHON_EXE (
    echo [ERRO] Python portatil nao foi localizado em: %SERVER_DIR%\runtime\python.exe
    echo Certifique-se de que a pasta 'server\runtime' esta presente.
    pause
    exit /b 2
)

echo DIAGNOSTICO DE SERVICOS EM SEGUNDO PLANO:
echo -------------------------------------------------------------------------------
netstat -ano | findstr :8000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [ONLINE] Servidor MapFy 24/7: ATIVO na Porta 8000
) else (
    echo [OFFLINE] Servidor MapFy 24/7: INATIVO (Porta 8000 livre)
)
if exist "%SERVER_DIR%\sentinel_agent.pid" (
    echo [ATIVO] Agente Sentinel: Heartbeat operacional (PID gravado)
) else (
    echo [INATIVO] Agente Sentinel: Parado
)
echo.
echo -------------------------------------------------------------------------------
echo Ultimas 8 linhas do log do servidor (server\mapfy_server.log):
echo -------------------------------------------------------------------------------
if exist "%SERVER_DIR%\mapfy_server.log" (
    powershell -NoProfile -Command "Get-Content '%SERVER_DIR%\mapfy_server.log' -Tail 8"
) else (
    echo (Nenhum log gerado ainda)
)
echo.
pause
