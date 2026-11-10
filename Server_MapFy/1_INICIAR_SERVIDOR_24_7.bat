@echo off
setlocal
set "SERVER_DIR=%~dp0server"

if not exist "%SERVER_DIR%\INSTALAR_INICIALIZACAO.ps1" exit /b 1

powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SERVER_DIR%\INSTALAR_INICIALIZACAO.ps1" -StartNow >nul 2>nul
exit /b %errorlevel%
