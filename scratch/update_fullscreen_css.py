from pathlib import Path

css_path = Path(r"DashBoard\common\css\fullscreen_inspector.css")
content = css_path.read_text(encoding="utf-8")

target = """html.dark [class*="text-slate-400"],
html.dark [class*="text-slate-500"] {
    color: #f8fafc !important;
}"""

replacement = """html.dark [class*="text-slate-400"],
html.dark [class*="text-slate-500"] {
    color: #f8fafc !important;
}

/* ==========================================================================
   ALTO CONTRASTE EXECUTIVO: GRÁFICO DE ROSCA / DONUT DE CONFORMIDADE
   - No modo claro: textos em preto profundo (#000000 / #0f172a), legibilidade máxima.
   - No modo escuro: textos em branco puro (#ffffff), zero cinza.
   ========================================================================== */
#donutDataContainer > div,
.donut-legend-card {
    transition: background-color 0.2s ease, border-color 0.2s ease;
}

html:not(.dark) #donutDataContainer,
html:not(.dark) #donutDataContainer span,
html:not(.dark) #donutDataContainer div,
html:not(.dark) [id^="donutVal"],
html:not(.dark) #donutCenterOverlay span:not(#donutCenterPerc),
html:not(.dark) #donutScopeBadge {
    color: #0f172a !important;
}

html:not(.dark) #donutDataContainer span.donut-card-range,
html:not(.dark) #donutDataContainer span[class*="text-[9px]"],
html:not(.dark) #donutDataContainer span.font-mono:not([id^="donutVal"]) {
    color: #334155 !important;
    font-weight: 700 !important;
}

html:not(.dark) #donutDataContainer span[id^="donutVal"],
html:not(.dark) #donutValDentro,
html:not(.dark) #donutValAbaixo,
html:not(.dark) #donutValAcima,
html:not(.dark) #donutValTotal {
    color: #000000 !important;
    font-weight: 900 !important;
}

/* Modo escuro: BRANCO PURO ABSOLUTO (ZERO CINZA) */
html.dark #donutDataContainer span[id^="donutVal"],
html.dark #donutValDentro,
html.dark #donutValAbaixo,
html.dark #donutValAcima,
html.dark #donutCenterOverlay span:not(#donutCenterPerc),
html.dark #donutScopeBadge {
    color: #ffffff !important;
    font-weight: 800 !important;
}

html.dark #donutDataContainer span.donut-card-range,
html.dark #donutDataContainer span[class*="text-[9px]"],
html.dark #donutDataContainer span.font-mono:not([id^="donutVal"]) {
    color: #f8fafc !important;
    font-weight: 600 !important;
}"""

content_norm = content.replace("\r\n", "\n")
target_norm = target.replace("\r\n", "\n")
replacement_norm = replacement.replace("\r\n", "\n")

if target_norm in content_norm:
    content_norm = content_norm.replace(target_norm, replacement_norm)
    # preserve original newline style
    if "\r\n" in content:
        content_norm = content_norm.replace("\n", "\r\n")
    css_path.write_text(content_norm, encoding="utf-8")
    print("SUCCESS: fullscreen_inspector.css atualizado com sucesso!")
else:
    print("WARNING: target not found!")
