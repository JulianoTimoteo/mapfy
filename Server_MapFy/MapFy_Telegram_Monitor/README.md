# MapFy Telegram Monitor

Microservidor Python independente e desacoplado para observabilidade, heartbeat contínuo e notificações em tempo real do processo de extração de dados do **MapFy** via Telegram Bot API oficial.

---

## 1. Visão Geral da Arquitetura

O **MapFy Telegram Monitor** opera como um serviço satélite leve que roda localmente em `127.0.0.1:8765`. Ele não interfere nas regras de negócio, seletores, Playwright ou fluxo de dados do extrator principal.

### Principais Características
- **Independência Total:** Se o monitor ou o Telegram estiverem offline, o processo de extração do MapFy continua normalmente sem ser interrompido.
- **Segurança Reforçada:**
  - O Token do Telegram reside exclusivamente no arquivo `.env` (nunca no código ou versionado).
  - Todas as mensagens e logs passam por sanitização automática (`[REDACTED_TELEGRAM_TOKEN]`).
  - Endpoints operacionais protegidos por chave de API (`X-API-Key`).
  - Restrição rígida de destinatário: notificações são enviadas exclusivamente para o `TELEGRAM_CHAT_ID` configurado.
- **Máquina de Estados & Heartbeat:**
  - Estados: `IDLE`, `RUNNING`, `RUNNING_WITH_ERRORS`, `COMPLETED`, `FAILED`, `NO_HEARTBEAT`, `RECOVERED`.
  - Se a extração passar mais de 180 segundos sem enviar heartbeat, um incidente é aberto no SQLite e um alerta de interrupção é disparado (com proteção anti-duplicação).
  - Ao retomar os pulsos de vida, o incidente é fechado e uma notificação de recuperação é enviada.
- **Banco de Dados Local SQLite (Modo WAL):**
  - Armazena histórico completo de execuções, tempos de início/término, durações, eventos, erros e incidentes em `data/monitor.db`.

---

## 2. Estrutura de Diretórios

```text
MapFy_Telegram_Monitor/
│
├── .env                     # Credenciais locais (ignorado no Git)
├── .env.example             # Modelo de configuração
├── requirements.txt         # Dependências do microservidor
├── README.md                # Documentação do sistema
├── run_server.py            # Ponto de entrada do microservidor
├── install_windows.ps1      # Script PowerShell de instalação
├── install_windows.bat      # Script Batch de instalação
├── start_windows.bat        # Script para iniciar o serviço
├── stop_windows.bat         # Script para parar o serviço
│
├── notifier/                # Núcleo do Microservidor
│   ├── __init__.py
│   ├── app.py               # MicroAPI FastAPI com rotas protegidas
│   ├── telegram.py          # Cliente oficial Telegram Bot API e modelos
│   ├── database.py          # Gerenciador SQLite com modo WAL e índices
│   ├── monitor.py           # Máquina de estados e thread de heartbeat
│   ├── security.py          # Validação de API Key e autorização de chat
│   └── config.py            # Leitura de configurações e sanitização de logs
│
├── integration/             # Módulos para o Extrator MapFy
│   ├── __init__.py
│   ├── notifier_client.py   # Cliente desacoplado e resiliente (ExtractionReporter)
│   └── logging_handler.py   # Handler do logging Python para captura automática
│
├── tests/                   # Suíte de Testes Automatizados
│   ├── test_telegram.py     # Testes de formatação, sanitização e segurança
│   ├── test_database.py     # Testes de persistência, métricas e integridade
│   ├── test_api.py          # Testes dos endpoints HTTP e autenticação
│   └── test_monitor.py      # Testes de máquina de estados e timeouts
│
├── data/
│   └── monitor.db           # Banco SQLite de monitoramento
│
└── logs/
    └── monitor.log          # Arquivo de logs rotativos do monitor
```

---

## 3. Configuração do Bot do Telegram

1. Acesse o **BotFather** no Telegram e crie seu bot (ou use o bot existente `@MapfySentinelBot`).
2. Obtenha o token gerado (ex: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789`).
3. Abra uma conversa com o bot no Telegram (`https://t.me/MapfySentinelBot`) e envie a mensagem `/start`.
4. Configure as variáveis no arquivo `.env`:
   ```env
   TELEGRAM_BOT_USERNAME=MapfySentinelBot
   TELEGRAM_BOT_TOKEN=seu_token_aqui
   TELEGRAM_CHAT_ID=seu_chat_id_aqui
   MONITOR_API_KEY=mapfy_monitor_secret_key_2026
   ```

*(Dica: Se não souber seu CHAT_ID, envie `/start` ao bot e use a ferramenta de descoberta do monitor).*

---

## 4. Como Executar

### Instalação
Dê um duplo clique em `install_windows.bat` ou execute via PowerShell:
```powershell
.\install_windows.ps1
```

### Inicialização
Dê um duplo clique em `start_windows.bat`. O servidor subirá em:
`http://127.0.0.1:8765`

### Parada
Dê um duplo clique em `stop_windows.bat`.

---

## 5. Endpoints da MicroAPI

| Método | Endpoint | Protegido? | Descrição |
| :--- | :--- | :---: | :--- |
| `GET` | `/health` | Não | Verifica se o microservidor está online |
| `GET` | `/status` | **Sim** (`X-API-Key`) | Retorna estado atual, execução ativa e incidentes |
| `GET` | `/report/latest` | **Sim** (`X-API-Key`) | Retorna relatório da última extração e eventos |
| `POST` | `/telegram/test` | **Sim** (`X-API-Key`) | Dispara mensagem de teste para o chat configurado |
| `POST` | `/telegram/discover-chat` | **Sim** (`X-API-Key`) | Detecta o CHAT_ID que enviou `/start` ao bot |
| `POST` | `/extraction/start` | **Sim** (`X-API-Key`) | Inicia monitoramento de uma execução |
| `POST` | `/extraction/event` | **Sim** (`X-API-Key`) | Registra evento/erro operacional ou exceção |
| `POST` | `/extraction/heartbeat`| **Sim** (`X-API-Key`) | Pulso de vida da extração (a cada 60s) |
| `POST` | `/extraction/finish` | **Sim** (`X-API-Key`) | Encerra execução e gera relatório consolidado |

---

## 6. Como Usar no Extrator MapFy

```python
from integration.notifier_client import ExtractionReporter
from integration.logging_handler import TelegramMonitorLoggingHandler
import logging

# 1. Cria a instância do reporter
reporter = ExtractionReporter(
    base_url="http://127.0.0.1:8765",
    api_key="mapfy_monitor_secret_key_2026",
    auto_heartbeat=True  # Thread em segundo plano envia pulso a cada 60s
)

# 2. Conecta ao logging do Python para captura automática de erros
logging.getLogger().addHandler(TelegramMonitorLoggingHandler(reporter))

# 3. Notifica o início da extração
run_id = reporter.start()

try:
    # Executa a rotina do MapFy normalmente...
    # ...
    # Pode enviar eventos manuais quando desejar:
    reporter.event(level="INFO", message="Download concluído com sucesso")

    # Finaliza com sucesso
    reporter.finish(status="COMPLETED", summary={"total_linhas": 1500})
except Exception as e:
    reporter.event(level="ERROR", message=str(e), details=traceback.format_exc())
    reporter.finish(status="FAILED")
    raise
```

---

## 7. Execução dos Testes Automatizados

Para rodar todos os testes automatizados:
```powershell
python -m unittest discover -s tests -v
```
