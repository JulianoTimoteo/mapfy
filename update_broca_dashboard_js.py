with open('DashBoard/broca_armadilha/js/dashboard.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update fallbackDataLabelsPlugin to never draw if datalabels plugin is active
old_fallback = """    const fallbackDataLabelsPlugin = {
        id: 'pitangueiras_datalabels_fallback',
        afterDatasetsDraw(chart) {
            if (typeof window.ChartDataLabels !== 'undefined') return; // Delega estritamente ao ChartDataLabels oficial"""

new_fallback = """    const fallbackDataLabelsPlugin = {
        id: 'pitangueiras_datalabels_fallback',
        afterDatasetsDraw(chart) {
            if (typeof window.ChartDataLabels !== 'undefined' || (typeof Chart !== 'undefined' && Chart.registry && Chart.registry.plugins.items['datalabels'])) {
                return; // Delega estritamente ao ChartDataLabels oficial
            }"""

if old_fallback in code:
    code = code.replace(old_fallback, new_fallback)
    print("1. Updated fallbackDataLabelsPlugin check")
else:
    print("1. Failed to find old_fallback")

# 2. Add Chart destruction before new Chart in initCharts
old_init_faz = """        // 1. Fazendas (Top Fazendas com Maior Captura)
        const ctxFaz = document.getElementById('chartFazendas')?.getContext('2d');
        if (ctxFaz) {
            state.charts.fazendas = new Chart(ctxFaz, {"""

new_init_faz = """        // 1. Fazendas (Top Fazendas com Maior Captura)
        const ctxFaz = document.getElementById('chartFazendas')?.getContext('2d');
        if (ctxFaz) {
            const exFaz = Chart.getChart(ctxFaz.canvas);
            if (exFaz) exFaz.destroy();
            state.charts.fazendas = new Chart(ctxFaz, {"""

old_init_tal = """        // 2. Talhões (Top Talhões com Maior Pressão)
        const ctxTal = document.getElementById('chartTalhoes')?.getContext('2d');
        if (ctxTal) {
            state.charts.talhoes = new Chart(ctxTal, {"""

new_init_tal = """        // 2. Talhões (Top Talhões com Maior Pressão)
        const ctxTal = document.getElementById('chartTalhoes')?.getContext('2d');
        if (ctxTal) {
            const exTal = Chart.getChart(ctxTal.canvas);
            if (exTal) exTal.destroy();
            state.charts.talhoes = new Chart(ctxTal, {"""

old_init_time = """        // 3. Timeline (Evolução Temporal)
        const ctxTime = document.getElementById('chartTimeline')?.getContext('2d');
        if (ctxTime) {
            state.charts.timeline = new Chart(ctxTime, {"""

new_init_time = """        // 3. Timeline (Evolução Temporal)
        const ctxTime = document.getElementById('chartTimeline')?.getContext('2d');
        if (ctxTime) {
            const exTime = Chart.getChart(ctxTime.canvas);
            if (exTime) exTime.destroy();
            state.charts.timeline = new Chart(ctxTime, {"""

old_init_sev = """        // 4. Severity Donut (Distribuição de Severidade)
        const ctxSev = document.getElementById('chartSeverity')?.getContext('2d');
        if (ctxSev) {
            state.charts.severity = new Chart(ctxSev, {"""

new_init_sev = """        // 4. Severity Donut (Distribuição de Severidade)
        const ctxSev = document.getElementById('chartSeverity')?.getContext('2d');
        if (ctxSev) {
            const exSev = Chart.getChart(ctxSev.canvas);
            if (exSev) exSev.destroy();
            state.charts.severity = new Chart(ctxSev, {"""

for o, n, label in [
    (old_init_faz, new_init_faz, "Fazendas destroy check"),
    (old_init_tal, new_init_tal, "Talhoes destroy check"),
    (old_init_time, new_init_time, "Timeline destroy check"),
    (old_init_sev, new_init_sev, "Severity destroy check")
]:
    if o in code:
        code = code.replace(o, n)
        print(f"2. Added {label}")
    else:
        print(f"2. Failed to add {label}")

# 3. Toggle filtrarPorResponsavel
old_filtrar_resp = """    window.filtrarPorResponsavel = function (nome) {
        const sel = document.getElementById('filterResponsavel');
        if (sel) {
            sel.value = nome;
            state.activeFilters.responsavel = nome;
            aplicarFiltros();
        }
    };"""

new_filtrar_resp = """    window.filtrarPorResponsavel = function (nome) {
        const sel = document.getElementById('filterResponsavel');
        if (sel) {
            if (state.activeFilters.responsavel === nome) {
                sel.value = 'ALL';
                state.activeFilters.responsavel = 'ALL';
            } else {
                sel.value = nome;
                state.activeFilters.responsavel = nome;
            }
            aplicarFiltros();
        }
    };"""

if old_filtrar_resp in code:
    code = code.replace(old_filtrar_resp, new_filtrar_resp)
    print("3. Updated filtrarPorResponsavel toggle")
else:
    print("3. Failed to find old_filtrar_resp")

with open('DashBoard/broca_armadilha/js/dashboard.js', 'w', encoding='utf-8') as f:
    f.write(code)
print("Finished updating broca_armadilha/js/dashboard.js")
