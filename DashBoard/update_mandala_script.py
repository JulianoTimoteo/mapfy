import re

path = 'DashBoard/build_dashboard_html.py'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update mandala_nodes generation
old_node_pattern = re.compile(
    r"# Se for um painel ativo, clique vai DIRETO para o relatório!.*?# Nó da Mandala\s*mandala_nodes\.append\(f'''\s*<div class=\"mandala-node.*?</svg>\s*</div>\s*</div>\s*<!-- Nome e Contagem Exata.*?</span\s*>\s*</div>\s*\{special_badge\}\s*</div>\s*'''\)",
    re.DOTALL
)

new_node_code = """        # Se for um painel ativo, clique abre o relatório
        if active_url:
            click_action = f"handleNodeClick({i}, '{active_url}')"
            node_border_class = "border-emerald-500 ring-2 ring-emerald-500/40 shadow-[0_0_16px_rgba(16,185,129,0.35)]"
        else:
            click_action = f"handleNodeClick({i}, '')"
            node_border_class = "border-[var(--node-border)]"

        # Nó da Mandala (Compacto e Responsivo, sem empelotar no celular)
        mandala_nodes.append(f'''
        <div class="mandala-node group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 hover:scale-115 z-20 flex flex-col items-center"
             style="left: {(x/800.0)*100:.2f}%; top: {(y/800.0)*100:.2f}%;"
             data-index="{i}"
             data-name="{item['clean_name']}"
             data-folder="{item['folder']}"
             data-cat="{item['category']}"
             data-rows="{item['rows']:,}"
             data-date="{item['latest_date']}"
             data-cols="{item['cols_count']}"
             data-url="{active_url or ''}"
             onclick="{click_action}"
             onmouseenter="highlightNode({i})"
             onmouseleave="resetCenter()">
            
            <!-- Disco do Ícone Flutuante (Tamanho Responsivo: 36px celular, 44px tablet, 56px-64px desktop) -->
            <div class="w-9 h-9 sm:w-11 sm:h-11 md:w-13 md:h-13 lg:w-15 lg:h-15 xl:w-16 xl:h-16 rounded-xl sm:rounded-2xl p-1 sm:p-2 md:p-2.5 transition-all flex items-center justify-center relative border {node_border_class} group-hover:border-emerald-500 group-hover:shadow-[0_0_24px_rgba(16,185,129,0.45)] group-hover:scale-105"
                 style="background: var(--node-bg); box-shadow: var(--node-shadow);">
                <span class="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 text-[8px] sm:text-[9px] font-mono font-bold px-1 sm:px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    {i+1:02d}
                </span>
                <div class="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 flex items-center justify-center">
                    {svg}
                </div>
            </div>

            <!-- Nome e Contagem: Oculto no celular (hidden md:flex) para eliminar 100% de sobreposição! -->
            <div class="hidden md:flex mt-1 px-2 py-0.5 rounded-full border text-[9px] lg:text-[10px] font-semibold transition-colors whitespace-nowrap shadow-sm group-hover:text-emerald-500 group-hover:border-emerald-500/50 items-center gap-1"
                 style="background: var(--node-label-bg); border-color: var(--node-label-border); color: var(--node-label-text);">
                <span>{short_name}</span>
                <span class="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{item['rows']:,}</span>
            </div>
        </div>
        ''')"""

if old_node_pattern.search(code):
    code = old_node_pattern.sub(new_node_code, code, count=1)
    print("Node template updated successfully!")
else:
    print("Node pattern not matched directly, using literal replacement...")
    # fallback to string replace
    old_start = "# Se for um painel ativo, clique vai DIRETO para o relatório!"
    old_end = "{special_badge}\n        </div>\n        ''')"
    pos1 = code.find(old_start)
    pos2 = code.find(old_end, pos1)
    if pos1 != -1 and pos2 != -1:
        code = code[:pos1] + new_node_code + code[pos2 + len(old_end):]
        print("Node template updated via slice!")
    else:
        print("Could not find slice boundaries!")

# 2. Add mobile_chips generation before grid_cards
chip_gen = """
    # Carrossel de Etapas para Mobile (Touch-friendly, Zero Empelotamento)
    mobile_chips = []
    for i, item in enumerate(ordered_forms):
        short_name = SHORT_NAMES.get(item["folder"], item["clean_name"][:12])
        active_url = get_active_panel(item["folder"])
        url_arg = f"'{active_url}'" if active_url else "''"
        chip = f'''
        <button id="mobile-chip-{i}"
                onclick="handleNodeClick({i}, {url_arg})"
                class="mobile-step-chip shrink-0 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                style="background: var(--card-bg); border-color: var(--border-color); color: var(--text-primary);">
            <span class="font-mono text-[9px] font-bold text-emerald-500">{i+1:02d}</span>
            <span>{short_name}</span>
            <span class="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold opacity-80">{item['rows']:,}</span>
        </button>
        '''
        mobile_chips.append(chip)
"""

if 'mobile_chips = []' not in code:
    code = code.replace("# Grid Minimalista\n    grid_cards = []", chip_gen + "\n    # Grid Minimalista\n    grid_cards = []")
    print("mobile_chips generation added!")

