# -*- coding: utf-8 -*-
"""
build_dosagem_html_and_js.py
Generates index.html and js/dashboard.js for DashBoard/dosagem_sulco/
"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent / "dosagem_sulco"

def generate_index_html():
    html = '''<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plantio — Dosagem de Produto na Sulcação • Usina Pitangueiras</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body class="min-h-screen flex flex-col font-sans selection:bg-emerald-500 selection:text-white">

    <!-- 1. CABEÇALHO EXECUTIVO (SEM ATALHOS CRUZADOS) -->
    <header class="border-b sticky top-0 z-40 backdrop-blur-md transition-colors duration-200"
            style="background: var(--header-bg); border-color: var(--border-color);">
        <div class="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
            
            <div class="flex items-center gap-3.5">
                <a href="../index.html" class="p-2 rounded-xl border transition-all hover:border-emerald-500 hover:scale-105 flex items-center justify-center shadow-sm"
                   style="background: var(--bg-card); border-color: var(--border-color);"
                   title="Voltar para a Mandala Hub">
                    <span class="text-sm font-bold text-emerald-500">←</span>
                    <span class="text-xs font-semibold ml-1 hidden sm:inline text-[var(--text-secondary)]">Mandala Hub</span>
                </a>
                
                <div class="h-10 sm:h-11 px-2.5 py-1 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                    <img src="assets/logo_pitangueiras.png" alt="Usina Pitangueiras 51 Anos" class="h-full w-auto object-contain">
                </div>

                <div>
                    <div class="flex items-center gap-2">
                        <h1 class="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)]">
                            Plantio — Dosagem de Produto na Sulcação
                        </h1>
                        <span class="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                            Safra 2026
                        </span>
                    </div>
                    <p class="text-xs text-[var(--text-secondary)]">
                        Monitoramento de dosagem de adubo e torta, análise de variabilidade, rastreabilidade operacional e georreferenciamento
                    </p>
                </div>
            </div>

            <!-- Controles do Cabeçalho -->
            <div class="flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
                <!-- Seletor Temporal -->
                <div class="period-segmented-group shadow-sm">
                    <button id="btnAllDates" class="period-toggle-btn active" data-period="all">
                        <span>🌐</span>
                        <span>Safra Completa</span>
                        <span class="period-badge" id="badgeAll">0</span>
                    </button>
                    <button id="btnLatestDate" class="period-toggle-btn" data-period="latest">
                        <span>📅</span>
                        <span>Última Data</span>
                        <span class="period-badge" id="badgeLatest">-</span>
                    </button>
                    <button id="btnToday" class="period-toggle-btn" data-period="today">
                        <span>📆</span>
                        <span>Hoje</span>
                        <span class="period-badge" id="badgeToday">0</span>
                    </button>
                </div>

                <button id="btnExportCSV" class="px-3 py-1.5 rounded-xl border font-semibold flex items-center gap-1.5 transition-all hover:border-emerald-500"
                        style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-secondary);">
                    <span>📥</span>
                    <span class="hidden sm:inline">CSV</span>
                </button>

                <button onclick="window.print()" class="px-3 py-1.5 rounded-xl border font-semibold flex items-center gap-1.5 transition-all hover:border-emerald-500"
                        style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-secondary);">
                    <span>🖨️</span>
                    <span class="hidden sm:inline">Relatório</span>
                </button>

                <button id="themeToggle" class="p-2 rounded-xl border transition-colors hover:border-emerald-500"
                        style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-primary);">
                    <span id="themeIcon">🌙</span>
                </button>
            </div>
        </div>
    </header>

    <!-- CONTEÚDO PRINCIPAL -->
    <main class="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        <!-- 2. SELETOR RÁPIDO DE PRODUTOS (ADUBO & TORTA SEPARADOS) -->
        <section class="p-4 rounded-2xl border shadow-sm transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                 style="background: var(--bg-card); border-color: var(--border-color);">
            <div class="flex items-center gap-3">
                <span class="text-2xl">🌱</span>
                <div>
                    <h2 class="text-sm font-bold text-[var(--text-primary)]">Segmentação de Insumos • Sulcação</h2>
                    <p class="text-[11px] text-[var(--text-secondary)]">Análise agronômica isolada para evitar comparação direta de grandezas distintas</p>
                </div>
            </div>

            <!-- Botões Segmentados de Produto -->
            <div class="inline-flex p-1 rounded-xl border text-xs font-semibold"
                 style="background: var(--bg-page); border-color: var(--border-color);">
                <button id="btnProdAll" class="px-4 py-1.5 rounded-lg transition-all text-white bg-emerald-600 shadow-sm flex items-center gap-1.5" onclick="setProductFilter('ALL')">
                    <span>◈</span>
                    <span>Todos os Produtos</span>
                    <span class="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px] font-mono" id="prodBadgeAll">1.279</span>
                </button>
                <button id="btnProdAdubo" class="px-4 py-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-emerald-500 flex items-center gap-1.5" onclick="setProductFilter('Adubo')">
                    <span>🌿</span>
                    <span>Adubo</span>
                    <span class="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-500 text-[10px] font-mono" id="prodBadgeAdubo">1.185</span>
                </button>
                <button id="btnProdTorta" class="px-4 py-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-amber-500 flex items-center gap-1.5" onclick="setProductFilter('Torta')">
                    <span>🍂</span>
                    <span>Torta</span>
                    <span class="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-mono" id="prodBadgeTorta">94</span>
                </button>
            </div>
        </section>

        <!-- 3. COMPARATIVO EXECUTIVO: ADUBO VS TORTA -->
        <section class="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <!-- Bloco Adubo -->
            <div class="p-4 rounded-2xl border shadow-sm transition-all border-emerald-500/40 relative overflow-hidden"
                 style="background: var(--bg-card);">
                <div class="flex items-center justify-between pb-2 mb-3 border-b" style="border-color: var(--border-color);">
                    <div class="flex items-center gap-2">
                        <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
                        <h3 class="font-bold text-sm text-[var(--text-primary)]">Insumo: Adubo de Plantio</h3>
                        <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/30">92,6% do Volume</span>
                    </div>
                    <span class="font-mono text-xs text-emerald-500 font-bold" id="compAduboCount">1.185 medições</span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Média Real</span>
                        <strong class="text-base font-mono text-emerald-500" id="compAduboMedia">3,40 kg/m</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Mediana (P50)</span>
                        <strong class="text-base font-mono text-[var(--text-primary)]" id="compAduboMediana">3,41 kg/m</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Faixa Padrão</span>
                        <strong class="text-xs font-mono text-emerald-500" id="compAduboFaixa">3,00 a 3,80 kg/m</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Variabilidade</span>
                        <strong class="text-xs font-mono text-indigo-400" id="compAduboCV">CV: 15,9% (±0,54)</strong>
                    </div>
                </div>
            </div>

            <!-- Bloco Torta -->
            <div class="p-4 rounded-2xl border shadow-sm transition-all border-amber-500/40 relative overflow-hidden"
                 style="background: var(--bg-card);">
                <div class="flex items-center justify-between pb-2 mb-3 border-b" style="border-color: var(--border-color);">
                    <div class="flex items-center gap-2">
                        <span class="w-3 h-3 rounded-full bg-amber-500"></span>
                        <h3 class="font-bold text-sm text-[var(--text-primary)]">Insumo: Torta de Filtro</h3>
                        <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/30">7,4% do Volume</span>
                    </div>
                    <span class="font-mono text-xs text-amber-500 font-bold" id="compTortaCount">94 medições</span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Média Real</span>
                        <strong class="text-base font-mono text-amber-500" id="compTortaMedia">5,62 t/ha</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Mediana (P50)</span>
                        <strong class="text-base font-mono text-[var(--text-primary)]" id="compTortaMediana">5,65 t/ha</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Faixa Padrão</span>
                        <strong class="text-xs font-mono text-amber-500" id="compTortaFaixa">5,20 a 6,00 t/ha</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Variabilidade</span>
                        <strong class="text-xs font-mono text-indigo-400" id="compTortaCV">CV: 6,5% (±0,37)</strong>
                    </div>
                </div>
            </div>
        </section>

        <!-- 4. BARRA DE FILTROS INTEGRADA -->
        <section class="p-4 rounded-2xl border shadow-sm transition-colors"
                 style="background: var(--bg-card); border-color: var(--border-color);">
            <div class="flex items-center justify-between gap-4 mb-3 pb-2 border-b"
                 style="border-color: var(--border-color);">
                <div class="flex items-center gap-2">
                    <span class="text-emerald-500 text-sm">⚡</span>
                    <h2 class="text-sm font-bold tracking-tight text-[var(--text-primary)]">Filtros Operacionais</h2>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-xs font-mono text-[var(--text-secondary)]">
                        Exibindo <strong class="text-emerald-500 font-bold" id="lblFilteredCount">0</strong> de <span id="lblTotalCount">0</span> medições
                    </span>
                    <button id="btnClearFilters" class="text-xs font-semibold text-rose-500 hover:underline flex items-center gap-1">
                        <span>✕</span>
                        <span>Limpar</span>
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                <div>
                    <label class="block font-medium mb-1 text-[var(--text-secondary)]">Frente Operacional</label>
                    <select id="filterFrente" class="w-full p-2 rounded-xl border text-xs focus:outline-none focus:border-emerald-500"
                            style="background: var(--bg-page); border-color: var(--border-color); color: var(--text-primary);">
                        <option value="ALL">Todas as Frentes</option>
                    </select>
                </div>
                <div>
                    <label class="block font-medium mb-1 text-[var(--text-secondary)]">Ordem de Serviço (OS)</label>
                    <select id="filterOS" class="w-full p-2 rounded-xl border text-xs focus:outline-none focus:border-emerald-500"
                            style="background: var(--bg-page); border-color: var(--border-color); color: var(--text-primary);">
                        <option value="ALL">Todas as OS</option>
                    </select>
                </div>
                <div>
                    <label class="block font-medium mb-1 text-[var(--text-secondary)]">Responsável / Inspetor</label>
                    <select id="filterResponsavel" class="w-full p-2 rounded-xl border text-xs focus:outline-none focus:border-emerald-500"
                            style="background: var(--bg-page); border-color: var(--border-color); color: var(--text-primary);">
                        <option value="ALL">Todos os Responsáveis</option>
                    </select>
                </div>
                <div>
                    <label class="block font-medium mb-1 text-[var(--text-secondary)]">Status Técnico</label>
                    <select id="filterStatusTecnico" class="w-full p-2 rounded-xl border text-xs focus:outline-none focus:border-emerald-500"
                            style="background: var(--bg-page); border-color: var(--border-color); color: var(--text-primary);">
                        <option value="ALL">Todos os Registros</option>
                        <option value="DENTRO">Dentro da Meta</option>
                        <option value="ABAIXO">Abaixo da Meta</option>
                        <option value="ACIMA">Acima da Meta</option>
                    </select>
                </div>
                <div>
                    <label class="block font-medium mb-1 text-[var(--text-secondary)]">Auditoria GPS</label>
                    <select id="filterGPS" class="w-full p-2 rounded-xl border text-xs focus:outline-none focus:border-emerald-500"
                            style="background: var(--bg-page); border-color: var(--border-color); color: var(--text-primary);">
                        <option value="ALL">Todos os Registros</option>
                        <option value="GPS_VALIDO">Com GPS Válido</option>
                        <option value="GPS_INVALIDO">GPS Ausente/Inválido</option>
                    </select>
                </div>
            </div>

            <div class="mt-4 pt-3 border-t flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                 style="border-color: var(--border-color);">
                <div class="w-full md:w-96 relative">
                    <input type="text" id="globalSearch" placeholder="Buscar por ID, OS, frente, responsável ou local..."
                           class="w-full p-2 pl-8 rounded-xl border text-xs focus:outline-none focus:border-emerald-500"
                           style="background: var(--bg-page); border-color: var(--border-color); color: var(--text-primary);">
                    <span class="absolute left-2.5 top-2.5 text-xs text-[var(--text-muted)]">🔍</span>
                </div>
            </div>
        </section>

        <!-- 5. 10 CARDS EXECUTIVOS INTERATIVOS -->
        <section class="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3 sm:gap-3.5">
            <div class="card-transition p-3.5 rounded-2xl border flex flex-col justify-between"
                 style="background: var(--bg-card); border-color: var(--border-color);" title="Total de medições filtradas">
                <span class="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)]">Medições</span>
                <div class="text-2xl font-extrabold font-mono text-[var(--text-primary)] my-1" id="cardTotalMedicoes">0</div>
                <span class="text-[9px] text-[var(--text-muted)] font-mono">Registros</span>
            </div>

            <div class="card-transition p-3.5 rounded-2xl border flex flex-col justify-between"
                 style="background: var(--bg-card); border-color: var(--border-color);" title="Média aritmética das dosagens">
                <span class="text-[10px] uppercase font-bold tracking-wider text-emerald-500">Média</span>
                <div class="text-2xl font-extrabold font-mono text-emerald-500 my-1" id="cardDosagemMedia">0,000</div>
                <span class="text-[9px] text-emerald-500/80 font-mono" id="cardDosagemUnidade">Geral</span>
            </div>

            <div class="card-transition p-3.5 rounded-2xl border flex flex-col justify-between"
                 style="background: var(--bg-card); border-color: var(--border-color);" title="Mediana da dosagem (P50)">
                <span class="text-[10px] uppercase font-bold tracking-wider text-teal-500">Mediana</span>
                <div class="text-2xl font-extrabold font-mono text-teal-500 my-1" id="cardDosagemMediana">0,000</div>
                <span class="text-[9px] text-teal-500/80 font-mono">P50 Centro</span>
            </div>

            <div class="card-transition p-3.5 rounded-2xl border flex flex-col justify-between"
                 style="background: var(--bg-card); border-color: var(--border-color);" title="Valores extremos medidos">
                <span class="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)]">Mín • Máx</span>
                <div class="text-sm font-extrabold font-mono text-[var(--text-primary)] my-1">
                    <span id="cardDosagemMin">0</span> a <span id="cardDosagemMax">0</span>
                </div>
                <span class="text-[9px] text-[var(--text-muted)] font-mono">Extremos</span>
            </div>

            <div class="card-transition p-3.5 rounded-2xl border flex flex-col justify-between"
                 style="background: var(--bg-card); border-color: var(--border-color);" title="Dispersão e homogeneidade">
                <span class="text-[10px] uppercase font-bold tracking-wider text-indigo-400">Desvio • CV%</span>
                <div class="text-lg font-extrabold font-mono text-indigo-400 my-1" id="cardStdDev">±0,000</div>
                <span class="text-[9px] text-indigo-400/80 font-mono" id="cardCVPerc">CV: 0%</span>
            </div>

            <div class="card-transition p-3.5 rounded-2xl border flex flex-col justify-between border-emerald-500/40"
                 style="background: var(--bg-card); border-color: var(--border-color);" title="Medições dentro da meta técnica">
                <span class="text-[10px] uppercase font-bold tracking-wider text-emerald-500">Na Meta</span>
                <div class="text-2xl font-extrabold font-mono text-emerald-500 my-1" id="cardPercDentro">0%</div>
                <span class="text-[9px] text-emerald-500 font-mono" id="cardCountDentro">0 medições</span>
            </div>

            <div class="card-transition p-3.5 rounded-2xl border flex flex-col justify-between"
                 style="background: var(--bg-card); border-color: var(--border-color);" title="Medições abaixo da meta mínima">
                <span class="text-[10px] uppercase font-bold tracking-wider text-amber-500">Abaixo</span>
                <div class="text-2xl font-extrabold font-mono text-amber-500 my-1" id="cardPercAbaixo">0%</div>
                <span class="text-[9px] text-amber-500/80 font-mono" id="cardCountAbaixo">0 medições</span>
            </div>

            <div class="card-transition p-3.5 rounded-2xl border flex flex-col justify-between"
                 style="background: var(--bg-card); border-color: var(--border-color);" title="Medições acima da meta máxima">
                <span class="text-[10px] uppercase font-bold tracking-wider text-purple-400">Acima</span>
                <div class="text-2xl font-extrabold font-mono text-purple-400 my-1" id="cardPercAcima">0%</div>
                <span class="text-[9px] text-purple-400/80 font-mono" id="cardCountAcima">0 medições</span>
            </div>

            <div class="card-transition p-3.5 rounded-2xl border flex flex-col justify-between"
                 style="background: var(--bg-card); border-color: var(--border-color);" title="Total de OS">
                <span class="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)]">OS</span>
                <div class="text-2xl font-extrabold font-mono text-[var(--text-primary)] my-1" id="cardTotalOS">0</div>
                <span class="text-[9px] text-[var(--text-muted)] font-mono">Distintas</span>
            </div>

            <div class="card-transition p-3.5 rounded-2xl border flex flex-col justify-between"
                 style="background: var(--bg-card); border-color: var(--border-color);" title="Anomalias estatísticas detectadas via IQR">
                <span class="text-[10px] uppercase font-bold tracking-wider text-rose-500">Alertas IQR</span>
                <div class="text-2xl font-extrabold font-mono text-rose-500 my-1" id="cardAnomalias">0</div>
                <span class="text-[9px] text-rose-500/80 font-mono">Outliers</span>
            </div>
        </section>

        <!-- 6. BANNER DE DIRETRIZ TÉCNICA E PARÂMETROS CONFIGURÁVEIS -->
        <section class="p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs"
                 style="background: var(--bg-card); border-color: var(--border-color);">
            <div class="flex items-start gap-3">
                <span class="text-xl">🎯</span>
                <div>
                    <strong class="font-bold">Diretriz Técnica Agronômica • Calibração por Produto:</strong>
                    <p class="mt-0.5 leading-relaxed text-[var(--text-secondary)]" id="bannerTargetText">
                        Adubo: <strong class="text-emerald-500 font-mono">3,00 a 3,80 kg/m</strong> (Alvo: 3,40) • 
                        Torta: <strong class="text-amber-500 font-mono">5,20 a 6,00 t/ha</strong> (Alvo: 5,60).
                        Parâmetros agronômicos auditáveis e editáveis em tempo real.
                    </p>
                </div>
            </div>
            <button id="btnOpenTargetModal" class="px-3.5 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold whitespace-nowrap text-xs hover:bg-emerald-500 hover:text-white transition-all shadow-sm">
                ⚙️ Ajustar Faixas Técnicas
            </button>
        </section>

        <!-- 7. GRÁFICOS: EVOLUÇÃO E DONUT DE CONFORMIDADE -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <!-- Gráfico de Linha: Série Temporal com Metas -->
            <div class="lg:col-span-2 p-5 rounded-2xl border shadow-sm transition-colors flex flex-col justify-between"
                 style="background: var(--bg-card); border-color: var(--border-color);"
                 id="chartEvolutionCard">
                <div>
                    <div class="flex items-center justify-between gap-4 mb-4 pb-3 border-b"
                         style="border-color: var(--border-color);">
                        <div>
                            <h2 class="text-sm font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                                <span>📈</span>
                                <span>Evolução Temporal da Dosagem Média</span>
                            </h2>
                            <p class="text-[11px] text-[var(--text-secondary)] mt-0.5" id="evolutionSubtitle">
                                Médias diárias registradas ao longo da safra
                            </p>
                        </div>
                        <div class="flex items-center gap-2 text-xs font-mono">
                            <span class="flex items-center gap-1.5 text-amber-500"><span class="w-3 h-0.5 bg-amber-500"></span> Min</span>
                            <span class="flex items-center gap-1.5 text-purple-500"><span class="w-3 h-0.5 bg-purple-500"></span> Max</span>
                            <span class="flex items-center gap-1.5 text-emerald-500"><span class="w-3 h-0.5 bg-emerald-500"></span> Média Real</span>
                        </div>
                    </div>
                    <div class="h-64 w-full relative">
                        <canvas id="chartEvolution"></canvas>
                    </div>
                </div>
                <div class="mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono" style="border-color: var(--border-color);">
                    <span>Safra 2026 • Usina Pitangueiras</span>
                    <span id="evolutionDaysCount">0 dias avaliados</span>
                </div>
            </div>

            <!-- Gráfico de Rosca: Distribuição de Conformidade (SEMPRE NA META NO CENTRO) -->
            <div class="p-5 rounded-2xl border shadow-sm transition-colors flex flex-col justify-between"
                 style="background: var(--bg-card); border-color: var(--border-color);">
                <div>
                    <div class="flex items-center justify-between gap-4 mb-3 pb-3 border-b"
                         style="border-color: var(--border-color);">
                        <div>
                            <h2 class="text-sm font-bold tracking-tight text-[var(--text-primary)]">Distribuição de Conformidade</h2>
                            <p class="text-[11px] text-[var(--text-secondary)] mt-0.5">Faixa técnica agronômica</p>
                        </div>
                        <span class="text-xs text-[var(--text-muted)] font-mono font-semibold" id="donutScopeBadge">% da safra</span>
                    </div>

                    <!-- Rosca com Percentual e Contagem Central (SEMPRE NA META) -->
                    <div class="relative aspect-square w-full max-w-[210px] mx-auto py-2">
                        <canvas id="chartDonut"></canvas>
                        <div id="donutCenterOverlay" class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                            <span class="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-500 leading-none" id="donutCenterPerc">0%</span>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-1">Na Meta</span>
                            <span class="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold" id="donutCenterCount">0 de 0</span>
                        </div>
                    </div>
                </div>

                <!-- Detalhamento Numérico Explícito e Barras de Progresso -->
                <div class="mt-3 pt-3 border-t space-y-2.5 text-xs" style="border-color: var(--border-color);">
                    <div>
                        <div class="flex items-center justify-between text-[11px] mb-1">
                            <span class="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Dentro da Meta (<span id="labelRangeDentro">Faixa Técnica</span>)
                            </span>
                            <span class="font-mono font-bold" id="donutValDentro">0 (0%)</span>
                        </div>
                        <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700/80 overflow-hidden">
                            <div id="donutBarDentro" class="h-full bg-emerald-500 rounded-full transition-all duration-500" style="width: 0%;"></div>
                        </div>
                    </div>

                    <div>
                        <div class="flex items-center justify-between text-[11px] mb-1">
                            <span class="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                                <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Abaixo da Meta
                            </span>
                            <span class="font-mono font-bold" id="donutValAbaixo">0 (0%)</span>
                        </div>
                        <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700/80 overflow-hidden">
                            <div id="donutBarAbaixo" class="h-full bg-amber-500 rounded-full transition-all duration-500" style="width: 0%;"></div>
                        </div>
                    </div>

                    <div>
                        <div class="flex items-center justify-between text-[11px] mb-1">
                            <span class="flex items-center gap-1.5 font-semibold text-purple-600 dark:text-purple-400">
                                <span class="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Acima da Meta
                            </span>
                            <span class="font-mono font-bold" id="donutValAcima">0 (0%)</span>
                        </div>
                        <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700/80 overflow-hidden">
                            <div id="donutBarAcima" class="h-full bg-purple-500 rounded-full transition-all duration-500" style="width: 0%;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 8. HISTOGRAMA DE FREQUÊNCIA E RANKING DE FRENTES -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="p-5 rounded-2xl border shadow-sm transition-colors"
                 style="background: var(--bg-card); border-color: var(--border-color);"
                 id="chartHistogramCard">
                <div class="flex items-center justify-between gap-4 mb-4 pb-3 border-b"
                     style="border-color: var(--border-color);">
                    <div>
                        <h2 class="text-sm font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                            <span>📊</span>
                            <span>Histograma de Dosagem</span>
                        </h2>
                        <p class="text-[11px] text-[var(--text-secondary)] mt-0.5">Frequência das medições por classes de dosagem</p>
                    </div>
                    <span class="text-xs font-mono text-[var(--text-muted)]" id="histSubtitle">Classes</span>
                </div>
                <div class="h-64 w-full">
                    <canvas id="chartHistogram"></canvas>
                </div>
            </div>

            <div class="p-5 rounded-2xl border shadow-sm transition-colors"
                 style="background: var(--bg-card); border-color: var(--border-color);">
                <div class="flex items-center justify-between gap-4 mb-4 pb-3 border-b"
                     style="border-color: var(--border-color);">
                    <div>
                        <h2 class="text-sm font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                            <span>🚜</span>
                            <span>Média de Dosagem por Frente</span>
                        </h2>
                        <p class="text-[11px] text-[var(--text-secondary)] mt-0.5">Comparativo operacional entre as frentes ativas</p>
                    </div>
                    <span class="text-xs font-mono text-[var(--text-muted)]">Ranking</span>
                </div>
                <div class="h-64 w-full">
                    <canvas id="chartFrentes"></canvas>
                </div>
            </div>
        </div>

        <!-- 9. PAINEL DE DETECÇÃO DE ANOMALIAS E OUTLIERS (IQR) -->
        <section class="p-5 rounded-2xl border shadow-sm transition-colors"
                 style="background: var(--bg-card); border-color: var(--border-color);">
            <div class="flex items-center justify-between gap-4 mb-4 pb-3 border-b" style="border-color: var(--border-color);">
                <div class="flex items-center gap-2.5">
                    <span class="p-2 rounded-xl bg-rose-500/15 text-rose-500 text-lg">⚠️</span>
                    <div>
                        <h2 class="text-sm font-bold tracking-tight text-[var(--text-primary)]">
                            Auditoria Estatística de Anomalias & Inconsistências
                        </h2>
                        <p class="text-[11px] text-[var(--text-secondary)] mt-0.5">
                            Identificação de desvios (1.5x IQR), durações atípicas e dados ausentes calculados rigorosamente
                        </p>
                    </div>
                </div>
                <span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-500 border border-rose-500/30" id="badgeAnomaliesCount">
                    0 anomalias encontradas
                </span>
            </div>

            <div class="overflow-x-auto rounded-xl border max-h-60" style="border-color: var(--border-color);">
                <table class="w-full text-left text-xs border-collapse">
                    <thead style="background: var(--bg-page); color: var(--text-secondary);" class="sticky top-0">
                        <tr class="border-b" style="border-color: var(--border-color);">
                            <th class="p-2.5 font-semibold">ID</th>
                            <th class="p-2.5 font-semibold">Data / Hora</th>
                            <th class="p-2.5 font-semibold">Produto</th>
                            <th class="p-2.5 font-semibold text-right">Dosagem</th>
                            <th class="p-2.5 font-semibold">Frente</th>
                            <th class="p-2.5 font-semibold">OS</th>
                            <th class="p-2.5 font-semibold">Motivo do Alerta</th>
                            <th class="p-2.5 font-semibold">Regra de Detecção</th>
                            <th class="p-2.5 font-semibold text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody id="tableAnomaliesBody" class="divide-y" style="border-color: var(--border-color);">
                        <!-- Preenchido via JS -->
                    </tbody>
                </table>
            </div>
        </section>

        <!-- 10. MAPA GEOGRÁFICO DE PONTOS -->
        <section class="p-5 rounded-2xl border shadow-sm transition-colors"
                 style="background: var(--bg-card); border-color: var(--border-color);">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-3 border-b"
                 style="border-color: var(--border-color);">
                <div>
                    <h2 class="text-sm font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                        <span>🗺️</span>
                        <span>Geolocalização das Aplicações no Campo</span>
                    </h2>
                    <p class="text-[11px] text-[var(--text-secondary)] mt-0.5">Pontos georreferenciados com marcadores por produto e status de conformidade</p>
                </div>
                <div class="flex items-center gap-3 text-xs font-mono flex-wrap">
                    <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-emerald-500"></span> Adubo</span>
                    <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-amber-500"></span> Torta</span>
                    <span class="px-2 py-0.5 rounded bg-[var(--bg-page)] border text-[11px]" id="mapPointsCount">0 pontos plotados</span>
                </div>
            </div>
            <div id="mapDosagem" class="w-full h-96 rounded-xl border z-10" style="border-color: var(--border-color);"></div>
        </section>

        <!-- 11. ANÁLISE OPERACIONAL POR OS -->
        <section class="p-5 rounded-2xl border shadow-sm transition-colors"
                 style="background: var(--bg-card); border-color: var(--border-color);">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-3 border-b"
                 style="border-color: var(--border-color);">
                <div>
                    <h2 class="text-sm font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                        <span>📋</span>
                        <span>Painel Analítico por Ordem de Serviço (OS)</span>
                    </h2>
                    <p class="text-[11px] text-[var(--text-secondary)] mt-0.5">Variabilidade, média, desvio-padrão e produtos aplicados por OS</p>
                </div>
                <div class="flex items-center gap-2 text-xs">
                    <span class="text-[var(--text-secondary)]">Ordenar por:</span>
                    <select id="selectSortOS" class="p-1.5 rounded-lg border text-xs focus:outline-none focus:border-emerald-500"
                            style="background: var(--bg-page); border-color: var(--border-color); color: var(--text-primary);">
                        <option value="volume">Maior Volume de Medições</option>
                        <option value="cv">Maior Variabilidade (CV%)</option>
                        <option value="media_asc">Menor Média</option>
                        <option value="media_desc">Maior Média</option>
                        <option value="conformidade">Menor Conformidade (%)</option>
                    </select>
                </div>
            </div>

            <div class="overflow-x-auto rounded-xl border" style="border-color: var(--border-color);">
                <table class="w-full text-left text-xs border-collapse">
                    <thead style="background: var(--bg-page); color: var(--text-secondary);">
                        <tr class="border-b" style="border-color: var(--border-color);">
                            <th class="p-3 font-semibold">OS</th>
                            <th class="p-3 font-semibold">Frentes</th>
                            <th class="p-3 font-semibold">Produtos</th>
                            <th class="p-3 font-semibold text-center">Medições</th>
                            <th class="p-3 font-semibold text-right">Média</th>
                            <th class="p-3 font-semibold text-right">Mín / Máx</th>
                            <th class="p-3 font-semibold text-right">Amplitude</th>
                            <th class="p-3 font-semibold text-right">Desvio</th>
                            <th class="p-3 font-semibold text-right">CV %</th>
                            <th class="p-3 font-semibold text-center">Conformidade</th>
                            <th class="p-3 font-semibold text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody id="tableOSBody" class="divide-y" style="border-color: var(--border-color);">
                        <!-- Preenchido via JS -->
                    </tbody>
                </table>
            </div>
        </section>

        <!-- 12. TABELA GERAL DE MEDIÇÕES DETALHADAS -->
        <section class="p-5 rounded-2xl border shadow-sm transition-colors"
                 style="background: var(--bg-card); border-color: var(--border-color);">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-3 border-b"
                 style="border-color: var(--border-color);">
                <div>
                    <h2 class="text-sm font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                        <span>📑</span>
                        <span>Registros Individuais de Dosagem</span>
                    </h2>
                    <p class="text-[11px] text-[var(--text-secondary)] mt-0.5">Rastreabilidade ponto a ponto com auditoria de duração e ficha de campo</p>
                </div>
                <div class="flex items-center gap-2 text-xs">
                    <span class="text-[var(--text-secondary)]">Exibir:</span>
                    <select id="pageSizeSelect" class="p-1.5 rounded-lg border text-xs focus:outline-none focus:border-emerald-500"
                            style="background: var(--bg-page); border-color: var(--border-color); color: var(--text-primary);">
                        <option value="15">15 registros</option>
                        <option value="30">30 registros</option>
                        <option value="50">50 registros</option>
                        <option value="100">100 registros</option>
                    </select>
                </div>
            </div>

            <div class="overflow-x-auto rounded-xl border" style="border-color: var(--border-color);">
                <table class="w-full text-left text-xs border-collapse">
                    <thead style="background: var(--bg-page); color: var(--text-secondary);">
                        <tr class="border-b" style="border-color: var(--border-color);">
                            <th class="p-3 font-semibold">ID</th>
                            <th class="p-3 font-semibold">Data / Hora</th>
                            <th class="p-3 font-semibold">Produto</th>
                            <th class="p-3 font-semibold">Frente</th>
                            <th class="p-3 font-semibold">OS</th>
                            <th class="p-3 font-semibold">Talhão</th>
                            <th class="p-3 font-semibold">Responsável</th>
                            <th class="p-3 font-semibold text-right">Dosagem</th>
                            <th class="p-3 font-semibold text-center">Status</th>
                            <th class="p-3 font-semibold text-center">Duração</th>
                            <th class="p-3 font-semibold text-center">GPS</th>
                            <th class="p-3 font-semibold text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody id="tableRecordsBody" class="divide-y" style="border-color: var(--border-color);">
                        <!-- Preenchido via JS -->
                    </tbody>
                </table>
            </div>

            <!-- Paginação -->
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-3 border-t text-xs"
                 style="border-color: var(--border-color);">
                <div class="text-[var(--text-secondary)] font-mono" id="paginationInfo">
                    Mostrando 0 de 0 registros
                </div>
                <div class="flex items-center gap-1.5" id="paginationControls">
                    <!-- Gerado dinamicamente via JS -->
                </div>
            </div>
        </section>

    </main>

    <!-- 13. MODAL DE AJUSTE DE FAIXAS TÉCNICAS (POR PRODUTO) -->
    <div id="targetModal" class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm hidden flex items-center justify-center p-4">
        <div class="w-full max-w-lg rounded-2xl border shadow-2xl p-6 transition-all"
             style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-primary);">
            
            <div class="flex items-center justify-between pb-3 mb-4 border-b" style="border-color: var(--border-color);">
                <div class="flex items-center gap-2">
                    <span class="text-xl">⚙️</span>
                    <div>
                        <h3 class="font-bold text-sm">Calibrar Parâmetros Técnicos de Dosagem</h3>
                        <p class="text-[11px] text-[var(--text-secondary)]">Defina os limites agronômicos aceitáveis para cada insumo</p>
                    </div>
                </div>
                <button id="btnCloseTargetModal" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50">✕</button>
            </div>

            <div class="space-y-4 text-xs">
                <!-- Seção Adubo -->
                <div class="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                    <strong class="text-emerald-500 font-bold block text-sm">🌿 Parâmetros para Adubo</strong>
                    <div class="grid grid-cols-3 gap-2">
                        <div>
                            <label class="block font-medium mb-1 text-[var(--text-secondary)]">Mínimo:</label>
                            <input type="number" id="targetAduboMin" step="0.05" class="w-full p-2 rounded-lg border font-mono text-xs focus:border-emerald-500" style="background: var(--bg-page); border-color: var(--border-color); color: var(--text-primary);">
                        </div>
                        <div>
                            <label class="block font-medium mb-1 text-[var(--text-secondary)]">Alvo:</label>
                            <input type="number" id="targetAduboAlvo" step="0.05" class="w-full p-2 rounded-lg border font-mono text-xs focus:border-emerald-500" style="background: var(--bg-page); border-color: var(--border-color); color: var(--text-primary);">
                        </div>
                        <div>
                            <label class="block font-medium mb-1 text-[var(--text-secondary)]">Máximo:</label>
                            <input type="number" id="targetAduboMax" step="0.05" class="w-full p-2 rounded-lg border font-mono text-xs focus:border-emerald-500" style="background: var(--bg-page); border-color: var(--border-color); color: var(--text-primary);">
                        </div>
                    </div>
                </div>

                <!-- Seção Torta -->
                <div class="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                    <strong class="text-amber-500 font-bold block text-sm">🍂 Parâmetros para Torta de Filtro</strong>
                    <div class="grid grid-cols-3 gap-2">
                        <div>
                            <label class="block font-medium mb-1 text-[var(--text-secondary)]">Mínimo:</label>
                            <input type="number" id="targetTortaMin" step="0.05" class="w-full p-2 rounded-lg border font-mono text-xs focus:border-amber-500" style="background: var(--bg-page); border-color: var(--border-color); color: var(--text-primary);">
                        </div>
                        <div>
                            <label class="block font-medium mb-1 text-[var(--text-secondary)]">Alvo:</label>
                            <input type="number" id="targetTortaAlvo" step="0.05" class="w-full p-2 rounded-lg border font-mono text-xs focus:border-amber-500" style="background: var(--bg-page); border-color: var(--border-color); color: var(--text-primary);">
                        </div>
                        <div>
                            <label class="block font-medium mb-1 text-[var(--text-secondary)]">Máximo:</label>
                            <input type="number" id="targetTortaMax" step="0.05" class="w-full p-2 rounded-lg border font-mono text-xs focus:border-amber-500" style="background: var(--bg-page); border-color: var(--border-color); color: var(--text-primary);">
                        </div>
                    </div>
                </div>

                <div class="pt-2 flex items-center justify-end gap-2 border-t" style="border-color: var(--border-color);">
                    <button id="btnResetDefaultTargets" class="px-3 py-2 rounded-xl border text-slate-400 hover:text-white transition-colors">
                        Restaurar Padrão
                    </button>
                    <button id="btnSaveTargets" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md">
                        Salvar e Recalcular
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- 14. MODAL RAIO-X INDIVIDUAL DA MEDIÇÃO -->
    <div id="recordModal" class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm hidden flex items-center justify-center p-4">
        <div class="w-full max-w-2xl rounded-2xl border shadow-2xl p-6 transition-all max-h-[90vh] overflow-y-auto"
             style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-primary);">
            
            <div class="flex items-center justify-between pb-3 mb-4 border-b" style="border-color: var(--border-color);">
                <div class="flex items-center gap-2.5">
                    <span class="p-2 rounded-xl bg-emerald-500/15 text-emerald-500 text-lg">🔍</span>
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="font-bold text-sm">Raio-X da Medição #<span id="modalRecordId">-</span></h3>
                            <span id="modalRecordBadge" class="text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold">STATUS</span>
                        </div>
                        <p class="text-[11px] text-[var(--text-secondary)] mt-0.5" id="modalRecordSubtitle">-</p>
                    </div>
                </div>
                <button id="btnCloseRecordModal" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50">✕</button>
            </div>

            <div id="modalRecordContent" class="space-y-4 text-xs">
                <!-- Preenchido via JS -->
            </div>

            <div class="mt-6 pt-3 border-t flex justify-end" style="border-color: var(--border-color);">
                <button id="btnCloseRecordModalFooter" class="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors">
                    Fechar
                </button>
            </div>
        </div>
    </div>

    <!-- SCRIPTS -->
    <script src="js/data.js"></script>
    <script src="js/dosagem_engine.js"></script>
    <script src="js/dashboard.js"></script>
</body>
</html>
'''
    with open(BASE_DIR / "index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("dosagem_sulco/index.html written")

generate_index_html()
def generate_dashboard_js():
    code = '''/**
 * dashboard.js
 * ============
 * Controlador Executivo da Interface para Dosagem de Produto na Sulcação
 * Usina Pitangueiras • Safra 2026
 */

(function () {
    'use strict';

    const state = {
        rawRecords: [],
        normalizedRecords: [],
        filteredRecords: [],
        targetConfig: null,
        selectedProduct: 'ALL', // 'ALL', 'Adubo', 'Torta'
        activePeriod: 'all',    // 'all', 'latest', 'today'
        latestDateStr: '',
        todayDateStr: '',
        filters: {
            frente: 'ALL',
            os: 'ALL',
            responsavel: 'ALL',
            statusTecnico: 'ALL',
            gps: 'ALL',
            search: ''
        },
        pagination: {
            currentPage: 1,
            pageSize: 15,
            totalPages: 1
        },
        sortOS: 'volume',
        charts: {
            donut: null,
            evolution: null,
            histogram: null,
            frentes: null
        },
        map: null,
        markersLayer: null
    };

    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        initData();
        initFilters();
        initPeriodSelector();
        initTargetModal();
        initCharts();
        initMap();
        initTableListeners();
        applyFiltersAndRender();
        initPowerUserShortcuts();
    });

    // 1. Gerenciamento de Tema
    function initTheme() {
        const saved = localStorage.getItem('pitangueiras_theme') || 'dark';
        if (saved === 'light') {
            document.documentElement.classList.remove('dark');
            document.getElementById('themeIcon').innerText = '☀️';
        } else {
            document.documentElement.classList.add('dark');
            document.getElementById('themeIcon').innerText = '🌙';
        }

        document.getElementById('themeToggle').addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('pitangueiras_theme', isDark ? 'dark' : 'light');
            document.getElementById('themeIcon').innerText = isDark ? '🌙' : '☀️';
            if (state.charts.evolution) {
                state.charts.evolution.destroy();
                state.charts.donut.destroy();
                state.charts.histogram.destroy();
                state.charts.frentes.destroy();
                initCharts();
                updateChartsAndVisuals();
            }
        });
    }

    // 2. Inicialização dos Dados
    function initData() {
        const raw = window.DOSAGEM_RAW_DATA || [];
        state.rawRecords = raw;
        state.targetConfig = window.DosagemEngine.getTargetConfig();
        state.normalizedRecords = raw.map(r => window.DosagemEngine.normalizeRecord(r));

        // Maior data
        const validDates = state.normalizedRecords
            .filter(r => r.dataParsed)
            .map(r => ({ date: r.dataParsed, str: r.dataBR }))
            .sort((a, b) => b.date.getTime() - a.date.getTime());

        if (validDates.length > 0) {
            state.latestDateStr = validDates[0].str;
            const badgeLatest = document.getElementById('badgeLatest');
            if (badgeLatest) badgeLatest.innerText = state.latestDateStr;
        }

        const now = new Date();
        const todayStr = window.DosagemEngine.formatDateBR(now);
        state.todayDateStr = todayStr;

        const countToday = state.normalizedRecords.filter(r => r.dataBR === todayStr).length;
        const badgeToday = document.getElementById('badgeToday');
        if (badgeToday) badgeToday.innerText = countToday;

        const badgeAll = document.getElementById('badgeAll');
        if (badgeAll) badgeAll.innerText = state.normalizedRecords.length;

        // Contagens nos botões de produto
        const cAdubo = state.normalizedRecords.filter(r => (r.produto || '').includes('Adubo')).length;
        const cTorta = state.normalizedRecords.filter(r => (r.produto || '').includes('Torta')).length;
        setElText('prodBadgeAll', state.normalizedRecords.length.toLocaleString());
        setElText('prodBadgeAdubo', cAdubo.toLocaleString());
        setElText('prodBadgeTorta', cTorta.toLocaleString());

        updateTargetBanner();
    }

    function updateTargetBanner() {
        const textEl = document.getElementById('bannerTargetText');
        if (textEl && state.targetConfig) {
            const ad = state.targetConfig.adubo;
            const to = state.targetConfig.torta;
            textEl.innerHTML = `
                Adubo: <strong class="text-emerald-500 font-mono">${ad.min.toFixed(2)} a ${ad.max.toFixed(2)} ${ad.unidade}</strong> (Alvo: ${ad.alvo.toFixed(2)}) • 
                Torta: <strong class="text-amber-500 font-mono">${to.min.toFixed(2)} a ${to.max.toFixed(2)} ${to.unidade}</strong> (Alvo: ${to.alvo.toFixed(2)}).
                Parâmetros agronômicos auditáveis e editáveis em tempo real.
            `;
        }
    }

    // 3. Filtros
    function initFilters() {
        const frentes = new Set();
        const osList = new Set();
        const resps = new Set();

        state.normalizedRecords.forEach(r => {
            if (r.frente && r.frente !== 'Não Informado') frentes.add(r.frente);
            if (r.os && r.os !== 'Sem OS') osList.add(r.os);
            if (r.responsavel && r.responsavel !== 'Não Informado') resps.add(r.responsavel);
        });

        populateSelect('filterFrente', Array.from(frentes).sort());
        populateSelect('filterOS', Array.from(osList).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
        populateSelect('filterResponsavel', Array.from(resps).sort());

        ['filterFrente', 'filterOS', 'filterResponsavel', 'filterStatusTecnico', 'filterGPS'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    const key = id.replace('filter', '');
                    const stateKey = key.charAt(0).toLowerCase() + key.slice(1);
                    state.filters[stateKey] = el.value;
                    state.pagination.currentPage = 1;
                    applyFiltersAndRender();
                });
            }
        });

        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            let timeout = null;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    state.filters.search = e.target.value.trim().toLowerCase();
                    state.pagination.currentPage = 1;
                    applyFiltersAndRender();
                }, 250);
            });
        }

        const btnClear = document.getElementById('btnClearFilters');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                document.getElementById('filterFrente').value = 'ALL';
                document.getElementById('filterOS').value = 'ALL';
                document.getElementById('filterResponsavel').value = 'ALL';
                document.getElementById('filterStatusTecnico').value = 'ALL';
                document.getElementById('filterGPS').value = 'ALL';
                if (searchInput) searchInput.value = '';

                state.filters = {
                    frente: 'ALL',
                    os: 'ALL',
                    responsavel: 'ALL',
                    statusTecnico: 'ALL',
                    gps: 'ALL',
                    search: ''
                };
                setProductFilter('ALL');
            });
        }

        const btnExport = document.getElementById('btnExportCSV');
        if (btnExport) btnExport.addEventListener('click', exportFilteredCSV);
    }

    function populateSelect(selectId, options) {
        const sel = document.getElementById(selectId);
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = `<option value="ALL">${sel.options[0].text}</option>`;
        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt;
            el.textContent = opt;
            sel.appendChild(el);
        });
        sel.value = currentVal;
    }

    // 4. Seletor de Período Temporal
    function initPeriodSelector() {
        const btnAll = document.getElementById('btnAllDates');
        const btnLatest = document.getElementById('btnLatestDate');
        const btnToday = document.getElementById('btnToday');

        function setPeriod(period) {
            state.activePeriod = period;
            [btnAll, btnLatest, btnToday].forEach(b => b && b.classList.remove('active'));
            if (period === 'all' && btnAll) btnAll.classList.add('active');
            if (period === 'latest' && btnLatest) btnLatest.classList.add('active');
            if (period === 'today' && btnToday) btnToday.classList.add('active');
            state.pagination.currentPage = 1;
            applyFiltersAndRender();
        }

        if (btnAll) btnAll.addEventListener('click', () => setPeriod('all'));
        if (btnLatest) btnLatest.addEventListener('click', () => setPeriod('latest'));
        if (btnToday) btnToday.addEventListener('click', () => setPeriod('today'));
    }

    // 5. Seletor de Produto (Global)
    window.setProductFilter = function (prod) {
        state.selectedProduct = prod;

        const btnAll = document.getElementById('btnProdAll');
        const btnAdubo = document.getElementById('btnProdAdubo');
        const btnTorta = document.getElementById('btnProdTorta');

        [btnAll, btnAdubo, btnTorta].forEach(b => {
            if (b) {
                b.className = 'px-4 py-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-emerald-500 flex items-center gap-1.5';
            }
        });

        if (prod === 'ALL' && btnAll) {
            btnAll.className = 'px-4 py-1.5 rounded-lg transition-all text-white bg-emerald-600 shadow-sm flex items-center gap-1.5';
        } else if (prod === 'Adubo' && btnAdubo) {
            btnAdubo.className = 'px-4 py-1.5 rounded-lg transition-all text-white bg-emerald-600 shadow-sm flex items-center gap-1.5';
        } else if (prod === 'Torta' && btnTorta) {
            btnTorta.className = 'px-4 py-1.5 rounded-lg transition-all text-white bg-amber-600 shadow-sm flex items-center gap-1.5';
        }

        state.pagination.currentPage = 1;
        applyFiltersAndRender();
    };

    // 6. Aplicação de Filtros
    function applyFiltersAndRender() {
        let list = [...state.normalizedRecords];

        // Filtro Temporal
        if (state.activePeriod === 'latest' && state.latestDateStr) {
            list = list.filter(r => r.dataBR === state.latestDateStr);
        } else if (state.activePeriod === 'today') {
            list = list.filter(r => r.dataBR === state.todayDateStr);
        }

        // Filtro de Produto
        if (state.selectedProduct !== 'ALL') {
            list = list.filter(r => (r.produto || '').includes(state.selectedProduct));
        }

        // Filtros Categóricos
        if (state.filters.frente !== 'ALL') {
            list = list.filter(r => r.frente === state.filters.frente);
        }
        if (state.filters.os !== 'ALL') {
            list = list.filter(r => r.os === state.filters.os);
        }
        if (state.filters.responsavel !== 'ALL') {
            list = list.filter(r => r.responsavel === state.filters.responsavel);
        }
        if (state.filters.statusTecnico !== 'ALL') {
            list = list.filter(r => {
                const cls = window.DosagemEngine.classifyRecord(r, state.targetConfig);
                return cls.status === state.filters.statusTecnico;
            });
        }
        if (state.filters.gps === 'GPS_VALIDO') {
            list = list.filter(r => r.hasValidCoords);
        } else if (state.filters.gps === 'GPS_INVALIDO') {
            list = list.filter(r => !r.hasValidCoords);
        }
        if (state.filters.search) {
            const term = state.filters.search;
            list = list.filter(r => {
                return r.id.toLowerCase().includes(term) ||
                       r.frente.toLowerCase().includes(term) ||
                       r.os.toLowerCase().includes(term) ||
                       r.responsavel.toLowerCase().includes(term) ||
                       r.produto.toLowerCase().includes(term) ||
                       r.local.toLowerCase().includes(term);
            });
        }

        state.filteredRecords = list;

        setElText('lblFilteredCount', list.length.toLocaleString());
        setElText('lblTotalCount', state.normalizedRecords.length.toLocaleString());

        renderKPICards();
        renderProductComparison();
        updateChartsAndVisuals();
        renderAnomaliesPanel();
        updateMap();
        renderOSTable();
        renderRecordsTable();
    }

    // 7. Cards Executivos (KPIs)
    function renderKPICards() {
        const m = window.DosagemEngine.calculateMetrics(state.filteredRecords, state.targetConfig, state.selectedProduct);
        const anomalies = window.DosagemEngine.detectAnomalies(state.filteredRecords);

        setElText('cardTotalMedicoes', m.totalMedicoes.toLocaleString('pt-BR'));
        setElText('cardDosagemMedia', m.media.toLocaleString('pt-BR', { minimumFractionDigits: 3 }));
        setElText('cardDosagemMediana', m.mediana.toLocaleString('pt-BR', { minimumFractionDigits: 3 }));
        setElText('cardDosagemMin', m.min.toLocaleString('pt-BR', { minimumFractionDigits: 3 }));
        setElText('cardDosagemMax', m.max.toLocaleString('pt-BR', { minimumFractionDigits: 3 }));
        setElText('cardStdDev', `±${m.desvioPadrao.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}`);
        setElText('cardCVPerc', `CV: ${m.cvPerc.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`);

        setElText('cardPercDentro', `${m.percDentro.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`);
        setElText('cardCountDentro', `${m.dentroFaixa} medições`);

        setElText('cardPercAbaixo', `${m.percAbaixo.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`);
        setElText('cardCountAbaixo', `${m.abaixoFaixa} medições`);

        setElText('cardPercAcima', `${m.percAcima.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`);
        setElText('cardCountAcima', `${m.acimaFaixa} medições`);

        setElText('cardTotalOS', m.osCount);
        setElText('cardAnomalias', anomalies.length);

        const unidadeEl = document.getElementById('cardDosagemUnidade');
        if (unidadeEl) {
            if (state.selectedProduct === 'Adubo') unidadeEl.innerText = state.targetConfig.adubo.unidade;
            else if (state.selectedProduct === 'Torta') unidadeEl.innerText = state.targetConfig.torta.unidade;
            else unidadeEl.innerText = 'Média Geral';
        }
    }

    // 8. Comparativo Adubo vs Torta
    function renderProductComparison() {
        const comp = window.DosagemEngine.compareProducts(state.filteredRecords, state.targetConfig);

        const ad = comp.Adubo;
        const to = comp.Torta;

        setElText('compAduboCount', `${ad.totalMedicoes} medições`);
        setElText('compAduboMedia', `${ad.media.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${ad.unidade}`);
        setElText('compAduboMediana', `${ad.mediana.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${ad.unidade}`);
        setElText('compAduboFaixa', `${ad.targetMin} a ${ad.targetMax} ${ad.unidade}`);
        setElText('compAduboCV', `CV: ${ad.cvPerc}% (±${ad.desvioPadrao})`);

        setElText('compTortaCount', `${to.totalMedicoes} medições`);
        setElText('compTortaMedia', `${to.media.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${to.unidade}`);
        setElText('compTortaMediana', `${to.mediana.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${to.unidade}`);
        setElText('compTortaFaixa', `${to.targetMin} a ${to.targetMax} ${to.unidade}`);
        setElText('compTortaCV', `CV: ${to.cvPerc}% (±${to.desvioPadrao})`);
    }

    // 9. Gráficos Chart.js
    function initCharts() {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? '#2e3238' : '#e2e8f0';

        // 1. Donut: Conformidade Técnica (SEMPRE NA META NO CENTRO)
        const ctxDonut = document.getElementById('chartDonut');
        if (ctxDonut) {
            state.charts.donut = new Chart(ctxDonut, {
                type: 'doughnut',
                data: {
                    labels: ['Dentro da Meta', 'Abaixo da Meta', 'Acima da Meta'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#10b981', '#f59e0b', '#a855f7'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function (ctx) {
                                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                    const val = ctx.raw || 0;
                                    const perc = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                                    return ` ${ctx.label}: ${val} medições (${perc}%)`;
                                }
                            }
                        }
                    },
                    cutout: '72%'
                }
            });
        }

        // 2. Evolução Temporal
        const ctxEvolution = document.getElementById('chartEvolution');
        if (ctxEvolution) {
            state.charts.evolution = new Chart(ctxEvolution, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Média Real',
                            data: [],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.3,
                            borderWidth: 2.5,
                            pointRadius: 4,
                            pointBackgroundColor: '#10b981'
                        },
                        {
                            label: 'Meta Mínima',
                            data: [],
                            borderColor: '#f59e0b',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            pointRadius: 0,
                            fill: false
                        },
                        {
                            label: 'Meta Máxima',
                            data: [],
                            borderColor: '#a855f7',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            pointRadius: 0,
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 10 } }, grid: { display: false } },
                        y: { ticks: { color: textColor, font: { family: 'JetBrains Mono' } }, grid: { color: gridColor } }
                    }
                }
            });
        }

        // 3. Histograma
        const ctxHistogram = document.getElementById('chartHistogram');
        if (ctxHistogram) {
            state.charts.histogram = new Chart(ctxHistogram, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Medições',
                        data: [],
                        backgroundColor: '#0284c7',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 10 } }, grid: { display: false } },
                        y: { ticks: { color: textColor, font: { family: 'JetBrains Mono' } }, grid: { color: gridColor } }
                    }
                }
            });
        }

        // 4. Frentes
        const ctxFrentes = document.getElementById('chartFrentes');
        if (ctxFrentes) {
            state.charts.frentes = new Chart(ctxFrentes, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Dosagem Média',
                        data: [],
                        backgroundColor: '#10b981',
                        borderRadius: 6
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textColor, font: { family: 'JetBrains Mono' } }, grid: { color: gridColor } },
                        y: { ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 10 } }, grid: { display: false } }
                    }
                }
            });
        }
    }

    function updateChartsAndVisuals() {
        const m = window.DosagemEngine.calculateMetrics(state.filteredRecords, state.targetConfig, state.selectedProduct);
        const timeSeries = window.DosagemEngine.calculateTimeSeries(state.filteredRecords, state.selectedProduct);
        const histogram = window.DosagemEngine.calculateHistogram(state.filteredRecords, state.selectedProduct);
        const frentes = window.DosagemEngine.calculateFrenteBreakdown(state.filteredRecords, state.selectedProduct);

        // 1. Donut: Centro SEMPRE exibe o que está na meta
        if (state.charts.donut) {
            state.charts.donut.data.datasets[0].data = [m.dentroFaixa, m.abaixoFaixa, m.acimaFaixa];
            state.charts.donut.update();
        }

        setElText('donutCenterPerc', `${m.percDentro.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`);
        setElText('donutCenterCount', `${m.dentroFaixa} de ${m.totalMedicoes}`);

        // Rótulos de faixa do donut
        const targetDesc = state.selectedProduct === 'Adubo' ? state.targetConfig.adubo :
                           state.selectedProduct === 'Torta' ? state.targetConfig.torta : null;

        const lblDentro = document.getElementById('labelRangeDentro');
        if (lblDentro) {
            if (targetDesc) lblDentro.innerText = `${targetDesc.min.toFixed(2)} a ${targetDesc.max.toFixed(2)} ${targetDesc.unidade}`;
            else lblDentro.innerText = 'Meta por Insumo';
        }

        setElText('donutValDentro', `${m.dentroFaixa} (${m.percDentro}%)`);
        const barDentro = document.getElementById('donutBarDentro');
        if (barDentro) barDentro.style.width = `${m.percDentro}%`;

        setElText('donutValAbaixo', `${m.abaixoFaixa} (${m.percAbaixo}%)`);
        const barAbaixo = document.getElementById('donutBarAbaixo');
        if (barAbaixo) barAbaixo.style.width = `${m.percAbaixo}%`;

        setElText('donutValAcima', `${m.acimaFaixa} (${m.percAcima}%)`);
        const barAcima = document.getElementById('donutBarAcima');
        if (barAcima) barAcima.style.width = `${m.percAcima}%`;

        // 2. Linha Temporal
        if (state.charts.evolution) {
            state.charts.evolution.data.labels = timeSeries.labels;
            state.charts.evolution.data.datasets[0].data = timeSeries.medias;

            if (targetDesc) {
                state.charts.evolution.data.datasets[1].data = new Array(timeSeries.labels.length).fill(targetDesc.min);
                state.charts.evolution.data.datasets[2].data = new Array(timeSeries.labels.length).fill(targetDesc.max);
                state.charts.evolution.data.datasets[1].label = `Meta Mínima (${targetDesc.min} ${targetDesc.unidade})`;
                state.charts.evolution.data.datasets[2].label = `Meta Máxima (${targetDesc.max} ${targetDesc.unidade})`;
            } else {
                state.charts.evolution.data.datasets[1].data = [];
                state.charts.evolution.data.datasets[2].data = [];
            }
            state.charts.evolution.update();
        }
        setElText('evolutionDaysCount', `${timeSeries.labels.length} dias avaliados`);

        // 3. Histograma
        if (state.charts.histogram) {
            state.charts.histogram.data.labels = histogram.labels;
            state.charts.histogram.data.datasets[0].data = histogram.counts;
            state.charts.histogram.update();
        }

        // 4. Frentes
        if (state.charts.frentes) {
            state.charts.frentes.data.labels = frentes.map(f => f.frente);
            state.charts.frentes.data.datasets[0].data = frentes.map(f => f.media);
            state.charts.frentes.update();
        }
    }

    // 10. Painel de Anomalias Estatísticas (IQR)
    function renderAnomaliesPanel() {
        const tbody = document.getElementById('tableAnomaliesBody');
        if (!tbody) return;

        const anomalies = window.DosagemEngine.detectAnomalies(state.filteredRecords);
        setElText('badgeAnomaliesCount', `${anomalies.length} desvios detectados`);

        if (anomalies.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-emerald-500 font-semibold">✓ Nenhuma anomalia estatística detectada no conjunto filtrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = anomalies.slice(0, 50).map(a => {
            const r = a.record;
            return `
                <tr class="hover:bg-slate-500/5 transition-colors">
                    <td class="p-2.5 font-mono font-bold text-emerald-500">#${r.id}</td>
                    <td class="p-2.5 font-mono text-[11px]">${r.dataStr}</td>
                    <td class="p-2.5 font-semibold text-[11px]">${r.produto}</td>
                    <td class="p-2.5 text-right font-mono font-bold text-rose-500">${r.dosagem !== null ? r.dosagem.toFixed(3) : '-'}</td>
                    <td class="p-2.5 text-[11px] text-[var(--text-secondary)]">${r.frente}</td>
                    <td class="p-2.5 font-mono text-emerald-500">${r.os}</td>
                    <td class="p-2.5 text-rose-400 font-medium text-[11px]">${a.motivo}</td>
                    <td class="p-2.5 text-[10px] text-[var(--text-muted)] font-mono">${a.regra}</td>
                    <td class="p-2.5 text-center">
                        <button class="btn-inspect-anomaly px-2 py-0.5 rounded bg-[var(--bg-page)] hover:bg-emerald-500 hover:text-white border text-[10px] font-semibold transition-colors" data-id="${r.id}">
                            Raio-X
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-inspect-anomaly').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const rec = state.normalizedRecords.find(item => item.id === id);
                if (rec) openRecordModal(rec);
            });
        });
    }

    // 11. Mapa Leaflet
    function initMap() {
        const mapContainer = document.getElementById('mapDosagem');
        if (!mapContainer) return;

        state.map = L.map('mapDosagem', {
            center: [-20.85, -48.55],
            zoom: 11
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap | Usina Pitangueiras 2026',
            maxZoom: 18
        }).addTo(state.map);

        state.markersLayer = L.layerGroup().addTo(state.map);
    }

    function updateMap() {
        if (!state.map || !state.markersLayer) return;
        state.markersLayer.clearLayers();

        const validCoords = state.filteredRecords.filter(r => r.hasValidCoords);
        setElText('mapPointsCount', `${validCoords.length} pontos plotados`);

        if (validCoords.length === 0) return;

        const bounds = [];
        validCoords.forEach(r => {
            const isTorta = (r.produto || '').includes('Torta');
            const pinColor = isTorta ? '#f59e0b' : '#10b981';

            const marker = L.circleMarker([r.lat, r.lng], {
                radius: 6,
                fillColor: pinColor,
                color: '#ffffff',
                weight: 1.5,
                opacity: 0.9,
                fillOpacity: 0.8
            });

            marker.bindPopup(`
                <div class="text-xs space-y-1 font-sans">
                    <div class="font-bold text-sm text-slate-800">#${r.id} • ${r.produto}</div>
                    <div class="text-slate-600">OS: <strong>${r.os}</strong> | Frente: ${r.frente}</div>
                    <div class="text-slate-600">Talhão: ${r.local}</div>
                    <div class="text-slate-600">Inspetor: ${r.responsavel}</div>
                    <div class="text-slate-600">Data: ${r.dataStr}</div>
                    <div class="pt-1 mt-1 border-t text-sm font-bold" style="color: ${pinColor};">
                        Dosagem: ${r.dosagem !== null ? r.dosagem.toFixed(3) : '-'} (${r.produto})
                    </div>
                </div>
            `);

            state.markersLayer.addLayer(marker);
            bounds.push([r.lat, r.lng]);
        });

        if (bounds.length > 0) {
            state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
        }
    }

    // 12. Tabela de OS
    function renderOSTable() {
        const tbody = document.getElementById('tableOSBody');
        if (!tbody) return;

        let osList = window.DosagemEngine.calculateOSVariability(state.filteredRecords, state.targetConfig);

        const sortMode = state.sortOS;
        if (sortMode === 'volume') osList.sort((a, b) => b.totalMedicoes - a.totalMedicoes);
        else if (sortMode === 'cv') osList.sort((a, b) => b.cvPerc - a.cvPerc);
        else if (sortMode === 'media_asc') osList.sort((a, b) => a.media - b.media);
        else if (sortMode === 'media_desc') osList.sort((a, b) => b.media - a.media);
        else if (sortMode === 'conformidade') osList.sort((a, b) => a.percConforme - b.percConforme);

        if (osList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="p-6 text-center text-slate-400">Nenhuma Ordem de Serviço encontrada.</td></tr>`;
            return;
        }

        tbody.innerHTML = osList.map(item => {
            return `
                <tr class="hover:bg-slate-500/5 transition-colors">
                    <td class="p-3 font-mono font-bold text-emerald-500">${item.os}</td>
                    <td class="p-3 text-[11px] text-[var(--text-secondary)] line-clamp-1">${item.frentes.join(', ') || '-'}</td>
                    <td class="p-3 text-[11px] font-semibold">${item.produtos.join(', ') || '-'}</td>
                    <td class="p-3 text-center font-mono font-semibold">${item.totalMedicoes}</td>
                    <td class="p-3 text-right font-mono font-bold">${item.media.toFixed(3)}</td>
                    <td class="p-3 text-right font-mono text-[11px] text-[var(--text-secondary)]">${item.min.toFixed(2)} - ${item.max.toFixed(2)}</td>
                    <td class="p-3 text-right font-mono">${item.amplitude.toFixed(2)}</td>
                    <td class="p-3 text-right font-mono text-indigo-400">±${item.desvioPadrao.toFixed(3)}</td>
                    <td class="p-3 text-right font-mono text-indigo-400 font-bold">${item.cvPerc}%</td>
                    <td class="p-3 text-center">
                        <span class="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${item.percConforme >= 80 ? 'text-emerald-500 border-emerald-500/30' : 'text-amber-500 border-amber-500/30'}">
                            ${item.percConforme}%
                        </span>
                    </td>
                    <td class="p-3 text-center">
                        <button class="btn-filter-os px-2.5 py-1 rounded bg-[var(--bg-page)] hover:bg-emerald-500 hover:text-white border text-[10px] font-semibold transition-colors" data-os="${item.os}">
                            Filtrar
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-filter-os').forEach(btn => {
            btn.addEventListener('click', () => {
                const osVal = btn.getAttribute('data-os');
                document.getElementById('filterOS').value = osVal;
                state.filters.os = osVal;
                state.pagination.currentPage = 1;
                applyFiltersAndRender();
            });
        });
    }

    // 13. Tabela Geral com Paginação
    function renderRecordsTable() {
        const tbody = document.getElementById('tableRecordsBody');
        if (!tbody) return;

        const total = state.filteredRecords.length;
        state.pagination.totalPages = Math.ceil(total / state.pagination.pageSize) || 1;
        if (state.pagination.currentPage > state.pagination.totalPages) {
            state.pagination.currentPage = 1;
        }

        const startIdx = (state.pagination.currentPage - 1) * state.pagination.pageSize;
        const pageRecords = state.filteredRecords.slice(startIdx, startIdx + state.pagination.pageSize);

        if (pageRecords.length === 0) {
            tbody.innerHTML = `<tr><td colspan="12" class="p-8 text-center text-slate-400">Nenhum registro encontrado.</td></tr>`;
            setElText('paginationInfo', 'Nenhum registro');
            return;
        }

        setElText('paginationInfo', `Mostrando ${startIdx + 1} a ${Math.min(startIdx + state.pagination.pageSize, total)} de ${total.toLocaleString('pt-BR')} registros`);

        tbody.innerHTML = pageRecords.map(r => {
            const cls = window.DosagemEngine.classifyRecord(r, state.targetConfig);
            return `
                <tr class="hover:bg-slate-500/5 transition-colors">
                    <td class="p-3 font-mono font-bold text-emerald-500">#${r.id}</td>
                    <td class="p-3 font-mono text-[11px]">${r.dataStr}</td>
                    <td class="p-3 font-semibold text-[11px]">${r.produto}</td>
                    <td class="p-3 font-medium text-[11px]">${r.frente}</td>
                    <td class="p-3 font-mono font-bold">${r.os}</td>
                    <td class="p-3 text-[11px] text-[var(--text-secondary)]">${r.local}</td>
                    <td class="p-3 text-[11px] text-[var(--text-secondary)]">${r.responsavel}</td>
                    <td class="p-3 text-right font-mono font-bold text-sm">${r.dosagem !== null ? r.dosagem.toFixed(3) : '-'}</td>
                    <td class="p-3 text-center">
                        <span class="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${cls.badgeClass}">
                            ${cls.status}
                        </span>
                    </td>
                    <td class="p-3 text-center font-mono text-[11px]">${r.duracaoMinutos > 0 ? r.duracaoMinutos + ' min' : '< 1 min'}</td>
                    <td class="p-3 text-center font-mono text-[11px]">
                        ${r.hasValidCoords ? '<span class="text-emerald-500 font-bold">✓ GPS</span>' : '<span class="text-rose-500">✕ Ausente</span>'}
                    </td>
                    <td class="p-3 text-center">
                        <button class="btn-inspect px-2.5 py-1 rounded bg-[var(--bg-page)] hover:bg-emerald-500 hover:text-white border text-[10px] font-semibold transition-colors" data-id="${r.id}">
                            Raio-X
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-inspect').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const rec = state.normalizedRecords.find(item => item.id === id);
                if (rec) openRecordModal(rec);
            });
        });

        renderPaginationControls();
    }

    function renderPaginationControls() {
        const container = document.getElementById('paginationControls');
        if (!container) return;

        const totalP = state.pagination.totalPages;
        const curP = state.pagination.currentPage;

        container.innerHTML = `
            <button id="btnPrevPage" class="px-2.5 py-1 rounded border ${curP === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:border-emerald-500'}">Anterior</button>
            <span class="font-mono px-2">Página ${curP} de ${totalP}</span>
            <button id="btnNextPage" class="px-2.5 py-1 rounded border ${curP === totalP ? 'opacity-40 cursor-not-allowed' : 'hover:border-emerald-500'}">Próxima</button>
        `;

        const btnPrev = document.getElementById('btnPrevPage');
        const btnNext = document.getElementById('btnNextPage');
        if (btnPrev && curP > 1) {
            btnPrev.addEventListener('click', () => {
                state.pagination.currentPage--;
                renderRecordsTable();
            });
        }
        if (btnNext && curP < totalP) {
            btnNext.addEventListener('click', () => {
                state.pagination.currentPage++;
                renderRecordsTable();
            });
        }
    }

    function initTableListeners() {
        const selectSort = document.getElementById('selectSortOS');
        if (selectSort) {
            selectSort.addEventListener('change', () => {
                state.sortOS = selectSort.value;
                renderOSTable();
            });
        }

        const pageSizeSel = document.getElementById('pageSizeSelect');
        if (pageSizeSel) {
            pageSizeSel.addEventListener('change', () => {
                state.pagination.pageSize = parseInt(pageSizeSel.value, 10);
                state.pagination.currentPage = 1;
                renderRecordsTable();
            });
        }
    }

    // 14. Modal de Calibração de Parâmetros Técnicos
    function initTargetModal() {
        const modal = document.getElementById('targetModal');
        const btnOpen = document.getElementById('btnOpenTargetModal');
        const btnClose = document.getElementById('btnCloseTargetModal');
        const btnSave = document.getElementById('btnSaveTargets');
        const btnReset = document.getElementById('btnResetDefaultTargets');

        const inAdMin = document.getElementById('targetAduboMin');
        const inAdAlvo = document.getElementById('targetAduboAlvo');
        const inAdMax = document.getElementById('targetAduboMax');

        const inToMin = document.getElementById('targetTortaMin');
        const inToAlvo = document.getElementById('targetTortaAlvo');
        const inToMax = document.getElementById('targetTortaMax');

        function openModal() {
            inAdMin.value = state.targetConfig.adubo.min;
            inAdAlvo.value = state.targetConfig.adubo.alvo;
            inAdMax.value = state.targetConfig.adubo.max;

            inToMin.value = state.targetConfig.torta.min;
            inToAlvo.value = state.targetConfig.torta.alvo;
            inToMax.value = state.targetConfig.torta.max;

            modal.classList.remove('hidden');
        }

        function closeModal() {
            modal.classList.add('hidden');
        }

        if (btnOpen) btnOpen.addEventListener('click', openModal);
        if (btnClose) btnClose.addEventListener('click', closeModal);

        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const newCfg = {
                    adubo: {
                        ...state.targetConfig.adubo,
                        min: parseFloat(inAdMin.value),
                        alvo: parseFloat(inAdAlvo.value),
                        max: parseFloat(inAdMax.value)
                    },
                    torta: {
                        ...state.targetConfig.torta,
                        min: parseFloat(inToMin.value),
                        alvo: parseFloat(inToAlvo.value),
                        max: parseFloat(inToMax.value)
                    },
                    configurada: true
                };

                state.targetConfig = window.DosagemEngine.saveTargetConfig(newCfg);
                updateTargetBanner();
                closeModal();
                applyFiltersAndRender();
            });
        }

        if (btnReset) {
            btnReset.addEventListener('click', () => {
                localStorage.removeItem('mapfy_dosagem_targets_v1');
                state.targetConfig = window.DosagemEngine.getTargetConfig();
                updateTargetBanner();
                closeModal();
                applyFiltersAndRender();
            });
        }
    }

    // Ctrl + Double Click nos gráficos para calibrar
    function initPowerUserShortcuts() {
        const triggers = ['chartEvolutionCard', 'chartHistogramCard'];
        triggers.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('dblclick', (e) => {
                    if (e.ctrlKey) {
                        const btnOpen = document.getElementById('btnOpenTargetModal');
                        if (btnOpen) btnOpen.click();
                    }
                });
            }
        });
    }

    // 15. Modal Raio-X Individual
    function openRecordModal(r) {
        const modal = document.getElementById('recordModal');
        if (!modal) return;

        const cls = window.DosagemEngine.classifyRecord(r, state.targetConfig);
        setElText('modalRecordId', r.id);
        setElText('modalRecordSubtitle', `${r.produto} • ${r.frente} • OS ${r.os} • Talhão ${r.local}`);

        const badge = document.getElementById('modalRecordBadge');
        if (badge) {
            badge.innerText = cls.status;
            badge.className = `text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${cls.badgeClass}`;
        }

        const content = document.getElementById('modalRecordContent');
        if (content) {
            content.innerHTML = `
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl border bg-slate-500/5">
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Produto</span>
                        <strong class="text-base text-emerald-500">${r.produto}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Dosagem Medida</span>
                        <strong class="text-xl font-mono" style="color: ${cls.color};">${r.dosagem !== null ? r.dosagem.toFixed(3) : '-'}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Status Técnico</span>
                        <strong class="font-mono text-xs">${cls.label}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Data / Hora</span>
                        <strong class="font-mono">${r.dataStr}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Frente Operacional</span>
                        <strong>${r.frente}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Ordem de Serviço</span>
                        <strong class="font-mono text-emerald-500">${r.os}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Talhão / Fazenda</span>
                        <strong class="font-mono">${r.local}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Inspetor</span>
                        <strong>${r.responsavel}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">GPS Coordenadas</span>
                        <span class="font-mono text-[11px]">${r.hasValidCoords ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}` : '<span class="text-rose-500">Ausente</span>'}</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Duração da Medição</span>
                        <span class="font-mono text-[11px]">${r.duracaoMinutos > 0 ? r.duracaoMinutos + ' min' : '< 1 min'}</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Status no App</span>
                        <strong class="font-mono text-xs">${r.status} (Score: ${r.score})</strong>
                    </div>
                </div>
            `;
        }

        modal.classList.remove('hidden');

        const btnClose = document.getElementById('btnCloseRecordModal');
        const btnCloseF = document.getElementById('btnCloseRecordModalFooter');
        if (btnClose) btnClose.onclick = () => modal.classList.add('hidden');
        if (btnCloseF) btnCloseF.onclick = () => modal.classList.add('hidden');
    }

    // 16. Exportação CSV
    function exportFilteredCSV() {
        const headers = ['ID', 'Data', 'Produto', 'Dosagem', 'Frente', 'OS', 'Local', 'Responsavel', 'Status_Tecnico', 'Latitude', 'Longitude'];
        const rows = state.filteredRecords.map(r => {
            const cls = window.DosagemEngine.classifyRecord(r, state.targetConfig);
            return [
                r.id,
                `"${r.dataStr}"`,
                `"${r.produto}"`,
                r.dosagem !== null ? String(r.dosagem).replace('.', ',') : '',
                `"${r.frente}"`,
                `"${r.os}"`,
                `"${r.local}"`,
                `"${r.responsavel}"`,
                `"${cls.status}"`,
                r.lat ? String(r.lat).replace('.', ',') : '',
                r.lng ? String(r.lng).replace('.', ',') : ''
            ].join(';');
        });

        const csvContent = '\\uFEFF' + [headers.join(';'), ...rows].join('\\r\\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `pitangueiras_dosagem_sulco_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function setElText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

})();
'''
    with open(BASE_DIR / "js" / "dashboard.js", "w", encoding="utf-8") as f:
        f.write(code)
    print("dosagem_sulco/js/dashboard.js written")

generate_dashboard_js()
