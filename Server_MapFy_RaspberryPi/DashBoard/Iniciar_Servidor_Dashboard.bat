@echo off
title Servidor Local MapFy Dashboards - Usina Pitangueiras
cd /d "%~dp0\.."
echo ========================================================
echo INICIANDO SERVIDOR LOCAL MAPFY DASHBOARDS - PORTA 5500
echo Usina Pitangueiras - Safra 2026
echo ========================================================
echo.
echo URL Mandala Hub: http://127.0.0.1:5500/DashBoard/index.html
echo.
echo Pressione Ctrl+C para encerrar o servidor.
echo.
python -m http.server 5500
pause