# 3. Add favicon to head
if 'favicon.ico' not in code:
    code = code.replace(
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <link rel="shortcut icon" href="favicon.ico" type="image/x-icon">\n    <link rel="icon" href="favicon.ico" type="image/x-icon">'
    )
    print("Favicon linked in head!")

# 4. Update Center HUD in HTML
old_hud_start = '<!-- NÓ CENTRAL / HUD INTERATIVO (DESIGN PREMIUM COM LOGO OFICIAL DA EMPRESA) -->'
old_hud_end = '<!-- 17 NÓS DA MANDALA POSICIONADOS RADIALMENTE COM ÍCONES E NOMES -->'

new_hud_code = """<!-- NÓ CENTRAL / HUD INTERATIVO (DESIGN PREMIUM COM LOGO OFICIAL DA EMPRESA) -->
                <div id="centerHud"
                     class="w-36 h-36 sm:w-44 sm:h-44 md:w-56 md:h-56 lg:w-64 lg:h-64 rounded-full border-2 flex flex-col items-center justify-center text-center p-2 sm:p-3 md:p-5 transition-all duration-300 z-10 relative cursor-pointer"
                     style="background: var(--center-hud-bg); border-color: var(--center-hud-border); box-shadow: var(--center-hud-shadow); color: var(--text-primary);">
                    
                    <!-- Estado Padrão do Centro -->
                    <div id="centerDefault" class="space-y-0.5 sm:space-y-1 flex flex-col items-center justify-center p-1 w-full">
                        <div class="w-full flex items-center justify-center py-0.5">
                            <div class="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl bg-white shadow-sm border border-slate-200/90 flex items-center justify-center">
                                <img src="assets/logo_pitangueiras.png" alt="Usina Pitangueiras 51 Anos"
                                     class="h-5 sm:h-7 md:h-9 w-auto object-contain">
                            </div>
                        </div>
                        <div class="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight font-mono text-emerald-600 dark:text-emerald-400 leading-none">{total_records:,}</div>
                        <div class="text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">Registros Consolidados</div>
                        <div class="text-[8px] sm:text-[9px] md:text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">17 Fases • Safra 2026</div>
                    </div>

                    <!-- Estado Ativo no Hover/Tap (Preenchido dinamicamente via JS) -->
                    <div id="centerActive" class="hidden space-y-0.5 sm:space-y-1 w-full">
                        <div id="activeIconContainer" class="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 mx-auto flex items-center justify-center"></div>
                        <div id="activeCategory" class="text-[8px] sm:text-[9px] md:text-[10px] font-mono uppercase tracking-wider text-emerald-500 font-bold">Categoria</div>
                        <h4 id="activeName" class="text-[11px] sm:text-xs md:text-sm font-bold line-clamp-2 px-1 leading-tight" style="color: var(--text-primary);">Nome</h4>
                        <div class="text-xs sm:text-sm md:text-base font-mono font-extrabold text-emerald-500" id="activeRows">0 reg.</div>
                        <div class="text-[8px] sm:text-[9px] md:text-[10px] font-mono" style="color: var(--text-secondary);" id="activeDate">Data</div>
                        <div class="pt-0.5 sm:pt-1">
                            <span id="activeActionLabel" class="text-[9px] sm:text-[10px] bg-emerald-500 text-white px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full font-mono font-bold shadow-sm">
                                Abrir Painel ➜
                            </span>
                        </div>
                    </div>
                </div>

                """

h_pos1 = code.find(old_hud_start)
h_pos2 = code.find(old_hud_end, h_pos1)
if h_pos1 != -1 and h_pos2 != -1:
    code = code[:h_pos1] + new_hud_code + code[h_pos2:]
    print("Center HUD updated successfully!")

# 5. Add mobile step strip below mandalaSection SVG container
old_section_end = "{''.join(mandala_nodes)}\n            </div>\n        </section>"
new_section_end = """{''.join(mandala_nodes)}
            </div>

            <!-- Carrossel de Etapas para Mobile (Touch-friendly, Zero Empelotamento) -->
            <div class="w-full flex md:hidden flex-col items-center mt-3 px-2 select-none">
                <div class="text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <span>⚡ Toque em uma etapa para inspecionar e abrir</span>
                </div>
                <div class="flex overflow-x-auto gap-2 py-1 px-1 w-full max-w-lg no-scrollbar">
                    {''.join(mobile_chips)}
                </div>
            </div>
        </section>"""

if old_section_end in code:
    code = code.replace(old_section_end, new_section_end, 1)
    print("Mobile chips carousel placed below mandala container!")
else:
    print("Could not find section end boundary!")

# 6. Update JS logic for highlightNode, resetCenter, handleNodeClick
old_js_start = "// Interação com o Centro da Mandala ao passar o mouse"
old_js_end = "// Busca no Grid Minimalista"

