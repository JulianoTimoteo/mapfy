@echo off
chcp 65001 > nul
title Registrar Sentinel no Windows (Inicio Automatico 24/7)
cd /d "%~dp0"

echo ==========================================================
echo    REGISTRAR MAPFY SENTINEL v2 NO AGENDADOR DO WINDOWS
echo ==========================================================
echo Este script registra o Sentinel para iniciar sozinho em segundo plano
echo sempre que o computador ligar ou reiniciar, sem janelas abertas.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_windows.ps1" -AsTask

echo.
pause
