# DashBoard • Usina Pitangueiras (Mapfy 2026)

Esta é a pasta de trabalho dedicada ao desenvolvimento do **Painel Visual e Dashboard Interativo** da Usina Pitangueiras.

---

## 🔗 Conexão com os Dados

O dashboard consome diretamente as bases consolidadas e atualizadas continuamente pelo módulo **`Server_MapFy`**:

- **Origem dos dados:** `../Server_MapFy/server/relatorios/`
- **Publicação online:** arquivos consolidados são enviados ao repositório pelo servidor e
  disponibilizados pelo GitHub Pages em HTTPS.
- **Sincronização no navegador:** automática e sem configuração de endereço de API.
- **Segurança:** a chave de publicação fica somente no `.env` do computador servidor; relatórios
  enviados ao repositório público podem ser acessados publicamente.
- **Módulo de integração:** [`data_loader.py`](data_loader.py)
- **Formulários ativos (2026):** 17 formulários consolidados
- **Volume total:** +22.000 registros únicos
- **Formatos disponíveis:** `.csv` (com ponto e vírgula e utf-8-sig) e `.json` estruturado por registros

---

## 📂 Estrutura da Pasta

```
DashBoard/
  ├── data_loader.py        # Utilitário pronto para carregar os dados em DataFrames / JSON
  └── README.md             # Esta documentação
```

---

## 🚀 Próximo Passo

Estamos prontos para iniciar o desenvolvimento da interface do Dashboard (seja via Web Moderna, Streamlit, React ou Dash).
