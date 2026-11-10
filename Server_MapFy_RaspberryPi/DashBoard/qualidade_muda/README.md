# Qualidade da Muda de Cana • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `qualidade_muda`  
**Fase Agrícola:** Viveiros de Mudas e Colheita de Rebolos  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Inspecionar a sanidade fitossanitária, vigor vegetativo, ausência de danos mecânicos nas gemas e presença de broca nos lotes de muda colhidos para novos plantios.

> **Impacto Direto na Produtividade:**  
> O uso de mudas danificadas, brocadas ou dessecadas compromete irreversivelmente o canavial por todo o seu ciclo de 5 a 6 cortes, gerando custos catastróficos de replantio.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** % de Danos Físicos e % de Infestação de Broca
- **Critério de Aceitação:** Meta: Índice de broca na muda < 1,5%; gemas sem danos mecânicos de colhedora > 85%.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data do corte da muda |
| `fazenda_viveiro` | Viveiro de origem da muda |
| `variedade` | Variedade genética (ex: CTC, RB, IAC) |
| `frente_colheita` | Frente de corte de muda |
| `dano_mecanico` | % de gemas machucadas pelo facão da colhedora |
| `broca_na_muda` | % de toletes atacados por broca |
| `status` | Aprovada para Plantio ou Reprovada |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Gráfico de Rosca de Conformidade**: Percentual de mudas aprovadas com total de lotes no centro.
- **Evolução Temporal com Filtro Rápido**: Sanidade das mudas por dia com botões Todos, 30D, 15D e 7D.
- **Análise de Brocas na Muda**: Percentual de infestação por talhão de viveiro.
- **Qualidade por Frente**: Avaliação das equipes de colheita de muda.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Reduzir rotação dos rolos picadores da colhedora de mudas e afiar as facas de corte para evitar esmagamento das gemas.

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
