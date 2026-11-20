# ==============================================================================
# Script de Desinstalacao e Remocao de Servico - MapFy Sentinel v2
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   DESINSTALACAO - MAPFY SENTINEL v2" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$taskName = "MapFy_Sentinel_Monitor"

# 1. Encerra processo em execucao na porta 8765
Write-Host "[1/2] Encerrando processos ativos na porta 8765..." -ForegroundColor Yellow
$connections = Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue
if ($connections) {
    foreach ($conn in $connections) {
        try {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "Processo PID $($conn.OwningProcess) encerrado." -ForegroundColor Green
        } catch {}
    }
} else {
    Write-Host "Nenhum processo em escuta na porta 8765." -ForegroundColor Gray
}

# 2. Remove tarefa agendada
Write-Host "`n[2/2] Removendo tarefa agendada '$taskName'..." -ForegroundColor Yellow
try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
    Write-Host "Tarefa Agendada '$taskName' removida com sucesso." -ForegroundColor Green
} catch {
    Write-Host "Nenhuma tarefa agendada '$taskName' encontrada para remover." -ForegroundColor Gray
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "Desinstalacao concluida." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
