const fs = require('fs');
const path = require('path');

const dashDir = path.join(__dirname, '..', 'DashBoard');
const folders = fs.readdirSync(dashDir).filter(f => {
    const p = path.join(dashDir, f);
    return fs.statSync(p).isDirectory() && !['common', 'Maps', 'live_data', 'assets'].includes(f);
});

folders.forEach(folder => {
    const htmlPath = path.join(dashDir, folder, 'index.html');
    if (!fs.existsSync(htmlPath)) return;
    let html = fs.readFileSync(htmlPath, 'utf8');

    // 1. Inject design_guardian.css if not present
    if (!html.includes('design_guardian.css')) {
        const linkTag = '    <link rel="stylesheet" href="../common/css/design_guardian.css?v=2026.1">';
        if (html.includes('fullscreen_inspector.css')) {
            html = html.replace(/(<link[^>]*fullscreen_inspector\.css[^>]*>)/i, '$1\n' + linkTag);
        } else {
            html = html.replace('</head>', linkTag + '\n</head>');
        }
        console.log('Injected design_guardian.css in', folder);
    }

    // 2. Clean up any dark fallback inline styles on period controls
    const badStyle = /style="background:\s*var\(--bg-kpi,\s*#1e293b\);\s*border-color:\s*var\(--border-color,\s*rgba\(148,\s*163,\s*184,\s*0\.2\)\);"/g;
    if (html.match(badStyle)) {
        html = html.replace(badStyle, 'style="background: var(--bg-kpi); border-color: var(--border-color);"');
        console.log('Cleaned badStyle in', folder);
    }

    // 3. Clean up any other --bg-kpi, #1e293b fallback
    html = html.replace(/var\(--bg-kpi,\s*#1e293b\)/g, 'var(--bg-kpi)');

    fs.writeFileSync(htmlPath, html, 'utf8');
});

console.log('Design Guardian application completed across all dashboards.');
