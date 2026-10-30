# Monitoramento de Broca com Armadilhas de Feromônio • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `broca_armadilha`  
**Fase Agrícola:** Proteção Vegetal e Manejo Integrado de Pragas (MIP)  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Rastrear os níveis populacionais da broca-da-cana (Diatraea saccharalis) utilizando a rede de armadilhas iscadas com feromônio sintético distribuídas estrategicamente na área agrícola.

> **Impacto Direto na Produtividade:**  
> A broca abre galerias nos colmos que causam quebra prematura da cana, tombamento, perda de ATR e entrada de podridão-vermelha (Complexo Broca-Fungo), reduzindo a recuperação de açúcar e etanol.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** Captura (número de mariposas adultas capturadas por armadilha)
- **Critério de Aceitação:** Limiares técnicos: 0 a 2 insetos (Baixo risco), 3 a 5 (Médio alerta), ≥ 6 (Crítico / Ação de Controle Biológico imediata via Cotesia flavipes ou Trichogramma galloi).
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data da leitura e contagem na armadilha |
| `fazenda/talhao` | Localização geográfica da armadilha |
| `armadilha_id` | Código identificador do ponto de monitoramento |
| `capturas` | Quantidade de mariposas adultas encontradas |
| `nivel_infestacao` | Classificação: Baixo, Moderado ou Crítico |
| `latitude/longitude` | Ponto GPS exato da armadilha |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Gráfico de Rosca de Severidade**: Proporção de armadilhas por faixa de infestação com contagem total somada no centro.
- **Evolução Temporal com Filtro Rápido**: Curva de voo e capturas ao longo dos dias com seletores Todos, 30D, 15D e 7D.
- **Top Fazendas e Talhões com Maior Pressão**: Gráficos de barra destacando os pontos de foco prioritário para liberação de parasitoides.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Liberar biológicos (vespinhas Cotesia ou Trichogramma) nos talhões com índice crítico antes que as lagartas penetrem nos colmos.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
