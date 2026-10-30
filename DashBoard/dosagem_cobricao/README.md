# Dosagem de Insumos na Cobrição • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `dosagem_cobricao`  
**Fase Agrícola:** Plantio e Proteção de Cultivo  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Controlar a taxa de aplicação de inseticidas, nematicidas ou inoculantes biológicos injetados no solo durante o fechamento do sulco de plantio.

> **Impacto Direto na Produtividade:**  
> Subdosagens deixam as mudas desprotegidas contra cupins, nematoides e brocas de raiz. Sobredosagens causam desperdício financeiro de defensivos e risco de fitotoxicidade.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** L/ha ou kg/ha (litros ou quilos por hectare)
- **Critério de Aceitação:** Faixa técnica ideal: ±10% da dose agronômica recomendada no receituário técnico.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data e hora da aferição de vazão |
| `fazenda/talhao` | Área de plantio tratada |
| `frente` | Frente de plantio |
| `insumo` | Nome comercial e lote do produto aplicado |
| `dosagem_aplicada` | Volume efetivo medido nas pontas de pulverização |
| `status` | Na Meta, Subdose ou Sobredose |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Gráfico de Rosca de Conformidade**: Proporção de bicos e dosagens corretas com total somado no centro.
- **Linha do Tempo com Filtro Rápido**: Histórico diário com botões Todos, 30D, 15D e 7D.
- **Dispersão e Histograma**: Variação entre os bicos do implemento cobridor.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Checar pressão de trabalho da bomba, vazão individual de bicos com copo graduado e limpeza de filtros de linha.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
