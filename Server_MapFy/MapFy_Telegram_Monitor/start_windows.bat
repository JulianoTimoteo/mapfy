@echo off
chcp 65001 > nul
title MapFy Sentinel v2 [127.0.0.1:8765]
cd /d "%~dp0"

echo ==========================================================
echo    INICIANDO MAPFY SENTINEL v2 (CENTRO DE CONTROLE)
echo ==========================================================

REM Detecta interpretador Python no runtime portatil do servidor
set "PYTHON_EXE="
if exist "..\server\runtime\python.exe" (
    set "PYTHON_EXE=..\server\runtime\python.exe"
) else if exist "%~dp0..\server\runtime\python.exe" (
    set "PYTHON_EXE=%~dp0..\server\runtime\python.exe"
) else (
    set PYTHON_EXE=python
)

echo [INFO] Interpretador Python: %PYTHON_EXE%
echo [INFO] Endereco Local: http://127.0.0.1:8765
echo [INFO] Dashboard Web: http://127.0.0.1:8765/dashboard
echo [INFO] Para encerrar, feche esta janela ou execute stop_windows.bat
echo ==========================================================
echo.

%PYTHON_EXE% run_server.py 2>&1 | powershell -NoProfile -Command "$input | Tee-Object -FilePath 'logs\sentinel_console.log'"

if errorlevel 1 (
    echo.
    echo [ERRO] O servidor encerrou inesperadamente. Verifique a mensagem acima ou o arquivo logs\sentinel_console.log.
    pause
)
