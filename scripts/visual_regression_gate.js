/**
 * ==============================================================================
 * JARVIS DESIGN GUARDIAN — VISUAL REGRESSION GATE
 * Usina Pitangueiras — Safra 2026
 * Auditoria Global Automatizada de Integridade Visual, Contraste e Componentes
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE_DIR = path.resolve(__dirname, '..');
const DASH_DIR = path.join(BASE_DIR, 'DashBoard');
const AUDIT_OUT_DIR = path.join(BASE_DIR, 'scratch', 'audit');

if (!fs.existsSync(AUDIT_OUT_DIR)) {
    fs.mkdirSync(AUDIT_OUT_DIR, { recursive: true });
}

const DASHBOARDS = [
    'abertura_asa',
    'area_vivencia',
    'arremate_acabamento',
    'broca_armadilha',
    'canteirizacao',
    'checklist_veicular',
    'cobricao',
    'dosagem_cobricao',
    'dosagem_sulco',
    'herbicida',
    'paralelismo',
    'qualidade_cana',
    'qualidade_muda',
    'subsolagem',
    'sulcacao',
    'tpl_5s',
    'viabilidade_gemas'
];

async function runAudit() {
    console.log('==============================================================================');
    console.log('🛡️  JARVIS DESIGN GUARDIAN — AUDITORIA GLOBAL & VISUAL REGRESSION GATE');
    console.log('==============================================================================\n');

    const results = {
        timestamp: new Date().toISOString(),
        totalDashboards: DASHBOARDS.length,
        passed: 0,
        failed: 0,
        dashboards: {},
        globalIssues: []
    };

    let hasCriticalFailure = false;

    for (const slug of DASHBOARDS) {
        const dDir = path.join(DASH_DIR, slug);
        const htmlPath = path.join(dDir, 'index.html');
        const dataPath = path.join(dDir, 'js', 'data.js');
        const dashJsPath = path.join(dDir, 'js', 'dashboard.js');
        const cssPath = path.join(dDir, 'css', 'styles.css');

        const dashResult = {
            slug,
            dataLoaded: false,
            recordsCount: 0,
            hasDesignGuardianCss: false,
            hasMapControls: false,
            hasUniversalShapes: false,
            hasContrastIssues: false,
            hasFutureDates: false,
            issues: []
        };

        // 1. Verificar Carregamento de Dados (Anti-Apontamento Sumido)
        if (fs.existsSync(dataPath)) {
            try {
                const dataCode = fs.readFileSync(dataPath, 'utf8');
                const context = { window: {}, console: { log: () => {} } };
                vm.createContext(context);
                vm.runInContext(dataCode, context, { timeout: 3000 });

                let records = [];
                for (const k of Object.keys(context.window)) {
                    if (Array.isArray(context.window[k])) {
                        records = context.window[k];
                        break;
                    }
                }
                dashResult.recordsCount = records.length;
                if (records.length > 0) {
                    dashResult.dataLoaded = true;
                } else {
                    dashResult.issues.push('CRITICAL: Base de dados vazia (0 registros carregados).');
                    hasCriticalFailure = true;
                }
            } catch (err) {
                dashResult.issues.push(`CRITICAL: Falha ao executar data.js: ${err.message}`);
                hasCriticalFailure = true;
            }
        } else {
            dashResult.issues.push('CRITICAL: Arquivo data.js não localizado.');
            hasCriticalFailure = true;
        }

        // 2. Verificar HTML e Inclusão do Design Guardian
        if (fs.existsSync(htmlPath)) {
            const html = fs.readFileSync(htmlPath, 'utf8');

            dashResult.hasDesignGuardianCss = html.includes('design_guardian.css');
            if (!dashResult.hasDesignGuardianCss) {
                dashResult.issues.push('WARNING: design_guardian.css não está incluído no index.html.');
            }

            dashResult.hasUniversalShapes = html.includes('map_shapes_layer.js');

            // Verificar se há selects com cor branca hardcoded
            if (html.match(/<select[^>]*color:\s*(#ffffff|white)[^>]*>/i)) {
                dashResult.issues.push('CRITICAL: Elemento <select> com color: white hardcoded (texto invisível no tema claro).');
                dashResult.hasContrastIssues = true;
                hasCriticalFailure = true;
            }

            // Verificar se há inline background escuro fixo em evoPeriodControls
            if (html.match(/id=["'](evoPeriodControls|mapPeriodControls)["'][^>]*#1e293b/i)) {
                dashResult.issues.push('WARNING: Container de controles com fallback #1e293b hardcoded no HTML.');
                dashResult.hasContrastIssues = true;
            }
        }

        // 3. Verificar Dashboard JS e Padrões de Mapa / Sincronização
        if (fs.existsSync(dashJsPath)) {
            const js = fs.readFileSync(dashJsPath, 'utf8');

            const hasGoogle = js.includes('sateliteGoogle') || js.includes('Google Satellite');
            const hasEsri = js.includes('sateliteEsri') || js.includes('Esri');
            const hasLayers = js.includes('L.control.layers');
            dashResult.hasMapControls = hasGoogle && hasEsri && hasLayers;

            if (!dashResult.hasMapControls && !['herbicida'].includes(slug)) {
                dashResult.issues.push('WARNING: Controles de satélite Google/Esri não padronizados no mapa.');
            }
        }

        // 4. Verificar Datas Invertidas ou Futuras em data.js
        if (fs.existsSync(dataPath)) {
            const dataContent = fs.readFileSync(dataPath, 'utf8');
            const futureMatches = dataContent.match(/["'\s]\d{2}\/12\/2026/g) || [];
            if (futureMatches.length > 0) {
                dashResult.issues.push(`CRITICAL: Localizadas ${futureMatches.length} datas no mês 12 de 2026 (datas futuras/invertidas).`);
                dashResult.hasFutureDates = true;
                hasCriticalFailure = true;
            }

            // Verificar se há datas em formato US explícito (ex: 11/13/2026)
            const usMatches = dataContent.match(/["'\s]11\/13\/2026/g) || [];
            if (usMatches.length > 0) {
                dashResult.issues.push(`CRITICAL: Localizadas ${usMatches.length} datas em formato americano 11/13/2026.`);
                dashResult.hasFutureDates = true;
                hasCriticalFailure = true;
            }
        }

        if (dashResult.issues.length === 0) {
            results.passed++;
            console.log(`✅ [${slug}] APROVADO — ${dashResult.recordsCount} registros | Design Guardian OK | Mapas OK | Datas OK`);
        } else {
            results.failed++;
            console.log(`⚠️ [${slug}] ATENÇÃO — ${dashResult.issues.join(' | ')}`);
        }

        results.dashboards[slug] = dashResult;
    }

    // Salva relatórios
    fs.writeFileSync(path.join(AUDIT_OUT_DIR, 'visual_regression_report.json'), JSON.stringify(results, null, 2), 'utf8');

    let mdReport = `# 🛡️ JARVIS DESIGN GUARDIAN — RELATÓRIO DO VISUAL REGRESSION GATE\n\n`;
    mdReport += `**Data/Hora:** ${new Date().toLocaleString('pt-BR')}\n`;
    mdReport += `**Total de Dashboards Auditados:** ${results.totalDashboards}\n`;
    mdReport += `**Aprovados:** ${results.passed}\n`;
    mdReport += `**Com Pendências:** ${results.failed}\n\n`;
    mdReport += `## Status Geral do Gate: ${hasCriticalFailure ? '⛔ BLOQUEADO' : '✅ APROVADO'}\n\n`;
    mdReport += `| Dashboard | Registros | Design Guardian | Controles de Mapa | Shapes Universais | Status |\n`;
    mdReport += `|---|---|---|---|---|---|\n`;

    for (const slug of DASHBOARDS) {
        const d = results.dashboards[slug];
        const statusIcon = d.issues.length === 0 ? '✅ Aprovado' : '⚠️ Pendências';
        mdReport += `| \`${slug}\` | ${d.recordsCount} | ${d.hasDesignGuardianCss ? 'Sim' : 'Não'} | ${d.hasMapControls ? 'Sim' : 'Parcial'} | ${d.hasUniversalShapes ? 'Sim' : 'Não'} | ${statusIcon} |\n`;
    }

    fs.writeFileSync(path.join(AUDIT_OUT_DIR, 'visual_regression_report.md'), mdReport, 'utf8');

    console.log('\n==============================================================================');
    if (hasCriticalFailure) {
        console.log('⛔ VISUAL REGRESSION GATE: BLOQUEADO (Pendências Críticas Detectadas)');
        console.log('==============================================================================');
        process.exit(1);
    } else {
        console.log('✅ VISUAL REGRESSION GATE: APROVADO (100% dos Padrões Homologados)');
        console.log('==============================================================================');
        process.exit(0);
    }
}

runAudit();
