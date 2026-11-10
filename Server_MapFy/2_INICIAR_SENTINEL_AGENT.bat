@echo off
title 2 - Agente Sentinel (Segundo Plano)
color 0A
echo ===============================================================================
echo           MAPFY 2026 - 2. AGENTE SENTINEL (SEGUNDO PLANO)
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

echo [INFO] Disparando Agente Sentinel em segundo plano...
powershell -NoProfile -Command "Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList 'sentinel_agent.py' -WorkingDirectory '%SERVER_DIR%' -WindowStyle Hidden"
timeout /t 2 >nul
echo [OK] Agente Sentinel ativo com sucesso em segundo plano!
echo [HEARTBEAT] Telemetria enviando a cada 60s.
echo [LOG] Acompanhe em: server\sentinel_agent.log
echo.
echo Esta janela fechara automaticamente em 3 segundos...
timeout /t 3 >nul
