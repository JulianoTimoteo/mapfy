# Central de Inteligência — 5S e Gestão TPL • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `tpl_5s`  
**Fase Agrícola:** Organização Operacional, Auditoria 5S e Gestão Visual  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Avaliar e registrar o nível de aderência aos 5 Sensos (Utilização, Organização, Limpeza, Saúde/Padronização e Autodisciplina) nas frentes de corte, comboios de abastecimento, reboques de apoio e oficinas móveis.

> **Impacto Direto na Produtividade:**  
> Ambientes de trabalho rurais organizados e limpos reduzem acidentes de trabalho, evitam perda de ferramentas agrícolas, previnem contaminação de óleos lubrificantes e aumentam a produtividade operacional.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** Pontuação 5S (0 a 100) e Taxa de Conformidade dos Sensos
- **Critério de Aceitação:** Meta de excelência: Score 5S ≥ 85 pontos com zero não-conformidades críticas de segurança.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data da vistoria de 5S |
| `setor` | Setor auditado (Comboio, Oficina Móvel, Frente Agrícola, Vivência) |
| `auditor` | Técnico ou gestor que realizou a auditoria |
| `frente` | Frente de trabalho inspecionada |
| `status_formulario` | Conforme, Parcialmente Conforme ou Não Conforme |
| `itens_avaliados` | Checklist dos 6 requisitos fundamentais de conservação |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Vistorias por Setor (Barras)**: Volume de auditorias com valores visíveis em cada barra.
- **Status dos Formulários (Donut)**: Proporção de conformidade com total de vistorias somadas no centro.
- **Frentes Mais Auditadas**: Distribuição das vistorias entre equipes.
- **Evolução Temporal com Filtro Rápido**: Linha do tempo das vistorias com botões Todos, 30D, 15D e 7D.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Frentes com pontuação inferior a 70 pontos devem receber plano de ação 5S corretivo em até 48 horas com acompanhamento da gerência de operações.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
