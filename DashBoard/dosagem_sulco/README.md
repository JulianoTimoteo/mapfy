# Plantio — Dosagem de Insumos na Sulcação • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `dosagem_sulco`  
**Fase Agrícola:** Sulcação e Adubação de Base  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Monitorar a quantidade de adubo químico mineral, torta de filtro ou compostagem depositada no fundo do sulco antes da colocação das mudas de cana.

> **Impacto Direto na Produtividade:**  
> Garante nutrição equilibrada de fósforo, nitrogênio e potássio para o arranque inicial do sistema radicular. Desvios geram estande desuniforme e custos descontrolados.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** g/m (gramas por metro linear) ou kg/ha
- **Critério de Aceitação:** Faixa técnica ideal: Meta de adubação calibrada por tipo de solo e recomendação nutricional.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data da inspeção de adubação |
| `fazenda/talhao` | Talhão de sulcação |
| `insumo` | Adubo Mineral NPK / Torta de Filtro |
| `dosagem_medida` | Gramas por metro aferidas em lona coletora |
| `frente` | Frente de sulcação |
| `status` | Conforme, Abaixo ou Acima da Recomendação |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Segmentação por Insumo (Tabs)**: Separação analítica entre Adubo Mineral e Torta de Filtro.
- **Gráfico de Rosca de Conformidade**: Percentual na meta com total somado no centro.
- **Evolução Temporal com Filtro Rápido**: Acompanhamento diário com filtros Todos, 30D, 15D e 7D.
- **Histograma de Dosagem**: Frequência das doses aferidas.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Calibrar engrenagens do distribuidor de adubo e conferir umidade do insumo caso ocorra embuchamento ou quebra de rosca sem-fim.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
