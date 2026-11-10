$ErrorActionPreference = "Stop"

$src = (Get-Item ".\Server_MapFy").FullName
$dst = "E:\Server_MapFy"
$now = Get-Date

Write-Host "================================================="
Write-Host "SINCRONIZANDO PARA O PENDRIVE (E:\Server_MapFy)"
Write-Host "Timestamp aplicado: $($now.ToString('dd/MM/yyyy HH:mm:ss'))"
Write-Host "Origem: $src"
Write-Host "Destino: $dst"
Write-Host "================================================="

if (-not (Test-Path $dst)) {
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
}

# 1. Copiar arquivos da raiz
Write-Host "`n--- [1] ARQUIVOS DA RAIZ ---"
Get-ChildItem -Path $src -File | ForEach-Object {
    $target = Join-Path $dst $_.Name
    Copy-Item -Path $_.FullName -Destination $target -Force
    (Get-Item $target).LastWriteTime = $now
    Write-Host ("[RAIZ] {0} -> {1}" -f $_.Name, (Get-Item $target).LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss"))
}

# 2. Copiar arquivos da pasta server
Write-Host "`n--- [2] ARQUIVOS DE SERVER ---"
$serverSrc = Join-Path $src "server"
$serverDst = Join-Path $dst "server"
if (-not (Test-Path $serverDst)) {
    New-Item -ItemType Directory -Path $serverDst -Force | Out-Null
}

Get-ChildItem -Path $serverSrc -File | ForEach-Object {
    if ($_.Name -notmatch '\.(log|pid)$') {
        $target = Join-Path $serverDst $_.Name
        Copy-Item -Path $_.FullName -Destination $target -Force
        (Get-Item $target).LastWriteTime = $now
        Write-Host ("[SERVER] {0} -> {1}" -f $_.Name, (Get-Item $target).LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss"))
    }
}

# 3. Subpastas selecionadas
$subfolders = @("ferramentas", "tests", "specs")
foreach ($sub in $subfolders) {
    Write-Host "`n--- [3] SUBPASTA: $sub ---"
    $subSrc = Join-Path $serverSrc $sub
    $subDst = Join-Path $serverDst $sub
    if (Test-Path $subSrc) {
        if (-not (Test-Path $subDst)) {
            New-Item -ItemType Directory -Path $subDst -Force | Out-Null
        }
        Get-ChildItem -Path $subSrc -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($subSrc.Length).TrimStart('\', '/')
            $destPath = Join-Path $subDst $rel
            $destDir = Split-Path $destPath
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            Copy-Item -Path $_.FullName -Destination $destPath -Force
            (Get-Item $destPath).LastWriteTime = $now
            Write-Host ("[SUB] {0} -> {1}" -f $rel, (Get-Item $destPath).LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss"))
        }
    }
}

Write-Host "`n================================================="
Write-Host "SINCRONIZACAO CONCLUIDA COM SUCESSO!"
Write-Host "================================================="
