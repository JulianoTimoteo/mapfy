"""
Aplicação FastAPI - MapFy Sentinel v2.
Endpoints REST protegidos, observabilidade operacional, métricas Prometheus e Dashboard HTML embutido.
"""

from __future__ import annotations

import os
import shutil
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Optional

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

try:
    import psutil  # type: ignore
except ImportError:
    psutil = None

from notifier.config import Config
from notifier.database import DatabaseManager, to_local_str
from notifier.monitor import ExtractionMonitor
from notifier.security import verify_api_key
from notifier.telegram import TelegramClient

# Instâncias centrais do Sentinel
db_manager = DatabaseManager()
telegram_client = TelegramClient(db=db_manager)
monitor_engine = ExtractionMonitor(db=db_manager, telegram=telegram_client)
START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerencia o ciclo de vida da aplicação (inicia e finaliza threads em background)."""
    # 1. Inicia o monitor de heartbeat e anomalias
    monitor_engine.start_watcher()
    # 2. Inicia workers da fila outbox e listener do Telegram
    telegram_client.start_background_workers(db=db_manager, monitor_engine=monitor_engine)
    yield
    # Parada ordenada
    telegram_client.stop_background_workers()
    monitor_engine.stop_watcher()


app = FastAPI(
    title="MapFy Sentinel v2",
    description="Centro de Controle Operacional e Observabilidade do Extrator MapFy",
    version="2.0.0",
    docs_url="/docs" if Config.ENABLE_API_DOCS else None,
    redoc_url="/redoc" if Config.ENABLE_API_DOCS else None,
    openapi_url="/openapi.json" if Config.ENABLE_API_DOCS else None,
    lifespan=lifespan
)


# --- Modelos de Entrada Pydantic ---

class ExtractionStartRequest(BaseModel):
    run_id: Optional[str] = Field(None, description="Identificador único da execução (gerado se omitido)")
    server_name: Optional[str] = Field(None, description="Nome do servidor de origem")


class ExtractionEventRequest(BaseModel):
    run_id: str = Field(..., description="Identificador da execução")
    level: str = Field("INFO", description="Nível de severidade: INFO, WARNING, ERROR, CRITICAL")
    origin: str = Field(..., description="Módulo ou componente responsável pelo evento")
    message: str = Field(..., description="Descrição detalhada do evento ou erro")
    details: Optional[str] = Field(None, description="Traceback ou detalhes técnicos adicionais")


class ExtractionHeartbeatRequest(BaseModel):
    run_id: str = Field(..., description="Identificador da execução")
    stage: Optional[str] = Field(None, description="Nome do estágio corrente da automação")
    progress: Optional[float] = Field(None, description="Progresso percentual (0.0 a 100.0)")
    rows: Optional[int] = Field(None, description="Quantidade de linhas processadas até o momento")


class ExtractionFinishRequest(BaseModel):
    run_id: str = Field(..., description="Identificador da execução")
    status: str = Field("COMPLETED", description="Status final: COMPLETED, FAILED")
    summary: Optional[dict[str, Any]] = Field(None, description="Resumo analítico com totais de linhas, novos, etc.")


class TelegramTestRequest(BaseModel):
    message: Optional[str] = Field(None, description="Texto customizado para o teste")


# --- Endpoints Públicos e de Operação ---

@app.get("/health", tags=["Observabilidade"])
def get_health():
    """Endpoint básico para verificação de disponibilidade do Sentinel."""
    return {
        "status": "ok",
        "service": "MapFy Telegram Monitor",
        "version": "2.0.0",
        "telegram_configured": telegram_client.is_configured
    }


@app.get("/metrics", tags=["Observabilidade"])
def get_prometheus_metrics():
    """Exporta métricas operacionais no formato OpenMetrics / Prometheus."""
    recent = db_manager.get_recent_extractions(limit=50)
    total_runs = len(recent)
    success_runs = sum(1 for r in recent if r.get("status") == "COMPLETED" and r.get("error_count", 0) == 0)
    failed_runs = sum(1 for r in recent if r.get("status") == "FAILED")
    total_rows = sum(r.get("rows", 0) for r in recent)
    active = 1 if db_manager.get_active_extraction() else 0
    pending_outbox = len(db_manager.get_pending_outbox(limit=100))
    uptime = time.time() - START_TIME

    lines = [
        "# HELP mapfy_uptime_seconds Tempo em execucao do Sentinel v2",
        "# TYPE mapfy_uptime_seconds gauge",
        f"mapfy_uptime_seconds {uptime:.1f}",
        "# HELP mapfy_active_extraction Indicador se ha extracao em andamento (1 ou 0)",
        "# TYPE mapfy_active_extraction gauge",
        f"mapfy_active_extraction {active}",
        "# HELP mapfy_extractions_total Total de extracoes registradas recentemente",
        "# TYPE mapfy_extractions_total counter",
        f"mapfy_extractions_total {total_runs}",
        "# HELP mapfy_extractions_success_total Total de extracoes com sucesso absoluto",
        "# TYPE mapfy_extractions_success_total counter",
        f"mapfy_extractions_success_total {success_runs}",
        "# HELP mapfy_extractions_failed_total Total de extracoes finalizadas em falha",
        "# TYPE mapfy_extractions_failed_total counter",
        f"mapfy_extractions_failed_total {failed_runs}",
        "# HELP mapfy_rows_extracted_total Total consolidado de linhas processadas",
        "# TYPE mapfy_rows_extracted_total counter",
        f"mapfy_rows_extracted_total {total_rows}",
        "# HELP mapfy_outbox_pending_messages Mensagens aguardando entrega na fila outbox",
        "# TYPE mapfy_outbox_pending_messages gauge",
        f"mapfy_outbox_pending_messages {pending_outbox}",
    ]
    return Response(content="\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")


# --- Single-File Dashboard HTML (Fase 6) ---

DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MapFy Sentinel v2 — Centro de Controle</title>
  <style>
    :root {
      --bg: #0b1120;
      --card: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --success: #22c55e;
      --warning: #f59e0b;
      --danger: #ef4444;
      --neutral: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: var(--bg); color: var(--text); padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
    .header h1 { font-size: 24px; display: flex; align-items: center; gap: 10px; }
    .badge { padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .badge-running { background: rgba(34, 197, 94, 0.2); color: var(--success); border: 1px solid var(--success); }
    .badge-idle { background: rgba(100, 116, 139, 0.2); color: var(--text-muted); border: 1px solid var(--border); }
    .badge-error { background: rgba(239, 68, 68, 0.2); color: var(--danger); border: 1px solid var(--danger); }
    .badge-stalled { background: rgba(245, 158, 11, 0.2); color: var(--warning); border: 1px solid var(--warning); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 18px; }
    .card-title { font-size: 12px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 8px; }
    .card-value { font-size: 26px; font-weight: bold; }
    .card-sub { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
    .section-title { font-size: 18px; margin-bottom: 12px; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); font-size: 14px; }
    th { background: #162032; color: var(--text-muted); font-size: 12px; text-transform: uppercase; }
    tr:last-child td { border-bottom: none; }
    .btn { background: var(--primary); color: #0b1120; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
    .btn:hover { opacity: 0.9; }
    .mono { font-family: monospace; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🛡️ MapFy Sentinel v2 <span id="status-badge" class="badge badge-idle">CARREGANDO...</span></h1>
    <div>
      <span id="last-update" style="font-size: 13px; color: var(--text-muted); margin-right: 12px;"></span>
      <button class="btn" onclick="fetchData()">🔄 Atualizar</button>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-title">Execução Atual</div>
      <div id="current-run-id" class="card-value mono" style="font-size: 16px;">—</div>
      <div id="current-stage" class="card-sub">Estágio: AGUARDANDO</div>
    </div>
    <div class="card">
      <div class="card-title">Linhas Processadas</div>
      <div id="total-rows" class="card-value">—</div>
      <div id="rows-sub" class="card-sub">Na última extração</div>
    </div>
    <div class="card">
      <div class="card-title">Taxa de Sucesso</div>
      <div id="success-rate" class="card-value">—%</div>
      <div id="rate-sub" class="card-sub">Últimas 10 execuções</div>
    </div>
    <div class="card">
      <div class="card-title">Fila Outbox Telegram</div>
      <div id="outbox-count" class="card-value">—</div>
      <div id="outbox-sub" class="card-sub">Mensagens pendentes</div>
    </div>
  </div>

  <h2 class="section-title">📋 Execuções Recentes</h2>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Início</th>
        <th>Duração</th>
        <th>Status</th>
        <th>Linhas</th>
        <th>Erros</th>
      </tr>
    </thead>
    <tbody id="runs-table">
      <tr><td colspan="6" style="text-align:center; color: var(--text-muted);">Carregando dados do Sentinel...</td></tr>
    </tbody>
  </table>

  <script>
    async function fetchData() {
      try {
        const res = await fetch('/status');
        const data = await res.json();
        
        // Atualiza Badge
        const badge = document.getElementById('status-badge');
        badge.innerText = data.state;
        badge.className = 'badge ' + (
          data.state === 'RUNNING' ? 'badge-running' :
          data.state === 'IDLE' ? 'badge-idle' :
          data.state === 'STALLED' ? 'badge-stalled' : 'badge-error'
        );

        if (data.active_extraction) {
          document.getElementById('current-run-id').innerText = data.active_extraction.run_id;
          document.getElementById('current-stage').innerText = 'Estágio: ' + (data.active_extraction.stage || 'PROCESSANDO') + ' (' + (data.active_extraction.progress || 0) + '%)';
        } else {
          document.getElementById('current-run-id').innerText = 'Nenhuma ativa';
          document.getElementById('current-stage').innerText = 'Aguardando agendamento';
        }

        // Busca dados recentes
        const repRes = await fetch('/api/recent');
        const repData = await repRes.json();

        if (repData.latest) {
          document.getElementById('total-rows').innerText = Number(repData.latest.rows || 0).toLocaleString('pt-BR');
        }
        if (repData.stats) {
          document.getElementById('success-rate').innerText = repData.stats.success_rate + '%';
          document.getElementById('outbox-count').innerText = repData.stats.outbox_pending;
        }

        // Tabela
        const tbody = document.getElementById('runs-table');
        tbody.innerHTML = '';
        if (repData.history && repData.history.length > 0) {
          repData.history.forEach(r => {
            const tr = document.createElement('tr');
            const dur = Math.round(r.duration_seconds || 0);
            const durStr = Math.floor(dur / 60) + 'm ' + (dur % 60) + 's';
            tr.innerHTML = `
              <td class="mono"><code>${r.run_id}</code></td>
              <td>${r.start_time || '—'}</td>
              <td>${durStr}</td>
              <td><span class="badge ${r.status === 'COMPLETED' ? 'badge-running' : 'badge-error'}">${r.status}</span></td>
              <td>${Number(r.rows || 0).toLocaleString('pt-BR')}</td>
              <td>${r.error_count || 0}</td>
            `;
            tbody.appendChild(tr);
          });
        }

        document.getElementById('last-update').innerText = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR');
      } catch (err) {
        console.error('Falha ao atualizar dados:', err);
      }
    }

    fetchData();
    setInterval(fetchData, 4000);
  </script>
</body>
</html>
"""


