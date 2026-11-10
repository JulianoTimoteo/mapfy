# Servidor MapFy 24/7

O `MapFyServer.exe` executa a extração incremental imediatamente ao iniciar e depois no intervalo
configurado. Ao terminar, publica os relatórios atualizados no repositório do GitHub Pages. O
Dashboard carrega esses arquivos diretamente pelo HTTPS do próprio GitHub; não é necessário
abrir portas, configurar túnel, endereço IP ou opções no navegador.

Os arquivos baixados e consolidados ficam em `server\relatorios\`, ao lado do executável.
Somente os consolidados configurados para o Dashboard e o resumo público são enviados ao GitHub.
Os arquivos brutos de `historico\`, credenciais e sessão do Mapfy não são enviados.

## Notificações pelo Telegram

O servidor pode encaminhar ao Telegram os registros de log a partir do nível INFO, incluindo
mensagens de inicialização e encerramento. Para ativar:

1. Crie um bot com o `@BotFather` no Telegram e copie o token recebido.
2. Envie uma mensagem ao bot e consulte `https://api.telegram.org/bot<TOKEN>/getUpdates`
   para localizar o `chat.id` da conversa.
3. Configure `MAPFY_TELEGRAM_BOT_TOKEN` e `MAPFY_TELEGRAM_CHAT_ID` em `server\.env`.
   Não compartilhe o token nem o inclua no repositório.
4. Reinicie o servidor. Configure as duas variáveis juntas; deixe ambas vazias para desativar.

O envio ocorre em segundo plano para não atrasar o extrator. Se a entrega falhar, o erro é
registrado no console/log local. O executor `6_PARAR_SERVICOS.bat` solicita o encerramento
gracioso do servidor para que a notificação de parada seja enviada.

Para validar a entrega depois de configurar o bot, execute no diretório `server`:

```powershell
python mapfy_server.py --test-notification
```

O comando envia a mensagem `Testando envio do servidor MapFy.` e termina sem iniciar a extração.

## Preparar em outro computador Windows

1. Instale e mantenha atualizado o Microsoft Edge. O extrator usa o Edge instalado no Windows.
2. No GitHub, crie uma chave de acesso pessoal **fine-grained** com vencimento, limitada ao
   repositório `JulianoTimoteo/mapfy` e com a permissão `Contents: Read and write`.
3. Configure `MAPFY_USER`, `MAPFY_PASS` e `MAPFY_GITHUB_TOKEN` em `server\.env`. A chave do
   GitHub é confidencial; não a envie pelo chat, não a coloque no Dashboard e não compartilhe
   o `.env`.
4. Execute `Iniciar_MapFy_Server.bat`. Para iniciar após a entrada da conta no Windows, execute
   `INSTALAR_INICIALIZACAO.bat` uma vez.

A conta do Windows precisa permanecer conectada para a tarefa de inicialização automática
funcionar. Para a primeira autenticação, abra o navegador do servidor e confirme o acesso à
conta Mapfy. Os arquivos `session_state.json` e `.env` contêm dados sensíveis e devem ser
protegidos.

## Configuração do GitHub

A chave concedida pelo GitHub tem permissão de escrita no conteúdo do repositório selecionado;
o programa limita as publicações aos arquivos do Dashboard descritos acima. Guarde-a no `.env`
local do servidor e defina um vencimento para ela. O Dashboard nunca recebe nem lê essa chave;
os arquivos publicados são públicos, assim como o restante do Dashboard.

Depois de cada extração, o programa envia as alterações em um único commit. O GitHub Pages
atualiza o site automaticamente; a nova versão pode levar alguns minutos para aparecer. Não é
necessário configurar firewall, IP público, DNS ou um segundo serviço.

## Gerar o executável

No computador de compilação, com o ambiente virtual e as dependências do projeto instalados:

```powershell
python -m pip install pyinstaller
python -m PyInstaller --noconfirm --distpath Server_MapFy\server --workpath Server_MapFy\build\MapFyServer Server_MapFy\MapFyServer.spec
```

O executável é criado em `server\MapFyServer.exe`. Para validá-lo antes de iniciar os serviços:

```powershell
.\server\MapFyServer.exe --check
```

O EXE não inclui credenciais, sessão autenticada, Microsoft Edge nem os relatórios. Estes itens
permanecem separados do executável, ao lado dele.
