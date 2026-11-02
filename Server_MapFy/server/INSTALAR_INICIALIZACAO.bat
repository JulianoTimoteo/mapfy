@echo off
chcp 65001 > nul
title Inicializacao Automatica do Servidor MapFy

powershell -NoProfile -ExecutionPolicy Bypass -Command "$serverDir = '%~dp0'.TrimEnd('\'); $exe = Join-Path $serverDir 'MapFyServer.exe'; if (-not (Test-Path -LiteralPath $exe)) { Write-Error 'MapFyServer.exe não encontrado.'; exit 1 }; $action = New-ScheduledTaskAction -Execute $exe -WorkingDirectory $serverDir; $trigger = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name); Register-ScheduledTask -TaskName 'MapFyServer' -Action $action -Trigger $trigger -Description 'Inicia a API e a extração agendada do MapFy ao entrar no Windows.' -Force | Out-Null; Write-Host 'Inicialização automática configurada com sucesso para a pasta:' $serverDir"
if errorlevel 1 (
    echo.
    echo [ERRO] Não foi possível criar a tarefa de inicialização.
    pause
    exit /b 1
)

echo O servidor MapFy será iniciado quando esta conta entrar no Windows.
pause
