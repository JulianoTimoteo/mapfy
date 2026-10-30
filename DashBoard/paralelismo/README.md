# Paralelismo de Linhas e Piloto RTK • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `paralelismo`  
**Fase Agrícola:** Preparo de Solo, Sulcação e Plantio Guiado por Satélite  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Verificar a distância entre linhas de cana adjacentes formadas pelo trator com piloto automático via sinal RTK com correção centimétrica.

> **Impacto Direto na Produtividade:**  
> Espaçamento irregular de linhas causa pisoteio das soqueiras por pneus de tratores e colhedoras, destruição de gemas subterrâneas e redução de até 30% na longevidade do canavial.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** cm (centímetros de espaçamento entre sulcos)
- **Critério de Aceitação:** Meta técnica: Espaçamento nominal contratado (ex: 1,50 m simples ou duplo 1,50 x 0,90 m) com tolerância de ±5 cm.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data da checagem em campo |
| `fazenda/talhao` | Área de sulcação/plantio |
| `frente` | Frente operacional |
| `operador` | Operador do trator com piloto RTK |
| `espacamento_medido` | Distância física entre centros de sulcos |
| `status_rtk` | Sinal Fixo (RTK Fix), Flutuante (Float) ou Autônomo |
| `status` | Conforme, Estreito ou Largo |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Gráfico de Rosca (Donut)**: Percentual de paralelismo na meta com total somado no centro.
- **Evolução Temporal com Filtro Rápido**: Comportamento diário do espaçamento com botões Todos, 30D, 15D e 7D.
- **Histograma de Espaçamento**: Distribuição milimétrica das distâncias medidas.
- **Desempenho por Frente**: Índice de precisão por equipe de sulcação.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Caso ocorra desvio sistemático, recalibrar o offset do implemento no monitor do piloto e checar recepção da antena base RTK.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
