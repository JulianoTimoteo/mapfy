#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_dashboard_html.py
========================
Gera a página interativa do DashBoard com a MANDALA MASTERPIECE:
- Geometria astronômica/agronômica de alta precisão (sem pneus cinzas escuros no modo claro).
- Logo oficial da Usina Pitangueiras 51 Anos centralizada no HUD padrão quando não há hover.
- 17 nós com discos flutuantes elegantes, ícone oficial na Área de Vivência.
- Clique no nó da Área de Vivência vai DIRETO para area_vivencia/index.html (sem telas/modais intermediários).
- Nome e contagem de registros visíveis em cada nó.
- Suporte impecável a Tema Claro e Escuro com CSS variables.
- Seletor: Mandala Circular | Grid Minimalista | ◈ Ambos.
"""

import json
import math
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
META_FILE = BASE_DIR / "forms_metadata.json"
HTML_FILE = BASE_DIR / "index.html"

# Ícones vetoriais bicromáticos (Branco Puro #FFFFFF + Verde Esmeralda #10B981)
SVG_ICONS = {
    # 1. Subsolagem
    "Plantio - 03.1 - Preparo de Solo - Subsolagem": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <path d="M8 20h48" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
        <path d="M12 26h10m16 0h14" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 3"/>
        <path d="M26 12h12v14l-6 16h-4l-2-16V12z" fill="#FFFFFF"/>
        <path d="M28 42l16 12-22-2 6-10z" fill="#10B981"/>
        <path d="M20 52l-10 4m26-2l10 4" stroke="#10B981" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
    ''',

    # 2. Canteirização
    "Plantio - 03.1 - Preparo de Solo - Canteirização": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <path d="M8 50h48" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
        <path d="M12 50l10-24h20l10 24H12z" fill="#FFFFFF"/>
        <path d="M22 26h20" stroke="#10B981" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="32" cy="16" r="4" fill="#10B981"/>
        <path d="M32 10v6m-6-3h12" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
    </svg>
    ''',

    # 3. Sulcação
    "Plantio - 05 - Sulcação": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <ellipse cx="23" cy="28" rx="10" ry="18" fill="#FFFFFF" transform="rotate(-15 23 28)"/>
        <ellipse cx="41" cy="28" rx="10" ry="18" fill="#FFFFFF" transform="rotate(15 41 28)"/>
        <circle cx="23" cy="28" r="3" fill="#242629"/>
        <circle cx="41" cy="28" r="3" fill="#242629"/>
        <path d="M8 48c8-1 16-16 24-16s16 15 24 16" stroke="#10B981" stroke-width="4" stroke-linecap="round"/>
        <circle cx="32" cy="50" r="3" fill="#10B981"/>
    </svg>
    ''',

    # 4. Dosagem de Produto - Sulcação
    "Plantio - 04 - Dosagem de Produto - Sulcação": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <rect x="27" y="8" width="10" height="20" rx="2" fill="#FFFFFF"/>
        <path d="M22 28h20l-6 12h-8l-6-12z" fill="#FFFFFF"/>
        <rect x="25" y="6" width="14" height="4" rx="1" fill="#FFFFFF"/>
        <path d="M32 40L14 56h36L32 40z" fill="#10B981" fill-opacity="0.25" stroke="#10B981" stroke-width="2"/>
        <circle cx="24" cy="50" r="2" fill="#10B981"/>
        <circle cx="32" cy="48" r="2.5" fill="#10B981"/>
        <circle cx="40" cy="50" r="2" fill="#10B981"/>
    </svg>
    ''',

    # 5. Abertura da Asa
    "Plantio - 06 - Abertura da Asa": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <rect x="30" y="8" width="4" height="38" rx="2" fill="#FFFFFF"/>
        <circle cx="32" cy="46" r="3" fill="#FFFFFF"/>
        <path d="M30 32L12 18l4-4 14 12v6z" fill="#FFFFFF"/>
        <path d="M34 32L52 18l-4-4-14 12v6z" fill="#FFFFFF"/>
        <path d="M16 36c10 8 22 8 32 0" stroke="#10B981" stroke-width="3" stroke-linecap="round" stroke-dasharray="3 3"/>
        <circle cx="16" cy="36" r="2.5" fill="#10B981"/>
        <circle cx="48" cy="36" r="2.5" fill="#10B981"/>
    </svg>
    ''',

    # 6. Paralelismo
    "Plantio - 07 - Paralelismo": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <rect x="18" y="16" width="5" height="42" rx="2.5" fill="#FFFFFF"/>
        <rect x="41" y="16" width="5" height="42" rx="2.5" fill="#FFFFFF"/>
        <polygon points="32,6 37,11 32,16 27,11" fill="#10B981"/>
        <path d="M24 12a11 11 0 0 1 16 0" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
        <path d="M19 8a18 18 0 0 1 26 0" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
        <path d="M23 37h18" stroke="#10B981" stroke-width="2.5" stroke-linecap="round"/>
        <polygon points="23,37 27,34 27,40" fill="#10B981"/>
        <polygon points="41,37 37,34 37,40" fill="#10B981"/>
    </svg>
    ''',

    # 7. Qualidade da muda
    "Plantio - 08 - Qualidade da muda": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <rect x="24" y="24" width="16" height="32" rx="5" fill="#FFFFFF"/>
        <line x1="24" y1="40" x2="40" y2="40" stroke="#242629" stroke-width="2"/>
        <path d="M32 24c0-12-12-16-20-16 0 8 8 16 20 16z" fill="#10B981"/>
        <path d="M32 24c0-12 12-16 20-16 0 8-8 16-20 16z" fill="#10B981"/>
        <circle cx="32" cy="24" r="3" fill="#FFFFFF"/>
    </svg>
    ''',

    # 8. Quantidade de Gemas
    "Plantio - 09 - Quantidade de Gemas": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <rect x="22" y="8" width="20" height="48" rx="6" fill="#FFFFFF"/>
        <line x1="22" y1="24" x2="42" y2="24" stroke="#242629" stroke-width="2.5"/>
        <line x1="22" y1="40" x2="42" y2="40" stroke="#242629" stroke-width="2.5"/>
        <circle cx="32" cy="16" r="3.5" fill="#10B981"/>
        <circle cx="32" cy="32" r="3.5" fill="#10B981"/>
        <circle cx="32" cy="48" r="3.5" fill="#10B981"/>
        <path d="M46 16l6-3m-6 19l6-3m-6 19l6-3" stroke="#10B981" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
    ''',

    # 9. Quantidade de Cana
    "Plantio - 10 - Quantidade de Cana": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <circle cx="24" cy="38" r="9" fill="#FFFFFF"/>
        <circle cx="40" cy="38" r="9" fill="#FFFFFF"/>
        <circle cx="32" cy="24" r="9" fill="#FFFFFF"/>
        <circle cx="24" cy="38" r="4" fill="#10B981"/>
        <circle cx="40" cy="38" r="4" fill="#10B981"/>
        <circle cx="32" cy="24" r="4" fill="#10B981"/>
    </svg>
    ''',

    # 10. Dosagem de Produto - Cobrição
    "Plantio - 11 - Dosagem de Produto - Cobrição": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <path d="M32 10l18 8v16c0 14-18 22-18 22S14 48 14 34V18l18-8z" fill="#FFFFFF"/>
        <path d="M32 16l12 6v12c0 9-12 15-12 15s-12-6-12-15V22l12-6z" fill="#242629"/>
        <path d="M32 24v16m-8-8h16" stroke="#10B981" stroke-width="3" stroke-linecap="round"/>
    </svg>
    ''',

    # 11. Cobrição
    "Plantio - 12 - Cobrição": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <path d="M8 44c10-6 20-6 30 0s18 4 18 4" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
        <rect x="22" y="44" width="20" height="8" rx="2" fill="#10B981"/>
        <path d="M32 16v18m-6-6l6 6 6-6" stroke="#10B981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="32" cy="12" r="3" fill="#FFFFFF"/>
    </svg>
    ''',

    # 12. Arremate e Acabamento
    "Plantio - 13 - Arremate e Acabamento": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <rect x="12" y="12" width="40" height="40" rx="8" fill="#FFFFFF"/>
        <rect x="18" y="18" width="12" height="12" rx="3" fill="#242629"/>
        <rect x="34" y="18" width="12" height="12" rx="3" fill="#242629"/>
        <rect x="18" y="34" width="12" height="12" rx="3" fill="#242629"/>
        <rect x="34" y="34" width="12" height="12" rx="3" fill="#10B981"/>
        <circle cx="40" cy="40" r="3" fill="#FFFFFF"/>
    </svg>
    ''',

    # 13. Herbicida
    "Tratos - Herbicida": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <rect x="8" y="18" width="48" height="6" rx="3" fill="#FFFFFF"/>
        <line x1="32" y1="10" x2="32" y2="18" stroke="#FFFFFF" stroke-width="3"/>
        <path d="M14 28l-4 18m2-18l4 18" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
        <path d="M26 28l-4 18m2-18l4 18" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
        <path d="M38 28l-4 18m2-18l4 18" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
        <path d="M50 28l-4 18m2-18l4 18" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
    </svg>
    ''',

    # 14. Broca Armadilha
    "Infestação de Broca - Armadilha": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <path d="M32 10L10 50h44L32 10z" fill="#FFFFFF"/>
        <path d="M32 18L16 46h32L32 18z" fill="#242629"/>
        <circle cx="32" cy="32" r="5" fill="#10B981"/>
        <ellipse cx="32" cy="34" rx="4" ry="7" fill="#10B981"/>
    </svg>
    ''',

    # 15. Checklist Veicular
    "CHECK LIST VEICULAR": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <circle cx="18" cy="46" r="8" fill="#FFFFFF"/>
        <circle cx="46" cy="44" r="12" fill="#FFFFFF"/>
        <circle cx="18" cy="46" r="3" fill="#242629"/>
        <circle cx="46" cy="44" r="4" fill="#242629"/>
        <path d="M18 46h18v-8l6-14H30l-4 12h-8v10z" fill="#FFFFFF"/>
        <circle cx="46" cy="18" r="10" fill="#10B981"/>
        <path d="M41 18l3 3 8-8" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    ''',

    # 16. Área de Vivência / Checklist (Ícone Oficial com Prancheta, Lupa e Visto Verde)
    "#Check-list área de vivência _ Colheita": '''
    <img src="assets/checklist_vivencia.png" alt="Checklist Vivência" class="w-full h-full object-contain drop-shadow rounded-xl pointer-events-none select-none">
    ''',

    # 17. 5S e Gestão TPL
    "5S e Gestão - TPL": '''
    <svg viewBox="0 0 64 64" fill="none" class="w-full h-full drop-shadow">
        <rect x="12" y="12" width="40" height="46" rx="5" fill="#FFFFFF"/>
        <rect x="24" y="6" width="16" height="8" rx="3" fill="#242629" stroke="#FFFFFF" stroke-width="2"/>
        <circle cx="22" cy="24" r="3.5" fill="#10B981"/>
        <line x1="28" y1="24" x2="44" y2="24" stroke="#242629" stroke-width="3" stroke-linecap="round"/>
        <circle cx="22" cy="34" r="3.5" fill="#10B981"/>
        <line x1="28" y1="34" x2="44" y2="34" stroke="#242629" stroke-width="3" stroke-linecap="round"/>
        <circle cx="22" cy="44" r="3.5" fill="#10B981"/>
        <line x1="28" y1="44" x2="44" y2="44" stroke="#242629" stroke-width="3" stroke-linecap="round"/>
    </svg>
    '''
}

SHORT_NAMES = {
    "Plantio - 03.1 - Preparo de Solo - Subsolagem": "Subsolagem",
    "Plantio - 03.1 - Preparo de Solo - Canteirização": "Canteirização",
    "Plantio - 05 - Sulcação": "Sulcação",
    "Plantio - 04 - Dosagem de Produto - Sulcação": "Dosagem Sulco",
    "Plantio - 06 - Abertura da Asa": "Abertura Asa",
    "Plantio - 07 - Paralelismo": "Paralelismo RTK",
    "Plantio - 08 - Qualidade da muda": "Qualidade Muda",
    "Plantio - 09 - Quantidade de Gemas": "Qtd. Gemas",
    "Plantio - 10 - Quantidade de Cana": "Qtd. Cana",
    "Plantio - 11 - Dosagem de Produto - Cobrição": "Dosagem Cobr.",
    "Plantio - 12 - Cobrição": "Cobrição",
    "Plantio - 13 - Arremate e Acabamento": "Arremate",
    "Tratos - Herbicida": "Herbicida",
    "Infestação de Broca - Armadilha": "Broca Armadilha",
    "CHECK LIST VEICULAR": "Checklist Veic.",
    "#Check-list área de vivência _ Colheita": "Área Vivência",
    "5S e Gestão - TPL": "5S & Gestão",
}

ACTIVE_PANELS = {
    "#Check-list área de vivência _ Colheita": "area_vivencia/index.html",
    "Plantio - 03.1 - Preparo de Solo - Subsolagem": "subsolagem/index.html",
    "Plantio - 03.1 - Preparo de Solo - Canteirização": "canteirizacao/index.html",
    "Plantio - 04 - Dosagem de Produto - Sulcação": "dosagem_sulco/index.html",
    "Plantio - 05 - Sulcação": "sulcacao/index.html",
    "Plantio - 06 - Abertura da Asa": "abertura_asa/index.html",
    "Plantio - 07 - Paralelismo": "paralelismo/index.html",
    "Plantio - 08 - Qualidade da muda": "qualidade_muda/index.html",
    "Plantio - 09 - Quantidade de Gemas": "viabilidade_gemas/index.html",
    "Plantio - 10 - Quantidade de Cana": "qualidade_cana/index.html",
    "Plantio - 11 - Dosagem de Produto - Cobrição": "dosagem_cobricao/index.html",
    "Plantio - 12 - Cobrição": "cobricao/index.html",
    "Plantio - 13 - Arremate e Acabamento": "arremate_acabamento/index.html",
    "Tratos - Herbicida": "herbicida/index.html",
    "Infestação de Broca - Armadilha": "broca_armadilha/index.html",
    "5S e Gestão - TPL": "tpl_5s/index.html",
    "CHECK LIST VEICULAR": "checklist_veicular/index.html"
}

def get_active_panel(folder: str):
    if folder in ACTIVE_PANELS:
        return ACTIVE_PANELS[folder]
    f = folder.lower()
    if "subsolagem" in f:
        return "subsolagem/index.html"
    if "canteiriz" in f:
        return "canteirizacao/index.html"
    if "dosagem" in f and "sulca" in f:
        return "dosagem_sulco/index.html"
    if "dosagem" in f and "cobri" in f:
        return "dosagem_cobricao/index.html"
    if "cobri" in f and "dosagem" not in f:
        return "cobricao/index.html"
    if "arremate" in f:
        return "arremate_acabamento/index.html"
    if "herbicida" in f:
        return "herbicida/index.html"
    if "broca" in f or "armadilha" in f:
        return "broca_armadilha/index.html"
    if "sulca" in f and "dosagem" not in f:
        return "sulcacao/index.html"
    if "abertura" in f and "asa" in f:
        return "abertura_asa/index.html"
    if "paralelismo" in f:
        return "paralelismo/index.html"
    if "qualidade" in f and "muda" in f:
        return "qualidade_muda/index.html"
    if "gemas" in f:
        return "viabilidade_gemas/index.html"
    if "cana" in f:
        return "qualidade_cana/index.html"
    if "vivência" in f or "vivencia" in f or "check-list" in f:
        return "area_vivencia/index.html"
    if "5s" in f or "tpl" in f:
        return "tpl_5s/index.html"
    if "veicular" in f or "checklist veic" in f:
        return "checklist_veicular/index.html"
    return None

ORDEM_AGRO = [
    "Plantio - 03.1 - Preparo de Solo - Subsolagem",
    "Plantio - 03.1 - Preparo de Solo - Canteirização",
    "Plantio - 05 - Sulcação",
    "Plantio - 04 - Dosagem de Produto - Sulcação",
    "Plantio - 06 - Abertura da Asa",
    "Plantio - 07 - Paralelismo",
    "Plantio - 08 - Qualidade da muda",
    "Plantio - 09 - Quantidade de Gemas",
    "Plantio - 10 - Quantidade de Cana",
    "Plantio - 11 - Dosagem de Produto - Cobrição",
    "Plantio - 12 - Cobrição",
    "Plantio - 13 - Arremate e Acabamento",
    "Tratos - Herbicida",
    "Infestação de Broca - Armadilha",
    "CHECK LIST VEICULAR",
    "#Check-list área de vivência _ Colheita",
    "5S e Gestão - TPL"
]

def adapt_svg_colors(svg: str) -> str:
    s = svg.replace('fill="#FFFFFF"', 'fill="var(--icon-main)"')
    s = s.replace('stroke="#FFFFFF"', 'stroke="var(--icon-main)"')
    s = s.replace('fill="#242629"', 'fill="var(--icon-cutout)"')
    s = s.replace('stroke="#242629"', 'stroke="var(--icon-cutout)"')
    return s

def main():
    if not META_FILE.exists():
        print(f"Erro: Metadados não encontrados em {META_FILE}")
        return

    with open(META_FILE, "r", encoding="utf-8") as f:
        meta = json.load(f)

    forms_list = meta["forms"] if isinstance(meta, dict) and "forms" in meta else meta
    forms_dict = {item["folder"]: item for item in forms_list}
    ordered_forms = []
    for folder in ORDEM_AGRO:
        if folder in forms_dict:
            ordered_forms.append(forms_dict[folder])

    for item in forms_list:
        if item not in ordered_forms:
            ordered_forms.append(item)

    total_records = meta.get("total_records", sum(f["rows"] for f in ordered_forms)) if isinstance(meta, dict) else sum(f["rows"] for f in ordered_forms)
    total_forms = len(ordered_forms)

    # Identificação da data mais recente da safra
    recent_date = "27/10/2026"
    recent_count = sum(1 for f in ordered_forms if f.get("latest_date") == recent_date)

    # Coordenadas da Mandala Mais Espaçosa e Imponente (R=310px em canvas 800x800, aproveitando 2 a 3 cm a mais)
    CX, CY = 400.0, 400.0
    R = 310.0

    mandala_nodes = []
    mandala_spokes = []

    # Ticks de precisão na bússola externa (360 graus a cada 5 graus)
    precision_ticks = []
    for deg in range(0, 360, 5):
        rad = math.radians(deg)
        r_inner = 368 if deg % 30 == 0 else 373
        r_outer = 379
        x1 = CX + r_inner * math.cos(rad)
        y1 = CY + r_inner * math.sin(rad)
        x2 = CX + r_outer * math.cos(rad)
        y2 = CY + r_outer * math.sin(rad)
        stroke_w = 2.0 if deg % 30 == 0 else 1.0
        precision_ticks.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="var(--orbit-tick)" stroke-width="{stroke_w}"/>')

    for i, item in enumerate(ordered_forms):
        angle_deg = -90 + (i * (360.0 / total_forms))
        angle_rad = math.radians(angle_deg)
        x = CX + R * math.cos(angle_rad)
        y = CY + R * math.sin(angle_rad)

        raw_svg = SVG_ICONS.get(item["folder"], "<svg></svg>").strip()
        svg = adapt_svg_colors(raw_svg)
        short_name = SHORT_NAMES.get(item["folder"], item["clean_name"][:12])

        active_url = get_active_panel(item["folder"])
        is_active_dashboard = bool(active_url)
        is_recent = (item.get("latest_date") == recent_date)

        # Raio de conexão (spoke) do centro ao nó com animação de fluxo de dados
        spoke_stroke = "#10b981" if is_active_dashboard else "var(--spoke-line)"
        spoke_w = "1.8" if is_active_dashboard else "1.0"
        spoke_class = "spoke-line spoke-flow" if is_active_dashboard else "spoke-line"
        mandala_spokes.append(f"""
        <line id="spoke-{i}" x1="{CX}" y1="{CY}" x2="{x:.1f}" y2="{y:.1f}"
              stroke="{spoke_stroke}" stroke-width="{spoke_w}" stroke-dasharray="4 6" class="{spoke_class} transition-all duration-300"/>
        """)

        # Se for um painel ativo, clique abre o relatório
        if active_url:
            click_action = f"handleNodeClick({i}, '{active_url}')"
            node_border_class = "border-emerald-500 ring-2 ring-emerald-500/40 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
        else:
            click_action = f"handleNodeClick({i}, '')"
            node_border_class = "border-[var(--node-border)]"

        # Badge de Recente (Ponto pulsante âmbar dourado)
        recent_badge_html = """
        <span class="recent-dot absolute -top-1 -left-1 w-3 h-3 rounded-full bg-amber-400 ring-2 ring-amber-400/40 shadow-[0_0_8px_rgba(245,158,11,0.85)] z-30" title="Sincronizado recentemente na Safra (27/10/2026)">
            <span class="absolute inset-0 rounded-full bg-amber-300 animate-ping opacity-75"></span>
        </span>
        """ if is_recent else ""

        # Badge de Já Visitado (revelado dinamicamente via JS com checkmark)
        visited_badge_html = """
        <span class="visited-badge hidden absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-sky-500 text-white items-center justify-center text-[9px] font-bold shadow-md z-30 ring-2 ring-white dark:ring-slate-900" title="Relatório já consultado por você">✓</span>
        """

        # Nó da Mandala (Espaçoso, com Flutuação Harmônica Individual em Cascata)
        anim_delay = i * 0.28
        node_extra_classes = "is-recent" if is_recent else ""
        mandala_nodes.append(f"""
        <div class="mandala-node group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 flex flex-col items-center {node_extra_classes}"
             style="left: {(x/800.0)*100:.2f}%; top: {(y/800.0)*100:.2f}%; animation-delay: {anim_delay:.2f}s;"
             data-index="{i}"
             data-name="{item['clean_name']}"
             data-folder="{item['folder']}"
             data-cat="{item['category']}"
             data-rows="{item['rows']:,}"
             data-date="{item['latest_date']}"
             data-cols="{item['cols_count']}"
             data-url="{active_url or ''}"
             data-recent="{'true' if is_recent else 'false'}"
             onclick="{click_action}"
             onmouseenter="highlightNode({i})"
             onmouseleave="resetCenter()">
            
            <!-- Disco do Ícone Flutuante com Microinterações e Indicadores de Estado -->
            <div class="node-disc w-9 h-9 sm:w-11 sm:h-11 md:w-13 md:h-13 lg:w-15 lg:h-15 xl:w-16 xl:h-16 rounded-xl sm:rounded-2xl p-1 sm:p-2 md:p-2.5 transition-all duration-300 flex items-center justify-center relative border {node_border_class} group-hover:scale-110"
                 style="background: var(--node-bg); box-shadow: var(--node-shadow);">
                <span class="badge-index absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 text-[8px] sm:text-[9px] font-mono font-bold px-1 sm:px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    {i+1:02d}
                </span>
                {recent_badge_html}
                {visited_badge_html}
                <div class="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                    {svg}
                </div>
            </div>

            <!-- Nome e Contagem: Oculto no celular (hidden md:flex) para eliminar sobreposição -->
            <div class="node-label hidden md:flex mt-1 px-2.5 py-0.5 rounded-full border text-[9px] lg:text-[10px] font-semibold transition-all duration-200 whitespace-nowrap shadow-sm group-hover:scale-105 items-center gap-1.5"
                 style="background: var(--node-label-bg); border-color: var(--node-label-border); color: var(--node-label-text);">
                <span>{short_name}</span>
                <span class="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{item['rows']:,}</span>
            </div>
        </div>
        """)

    # Carrossel de Etapas para Mobile (Touch-friendly, Zero Empelotamento)
    mobile_chips = []
    for i, item in enumerate(ordered_forms):
        short_name = SHORT_NAMES.get(item["folder"], item["clean_name"][:12])
        active_url = get_active_panel(item["folder"])
        url_arg = f"'{active_url}'" if active_url else "''"
        is_recent = (item.get("latest_date") == recent_date)
        chip_recent_dot = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>' if is_recent else ''
        chip = f"""
        <button id="mobile-chip-{i}"
                onclick="handleNodeClick({i}, {url_arg})"
                class="mobile-step-chip shrink-0 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                style="background: var(--card-bg); border-color: var(--border-color); color: var(--text-primary);">
            <span class="font-mono text-[9px] font-bold text-emerald-500">{i+1:02d}</span>
            {chip_recent_dot}
            <span>{short_name}</span>
            <span class="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold opacity-80">{item['rows']:,}</span>
        </button>
        """
        mobile_chips.append(chip)

    # Grid Minimalista
    grid_cards = []
    for i, item in enumerate(ordered_forms):
        raw_svg = SVG_ICONS.get(item["folder"], "<svg></svg>").strip()
        svg = adapt_svg_colors(raw_svg)
        cols_json = json.dumps(item["columns"]).replace('"', '&quot;')
        active_url = get_active_panel(item["folder"])
        is_recent = (item.get("latest_date") == recent_date)

        card_badges = []
        if is_recent:
            card_badges.append('<span class="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/40 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Recente</span>')
        
        card_badges.append('<span class="visited-badge hidden px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40 items-center gap-1">✓ Visto</span>')

        if active_url:
            card_click = f"handleNodeClick({i}, '{active_url}')"
            card_badges.append('<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-sm flex items-center gap-1"><span>⚡</span><span>Painel Ativo</span></span>')
        else:
            card_click = f"handleNodeClick({i}, '')"
            card_badges.append(f'<span class="px-2 py-0.5 rounded-full text-[10px] font-medium border" style="background: var(--kpi-bg); border-color: var(--border-color); color: var(--text-secondary);">{item["category"]}</span>')

        card = f"""
        <div class="grid-item group rounded-2xl p-6 border transition-all duration-200 flex flex-col items-center text-center cursor-pointer relative hover:border-emerald-500/60 hover:shadow-lg"
             style="background: var(--card-bg); border-color: var(--border-color); box-shadow: var(--node-shadow);"
             data-name="{item['clean_name'].lower()}"
             data-cat="{item['category'].lower()}"
             data-folder="{item['folder']}"
             data-index="{i}"
             onclick="{card_click}">
            
            <!-- Badges Superiores -->
            <div class="w-full flex items-center justify-between text-[11px] mb-3 px-1" style="color: var(--text-secondary);">
                <span class="font-mono text-emerald-500 font-semibold">{i+1:02d}</span>
                <div class="flex items-center gap-1.5">
                    {''.join(card_badges)}
                </div>
            </div>

            <!-- Ícone Generoso Minimalista -->
            <div class="w-18 h-18 sm:w-20 sm:h-20 p-2 my-2 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <div class="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                    {svg}
                </div>
            </div>

            <!-- Título do Relatório -->
            <h3 class="font-semibold text-sm leading-snug mt-2 mb-1.5 transition-colors line-clamp-2 group-hover:text-emerald-500"
                style="color: var(--text-primary);">
                {item['clean_name']}
            </h3>

            <!-- Indicador Numérico em Verde -->
            <div class="mt-auto pt-3 border-t w-full flex items-center justify-between text-xs"
                 style="border-color: var(--border-color);">
                <span class="font-mono font-bold text-emerald-500 tracking-tight">{item['rows']:,} reg.</span>
                <span class="text-[11px] font-mono" style="color: var(--text-secondary);">{item['latest_date']}</span>
            </div>
        </div>
        """
        grid_cards.append(card)

    # Carregar template HTML desacoplado
    template_file = BASE_DIR / "template_mandala.html"
    with open(template_file, "r", encoding="utf-8") as tf:
        html_template = tf.read()

    # Substituição limpa de tokens
    final_html = html_template.replace("{{TOTAL_RECORDS}}", f"{total_records:,}")
    final_html = final_html.replace("{{RECENT_COUNT}}", str(recent_count))
    final_html = final_html.replace("{{PRECISION_TICKS}}", "".join(precision_ticks))
    final_html = final_html.replace("{{MANDALA_SPOKES}}", "".join(mandala_spokes))
    final_html = final_html.replace("{{MANDALA_NODES}}", "".join(mandala_nodes))
    final_html = final_html.replace("{{MOBILE_CHIPS}}", "".join(mobile_chips))
    final_html = final_html.replace("{{GRID_CARDS}}", "".join(grid_cards))
    final_html = final_html.replace("{{FORMS_DATA_JSON}}", json.dumps(ordered_forms, ensure_ascii=False))
    final_html = final_html.replace("{{ACTIVE_PANELS_JSON}}", json.dumps(ACTIVE_PANELS, ensure_ascii=False))

    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(final_html)

    print(f"Mandala Viva & Espaçosa gerada com sucesso em: {HTML_FILE}")

if __name__ == "__main__":
    main()
