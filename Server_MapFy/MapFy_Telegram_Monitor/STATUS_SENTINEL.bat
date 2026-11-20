@echo off
chcp 65001 > nul
title Status do MapFy Sentinel v2
cd /d "%~dp0"

echo ==========================================================
echo    STATUS DO MAPFY SENTINEL v2
echo ==========================================================

set "FOUND=0"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8765" ^| findstr "LISTENING"') do (
    set "FOUND=1"
    echo [ATIVO] Sentinel v2 rodando na porta 8765 (PID: %%a)
)

echo.
if "%FOUND%"=="1" (
    echo [STATUS] O servico esta OPERACIONAL em segundo plano.
    echo [TELEGRAM] Envie /status no Telegram para interagir com o bot.
) else (
    echo [STATUS] O Sentinel NAO esta rodando no momento.
    echo Para iniciar: execute INICIAR_SEGUNDO_PLANO.bat ou INICIAR_SEGUNDO_PLANO.vbs
)

echo ==========================================================
echo.
pause
