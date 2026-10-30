import os, re

dashboards = [
    'abertura_asa', 'area_vivencia', 'arremate_acabamento', 'canteirizacao',
    'cobricao', 'dosagem_cobricao', 'dosagem_sulco', 'herbicida', 'paralelismo',
    'qualidade_cana', 'qualidade_muda', 'subsolagem', 'sulcacao', 'viabilidade_gemas'
]

chart_script_regex = re.compile(r'(<script[^>]*src=["\'][^"\']*chart(?:\.umd)?(?:\.min)?\.js[^"\']*["\'][^>]*></script>)', re.IGNORECASE)

for d in dashboards:
    html_path = os.path.join('DashBoard', d, 'index.html')
    if os.path.exists(html_path):
        with open(html_path, 'r', encoding='utf-8') as f:
            html = f.read()
        if 'chartjs-plugin-datalabels' not in html:
            m = chart_script_regex.search(html)
            if m:
                matched_tag = m.group(1)
                replacement = matched_tag + '\n    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>'
                html = html.replace(matched_tag, replacement, 1)
                with open(html_path, 'w', encoding='utf-8') as f:
                    f.write(html)
                print(f'[HTML] Added datalabels to {d}')
            else:
                print(f'[WARN] No chart tag matched in {d}')

print('HTML injection complete!')
