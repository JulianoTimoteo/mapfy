# Changelog — MapFy Telegram Monitor / Sentinel

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.

## [2.0.0] — Sentinel (2026-11-20)

### 🛡️ Segurança e Higiene do Repositório (Fase 0)
- **Remoção de chaves hardcoded:** A chave de API padrão (`mapfy_monitor_secret_key_2026`) foi completamente erradicada do código-fonte, testes e templates.
- **Cofre em Cascata:** Resolução de segredos com prioridade estrita: Windows Credential Manager (Keyring) -> Variável de Ambiente (`os.environ`) -> Arquivo `.env` local.
- **Comparação em Tempo Constante:** Autenticação da API Key agora utiliza `hmac.compare_digest` mitigando ataques de timing.
- **IP Rate Limiting e Auto-Ban:** Proteção por força bruta que bloqueia temporariamente (HTTP 429) IPs com mais de 5 falhas consecutivas de autenticação.
- **Redação Aprofundada:** Mascaramento automático de tokens Telegram e chaves em logs, exceptions e URLs.
- **Higienização do Git:** Desindexação de binários `.exe`, caches, bancos `.db` e inclusão de regras estritas no `.gitignore`.

### 📦 Fila Durável Outbox & Anti-Flood (Fase 1)
- **Tabela Outbox em SQLite (WAL):** Envio assíncrono e durável de mensagens, desacoplando completamente as requisições HTTP do Telegram.
- **Tratamento de Rate Limit 429:** Respeito integral ao cabeçalho `Retry-After` e parâmetro `retry_after` da Telegram Bot API.
- **Retry Exponencial com Jitter:** Retentativas inteligentes para falhas de rede transitórias.
- **Deduplicação Anti-Flood por Fingerprint:** Erros repetidos na mesma janela de tempo são agrupados e atualizados in-place na mensagem original via `editMessageText`, eliminando spam.

### 🤖 Telegram Bidirecional & Centro de Controle (Fase 2)
- **Long-Polling com Offset Persistente:** Thread em background consumindo `getUpdates` com offset gravado na tabela `bot_state`.
- **Controle de Acesso RBAC:** Whitelist de usuários autorizados com papéis `admin` e `viewer`.
- **Pareamento Seguro por Código:** Procedimento de pareamento via `/parear <CÓDIGO>` de 6 dígitos gerado no console/API para o primeiro administrador.
- **Comandos Interativos:**
  - `/status` — Exibição de estado, estágio, progresso e badges dinâmicos.
  - `/ultimo` — Relatório analítico rico com total de linhas, velocidade (lin/s) e tamanho do XLSX.
  - `/historico` — Visão consolidada das últimas execuções com taxa de sucesso.
  - `/erros` — Lista dos últimos erros registrados com traceback resumido.
  - `/logs [N]` — Consulta remota em tempo real às últimas linhas do log operacional.
  - `/proxima` — Previsão da próxima execução agendada.
  - `/silenciar [min]` & `/retomar` — Gestão de modo silencioso para alertas operacionais.
  - `/saude` — Diagnóstico de CPU, RAM, espaço em disco (C: e D:) e status do banco.
  - `/rodar_agora` & `/parar` — Controle remoto da execução do extrator (restrito a admins).
- **Inline Keyboards e Callbacks:** Botões clicáveis integrados diretamente nos alertas de incidente.

### 👁️ Observabilidade Avançada & Detecção de Anomalias (Fase 3)
- **Dead Man's Switch:** Detecção automática de inatividade prolongada caso o Agendador de Tarefas do Windows falhe ou a máquina reinicie.
- **Detecção de Estágio Estagnado (STALLED):** Transição de estado e alerta imediato caso o processo de extração fique preso no mesmo estágio além de `STAGE_STALL_SECONDS`.
- **Métricas Comparativas:** Comparação automática do volume de linhas coletadas contra a mediana histórica móvel.

### 🔌 Client Enriquecido & Compatibilidade Total (Fase 4)
- **Context Manager de Estágios:** `with reporter.stage("LOGIN"):` para rastreamento granular de progresso.
- **Decorator `@monitored`:** Monitoramento automático de rotinas de extração.
- **Retrocompatibilidade Estrita:** Métodos e chamadas da v1 continuam funcionando sem qualquer alteração de código na automação.

### 📊 Single-File Dashboard HTML & Métricas (Fase 5 e 6)
- **Cockpit Operacional:** Painel visual servido em `/dashboard` em CSS/JS puro (sem dependências de internet).
- **Endpoint OpenMetrics:** `/metrics` compatível com Prometheus e Grafana.

### 🚀 Automação Windows (Fase 7)
- **Scripts PowerShell Aprimorados:** `install_windows.ps1` com suporte a `-AsTask` (registro no Agendador do Windows com auto-restart) e `uninstall_windows.ps1` para remoção limpa.
