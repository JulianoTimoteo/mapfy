@echo off
chcp 65001 > nul
title Servidor MapFy 24/7
cd /d "%~dp0"

if not exist "MapFyServer.exe" (
    echo [ERRO] MapFyServer.exe não foi encontrado nesta pasta.
    echo Execute o processo de compilação descrito no README.md.
    pause
    exit /b 1
)

MapFyServer.exe
if errorlevel 1 (
    echo.
    echo [ERRO] O servidor foi encerrado com erro. Consulte mapfy_server.log.
    pause
)
