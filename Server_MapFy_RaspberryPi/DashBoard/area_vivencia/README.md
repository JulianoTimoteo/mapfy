# Áreas de Vivência e Gestão TPL (NR-31) • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `area_vivencia`  
**Fase Agrícola:** Qualidade de Vida, Segurança e Saúde no Trabalho Rural  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Inspecionar e auditar sistematicamente as condições higiênico-sanitárias, conforto e conformidade legal das áreas de vivência móveis e fixas fornecidas aos colaboradores no campo, em estrito cumprimento à Norma Regulamentadora NR-31.

> **Impacto Direto na Produtividade:**  
> Garante a saúde e dignidade dos trabalhadores rurais, evita autuações trabalhistas, previne contaminações alimentares e acidentes operacionais durante os intervalos de turno.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** Índice de Conformidade (%) e Checklist de Requisitos
- **Critério de Aceitação:** Meta: 100% de conformidade com todos os itens da NR-31 (água potável, sanitários químicos higienizados, mesas e assentos, abrigo intempéries e kits de primeiros socorros).
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data e hora da auditoria realizada |
| `frente` | Frente agrícola ou turma de trabalho atendida |
| `turno` | Turno operacional (A, B ou C) |
| `agua_potavel` | Condição e temperatura da água para consumo |
| `sanitarios` | Estado de conservação e limpeza dos banheiros químicos |
| `abrigo_refeicao` | Cobertura, proteção solar e assentos para refeição |
| `primeiros_socorros` | Disponibilidade e validade dos kits de socorro |
| `status` | Conforme / Não Conforme por item inspecionado |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Gráfico de Rosca de Conformidade**: Percentual de itens conformes com valor total de auditorias no centro.
- **Itens com Mais Ocorrências**: Gráfico de barras destacando quais requisitos apresentaram falhas mais frequentes.
- **Volume de Inspeções por Turno**: Distribuição das vistorias entre os turnos diurno e noturno.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Qualquer não-conformidade em água potável ou sanitários exige reposição ou manutenção no mesmo dia pelo setor de Apoio Operacional.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
