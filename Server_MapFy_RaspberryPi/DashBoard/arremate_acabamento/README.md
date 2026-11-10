# Arremate e Acabamento de Talhões • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `arremate_acabamento`  
**Fase Agrícola:** Colheita e Sistematização de Áreas  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Avaliar o padrão de colheita e corte da cana nos arremates, carreadores, curvas de nível e pontas de linha, assegurando que não ocorra desperdício de matéria-prima nem danos mecânicos às soqueiras.

> **Impacto Direto na Produtividade:**  
> Arremates deficientes geram perdas expressivas de cana deixada no solo (toneladas de biomassa perdida), pisoteio excessivo de soqueira e atrasos nas operações subsequentes de tratos culturais.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** Score de Qualidade (0 a 100) e Perdas Estimadas
- **Critério de Aceitação:** Meta de acabamento excelente: Score ≥ 90 pontos.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data e hora da vistoria técnica |
| `fazenda` | Fazenda colhida |
| `talhao` | Talhão finalizado |
| `frente` | Frente de colheita responsável |
| `operador_colhedora` | Operador da colhedora de cana |
| `score_acabamento` | Nota técnica de qualidade atribuída |
| `cana_deixada` | Presença de tocos, cana inteira ou pontas caídas |
| `pisoteio_soqueira` | Avaliação do tráfego sobre as linhas de rebrota |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Gráfico de Rosca de Conformidade**: Distribuição entre Excelente, Bom, Regular e Crítico com total no centro.
- **Evolução Temporal com Filtro Rápido**: Comportamento da qualidade dos arremates por dia/semana com botões Todos, 30D, 15D e 7D.
- **Ranking de Frentes e Operadores**: Pontuação média dos operadores na execução das manobras de ponta.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Treinar operadores em manobras de carreador sem esmagamento de linha e calibrar altura do corte de base ao iniciar novas passadas.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
