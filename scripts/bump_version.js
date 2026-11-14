const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'DashBoard');
const dirs = fs.readdirSync(baseDir, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== 'common');
let updated = 0;

for (const d of dirs) {
    const indexPath = path.join(baseDir, d.name, 'index.html');
    if (fs.existsSync(indexPath)) {
        let content = fs.readFileSync(indexPath, 'utf8');
        if (content.includes('map_shapes_layer.js?v=2026.11.13_v7')) {
            content = content.replace(/map_shapes_layer\.js\?v=2026\.11\.13_v7/g, 'map_shapes_layer.js?v=2026.11.14_v1');
            fs.writeFileSync(indexPath, content, 'utf8');
            updated++;
            console.log('Updated:', d.name);
        }
    }
}
console.log('Total updated:', updated);