new_js_code = """// Interação com o Centro da Mandala ao passar o mouse ou tocar no celular
        const centerDefault = document.getElementById('centerDefault');
        const centerActive = document.getElementById('centerActive');
        const activeIconContainer = document.getElementById('activeIconContainer');
        const activeCategory = document.getElementById('activeCategory');
        const activeName = document.getElementById('activeName');
        const activeRows = document.getElementById('activeRows');
        const activeDate = document.getElementById('activeDate');
        const activeActionLabel = document.getElementById('activeActionLabel');

        let activeSelectedUrl = null;
        let selectedNodeIdx = null;

        function highlightNode(idx) {
            const node = formsData[idx];
            if (!node) return;

            selectedNodeIdx = idx;
            activeSelectedUrl = getActiveUrl(node.folder);

            // Ilumina o spoke (linha radial)
            document.querySelectorAll('[id^="spoke-"]').forEach(s => {
                s.setAttribute('stroke-width', '1.0');
                s.setAttribute('stroke-opacity', '0.4');
            });
            const spoke = document.getElementById(`spoke-${idx}`);
            if (spoke) {
                spoke.setAttribute('stroke', '#10b981');
                spoke.setAttribute('stroke-width', '2.8');
                spoke.setAttribute('stroke-opacity', '1.0');
            }

            // Preenche o Centro
            centerDefault.classList.add('hidden');
            centerActive.classList.remove('hidden');

            activeCategory.innerText = `ETAPA ${String(idx+1).padStart(2, '0')} • ${node.category}`;
            activeName.innerText = node.clean_name;
            activeRows.innerText = `${node.rows.toLocaleString()} reg.`;
            activeDate.innerText = `Sincronia: ${node.latest_date}`;

            if (activeSelectedUrl) {
                activeActionLabel.innerText = "🚀 Abrir Painel Executivo";
                activeActionLabel.className = "text-[9px] sm:text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-full font-mono font-bold shadow-md animate-pulse cursor-pointer inline-block";
            } else {
                activeActionLabel.innerText = "Ver Detalhes das Colunas";
                activeActionLabel.className = "text-[9px] sm:text-[10px] bg-slate-600 text-white px-3 py-1 rounded-full font-mono font-bold cursor-pointer inline-block";
            }

            // Pega o ícone do próprio nó
            const nodeEl = document.querySelector(`.mandala-node[data-index="${idx}"] svg, .mandala-node[data-index="${idx}"] img`);
            if (nodeEl) {
                activeIconContainer.innerHTML = nodeEl.outerHTML;
            }

            // Atualiza destaque no chip mobile
            document.querySelectorAll('.mobile-step-chip').forEach(c => {
                c.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-500/15');
            });
            const chip = document.getElementById(`mobile-chip-${idx}`);
            if (chip) {
                chip.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-500/15');
                chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        }

        function resetCenter() {
            const isMobile = window.innerWidth < 768;
            if (isMobile) return; // No mobile mantém o selecionado até outro clique

            centerDefault.classList.remove('hidden');
            centerActive.classList.add('hidden');
            selectedNodeIdx = null;
            activeSelectedUrl = null;

            // Reseta todos os spokes para a cor de tema atual
            document.querySelectorAll('[id^="spoke-"]').forEach((sp, idx) => {
                const node = formsData[idx];
                const isAct = node && getActiveUrl(node.folder);
                sp.setAttribute('stroke', isAct ? '#10b981' : 'var(--spoke-line)');
                sp.setAttribute('stroke-width', isAct ? '1.8' : '1.0');
                sp.setAttribute('stroke-opacity', '1.0');
            });
        }

        function handleNodeClick(idx, url) {
            const isMobile = window.innerWidth < 768;
            if (!isMobile) {
                if (url) {
                    window.location.href = url;
                } else {
                    const item = formsData[idx];
                    if (item) openModal(item.clean_name, item.category, item.rows.toLocaleString(), item.latest_date, item.folder, item.columns);
                }
                return;
            }

            // No celular: se já estava selecionado este nó, abre direto
            if (selectedNodeIdx === idx) {
                if (url) {
                    window.location.href = url;
                    return;
                } else {
                    const item = formsData[idx];
                    if (item) openModal(item.clean_name, item.category, item.rows.toLocaleString(), item.latest_date, item.folder, item.columns);
                    return;
                }
            }

            // Primeiro toque: seleciona e ilumina no centro
            highlightNode(idx);
        }

        // Clique no Center HUD abre o painel selecionado
        const centerHud = document.getElementById('centerHud');
        if (centerHud) {
            centerHud.addEventListener('click', () => {
                if (activeSelectedUrl) {
                    window.location.href = activeSelectedUrl;
                } else if (selectedNodeIdx !== null) {
                    const item = formsData[selectedNodeIdx];
                    if (item) openModal(item.clean_name, item.category, item.rows.toLocaleString(), item.latest_date, item.folder, item.columns);
                }
            });
        }
"""

js_pos1 = code.find(old_js_start)
js_pos2 = code.find(old_js_end, js_pos1)
if js_pos1 != -1 and js_pos2 != -1:
    code = code[:js_pos1] + new_js_code + "\n        " + code[js_pos2:]
    print("JS interaction updated successfully!")
else:
    print("Could not find JS interaction boundaries!")

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

print("build_dashboard_html.py saved successfully!")
