# Qualidade e Profundidade da Subsolagem • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `subsolagem`  
**Fase Agrícola:** Preparo de Solo e Descompactação Profunda  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Auditar a profundidade efetiva da haste subsoladora no perfil do solo, garantindo a quebra da camada compactada (pé-de-arado/pé-de-grade) provocada pelo tráfego de colhedoras e transbordos.

> **Impacto Direto na Produtividade:**  
> A subsolagem profunda permite que a raiz da cana atinja horizontes úmidos do solo em épocas de estiagem, aumentando a tolerância à seca e a produtividade de biomassa por hectare.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** cm (centímetros de profundidade de trabalho)
- **Critério de Aceitação:** Faixa técnica ideal: 40 cm a 50 cm de profundidade efetiva da ponteira.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data e hora da trincheira de medição |
| `fazenda/talhao` | Área subsolada |
| `frente` | Frente de subsolagem |
| `operador` | Operador do trator de esteira ou alta potência |
| `profundidade_medida` | Profundidade de corte aferida em trincheira |
| `status` | Na Meta, Raso ou Profundo Demais |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Gráfico de Rosca de Conformidade**: Amostras na faixa com total somado no centro.
- **Evolução Temporal com Filtro Rápido**: Profundidade média diária com botões Todos, 30D, 15D e 7D.
- **Histograma de Frequências**: Curva de profundidades atingidas.
- **Média por Frente**: Comparativo de profundidade entre frentes de trabalho.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Trocar ponteiras desgastadas e recalibrar o pistão de profundidade hidráulica para garantir penetração uniforme em manchas de solo argiloso.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
