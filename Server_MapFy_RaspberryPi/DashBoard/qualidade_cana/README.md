# Qualidade da Cana de Plantio • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `qualidade_cana`  
**Fase Agrícola:** Colheita de Mudas e Plantio Mecanizado  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Monitorar a densidade de toletes depositados por metro de sulco, pureza da carga e ausência de impurezas minerais ou vegetais na operação de plantio.

> **Impacto Direto na Produtividade:**  
> Garante a dosagem adequada de colmos no sulco sem falhas ou adensamento excessivo de mudas que desperdiçaria toneladas de cana no plantio.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** Rebolos por metro ou Toneladas por Hectare
- **Critério de Aceitação:** Faixa ideal: 12 a 18 gemas/rebolos viáveis por metro linear de sulco.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data da inspeção do sulco |
| `fazenda/talhao` | Área plantada |
| `frente` | Frente de plantio |
| `rebolos_metro` | Contagem de toletes por metro |
| `qualidade_corte` | Avaliação de lascamento e pontas secas |
| `status` | Ideal, Insuficiente ou Excessivo |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Gráfico de Rosca de Classificação**: Divisão das avaliações com total de inspeções somadas no centro.
- **Evolução Temporal com Filtro Rápido**: Evolução diária com seletores Todos, 30D, 15D e 7D.
- **Distribuição por Horário**: Variação do ritmo de plantio ao longo do dia.
- **Categorias de Observação**: Registro das principais causas de ocorrências.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Ajustar esteira alimentadora da plantadora para evitar sobreposição ou falhas de alimentação dos rebolos.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
