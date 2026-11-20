# Procedimento de Limpeza de Histórico Git e Revogação de Segredos

Este documento descreve o procedimento operacional de segurança caso tokens do Telegram ou chaves de API tenham sido comitados no histórico do repositório.

---

## 1. Regra de Ouro da Segurança

> **Qualquer credencial comitada no Git deve ser considerada imediatamente comprometida.**
> Nenhuma ferramenta de reescrita de histórico anula o fato de que o segredo pode ter sido baixado ou indexado enquanto esteve público.

---

## 2. Passo a Passo de Revogação Imediata

### 2.1 Revogação do Token no BotFather (Telegram)
1. Abra o Telegram e inicie uma conversa com [@BotFather](https://t.me/BotFather).
2. Envie o comando `/revoke`.
3. Selecione o bot `@MapfySentinelBot` (ou o bot do seu monitor).
4. O BotFather invalidará imediatamente o token anterior e emitirá um novo token seguro.
5. Cadastre o novo token no cofre do Windows via CLI:
   ```cmd
   python run_server.py --set-secret TELEGRAM_BOT_TOKEN
   ```
   *(O valor será solicitado e gravado sem ser exibido na tela).*

### 2.2 Rotação da Chave da API do Monitor
1. Gere uma nova chave criptográfica forte de 32 bytes:
   ```cmd
   python run_server.py --generate-key
   ```
2. Defina a nova chave no cofre seguro:
   ```cmd
   python run_server.py --set-secret MONITOR_API_KEY
   ```
3. Atualize o arquivo `.env` do extrator (`automacao_mapfy.py`) para enviar a nova chave nos cabeçalhos `X-API-Key`.

---

## 3. Limpeza do Histórico Git (Remoção Definitiva de Commits)

Utilize `git-filter-repo` (ferramenta recomendada oficial do Git, substituta de `filter-branch`):

```bash
# 1. Instalar git-filter-repo (se necessário)
pip install git-filter-repo

# 2. Criar backup do repositório
cp -r .git /backup-seguro-git

# 3. Remover arquivos sensíveis de todo o histórico
git filter-repo --invert-paths --path Server_MapFy/MapFy_Telegram_Monitor/.env --path Server_MapFy/MapFy_Telegram_Monitor/MapFy_Telegram_Monitor.exe

# 4. Substituir strings de tokens que possam ter ficado em mensagens de commit
git filter-repo --replace-text <(echo 'regex:[0-9]{8,10}:[a-zA-Z0-9_-]{35}==>[REDACTED_TELEGRAM_TOKEN]')

# 5. Forçar a sincronização com o repositório remoto
git push origin main --force --all
```

---

## 4. Scan Pre-Commit de Segredos

O monitor inclui verificação preventiva local antes de cada commit.
Para ativar o hook local do Git:

```bash
# No diretório raiz do repositório
git config core.hooksPath .githooks
```

O hook bloqueia commits que contenham padrões como `[0-9]{8,12}:[A-Za-z0-9_-]{35}` ou chaves de API cruas.
