const fs = require('fs');
const path = require('path');

const dirs = fs.readdirSync('DashBoard').filter(d => 
    fs.statSync(path.join('DashBoard', d)).isDirectory() && 
    !['common', 'assets', 'live_data', 'Maps'].includes(d)
);

const CACHE_BUSTER = 'v=2026.11.13_v7';

dirs.forEach(d => {
    const htmlPath = path.join('DashBoard', d, 'index.html');
    if (!fs.existsSync(htmlPath)) return;

    let html = fs.readFileSync(htmlPath, 'utf8');

    // 1. Atualizar ou injetar design_guardian.css com cache buster
    if (html.includes('design_guardian.css')) {
        html = html.replace(/href="[^"]*design_guardian\.css[^"]*"/g, `href="../common/css/design_guardian.css?${CACHE_BUSTER}"`);
    } else {
        html = html.replace('</head>', `    <link rel="stylesheet" href="../common/css/design_guardian.css?${CACHE_BUSTER}">\n</head>`);
    }

    // 2. Atualizar ou injetar map_shapes_layer.js com cache buster
    if (html.includes('map_shapes_layer.js')) {
        html = html.replace(/src="[^"]*map_shapes_layer\.js[^"]*"/g, `src="../common/js/map_shapes_layer.js?${CACHE_BUSTER}"`);
    } else {
        html = html.replace('</body>', `    <script src="../common/js/map_shapes_layer.js?${CACHE_BUSTER}"></script>\n</body>`);
    }

    // 3. Limpar estilos inline conflitantes de selects e inputs na barra de filtros
    html = html.replace(/\s*style="background:\s*var\(--bg-page\);\s*border-color:\s*var\(--border-color\);\s*color:\s*var\(--text-primary\);"/g, '');

    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(`[✓] Updated ${d}/index.html`);
});

console.log('\nAll 17 dashboards synchronized with cache-busters and clean tokens.');
