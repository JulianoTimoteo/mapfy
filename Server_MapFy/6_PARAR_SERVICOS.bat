@echo off
setlocal
set "SERVER_DIR=%~dp0server"

if not exist "%SERVER_DIR%\PARAR_SERVICOS.ps1" exit /b 1

powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SERVER_DIR%\PARAR_SERVICOS.ps1" >nul 2>nul
exit /b %errorlevel%
