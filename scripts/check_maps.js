const fs = require('fs');
const path = require('path');

const dirs = fs.readdirSync('DashBoard').filter(d => 
    fs.statSync(path.join('DashBoard', d)).isDirectory() && 
    !['common', 'assets', 'live_data', 'Maps'].includes(d)
);

console.log('Auditing 17 Dashboards Map Setup:\n');
dirs.forEach(d => {
    const jsPath = path.join('DashBoard', d, 'js', 'dashboard.js');
    if (!fs.existsSync(jsPath)) {
        console.log(`[!] ${d}: NO dashboard.js`);
        return;
    }
    const content = fs.readFileSync(jsPath, 'utf8');
    const hasGoogle = content.includes('🛰️ Satélite Google');
    const hasEsri = content.includes('🌍 Satélite Esri');
    const hasVetorial = content.includes('🗺️ Mapa Vetorial');
    const hasTopLeft = content.includes("position: 'topleft'") || content.includes('position: "topleft"');
    const hasLayerControl = content.includes('L.control.layers(baseMaps');
    const hasShapesScript = fs.readFileSync(path.join('DashBoard', d, 'index.html'), 'utf8').includes('map_shapes_layer.js');

    const ok = hasGoogle && hasEsri && hasVetorial && hasTopLeft && hasLayerControl && hasShapesScript;
    console.log(`${ok ? '✓' : '✗'} ${d.padEnd(22)} | G:${hasGoogle ? '1':'0'} E:${hasEsri ? '1':'0'} V:${hasVetorial ? '1':'0'} | TopLeft:${hasTopLeft ? '1':'0'} | LayerCtrl:${hasLayerControl ? '1':'0'} | ShapesScript:${hasShapesScript ? '1':'0'}`);
});
