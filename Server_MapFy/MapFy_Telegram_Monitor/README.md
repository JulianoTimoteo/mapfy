# MapFy Sentinel v2 — Centro de Controle Operacional

Microserviço autônomo de observabilidade, resiliência, mensageria durável e controle remoto via Telegram para a automação de extração de dados do **MapFy**.

---

## 1. Visão Geral

O **Sentinel v2** transforma o monitor passivo original em um **centro de controle operacional completo**, executando localmente em `127.0.0.1:8765`. Ele acompanha o ciclo de vida da automação (`automacao_mapfy.py`), detecta travamentos no navegador, pontos cegos do agendador, expõe um cockpit visual em tempo real e permite comando bidirecional interativo via Telegram com botões inline.

### Destaques Arquiteturais
- **Zero Interferência:** Se o Telegram ou a rede oscilarem, a extração real nunca é interrompida.
- **Fila Durável Outbox:** Mensagens persistidas no SQLite em modo WAL com retry exponencial, backoff, jitter e respeito a rate limit HTTP 429 (`retry_after`).
- **Telegram Bidirecional com RBAC:** Suporte a comandos interativos (`/status`, `/ultimo`, `/historico`, `/erros`, `/logs`, `/saude`, `/rodar_agora`, `/silenciar`) e botões inline com perfis `admin` e `viewer`.
- **Anti-Flood Inteligente:** Erros repetitivos são agrupados por fingerprint e atualizados in-place na mensagem original sem gerar enxurrada de notificações.
- **Dead Man's Switch:** Dispara alerta caso o Agendador de Tarefas do Windows falhe e nenhuma extração inicie dentro da janela programada.
- **Detecção de STALLED:** Monitora o estágio atual do navegador e detecta travamento mesmo se a thread Python continuar viva.
- **Cockpit Visual HTML:** Dashboard responsivo de página única acessível em `http://127.0.0.1:8765/dashboard` sem dependências externas de CDN.
- **Métricas Prometheus:** Exportação padronizada em `http://127.0.0.1:8765/metrics`.

---

## 2. Estrutura de Diretórios

```text
MapFy_Telegram_Monitor/
│
├── .env.example             # Modelo oficial de configuração
├── requirements.txt         # Dependências do microservidor
├── README.md                # Documentação completa
├── CHANGELOG.md             # Histórico de versões
├── run_server.py            # Ponto de entrada com CLI de autodiagnóstico
├── install_windows.ps1      # Instalação e agendamento como tarefa no Windows
├── uninstall_windows.ps1    # Remoção e limpeza de tarefa agendada
├── start_windows.bat        # Inicialização rápida
├── stop_windows.bat         # Encerramento limpo de processo
├── MapFy_Telegram_Monitor.spec # Configuração de empacotamento PyInstaller
│
├── notifier/                # Núcleo Operacional do Sentinel
│   ├── app.py               # API FastAPI, rotas, dashboard HTML e métricas
│   ├── bot_commands.py      # Manipulador de comandos e permissões do Telegram
│   ├── config.py            # Resolução em cascata (Keyring -> Env -> .env)
│   ├── database.py          # SQLite WAL versionado (v2), Outbox e incidentes
│   ├── monitor.py           # Máquina de estados, Dead Man's Switch e STALLED
│   ├── security.py          # Comparação em tempo constante e IP Rate Limiting
│   └── telegram.py          # Cliente HTTP, workers de outbox e long-polling
│
├── integration/             # Módulos de Integração para a Automação
│   ├── notifier_client.py   # ExtractionReporter com context managers de estágio
│   └── logging_handler.py   # Handler para roteamento de logs do Python
│
└── tests/                   # Bateria com 31 testes unitários automatizados
    ├── test_api.py          # Testes de contrato REST e segurança da API
    ├── test_database.py     # Testes de persistência, migrações e incidentes
    ├── test_monitor.py      # Testes de transição de estados e timeouts
    ├── test_telegram.py     # Testes de formatação e sanitização de dados
    └── test_sentinel_v2.py  # Testes de Outbox, anti-flood, RBAC e comandos
```

---

## 3. Instalação e Configuração

### 3.1 Instalação Automática no Windows
Abra o PowerShell na pasta do projeto e execute:
```powershell
.\install_windows.ps1
```
Para registrar o Sentinel como **Tarefa Agendada do Windows** com auto-recuperação contínua:
```powershell
.\install_windows.ps1 -AsTask
```

### 3.2 Geração de Chave de API e Configuração de Segredos
O Sentinel nunca utiliza senhas padrão em produção. Para gerar uma chave criptográfica forte:
```powershell
python run_server.py --generate-key
```

Para armazenar a chave com segurança no **Windows Credential Manager**:
```powershell
python run_server.py --set-secret MONITOR_API_KEY --value "SUA_CHAVE_AQUI"
```

### 3.3 Autodiagnóstico Pré-Voo
Verifique se todo o ambiente, banco de dados e permissões estão íntegros executando:
```powershell
python run_server.py --selfcheck
```

---

## 4. Comandos do Bot no Telegram

| Comando | Descrição | Nível de Acesso |
| :--- | :--- | :---: |
| `/status` | Exibe o estado operacional, estágio atual e progresso | Todos |
| `/ultimo` | Relatório analítico completo da última extração | Todos |
| `/historico` | Lista consolidada das últimas 5 execuções | Todos |
| `/erros` | Últimos 5 erros registrados com traceback | Todos |
| `/logs [N]` | Últimas N linhas do log operacional ativo | Todos |
| `/proxima` | Previsão da próxima execução agendada | Todos |
| `/saude` | Diagnóstico de CPU, RAM, discos C: e D: e SQLite | Todos |
| `/silenciar [m]` | Suspende notificações de incidentes por M minutos | Todos |
| `/retomar` | Reativa notificações operacionais imediatamente | Todos |
| `/rodar_agora` | Dispara o extrator `automacao_mapfy.py` manualmente | **Admin** |
| `/parar` | Solicita cancelamento da execução ativa | **Admin** |
| `/parear [código]`| Pareia o primeiro administrador usando código de 6 dígitos | — |
| `/ajuda` | Exibe o menu completo e atalhos rápidos | Todos |

---

## 5. Dashboard Cockpit Visual

Acesse `http://127.0.0.1:8765/dashboard` diretamente pelo navegador da máquina host para visualizar:
- KPIs de execução em tempo real (Estado, Estágio, Linhas, Taxa de Sucesso);
- Fila Outbox e diagnósticos do sistema;
- Histórico tabular recente atualizado automaticamente a cada 4 segundos.

---

## 6. Execução da Bateria de Testes

Para validar a integridade de todas as camadas do sistema:
```powershell
$env:PYTHONPATH="."
python -m unittest discover -s tests
```
*Total de 31 testes unitários com cobertura de banco de dados, API, concorrência, outbox e comandos.*
