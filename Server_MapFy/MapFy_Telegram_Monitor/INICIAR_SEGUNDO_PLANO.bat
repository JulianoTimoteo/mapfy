@echo off
chcp 65001 > nul
title Iniciar MapFy Sentinel v2 em Segundo Plano
cd /d "%~dp0"

echo ==========================================================
echo    MAPFY SENTINEL v2 - INICIALIZADOR EM SEGUNDO PLANO
echo ==========================================================

REM Verifica se já está em execução na porta 8765
netstat -ano | findstr ":8765" | findstr "LISTENING" > nul 2>&1
if not errorlevel 1 (
    echo [AVISO] O Sentinel v2 JA ESTA EM EXECUCAO na porta 8765!
    echo Nao e necessario iniciar novamente.
    echo O bot Telegram @MapfySentinelBot esta respondendo aos comandos.
    echo ==========================================================
    timeout /t 5 > nul
    exit /b 0
)

echo [INFO] Disparando Sentinel v2 silenciosamente em segundo plano...
start "" wscript.exe "%~dp0INICIAR_SEGUNDO_PLANO.vbs"

echo [INFO] Aguardando estabilizacao do servico (3 segundos)...
timeout /t 3 > nul

REM Checa se subiu com sucesso na porta 8765
netstat -ano | findstr ":8765" | findstr "LISTENING" > nul 2>&1
if not errorlevel 1 (
    echo.
    echo ==========================================================
    echo [SUCESSO] MapFy Sentinel v2 esta rodando em SEGUNDO PLANO!
    echo.
    echo  * Nenhuma janela preta precisa ficar aberta na tela.
    echo  * O bot @MapfySentinelBot esta monitorando 24/7.
    echo  * Logs sendo gravados em: logs\sentinel.log
    echo  * Teste no Telegram: envie /status
    echo  * Para encerrar no futuro: execute PARAR_SENTINEL.bat
    echo ==========================================================
) else (
    echo.
    echo [AVISO] O comando de segundo plano foi enviado.
    echo Se nao responder em instantes, confira logs\sentinel.log.
    echo ==========================================================
)

timeout /t 6 > nul
