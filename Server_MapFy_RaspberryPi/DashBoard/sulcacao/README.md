# Monitoramento de Qualidade da Sulcação • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `sulcacao`  
**Fase Agrícola:** Sulcação e Preparo do Leito de Plantio  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Controlar a profundidade e largura do sulco de plantio, assegurando espaço ideal para a deposição dos toletes de cana e dos fertilizantes de arranque.

> **Impacto Direto na Produtividade:**  
> Sulcos rasos deixam as mudas vulneráveis a tombamento e desidratação. Sulcos irregulares provocam dificuldades no tráfego das carretas de plantio e problemas no recobrimento.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** cm (centímetros de profundidade do sulco)
- **Critério de Aceitação:** Faixa técnica ideal: 25 cm a 35 cm de profundidade de fundo de sulco.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data da inspeção do sulcador |
| `fazenda/talhao` | Talhão em sulcação |
| `frente` | Frente de sulcação |
| `operador` | Operador do trator |
| `profundidade_sulco` | Profundidade aferida no centro da linha |
| `largura_fundo` | Abertura da base do sulco |
| `status` | Na Meta, Raso ou Fundo |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Gráfico de Rosca de Conformidade**: Percentual de sulcos conformes com total somado no centro.
- **Evolução Temporal com Filtro Rápido**: Comportamento ao longo dos dias com filtros Todos, 30D, 15D e 7D.
- **Histograma de Distribuição**: Dispersão das profundidades de sulco.
- **Desempenho por Frente**: Uniformidade da profundidade entre frentes operacionais.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Checar o desgaste das botinas do sulcador e a pressão dos cilindros traseiros de sustentação.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