@app.get("/dashboard", response_class=HTMLResponse, tags=["Dashboard"])
def get_dashboard():
    """Painel HTML único de observabilidade em tempo real do Sentinel."""
    return HTMLResponse(content=DASHBOARD_HTML)


# --- Endpoints Protegidos por Chave de API ---

@app.get("/status", dependencies=[Depends(verify_api_key)], tags=["Observabilidade"])
def get_status():
    """Retorna o estado detalhado da máquina de estados, execução ativa e integridade."""
    active = db_manager.get_active_extraction()
    incidents = db_manager.get_open_incidents()

    return {
        "state": monitor_engine.current_state,
        "current_run_id": monitor_engine.current_run_id,
        "active_extraction": active,
        "open_incidents": incidents,
        "telegram": {
            "configured": telegram_client.is_configured,
            "username": Config.TELEGRAM_BOT_USERNAME,
            "chat_id_set": bool(Config.TELEGRAM_CHAT_ID and Config.TELEGRAM_CHAT_ID != "OBTER_AUTOMATICAMENTE_OU_CONFIGURAR")
        }
    }


@app.get("/api/recent", dependencies=[Depends(verify_api_key)], tags=["Observabilidade"])
def get_recent_metrics():
    """Retorna dados agregados e histórico recente para alimentação do Dashboard."""
    history = db_manager.get_recent_extractions(limit=10)
    latest = db_manager.get_latest_extraction()
    pending_outbox = len(db_manager.get_pending_outbox(limit=100))

    success_cnt = sum(1 for r in history if r.get("status") == "COMPLETED" and r.get("error_count", 0) == 0)
    rate = round((success_cnt / len(history)) * 100, 1) if history else 100.0

    return {
        "latest": latest,
        "history": history,
        "stats": {
            "success_rate": rate,
            "outbox_pending": pending_outbox,
            "uptime_seconds": int(time.time() - START_TIME)
        }
    }


