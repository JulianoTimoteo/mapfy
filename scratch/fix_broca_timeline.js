const fs = require('fs');
const path = require('path');

// 1. broca_armadilha index.html
const p = path.join(__dirname, '..', 'DashBoard', 'broca_armadilha', 'index.html');
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/<button id="btnTimelineDia"[^>]*>Diário<\/button>\s*<button id="btnTimelineMes"[^>]*>Mensal<\/button>/,
    '<button id="btnTimelineDia" type="button" class="btn-timeline-toggle active">Diário</button>\n                            <button id="btnTimelineMes" type="button" class="btn-timeline-toggle">Mensal</button>');
fs.writeFileSync(p, c, 'utf8');
console.log('Fixed timeline buttons in broca_armadilha index.html');

// 2. broca_armadilha dashboard.js
const pJs = path.join(__dirname, '..', 'DashBoard', 'broca_armadilha', 'js', 'dashboard.js');
let cJs = fs.readFileSync(pJs, 'utf8');
cJs = cJs.replace(/btnDia\.className\s*=\s*'[^']*';\s*btnMes\.className\s*=\s*'[^']*';/,
    "btnDia.className = 'btn-timeline-toggle active'; btnMes.className = 'btn-timeline-toggle';");
cJs = cJs.replace(/btnMes\.className\s*=\s*'[^']*';\s*btnDia\.className\s*=\s*'[^']*';/,
    "btnMes.className = 'btn-timeline-toggle active'; btnDia.className = 'btn-timeline-toggle';");
fs.writeFileSync(pJs, cJs, 'utf8');
console.log('Fixed timeline buttons in broca_armadilha dashboard.js');
