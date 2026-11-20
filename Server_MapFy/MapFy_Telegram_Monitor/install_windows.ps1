# ==============================================================================
# Script de Instalacao e Registro de Servico - MapFy Sentinel v2
# ==============================================================================
param (
    [switch]$AsTask,
    [switch]$SelfCheck
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   INSTALACAO - MAPFY SENTINEL v2 (CENTRO DE CONTROLE)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 1. Localizacao do Python
$pythonCmd = "python"
if (Test-Path "..\server\runtime\python.exe") {
    $pythonCmd = (Resolve-Path "..\server\runtime\python.exe").Path
}

Write-Host "[1/5] Verificando interpretador Python..." -ForegroundColor Yellow
try {
    $ver = & $pythonCmd --version
    Write-Host "Python encontrado: $ver ($pythonCmd)" -ForegroundColor Green
} catch {
    Write-Error "Python nao encontrado. Instale o Python 3.10+ ou forneca o runtime em ..\server\runtime\python.exe"
    exit 1
}

# 2. Instalacao de Dependencias
Write-Host "`n[2/5] Instalando dependencias do requirements.txt..." -ForegroundColor Yellow
& $pythonCmd -m pip install -r requirements.txt --quiet

# 3. Criacao dos Diretorios
Write-Host "`n[3/5] Garantindo diretorios operacionais..." -ForegroundColor Yellow
if (-not (Test-Path "data")) { New-Item -ItemType Directory -Path "data" | Out-Null }
if (-not (Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" | Out-Null }
Write-Host "Diretorios data/ e logs/ prontos." -ForegroundColor Green

# 4. Configuracao do .env
Write-Host "`n[4/5] Verificando configuracao do .env..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "[NOVO] Arquivo .env gerado a partir do modelo." -ForegroundColor Magenta
    # Gera chave de API segura
    Write-Host "Gerando chave de API de alta entropia..." -ForegroundColor Cyan
    & $pythonCmd run_server.py --generate-key
} else {
    Write-Host "[OK] Arquivo .env ja existente." -ForegroundColor Green
}

# 5. Autodiagnostico (Self-Check)
Write-Host "`n[5/5] Executando pre-flight check do Sentinel..." -ForegroundColor Yellow
& $pythonCmd run_server.py --selfcheck

# Opcional: Registro no Agendador de Tarefas do Windows e Inicializacao Automatica
if ($AsTask) {
    Write-Host "`n[SERVICO] Registrando inicializacao automatica com o Windows..." -ForegroundColor Yellow
    $taskName = "MapFy_Sentinel_Monitor"
    $pythonwCmd = $pythonCmd
    $candidate = [System.IO.Path]::ChangeExtension($pythonCmd, "w.exe")
    if (Test-Path $candidate) {
        $pythonwCmd = $candidate
    }
    
    $account = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $action = New-ScheduledTaskAction -Execute $pythonwCmd -Argument "run_server.py" -WorkingDirectory $scriptDir
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $account
    $principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet `
        -StartWhenAvailable `
        -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -RestartCount 999 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -MultipleInstances IgnoreNew `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -Hidden
    
    try {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
        Register-ScheduledTask `
            -TaskName $taskName `
            -Action $action `
            -Trigger $trigger `
            -Principal $principal `
            -Settings $settings `
            -Description "Mantém o Sentinel v2 do MapFy ativo em segundo plano 24/7 com reinício automático." | Out-Null
        Write-Host "[OK] Tarefa Agendada '$taskName' registrada com sucesso para iniciar ao logar no Windows!" -ForegroundColor Green
        
        # Inicia a tarefa imediatamente em segundo plano
        Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Write-Host "[OK] Sentinel v2 iniciado em segundo plano pela tarefa agendada." -ForegroundColor Green
    } catch {
        Write-Warning "Falha ao registrar tarefa no Agendador: $($_.Exception.Message)"
    }

    # Redundancia: Garante tambem na pasta Inicializar (Startup) do Windows do usuario
    try {
        $startupDir = [System.Environment]::GetFolderPath('Startup')
        $vbsSource = Join-Path $scriptDir "INICIAR_SEGUNDO_PLANO.vbs"
        if ((Test-Path $vbsSource) -and (Test-Path $startupDir)) {
            $startupTarget = Join-Path $startupDir "Iniciar_MapFy_Sentinel.vbs"
            Copy-Item -LiteralPath $vbsSource -Destination $startupTarget -Force
            Write-Host "[OK] Redundancia garantida: atalho criado na pasta Inicializar do Windows ($startupTarget)" -ForegroundColor Green
        }
    } catch {
        Write-Warning "Nao foi possivel copiar para a pasta Startup: $($_.Exception.Message)"
    }
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "Instalacao do MapFy Sentinel v2 finalizada com sucesso!" -ForegroundColor Green
Write-Host "Painel Dashboard local: http://127.0.0.1:8765/dashboard" -ForegroundColor Green
Write-Host "Para iniciar em primeiro plano: .\start_windows.bat" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
