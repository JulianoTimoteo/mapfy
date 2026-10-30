# Quantidade e Viabilidade de Gemas no Plantio • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `viabilidade_gemas`  
**Fase Agrícola:** Plantio Mecanizado e Avaliação de Estande Futuro  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Auditar diretamente no sulco aberto o número total de gemas distribuídas por metro linear de sulco e a porcentagem de gemas efetivamente viáveis (vivas, intumescidas e livres de broca ou esmagamento mecânico).

> **Impacto Direto na Produtividade:**  
> Garante a densidade perfeita de brotos por metro para formação de um canavial denso, fechado e de alta produtividade (TCH). Evita replantios caros e previne a infestação de plantas daninhas provocada por clareiras.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** Gemas/metro e Taxa de Viabilidade (%)
- **Critério de Aceitação:** Meta agronômica: 15 a 18 gemas totais/metro e Viabilidade mínima de 80% das gemas.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data da inspeção no sulco |
| `fazenda/talhao` | Talhão de plantio |
| `frente` | Frente de plantio |
| `gemas_totais_metro` | Contagem de todas as gemas no metro de sulco |
| `gemas_viaveis_metro` | Contagem de gemas perfeitas e funcionais |
| `taxa_viabilidade` | Cálculo: (Gemas Viáveis / Gemas Totais) × 100 |
| `status` | Aprovado (Alta Viabilidade) ou Alerta (Baixa Viabilidade) |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Gráfico de Rosca de Viabilidade**: Proporção de gemas viáveis com total somado no centro.
- **Evolução Temporal com Filtro Rápido**: Viabilidade diária com seletores Todos, 30D, 15D e 7D.
- **Dispersão: Total vs Viáveis**: Gráfico de dispersão correlacionando densidade e sanidade.
- **Histograma de Frequências**: Distribuição do número de gemas por metro.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Se a viabilidade cair abaixo de 80%, revisar a velocidade de colheita da muda no viveiro e inspecionar os rolos alimentadores da plantadora para eliminar esmagamento de gemas.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
