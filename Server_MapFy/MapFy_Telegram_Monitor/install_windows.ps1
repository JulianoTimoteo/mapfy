# Script de Instalacao do MapFy Telegram Monitor para Windows
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   INSTALACAO - MAPFY TELEGRAM MONITOR" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 1. Verifica Python
$pythonCmd = "python"
try {
    & $pythonCmd --version
} catch {
    Write-Error "Python nao encontrado no PATH do sistema. Instale o Python 3.10+ ou use o runtime do servidor."
    exit 1
}

# 2. Instala dependencias
Write-Host "`n[1/3] Instalando dependencias do requirements.txt..." -ForegroundColor Yellow
& $pythonCmd -m pip install -r requirements.txt

# 3. Cria diretorios necessarios
Write-Host "`n[2/3] Criando diretorios de dados e logs..." -ForegroundColor Yellow
if (-not (Test-Path "data")) { New-Item -ItemType Directory -Path "data" | Out-Null }
if (-not (Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" | Out-Null }

# 4. Cria arquivo .env a partir do .env.example se nao existir
Write-Host "`n[3/3] Verificando configuracao do .env..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "[AVISO] Arquivo .env criado a partir de .env.example. Edite com seu TOKEN do BotFather." -ForegroundColor Magenta
} else {
    Write-Host "[OK] Arquivo .env ja existente." -ForegroundColor Green
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "Instalacao concluida com sucesso!" -ForegroundColor Green
Write-Host "Para iniciar o monitor, execute: .\start_windows.bat" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
