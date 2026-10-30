# Abertura da Asa (Preparo de Solo) • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `abertura_asa`  
**Fase Agrícola:** Preparo de Solo e Conservação  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Monitorar a largura e abertura das asas dos implementos de preparo profundo e descompactação de solo, assegurando o perfil correto de mobilização da terra sem danificar terraços ou carreadores.

> **Impacto Direto na Produtividade:**  
> A abertura incorreta gera desuniformidade no leito de plantio, sulcos rasos ou deformados e acúmulo excessivo de torrões, prejudicando o assentamento das mudas e a retenção de umidade.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** cm (centímetros)
- **Critério de Aceitação:** Faixa técnica ideal: 60 cm a 80 cm de abertura de asa.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data e hora do apontamento no talhão |
| `fazenda` | Nome da fazenda / unidade agrícola |
| `talhao` | Número identificador do talhão |
| `frente` | Frente operacional de preparo de solo |
| `operador` | Colaborador operador do trator/implemento |
| `abertura_asa` | Medição física da abertura da asa em centímetros |
| `status` | Classificação automática: Na Meta, Abaixo ou Acima |
| `latitude/longitude` | Coordenadas GPS do ponto exato no campo |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Gráfico de Rosca (Donut)**: Apresenta a proporção de amostras Dentro da Meta vs Fora da Meta com valores nas fatias e total de medições somadas no centro.
- **Evolução Temporal com Filtro Rápido**: Mostra a média diária ao longo da safra com botões interativos Todos, 30D, 15D e 7D para análise de tendências recentes.
- **Histograma de Frequências**: Evidencia a distribuição estatística das larguras de asa medidas.
- **Desempenho por Frente**: Compara o índice de conformidade técnica entre as frentes de preparo.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Caso a média fique abaixo da meta, ajustar os tirantes e limitadores hidráulicos da asa. Se acima da meta, calibrar a abertura para evitar esforço trativo excessivo e consumo de combustível desnecessário.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
