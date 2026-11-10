# Aplicação de Herbicida e Condições Climáticas (Delta T) • Usina Pitangueiras
## Sistema Integrado MapFy • Safra 2026
**Módulo Operacional:** `herbicida`  
**Fase Agrícola:** Tratos Culturais e Manejo de Plantas Daninhas  
**Ambiente:** Plataforma Web Integrada ao Hub Central da Mandala  

---

### 1. Visão Geral e Importância Agronômica
Monitorar a eficácia e segurança agronômica das pulverizações de herbicidas terrestres, cruzando parâmetros operacionais do pulverizador com as variáveis meteorológicas críticas (Temperatura, Umidade Relativa do Ar, Velocidade do Vento e Delta T).

> **Impacto Direto na Produtividade:**  
> Pulverizar sob vento excessivo gera deriva para áreas vizinhas e matas. Baixa umidade causa evaporação das gotas antes de atingirem o alvo. Falhas de limpeza de bicos geram faixas de mato no canavial.

---

### 2. Metas Técnicas e Parâmetros de Conformidade
- **Unidade de Medida:** Delta T (°C), Velocidade do Vento (km/h), Vazão (L/ha)
- **Critério de Aceitação:** Janela meteorológica segura: Temperatura < 32°C, UR > 50%, Vento de 3 a 10 km/h, Delta T ideal entre 2°C e 8°C.
- **Fórmula de Conformidade:**
  $$\text{Taxa de Conformidade (\%)} = \left( \frac{\text{Medições Conformes na Faixa}}{\text{Total de Medições Válidas}} \right) \times 100$$

---

### 3. Estrutura e Dicionário de Dados de Campo
Os dados são capturados pelos técnicos agrícolas e operadores via aplicativo móvel MapFy, consolidados em `js/data.js` e auditados pelo motor analítico local:

| Campo do Registro | Significado e Utilização Operacional |
| :--- | :--- |
| `data` | Data e hora exata da pulverização |
| `fazenda/talhao` | Local da aplicação |
| `operacao` | Dessecação, Pré-emergência ou Pós-emergência |
| `planta_soca` | Ambiente: Cana Planta, Cana Soca ou Carreador |
| `temperatura` | Temperatura do ar (°C) |
| `umidade` | Umidade relativa do ar (%) |
| `vento` | Velocidade do vento (km/h) |
| `delta_t` | Janela psicrométrica de evaporação da gota |
| `limpeza_bicos` | Avaliação do padrão de jatos e bicos desobstruídos |


---

### 4. Recursos Visuais e Painel de Indicadores
Este painel dispõe dos seguintes recursos analíticos homologados para apoio à decisão:

- **Dispersão Climática e Delta T**: Gráficos de dispersão com áreas de risco de deriva e evaporação.
- **Planta, Soca ou Carreador (Donut)**: Classificação do ambiente operacional com valores nas fatias e total somado no centro.
- **Linha do Tempo com Filtro Rápido**: Inspeções e ocorrências ao longo dos dias com botões Todos, 30D, 15D e 7D.
- **Matriz de Limpeza e Bicos**: Status de conservação do implemento pulverizador.

- **Mapa Georreferenciado Leaflet:** Pontos georreferenciados nos talhões com coloração indicativa (Verde = Conforme, Vermelho = Fora da Meta), visualização de clusters e **Modo Tela Inteira** para navegação ampla em smartphones e computadores.
- **Raio-X da Medição:** Modal de inspeção detalhada ponto a ponto, 100% responsivo e otimizado para celulares, com visualização em tela cheia no computador.
- **Totalizador no Centro dos Gráficos de Rosca:** Exibição explícita do valor total somado de todas as categorias diretamente no miolo da rosca em tema claro e escuro.
- **Filtros Rápidos Temporais:** Seletores interativos (`Todos`, `30D`, `15D`, `7D`) para análise imediata do histórico diário de medições.
- **Ícones Informativos `(i)` com Popover:** Localizados ao lado de cada título de bloco, explicando o que é o item, a métrica utilizada, o que contém e como interpretá-lo na prática. Fechamento universal com um clique em qualquer lugar da tela.

---

### 5. Guia de Ações Corretivas para a Operação
Em caso de detecção de não-conformidade recorrente ou alertas visuais no painel:

> **Procedimento Recomendado:**  
> Interromper imediatamente a aplicação caso o vento supere 10 km/h ou o Delta T ultrapasse 8°C (risco extremo de evaporação e perda do produto).

---
*Usina Pitangueiras Açúcar e Álcool Ltda. • Engenharia de Dados & Qualidade Agrícola • Safra 2026*
