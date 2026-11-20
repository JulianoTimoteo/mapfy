@echo off
chcp 65001 > nul
title Parar MapFy Sentinel v2
cd /d "%~dp0"

echo ==========================================================
echo    ENCERRANDO MAPFY SENTINEL v2 (SEGUNDO PLANO)
echo ==========================================================

set "FOUND=0"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8765" ^| findstr "LISTENING"') do (
    set "FOUND=1"
    echo [INFO] Finalizando processo Sentinel PID %%a na porta 8765...
    taskkill /F /PID %%a > nul 2>&1
)

if "%FOUND%"=="1" (
    echo.
    echo [OK] Sentinel encerrado com sucesso.
) else (
    echo.
    echo [INFO] O Sentinel nao estava em execucao na porta 8765.
)

echo ==========================================================
timeout /t 3 > nul
