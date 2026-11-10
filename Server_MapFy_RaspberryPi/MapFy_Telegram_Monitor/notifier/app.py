import uuid
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from notifier.config import Config
from notifier.database import DatabaseManager
from notifier.monitor import ExtractionMonitor
from notifier.security import verify_api_key
from notifier.telegram import TelegramClient

# Instâncias centrais
db_manager = DatabaseManager()
telegram_client = TelegramClient()
monitor_engine = ExtractionMonitor(db=db_manager, telegram=telegram_client)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerencia o ciclo de vida da aplicação (inicia e finaliza threads em background)."""
    monitor_engine.start_background_watcher()
    yield
    monitor_engine.stop_background_watcher()


app = FastAPI(
    title="MapFy Telegram Monitor",
    description="Microservidor de observabilidade e alertas via Telegram para o extrator MapFy",
    version="1.0.0",
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


class ExtractionFinishRequest(BaseModel):
    run_id: str = Field(..., description="Identificador da execução")
    status: str = Field("COMPLETED", description="Status final: COMPLETED, FAILED")
    summary: Optional[dict[str, Any]] = Field(None, description="Resumo com totais de linhas, formulários, etc.")


class TelegramTestRequest(BaseModel):
    message: Optional[str] = Field(None, description="Texto customizado para o teste")


# --- Endpoints Públicos ---

@app.get("/health", tags=["Observabilidade"])
def get_health():
    """Endpoint básico para verificação de disponibilidade do microservidor."""
    return {
        "status": "ok",
        "service": "MapFy Telegram Monitor",
        "version": "1.0.0",
        "telegram_configured": telegram_client.is_configured
    }


# --- Endpoints Protegidos por Chave de API ---

@app.get("/status", dependencies=[Depends(verify_api_key)], tags=["Observabilidade"])
def get_status():
    """Retorna o estado detalhado da máquina de estados, execução ativa e integridade."""
    active = db_manager.get_active_extraction()
    incidents = []
    if active:
        inc = db_manager.get_open_incident(active["run_id"], "NO_HEARTBEAT")
        if inc:
            incidents.append(inc)

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
    """Registra o pulso de vida de uma extração em andamento."""
    updated = monitor_engine.register_heartbeat(req.run_id)
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
    """Registra a conclusão da extração e gera relatório."""
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
