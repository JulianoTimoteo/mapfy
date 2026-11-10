@echo off
title 1 - Servidor MapFy 24/7 (Segundo Plano)
color 0B
echo ===============================================================================
echo           MAPFY 2026 - 1. SERVIDOR INTEGRADO 24/7 (SEGUNDO PLANO)
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

netstat -ano | findstr :8000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [INFO] Servidor MapFy 24/7 ja esta ativo na porta 8000.
    echo [API] Acesse em: http://127.0.0.1:8000
    echo Esta janela fechara em 3 segundos...
    timeout /t 3 >nul
    exit /b 0
)
echo [INFO] Disparando Servidor MapFy 24/7 em segundo plano...
powershell -NoProfile -Command "Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList 'mapfy_server.py' -WorkingDirectory '%SERVER_DIR%' -WindowStyle Hidden"
timeout /t 2 >nul
echo [OK] Servidor iniciado com sucesso em segundo plano!
echo [API] Acesse em: http://127.0.0.1:8000
echo [LOG] Acompanhe em: server\mapfy_server.log
echo.
echo Esta janela fechara automaticamente em 3 segundos...
timeout /t 3 >nul
