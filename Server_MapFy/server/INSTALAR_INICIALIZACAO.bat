@echo off
setlocal
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0INSTALAR_INICIALIZACAO.ps1" -StartNow >nul 2>nul
exit /b %errorlevel%
