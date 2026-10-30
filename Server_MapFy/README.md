# Mapfy — extração e gateway de relatórios

O servidor preserva o extrator atual e organiza os dados em duas camadas, sem mover nem
reprocessar os arquivos já existentes:

- **Brutos:** cada exportação original fica em `relatorios/<formulário>/historico/`.
- **Consolidados:** `dados.csv` e `dados.json` mantêm a visão atualizada por formulário.
- **Gateway:** a API REST expõe os consolidados em modo somente leitura e com paginação.

O conteúdo de `relatorios/` continua sendo a fonte dos dados. Nenhum arquivo do Dashboard é
alterado por este servidor.

## Preparação

Requer Python 3.10 ou superior e Microsoft Edge para a extração automatizada.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install msedge
```

Crie o arquivo local de configuração a partir do modelo:

```powershell
Copy-Item .env.example .env
```

Preencha `MAPFY_USER` e `MAPFY_PASS` no `.env`. O arquivo contém credenciais e permanece fora
do controle de versão. A interface também pode gravar essas credenciais nesse arquivo.

## Gateway REST

Execute `Iniciar_Mapfy_Gateway.bat` ou rode:

```powershell
python api_gateway.py
```

Por padrão, o serviço escuta somente em `127.0.0.1:8000`. A documentação interativa fica em
`http://127.0.0.1:8000/docs`.

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/api/v1/health` | Estado do serviço e quantidade de relatórios disponíveis |
| `GET` | `/api/v1/reports` | Catálogo de relatórios consolidados |
| `GET` | `/api/v1/reports/{id}` | Metadados de um relatório |
| `GET` | `/api/v1/reports/{id}/records?limit=100&offset=0` | Registros paginados do CSV consolidado |

O catálogo fornece um identificador estável, o nome e a data de atualização de cada relatório.
O endpoint de registros aceita `limit` entre 1 e 1.000 e retorna `has_more`, evitando carregar
todo o arquivo na memória.

### Acesso pela rede

Para disponibilizar o gateway em outra máquina, configure `MAPFY_API_HOST` com o endereço de
escuta apropriado e defina uma chave forte em `MAPFY_API_KEY`. O serviço recusa iniciar em uma
interface que não seja local sem essa chave. Requisições autenticadas devem enviar o cabeçalho
`X-API-Key`.

Configure `MAPFY_CORS_ORIGINS` com uma lista separada por vírgulas dos endereços autorizados do
Dashboard; por padrão, são aceitos endereços locais de desenvolvimento nas portas 3000, 5173 e
5500. CORS não substitui autenticação nem deve ser tratado como controle de acesso.
Não grave `MAPFY_API_KEY` no código JavaScript do Dashboard: chaves entregues ao navegador podem
ser copiadas pelos usuários. Para um Dashboard público, mantenha a chave em um serviço de
servidor ou configure uma camada de autenticação/proxy antes de expor a API.

## Extração

O fluxo existente permanece disponível pela interface (`Iniciar_Mapfy_Extractor.bat`) ou pela
linha de comando:

```powershell
python mapfy_extractor.py --headless
python mapfy_extractor.py --form "Nome do formulário" --headless
python mapfy_extractor.py --force-start 01/01/2026 --headless
```

A extração incremental reutiliza `session_state.json`, salva os arquivos originais em
`historico/` e atualiza os consolidados por ID. O gateway lê `dados.csv`; portanto, cada
consolidação concluída fica disponível sem integração adicional entre os processos.

## Diretórios locais

`.env`, `session_state.json`, logs e `relatorios/` podem conter credenciais, sessão autenticada
ou dados operacionais. Não os compartilhe nem os versione. A API fica limitada ao computador
local por padrão; exponha-a na rede somente com chave e regras de firewall apropriadas.
