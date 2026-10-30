path = 'DashBoard/build_dashboard_html.py'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

start_marker = "// Interação com o Centro da Mandala ao passar o mouse ou tocar no celular"
end_marker = "// Busca no Grid Minimalista"

p1 = code.find(start_marker)
p2 = code.find(end_marker, p1)

if p1 != -1 and p2 != -1:
    js_raw = code[p1:p2]
    # Replace single { with {{ and } with }} except if already doubled
    # Let's write the exact escaped JS block:
    escaped_js = """// Interação com o Centro da Mandala ao passar o mouse ou tocar no celular
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

        function highlightNode(idx) {{
            const node = formsData[idx];
            if (!node) return;

            selectedNodeIdx = idx;
            activeSelectedUrl = getActiveUrl(node.folder);

            // Ilumina o spoke (linha radial)
            document.querySelectorAll('[id^="spoke-"]').forEach(s => {{
                s.setAttribute('stroke-width', '1.0');
                s.setAttribute('stroke-opacity', '0.4');
            }});
            const spoke = document.getElementById(`spoke-${{idx}}`);
            if (spoke) {{
                spoke.setAttribute('stroke', '#10b981');
                spoke.setAttribute('stroke-width', '2.8');
                spoke.setAttribute('stroke-opacity', '1.0');
            }}

            // Preenche o Centro
            centerDefault.classList.add('hidden');
            centerActive.classList.remove('hidden');

            activeCategory.innerText = `ETAPA ${{String(idx+1).padStart(2, '0')}} • ${{node.category}}`;
            activeName.innerText = node.clean_name;
            activeRows.innerText = `${{node.rows.toLocaleString()}} reg.`;
            activeDate.innerText = `Sincronia: ${{node.latest_date}}`;

            if (activeSelectedUrl) {{
                activeActionLabel.innerText = "🚀 Abrir Painel Executivo";
                activeActionLabel.className = "text-[9px] sm:text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-full font-mono font-bold shadow-md animate-pulse cursor-pointer inline-block";
            }} else {{
                activeActionLabel.innerText = "Ver Detalhes das Colunas";
                activeActionLabel.className = "text-[9px] sm:text-[10px] bg-slate-600 text-white px-3 py-1 rounded-full font-mono font-bold cursor-pointer inline-block";
            }}

            // Pega o ícone do próprio nó
            const nodeEl = document.querySelector(`.mandala-node[data-index="${{idx}}"] svg, .mandala-node[data-index="${{idx}}"] img`);
            if (nodeEl) {{
                activeIconContainer.innerHTML = nodeEl.outerHTML;
            }}

            // Atualiza destaque no chip mobile
            document.querySelectorAll('.mobile-step-chip').forEach(c => {{
                c.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-500/15');
            }});
            const chip = document.getElementById(`mobile-chip-${{idx}}`);
            if (chip) {{
                chip.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-500/15');
                chip.scrollIntoView({{ behavior: 'smooth', inline: 'center', block: 'nearest' }});
            }}
        }}

        function resetCenter() {{
            const isMobile = window.innerWidth < 768;
            if (isMobile) return; // No mobile mantém o selecionado até outro clique

            centerDefault.classList.remove('hidden');
            centerActive.classList.add('hidden');
            selectedNodeIdx = null;
            activeSelectedUrl = null;

            // Reseta todos os spokes para a cor de tema atual
            document.querySelectorAll('[id^="spoke-"]').forEach((sp, idx) => {{
                const node = formsData[idx];
                const isAct = node && getActiveUrl(node.folder);
                sp.setAttribute('stroke', isAct ? '#10b981' : 'var(--spoke-line)');
                sp.setAttribute('stroke-width', isAct ? '1.8' : '1.0');
                sp.setAttribute('stroke-opacity', '1.0');
            }});
        }}

        function handleNodeClick(idx, url) {{
            const isMobile = window.innerWidth < 768;
            if (!isMobile) {{
                if (url) {{
                    window.location.href = url;
                }} else {{
                    const item = formsData[idx];
                    if (item) openModal(item.clean_name, item.category, item.rows.toLocaleString(), item.latest_date, item.folder, item.columns);
                }}
                return;
            }}

            // No celular: se já estava selecionado este nó, abre direto
            if (selectedNodeIdx === idx) {{
                if (url) {{
                    window.location.href = url;
                    return;
                }} else {{
                    const item = formsData[idx];
                    if (item) openModal(item.clean_name, item.category, item.rows.toLocaleString(), item.latest_date, item.folder, item.columns);
                    return;
                }}
            }}

            // Primeiro toque: seleciona e ilumina no centro
            highlightNode(idx);
        }}

        // Clique no Center HUD abre o painel selecionado
        const centerHud = document.getElementById('centerHud');
        if (centerHud) {{
            centerHud.addEventListener('click', () => {{
                if (activeSelectedUrl) {{
                    window.location.href = activeSelectedUrl;
                }} else if (selectedNodeIdx !== null) {{
                    const item = formsData[selectedNodeIdx];
                    if (item) openModal(item.clean_name, item.category, item.rows.toLocaleString(), item.latest_date, item.folder, item.columns);
                }}
            }});
        }}
"""
    code = code[:p1] + escaped_js + "\n        " + code[p2:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print("Escaped JS successfully!")
else:
    print("Markers not found!")
