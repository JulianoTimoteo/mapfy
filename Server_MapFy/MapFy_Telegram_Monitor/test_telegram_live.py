import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from notifier.config import Config, redact_token
from notifier.telegram import TelegramClient


def main():
    print("==========================================================")
    print("   TESTE DE COMUNICAÇÃO REAL COM A TELEGRAM BOT API")
    print("==========================================================")
    
    if not Config.TELEGRAM_BOT_TOKEN or Config.TELEGRAM_BOT_TOKEN.startswith("SUBSTITUIR"):
        print("[ERRO] Token do Telegram não configurado no arquivo .env!")
        sys.exit(1)

    client = TelegramClient()
    print(f"Bot Username esperado: @{Config.TELEGRAM_BOT_USERNAME}")
    print(f"Token configurado: {redact_token(Config.TELEGRAM_BOT_TOKEN[:10])}...")

    # 1. Teste de Conexão (getMe)
    print("\n[1/3] Testando conexão com a API do Telegram (getMe)...")
    try:
        me = client.test_connection()
        print(f"[OK] Conexão bem-sucedida!")
        print(f"     ID do Bot: {me.get('id')}")
        print(f"     Nome: {me.get('first_name')}")
        print(f"     Username: @{me.get('username')}")
    except Exception as e:
        print(f"[FALHA] Não foi possível conectar ao Telegram: {e}")
        sys.exit(1)

    # 2. Descoberta de CHAT_ID recente
    print("\n[2/3] Buscando mensagens recentes enviadas ao bot (getUpdates)...")
    try:
        chat_id = client.get_chat_id()
        if chat_id:
            print(f"[OK] Último CHAT_ID detectado: {chat_id}")
            if not Config.TELEGRAM_CHAT_ID or Config.TELEGRAM_CHAT_ID == "OBTER_AUTOMATICAMENTE_OU_CONFIGURAR":
                print(f"     -> Sugestão: atualize TELEGRAM_CHAT_ID={chat_id} no arquivo .env")
        else:
            print("[INFO] Nenhuma mensagem recente encontrada.")
            print("       Abra o Telegram, busque por @MapfySentinelBot e envie /start para o bot.")
    except Exception as e:
        print(f"[AVISO] Erro ao buscar atualizações: {e}")

    # 3. Envio de Mensagem de Teste (se houver CHAT_ID válido)
    print("\n[3/3] Verificando envio de mensagem de teste...")
    if Config.TELEGRAM_CHAT_ID and Config.TELEGRAM_CHAT_ID != "OBTER_AUTOMATICAMENTE_OU_CONFIGURAR":
        try:
            print(f"Enviando mensagem para o chat autorizado: {Config.TELEGRAM_CHAT_ID}...")
            res = client.send_message(
                "MAPFY TELEGRAM MONITOR — TESTE REAL\n\n"
                "Servidor: MAPFY-EXTRACTOR\n"
                "Status: Bot conectado e comunicando com sucesso!\n"
                "Timestamp: 10/11/2026"
            )
            print("[OK] Mensagem entregue com sucesso à API do Telegram!")
            print(f"     Message ID: {res.get('result', {}).get('message_id')}")
        except Exception as e:
            print(f"[FALHA] Erro ao enviar mensagem de teste: {e}")
    else:
        print("[INFO] Envio ignorado pois TELEGRAM_CHAT_ID ainda não está configurado.")
        print("       Envie /start ao bot no Telegram e rode este script novamente para detectá-lo.")

    print("\n==========================================================")
    print("Teste finalizado.")
    print("==========================================================")


if __name__ == "__main__":
    main()
