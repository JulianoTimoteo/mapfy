$ErrorActionPreference = "Stop"
$serverDir = $PSScriptRoot
$taskName = "MapFyBackground"
$stopFile = Join-Path $serverDir "mapfy_background.stop"
$pidFile = Join-Path $serverDir "mapfy_background.pid"

try {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Disable-ScheduledTask -TaskName $taskName | Out-Null
    }

    Set-Content -LiteralPath $stopFile -Value "stop" -Encoding ASCII
    $deadline = (Get-Date).AddSeconds(60)
    while ((Test-Path -LiteralPath $pidFile) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 1
    }

    if (Test-Path -LiteralPath $pidFile) {
        $supervisorPid = 0
        if ([int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(), [ref]$supervisorPid)) {
            $process = Get-CimInstance Win32_Process -Filter "ProcessId = $supervisorPid"
            if ($process -and $process.CommandLine -like "*mapfy_background.py*") {
                Stop-Process -Id $supervisorPid -Force -ErrorAction SilentlyContinue
            }
        }
    }

    foreach ($service in @(
        @{ File = "mapfy_server.pid"; Script = "mapfy_server.py" },
        @{ File = "sentinel_agent.pid"; Script = "sentinel_agent.py" }
    )) {
        $servicePidFile = Join-Path $serverDir $service.File
        if (-not (Test-Path -LiteralPath $servicePidFile)) {
            continue
        }

        $servicePid = 0
        if ([int]::TryParse((Get-Content -LiteralPath $servicePidFile -Raw).Trim(), [ref]$servicePid)) {
            $process = Get-CimInstance Win32_Process -Filter "ProcessId = $servicePid"
            if ($process -and $process.CommandLine -like "*$($service.Script)*") {
                Stop-Process -Id $servicePid -Force -ErrorAction SilentlyContinue
            }
        }
        Remove-Item -LiteralPath $servicePidFile -Force -ErrorAction SilentlyContinue
    }

    Write-Output "Parada solicitada. A inicialização automática foi desativada."
}
catch {
    Write-Error "Falha ao parar serviços MapFy: $($_.Exception.Message)"
    exit 1
}
