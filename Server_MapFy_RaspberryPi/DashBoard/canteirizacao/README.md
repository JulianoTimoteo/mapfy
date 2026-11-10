# Monitoramento de Qualidade da Canteirização • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `canteirizacao`  
**Fase Agrícola:** Preparo de Solo e Construção de Canteiros  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Controlar a conformação, altura e largura dos canteiros de plantio e sulcação, garantindo leitos perfeitamente elevados e estruturados para receber as mudas de cana-de-açúcar.

> **Impacto Direto na Produtividade:**  
> Canteiros mal conformados causam soterramento excessivo ou exposição de mudas em chuvas pesadas, dificultam o controle de plantas daninhas e prejudicam o corte basal na colheita mecanizada futura.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** cm (centímetros de altura do canteiro)
- **Critério de Aceitação:** Faixa técnica ideal: 15 cm a 25 cm de elevação do canteiro.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data e hora da avaliação |
| `fazenda/talhao` | Local da canteirização |
| `frente` | Frente de canteirização |
| `operador` | Operador do conjunto trator-canteirizador |
| `altura_canteiro` | Altura medida do leito em centímetros |
| `largura_topo` | Largura do topo do canteiro |
| `status` | Na Meta, Baixo ou Alto |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Gráfico de Rosca (Donut)**: Conformidade das alturas com totalizador somado no centro.
- **Evolução Temporal com Filtro Rápido**: Médias diárias ao longo da safra com botões de filtro 7D, 15D, 30D e Todos.
- **Histograma de Altura**: Distribuição das frequências de elevação do canteiro.
- **Média por Frente**: Comparativo de desempenho entre frentes operacionais.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Ajustar ângulo dos discos conformadores e velocidade de deslocamento do trator para manter o canteiro firme e com topo plano.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
