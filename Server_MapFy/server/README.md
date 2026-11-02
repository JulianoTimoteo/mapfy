# Servidor MapFy 24/7

O `MapFyServer.exe` executa a extração incremental imediatamente ao iniciar e depois no intervalo
configurado. Ao terminar, publica os relatórios atualizados no repositório do GitHub Pages. O
Dashboard carrega esses arquivos diretamente pelo HTTPS do próprio GitHub; não é necessário
abrir portas, configurar túnel, endereço IP ou opções no navegador.

Os arquivos baixados e consolidados ficam em `server\relatorios\`, ao lado do executável.
Somente os consolidados configurados para o Dashboard e o resumo público são enviados ao GitHub.
Os arquivos brutos de `historico\`, credenciais e sessão do Mapfy não são enviados.

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
