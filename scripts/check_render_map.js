const fs = require('fs');
const path = require('path');

const dirs = fs.readdirSync('DashBoard').filter(d => 
    fs.statSync(path.join('DashBoard', d)).isDirectory() && 
    !['common', 'assets', 'live_data', 'Maps'].includes(d)
);

dirs.forEach(d => {
    const jsPath = path.join('DashBoard', d, 'js', 'dashboard.js');
    if (!fs.existsSync(jsPath)) return;
    const content = fs.readFileSync(jsPath, 'utf8');
    const match = content.match(/function\s+(renderMap|updateMapMarkers)\s*\([\s\S]*?\n\s*function/);
    if (match) {
        const body = match[0];
        const hasAddLayer = body.includes('.addLayer(state.markersLayer') || body.includes('.addLayer(state.markerCluster') || body.includes('.addLayer(dashboardState');
        if (hasAddLayer) {
            console.log(`[!] ${d}: calls addLayer inside ${match[1]}`);
        }
    }
});
console.log('Inspection complete.');