@app.get("/telegram/pair-code", dependencies=[Depends(verify_api_key)], tags=["Telegram"])
def get_pair_code():
    """Retorna o código de pareamento ativo do bot Telegram para autorização de admin."""
    saved_code = db_manager.get_bot_state("pair_code", "")
    if not saved_code:
        import secrets
        saved_code = f"{secrets.randbelow(900000) + 100000}"
        db_manager.set_bot_state("pair_code", saved_code)

    return {
        "success": True,
        "pair_code": saved_code,
        "instructions": f"Abra o bot no Telegram e envie: /parear {saved_code}"
    }


@app.get("/report/latest", dependencies=[Depends(verify_api_key)], tags=["Relatórios"])
def get_latest_report():
    """Retorna os dados completos e eventos da última extração registrada."""
    latest = db_manager.get_latest_extraction()
    if not latest:
        raise HTTPException(status_code=404, detail="Nenhuma extração registrada até o momento.")

    events = db_manager.get_events_for_run(latest["run_id"])
    return {
        "extraction": latest,
        "events": events
    }


@app.post("/telegram/test", dependencies=[Depends(verify_api_key)], tags=["Telegram"])
def test_telegram_message(req: TelegramTestRequest):
    """Envia uma mensagem de teste para o Telegram configurado."""
    if not telegram_client.is_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token do Telegram não configurado no .env"
        )

    text = req.message or (
        "MAPFY TELEGRAM MONITOR — TESTE DE COMUNICAÇÃO\n\n"
        "O microservidor de monitoramento está operando normalmente.\n"
        f"Servidor: {Config.SERVER_NAME}\n"
        "Status: ATIVO E CONECTADO"
    )

    try:
        res = telegram_client.send_message(text)
        return {
            "success": True,
            "message": "Mensagem de teste entregue à API do Telegram com sucesso.",
            "telegram_response": res
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha ao enviar mensagem ao Telegram: {e}"
        )


