import os, glob, re

snippet_check = "Totalizador no Centro de Gráficos Doughnut"

center_code = """
                // Totalizador no Centro de Gráficos Doughnut
                if (chartType === 'doughnut') {
                    const parent = chart.canvas ? chart.canvas.parentElement : null;
                    const hasHtmlCenter = parent && parent.querySelector('#donutCenterPerc, [id*="CenterPerc"], [id*="centerPerc"], [id*="donutCenter"]');
                    if (!hasHtmlCenter && chart.chartArea) {
                        let totalSum = 0;
                        chart.data.datasets.forEach(ds => {
                            if (Array.isArray(ds.data)) {
                                ds.data.forEach(v => {
                                    const n = typeof v === 'number' ? v : parseFloat(v);
                                    if (!isNaN(n) && isFinite(n)) totalSum += n;
                                });
                            }
                        });

                        if (totalSum > 0) {
                            const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                            const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

                            const meta = chart.getDatasetMeta(0);
                            let innerRadius = meta && meta.controller ? meta.controller.innerRadius : 40;
                            if (!innerRadius || innerRadius <= 0) innerRadius = 45;

                            ctx.save();
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';

                            const fontSizeNum = Math.max(16, Math.round(innerRadius * 0.44));
                            const fontSizeLabel = Math.max(9, Math.round(innerRadius * 0.20));

                            // Valor Somado
                            ctx.font = `bold ${fontSizeNum}px 'JetBrains Mono', 'Plus Jakarta Sans', sans-serif`;
                            ctx.fillStyle = defaultTextColor;
                            ctx.shadowColor = 'transparent';
                            ctx.fillText(Number.isInteger(totalSum) ? totalSum.toLocaleString('pt-BR') : totalSum.toFixed(1), centerX, centerY - (fontSizeLabel * 0.55));

                            // Rótulo "TOTAL"
                            ctx.font = `600 ${fontSizeLabel}px 'Plus Jakarta Sans', sans-serif`;
                            ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
                            ctx.fillText('TOTAL', centerX, centerY + (fontSizeNum * 0.55));

                            ctx.restore();
                        }
                    }
                }
"""

for js_path in glob.glob('DashBoard/**/js/dashboard.js', recursive=True):
    with open(js_path, 'r', encoding='utf-8') as f:
        code = f.read()

    if snippet_check in code:
        print("Already has center total:", js_path)
        continue

    # Regex to find afterDatasetsDraw end
    # Match: ctx.restore();\s*\}\);\s*\}\);
    pattern = re.compile(r'(ctx\.restore\(\);\s*\}\);\s*\}\);)')
    m = pattern.search(code)
    if m:
        matched_str = m.group(1)
        replacement = matched_str + "\n" + center_code
        code = code[:m.start()] + replacement + code[m.end():]
        with open(js_path, 'w', encoding='utf-8') as f:
            f.write(code)
        print("Updated:", js_path)
    else:
        print("Regex pattern not found in:", js_path)
