@echo off
title 6 - Parar Servicos MapFy
color 0C
echo ===============================================================================
echo           MAPFY 2026 - 6. PARADA DE SERVICOS EM SEGUNDO PLANO
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

echo [INFO] Encerrando servicos em segundo plano...
if exist "%SERVER_DIR%\mapfy_server.pid" (
    for /f %%i in (%SERVER_DIR%\mapfy_server.pid) do taskkill /f /pid %%i 2>nul
    del /f /q "%SERVER_DIR%\mapfy_server.pid" 2>nul
)
if exist "%SERVER_DIR%\sentinel_agent.pid" (
    for /f %%i in (%SERVER_DIR%\sentinel_agent.pid) do taskkill /f /pid %%i 2>nul
    del /f /q "%SERVER_DIR%\sentinel_agent.pid" 2>nul
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*mapfy_server.py*' -or $_.CommandLine -like '*sentinel_agent.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
taskkill /f /im MapFyServer.exe 2>nul
echo.
echo [OK] Todos os servicos em segundo plano foram finalizados!
timeout /t 3 >nul
