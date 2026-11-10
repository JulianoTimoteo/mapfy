from typing import Optional
from fastapi import Header, HTTPException, status
from notifier.config import Config, redact_token

MAX_TELEGRAM_MESSAGE_LENGTH = 4000


def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> bool:
    """
    Valida a chave de API fornecida no cabeçalho X-API-Key ou Authorization: Bearer.
    Lança HTTPException 401 caso a chave seja inválida ou ausente.
    """
    provided_key = None
    if x_api_key:
        provided_key = x_api_key.strip()
    elif authorization and authorization.lower().startswith("bearer "):
        provided_key = authorization[7:].strip()

    expected_key = Config.MONITOR_API_KEY.strip()
    if not expected_key:
        # Se nenhuma chave estiver configurada, rejeita por segurança
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="MONITOR_API_KEY não configurada no servidor."
        )

    if not provided_key or provided_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave de API inválida ou ausente."
        )

    return True


def sanitize_message_length(text: str, max_length: int = MAX_TELEGRAM_MESSAGE_LENGTH) -> str:
    """
    Garante que o texto da mensagem não ultrapasse o limite suportado pelo Telegram.
    Se ultrapassar, trunca preservando o início e adiciona aviso.
    """
    if not text:
        return ""
    
    # Aplica redação preventiva de credenciais antes de medir
    text = redact_token(text)
    
    if len(text) <= max_length:
        return text
    
    truncated_notice = "\n\n... [Mensagem truncada pelo monitor por exceder limite de tamanho]"
    cut_length = max_length - len(truncated_notice)
    return text[:cut_length] + truncated_notice


def validate_authorized_chat_id(target_chat_id: Optional[str | int] = None) -> str:
    """
    Garante que as notificações sejam enviadas exclusivamente para o CHAT_ID autorizado.
    Não permite que chamadas externas escolham destinatários arbitrários.
    """
    configured_id = str(Config.TELEGRAM_CHAT_ID).strip()
    
    if not configured_id or configured_id in ("OBTER_AUTOMATICAMENTE_OU_CONFIGURAR", "None", ""):
        raise ValueError("TELEGRAM_CHAT_ID não está configurado. Configure no .env ou utilize a descoberta automática.")
        
    if target_chat_id is not None:
        target_str = str(target_chat_id).strip()
        if target_str and target_str != configured_id:
            raise PermissionError(f"Destinatário {target_str} não autorizado. Apenas o CHAT_ID configurado tem permissão.")
            
    return configured_id
