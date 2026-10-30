# Gestão Inteligente da Frota e Videotelemetria • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `checklist_veicular`  
**Fase Agrícola:** Operações Mecanizadas, Transporte e Manutenção de Frota  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Monitorar o estado de conservação, itens danificados, criticidade, videotelemetria e abertura de Ordens de Serviço (OS) de todos os veículos e implementos da Usina Pitangueiras.

> **Impacto Direto na Produtividade:**  
> Evita acidentes operacionais, paradas forçadas no canavial, quebras de alto custo e garante a rastreabilidade entre condutor, gestor e manutenção preventiva.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** Nível de Criticidade, Status de OS e Videotelemetria
- **Critério de Aceitação:** Meta: 100% de veículos operando em estado Leve (Liberado); zero veículos liberados com criticidade alta/impeditiva.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data e hora da inspeção pré-operacional |
| `frota` | Código e modelo do veículo / caminhão / trator |
| `gestor` | Gestor responsável pelo veículo |
| `condutor` | Condutor ou operador no momento da vistoria |
| `criticidade` | Leve (Liberado), Moderado (Condutor Notificado), Crítico |
| `itens_danificados` | Componentes com avarias (Pneus, Freios, Iluminação, etc.) |
| `videotelemetria` | SIM / NÃO - Indicação de videotelemetria |
| `os` | Número da Ordem de Serviço de manutenção gerada |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Rosca de Criticidade**: Divisão entre Leve, Moderado e Crítico com total somado no centro.
- **Rosca de Videotelemetria**: Distribuição de registros com videotelemetria com total no centro.
- **Evolução Temporal com Filtro Rápido**: Evolução do volume de inspeções e avarias com filtros 7D, 15D, 30D e Todos.
- **Componentes Mais Danificados**: Gráfico de barras com as maiores causas de abertura de OS.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Veículos classificados como Moderados ou Críticos devem ser direcionados imediatamente para o box de oficina com OS aberta.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
