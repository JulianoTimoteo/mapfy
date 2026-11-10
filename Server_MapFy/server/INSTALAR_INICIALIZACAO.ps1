param(
    [switch]$StartNow
)

$ErrorActionPreference = "Stop"
$serverDir = $PSScriptRoot
$pythonw = Join-Path $serverDir "runtime\pythonw.exe"
$supervisor = Join-Path $serverDir "mapfy_background.py"
$installLog = Join-Path $serverDir "mapfy_background_install.log"
$taskName = "MapFyBackground"
$account = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

try {
    if (-not (Test-Path -LiteralPath $pythonw)) {
        throw "Python sem console não encontrado: $pythonw"
    }
    if (-not (Test-Path -LiteralPath $supervisor)) {
        throw "Supervisor MapFy não encontrado: $supervisor"
    }

    $action = New-ScheduledTaskAction `
        -Execute $pythonw `
        -Argument "-u `"$supervisor`"" `
        -WorkingDirectory $serverDir
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $account
    $principal = New-ScheduledTaskPrincipal `
        -UserId $account `
        -LogonType Interactive `
        -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet `
        -StartWhenAvailable `
        -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -RestartCount 999 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -MultipleInstances IgnoreNew `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -Hidden

    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description "Mantém o servidor MapFy, a extração incremental e o agente Sentinel ativos em segundo plano ao entrar nesta conta." `
        -Force | Out-Null

    $stopFile = Join-Path $serverDir "mapfy_background.stop"
    if (Test-Path -LiteralPath $stopFile) {
        Remove-Item -LiteralPath $stopFile -Force
    }

    if ($StartNow) {
        Start-ScheduledTask -TaskName $taskName
    }

    $message = "Tarefa $taskName configurada para iniciar ao entrar na conta $account."
    if ($StartNow) {
        $message += " Inicialização solicitada em segundo plano."
    }
    Add-Content -LiteralPath $installLog -Value "$(Get-Date -Format o) INFO $message"
    Write-Output $message
}
catch {
    Add-Content -LiteralPath $installLog -Value "$(Get-Date -Format o) ERROR $($_.Exception.Message)"
    exit 1
}