@app.post("/telegram/discover-chat", dependencies=[Depends(verify_api_key)], tags=["Telegram"])
def discover_chat_id():
    """Descobre o CHAT_ID do usuário que enviou /start ao bot."""
    if not telegram_client.is_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token do Telegram não configurado no .env"
        )

    chat_id = telegram_client.get_chat_id()
    if not chat_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma mensagem recente encontrada. Abra o bot no Telegram e envie /start primeiro."
        )

    return {
        "success": True,
        "chat_id": chat_id,
        "message": f"CHAT_ID detectado: {chat_id}. Atualize o TELEGRAM_CHAT_ID no seu arquivo .env."
    }


# --- Ciclo de Vida da Extração (Endpoints do Extrator) ---

@app.post("/extraction/start", dependencies=[Depends(verify_api_key)], tags=["Extração"])
def start_extraction(req: ExtractionStartRequest):
    """Registra o início de uma nova extração."""
    run_id = req.run_id or f"run_{uuid.uuid4().hex[:12]}"
    ext_data = monitor_engine.start_extraction(run_id, req.server_name)
    return {
        "success": True,
        "run_id": run_id,
        "extraction": ext_data
    }


@app.post("/extraction/event", dependencies=[Depends(verify_api_key)], tags=["Extração"])
def register_event(req: ExtractionEventRequest):
    """Registra um evento ou erro ocorrido durante a extração."""
    event_id = monitor_engine.register_event(
        run_id=req.run_id,
        level=req.level,
        origin=req.origin,
        message=req.message,
        details=req.details
    )
    return {
        "success": True,
        "event_id": event_id
    }


@app.post("/extraction/heartbeat", dependencies=[Depends(verify_api_key)], tags=["Extração"])
def register_heartbeat(req: ExtractionHeartbeatRequest):
    """Registra o pulso de vida de uma extração em andamento com dados de estágio e progresso."""
    updated = monitor_engine.register_heartbeat(
        run_id=req.run_id,
        stage=req.stage,
        progress=req.progress,
        rows=req.rows
    )
    if not updated:
        return {
            "success": False,
            "message": "Heartbeat descartado (execução inexistente, finalizada ou já arquivada)."
        }
    return {
        "success": True,
        "state": monitor_engine.current_state
    }


@app.post("/extraction/finish", dependencies=[Depends(verify_api_key)], tags=["Extração"])
def finish_extraction(req: ExtractionFinishRequest):
    """Registra a conclusão da extração e gera relatório analítico."""
    result = monitor_engine.finish_extraction(
        run_id=req.run_id,
        status=req.status,
        summary=req.summary
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Execução {req.run_id} não encontrada para finalização."
        )

    return {
        "success": True,
        "extraction": result
    }
