const fs = require('fs');
const path = require('path');

const dashDir = path.join(__dirname, '..', 'DashBoard');
const folders = fs.readdirSync(dashDir).filter(f => {
    const p = path.join(dashDir, f);
    return fs.statSync(p).isDirectory() && !['common', 'Maps', 'live_data', 'assets'].includes(f);
});

folders.forEach(folder => {
    const jsPath = path.join(dashDir, folder, 'js', 'dashboard.js');
    if (!fs.existsSync(jsPath)) return;
    let js = fs.readFileSync(jsPath, 'utf8');

    let modified = false;

    // Standardize btnSyncGlobalFilter classes
    // Replace complex className assignments with standard classes
    if (js.includes('btnSyncGlobalFilter') || js.includes('btnSync.className')) {
        // Look for sync locked
        const lockedPattern = /btnSync\.className\s*=\s*"[^"]*bg-emerald-600[^"]*";/g;
        if (js.match(lockedPattern)) {
            js = js.replace(lockedPattern, 'btnSync.className = "btn-sync-filter sync-locked";');
            modified = true;
        }
        // Look for sync unlocked
        const unlockedPattern = /btnSync\.className\s*=\s*"[^"]*bg-slate-[^"]*";/g;
        if (js.match(unlockedPattern)) {
            js = js.replace(unlockedPattern, 'btnSync.className = "btn-sync-filter sync-unlocked";');
            modified = true;
        }
    }

    if (js.includes('btnToggleMapSyncFilter') || js.includes('btnMapSync.className')) {
        const mapLockedPattern = /btnMapSync\.className\s*=\s*"[^"]*bg-emerald-600[^"]*";/g;
        if (js.match(mapLockedPattern)) {
            js = js.replace(mapLockedPattern, 'btnMapSync.className = "btn-sync-filter sync-locked";');
            modified = true;
        }
        const mapUnlockedPattern = /btnMapSync\.className\s*=\s*"[^"]*bg-slate-[^"]*";/g;
        if (js.match(mapUnlockedPattern)) {
            js = js.replace(mapUnlockedPattern, 'btnMapSync.className = "btn-sync-filter sync-unlocked";');
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(jsPath, js, 'utf8');
        console.log('Standardized sync button classes in', folder);
    }
});
