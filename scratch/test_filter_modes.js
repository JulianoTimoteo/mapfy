const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
    });

    const fileUrl = 'file://' + path.resolve('DashBoard/subsolagem/index.html').replace(/\\/g, '/');
    console.log('Navegando para:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

    // 1. Estado inicial
    const evoSyncText = await page.$eval('#syncText', el => el.innerText);
    const evoSyncIcon = await page.$eval('#syncIcon', el => el.innerText);
    const evoButtonsDisabled = await page.$$eval('.btn-evo-filter', btns => btns.map(b => b.disabled));
    console.log('1. Gráficos - Inicial:', { evoSyncIcon, evoSyncText, evoButtonsDisabled });

    const mapSyncText = await page.$eval('#mapSyncText', el => el.innerText);
    const mapSyncIcon = await page.$eval('#mapSyncIcon', el => el.innerText);
    const mapButtonsDisabled = await page.$$eval('.btn-map-filter', btns => btns.map(b => b.disabled));
    console.log('1. Mapa - Inicial:', { mapSyncIcon, mapSyncText, mapButtonsDisabled });

    // 2. Destravar Gráficos
    await page.click('#btnSyncGlobalFilter');
    const evoSyncTextUnlocked = await page.$eval('#syncText', el => el.innerText);
    const evoButtonsEnabled = await page.$$eval('.btn-evo-filter', btns => btns.map(b => b.disabled));
    console.log('2. Gráficos - Destravado:', { evoSyncTextUnlocked, evoButtonsEnabled });

    // 3. Clicar em 7D nos Gráficos
    await page.click('.btn-evo-filter[data-evo-range="7D"]');
    const donutValDentro = await page.$eval('#donutValDentro', el => el.innerText);
    console.log('3. Gráficos - Donut após 7D:', donutValDentro);

    // 4. Destravar Mapa
    await page.click('#btnToggleMapSyncFilter');
    const mapSyncTextUnlocked = await page.$eval('#mapSyncText', el => el.innerText);
    const mapButtonsEnabled = await page.$$eval('.btn-map-filter', btns => btns.map(b => b.disabled));
    console.log('4. Mapa - Destravado:', { mapSyncTextUnlocked, mapButtonsEnabled });

    // 5. Clicar em 15D no Mapa
    await page.click('.btn-map-filter[data-map-range="15D"]');
    console.log('5. Mapa - Clicado em 15D');

    // 6. Retravar Gráficos
    await page.click('#btnSyncGlobalFilter');
    const evoSyncTextRelocked = await page.$eval('#syncText', el => el.innerText);
    const evoButtonsRelocked = await page.$$eval('.btn-evo-filter', btns => btns.map(b => b.disabled));
    console.log('6. Gráficos - Retravado:', { evoSyncTextRelocked, evoButtonsRelocked });

    console.log('Total de erros no console:', errors.length);
    if (errors.length > 0) {
        console.error('Erros:', errors);
    }

    await browser.close();
})();
