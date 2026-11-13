const fs = require('fs');
const path = require('path');

const targets = [
    path.resolve('Server_MapFy_RaspberryPi', 'DashBoard'),
    path.resolve('C:\\Users\\julianotimoteo\\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\\Server_Funcionando', 'DashBoard'),
    path.resolve('C:\\Users\\julianotimoteo\\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\\Server_Funcionando', 'server', 'DashBoard')
];

const sourceDir = path.resolve('DashBoard');

function copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            // Apenas copia se o arquivo foi modificado ou é diferente
            let shouldCopy = true;
            if (fs.existsSync(destPath)) {
                const srcStat = fs.statSync(srcPath);
                const destStat = fs.statSync(destPath);
                if (srcStat.size === destStat.size && Math.abs(srcStat.mtimeMs - destStat.mtimeMs) < 1000) {
                    shouldCopy = false;
                }
            }
            if (shouldCopy) {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}

targets.forEach(target => {
    if (fs.existsSync(path.dirname(target))) {
        console.log(`Syncing to ${target}...`);
        copyDirRecursive(sourceDir, target);
        console.log(`[✓] Synced ${target}`);
    } else {
        console.log(`[!] Target parent does not exist: ${path.dirname(target)}`);
    }
});

console.log('\nAll mirrors synced successfully.');
