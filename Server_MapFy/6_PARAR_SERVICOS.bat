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
set PYTHON_EXE=
if exist "%SERVER_DIR%\.venv\Scripts\python.exe" set PYTHON_EXE=%SERVER_DIR%\.venv\Scripts\python.exe
if not defined PYTHON_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe
if not defined PYTHON_EXE if exist "C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe" set PYTHON_EXE=C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe
if not defined PYTHON_EXE (
    where py.exe >nul 2>&1
    if %errorlevel% equ 0 set PYTHON_EXE=py -3.12
)
if not defined PYTHON_EXE set PYTHON_EXE=python.exe

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