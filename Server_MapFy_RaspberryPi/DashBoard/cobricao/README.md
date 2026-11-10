# Profundidade de Cobrição no Plantio • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `cobricao`  
**Fase Agrícola:** Operação de Plantio Mecanizado  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Medir e auditar a espessura da camada de terra colocada sobre as mudas de cana no sulco de plantio, garantindo proteção térmica e umidade ideais para a brotação uniforme.

> **Impacto Direto na Produtividade:**  
> Cobrição muito rasa expõe as mudas ao ressecamento, calor e ataque de pragas. Cobrição excessivamente profunda causa asfixia das gemas, brotação atrasada e redução de estande (falhas no canavial).

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** cm (centímetros de terra sobre a muda)
- **Critério de Aceitação:** Faixa técnica ideal: 4,0 cm a 7,0 cm de terra compactada adequadamente sobre os rebolos.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data e horário da amostragem em campo |
| `fazenda/talhao` | Talhão de plantio |
| `frente` | Frente de plantio mecanizado |
| `operador` | Operador do trator cobridor |
| `profundidade_cm` | Medição manual com régua técnica graduada |
| `status` | Conforme (Na Meta), Raso (Abaixo) ou Fundo (Acima) |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Gráfico de Rosca de Conformidade**: Percentual de pontos na faixa ideal com totalizador no centro.
- **Linha do Tempo com Filtro Rápido**: Profundidade média diária com botões Todos, 30D, 15D e 7D.
- **Histograma de Profundidade**: Curva normal de espessura de terra no sulco.
- **Desempenho por Frente e OS**: Média de cobrição segmentada por frente de plantio.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Regular a pressão dos rolos compactadores e o ângulo das abas cobridoras do implemento a cada mudança de tipo de solo ou umidade.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
