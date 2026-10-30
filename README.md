# Automação Mapfy

Baixa periodicamente o relatório do Mapfy (CSV/ZIP), normaliza os dados e os consolida de forma
incremental em `MapfyDownloads/Mapfy.xlsx`, deduplicando pelo ID (mantém a versão mais recente).

## Estrutura

```
mapfy-automacao/
├── automacao_mapfy.py     # script completo
├── requirements.txt
├── .env.example           # modelo de configuração (versionar)
├── .env                   # credenciais reais (NUNCA versionar)
├── .gitignore
├── automacao_mapfy.log    # gerado na execução (rotativo, 2 MB x 5)
└── MapfyDownloads/        # gerado na execução
    ├── relatorio_AAAAMMDD_HHMMSS.csv|zip
    ├── Mapfy.xlsx         # base consolidada
    └── Mapfy.bak.xlsx     # backup do estado anterior
```

## Instalação

Requer Python 3.10+.

```bash
# 1. ambiente virtual
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2. dependências Python
pip install -r requirements.txt

# 3. navegador do Playwright (Chromium)
playwright install chromium
# Linux/servidor sem bibliotecas gráficas:
# playwright install --with-deps chromium
```

## Configuração

```bash
cp .env.example .env             # Windows: copy .env.example .env
```

Preencha ao menos `MAPFY_URL`, `MAPFY_USER` e `MAPFY_PASS`, e **ajuste os seletores** (`SEL_*`) à
interface real do Mapfy. Para descobri-los, grave a navegação:

```bash
playwright codegen https://SEU-MAPFY/login
```

O codegen mostra o seletor de cada campo/botão em que você clicar. Cole-os no `.env`.

Depois, abra `automacao_mapfy.py` e ajuste no topo:

- `COLUMN_MAP`: nomes das colunas do CSV -> nomes padronizados (precisa existir uma coluna que vire o `id`).
- `DATE_COLUMNS` e `NUMERIC_COLUMNS`: colunas a converter para data e número.

## Execução

```bash
python automacao_mapfy.py --once            # uma execução (exit code 0 = ok, 1 = falha)
python automacao_mapfy.py --once --headed   # com navegador visível, para depurar seletores
python automacao_mapfy.py                   # loop a cada INTERVAL_MINUTES
python automacao_mapfy.py --interval 30     # loop a cada 30 min (sobrescreve o .env)
```

Para rodar de forma permanente, prefira o agendador do sistema chamando `--once`
(Agendador de Tarefas no Windows, `cron`/`systemd timer` no Linux): se o processo cair,
a próxima execução recomeça sozinha. Não execute duas instâncias ao mesmo tempo.

## Como funciona a consolidação

1. O filtro baixa os últimos `DAYS_BACK` dias. A janela sobreposta é proposital: registros editados
   no Mapfy voltam no relatório e substituem a versão antiga.
2. Os dados novos são concatenados à base e deduplicados por `ID_COLUMN` com `keep='last'`.
3. O Excel é gravado em `Mapfy.tmp.xlsx`, validado e só então trocado por `Mapfy.xlsx` (`os.replace`).
   Se algo falhar antes disso, a base original permanece intacta.
4. Linhas sem ID são descartadas (e registradas no log), pois não podem ser deduplicadas.

## Resiliência

- Falhas de rede, timeouts e downloads são repetidos até `MAX_RETRIES` vezes com backoff exponencial.
- Credenciais recusadas **não** são repetidas, para não bloquear a conta. Configure `SEL_LOGIN_ERROR`
  para que o erro seja reconhecido.
- Em falha na automação, um screenshot `erro_*.png` é salvo em `MapfyDownloads/` para diagnóstico.
- Cada execução termina com uma linha `STATUS=SUCESSO|FALHA` no log, com linhas baixadas, novas,
  atualizadas e total da base.

## Segurança

- A senha só existe no `.env` (adicione ao `.gitignore`, já incluso) e não é escrita no log.
  Restrinja o acesso ao arquivo (`chmod 600 .env` no Linux).
- `MapfyDownloads/` pode conter dados sensíveis: não versione nem compartilhe sem necessidade.
- Textos que começam com `=` ganham um `'` na frente para não virarem fórmulas no Excel.
- Prefira um usuário do Mapfy dedicado à automação, com permissão somente de leitura/exportação.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `Timeout ... waiting for selector` | Seletor incorreto ou página lenta: use `--headed` e revise `SEL_*`. |
| `strict mode violation` | O seletor casa com mais de um elemento: torne-o mais específico. |
| Datas não preenchidas no filtro | Campo com máscara: use `DATE_INPUT_MODE=type` e confira `DATE_UI_FORMAT`. |
| `Coluna de ID 'id' não encontrada` | Inclua a coluna do ID no `COLUMN_MAP` (o erro lista as colunas disponíveis). |
| `Mapfy.xlsx está bloqueado` | Arquivo aberto no Excel: feche e rode de novo. |
| Acentos quebrados | Force `CSV_ENCODING=latin-1` (ou `utf-8`). |
