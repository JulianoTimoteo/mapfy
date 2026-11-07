#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_toolbar_raiox_info_perfection.py
======================================
1. Corrige o Toolbar de Período Temporal & Ações Operacionais:
   - Elimina qualquer quebra ou estouro lateral no celular (320px a 639px).
   - period-segmented-group ocupa 100% da largura útil sem estourar.
   - Botões de ações (CSV, Imprimir, Tema) dividem 3 colunas perfeitamente.
2. Ajusta a visão Raio-X do Apontamento no mapa no celular:
   - Elimina qualquer sobra lateral maior que a área do dispositivo.
   - recordModal/detailModal ocupa 100% da tela sem margens excedentes.
   - Leaflet popup com largura máxima responsiva calc(100vw - 32px).
3. Restaura e universaliza os "i" informativos em todos os títulos de cards,
   KPIs e gráficos dos 17 relatórios.
"""

import os
import re

CSS_PATH = os.path.join('DashBoard', 'common', 'css', 'fullscreen_inspector.css')
JS_PATH = os.path.join('DashBoard', 'common', 'js', 'fullscreen_inspector.js')

def update_css():
    print(f"Atualizando {CSS_PATH}...")
    with open(CSS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    extra_css = """
/* ==========================================================================
   TOOLBAR OPERACIONAL & SELETOR DE PERÍODO 100% RESPONSIVO (MOBILE-FIRST)
   Elimina qualquer estouro lateral em telas de smartphones de 320px a 639px
   ========================================================================== */
@media (max-width: 639px) {
    /* O container pai do toolbar empilha verticalmente */
    div:has(> div > .period-segmented-group),
    div:has(> .period-segmented-group),
    .toolbar-container {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 8px !important;
        padding: 8px !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
    }

    /* Bloco esquerdo com o grupo segmentado */
    div:has(> div > .period-segmented-group) > div:first-child {
        width: 100% !important;
        max-width: 100% !important;
    }

    /* Grupo segmentado ocupa 100% da largura da tela */
    .period-segmented-group {
        display: flex !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        padding: 2px !important;
        gap: 2px !important;
        border-radius: 12px !important;
        overflow: hidden !important;
    }

    /* Cada botão do período divide a largura igualmente (1/3) */
    .period-toggle-btn {
        flex: 1 1 0 !important;
        min-width: 0 !important;
        padding: 6px 2px !important;
        font-size: 10px !important;
        gap: 3px !important;
        justify-content: center !important;
        text-align: center !important;
        white-space: nowrap !important;
        border-radius: 8px !important;
    }

    .period-toggle-btn span {
        overflow: hidden !important;
        text-overflow: ellipsis !important;
    }

    .period-badge {
        padding: 1px 4px !important;
        font-size: 8.5px !important;
        margin-left: 1px !important;
    }

    /* Ferramentas Operacionais (Exportar CSV, Imprimir, Tema) em grid equilibrado */
    div:has(> div > .period-segmented-group) > div:last-child {
        width: 100% !important;
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        gap: 4px !important;
    }

    .btn-toolbar-action {
        width: 100% !important;
        min-width: 0 !important;
        padding: 6px 2px !important;
        font-size: 10px !important;
        justify-content: center !important;
        gap: 3px !important;
        border-radius: 10px !important;
    }

    .btn-toolbar-action span:last-child {
        overflow: hidden !important;
        text-overflow: ellipsis !important;
    }

    /* Barra de Contexto Ativo (Destaque do Período) */
    div:has(> div > #currentDateDisplay) {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 6px !important;
        padding: 8px 10px !important;
        width: 100% !important;
        box-sizing: border-box !important;
    }
}

/* ==========================================================================
   VISÃO RAIO-X DO APONTAMENTO NO MAPA 100% ADAPTADA AO CELULAR
   Zero sobras laterais: o modal ajusta-se com precisão milimétrica ao dispositivo
   ========================================================================== */
@media (max-width: 639px) {
    /* Remove padding do backdrop modal no mobile para evitar overflow 100vw + padding */
    #recordModal,
    #detailModal,
    #detailsModal,
    #recordDetailModal,
    #targetModal,
    div[id$="Modal"] {
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: 100vw !important;
        overflow-x: hidden !important;
        box-sizing: border-box !important;
    }

    /* O container do Raio-X preenche a largura exata da viewport sem vazamento */
    #recordModal > div,
    #detailModal > div,
    #detailsModal > div,
    #recordDetailModal > div,
    #targetModal > div {
        width: 100% !important;
        max-width: 100vw !important;
        height: 100% !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        margin: 0 !important;
        border-radius: 0 !important;
        border: none !important;
        padding: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
    }

    /* Cabeçalho do Raio-X */
    #recordModal > div > div:first-child,
    #detailModal > div > div:first-child,
    #detailsModal > div > div:first-child,
    #recordDetailModal > div > div:first-child {
        padding: 12px 14px !important;
        flex-shrink: 0 !important;
        padding-top: max(12px, env(safe-area-inset-top, 0px)) !important;
    }

    /* Corpo do Raio-X com scroll suave e largura estrita */
    #recordModal > div > div:nth-child(2),
    #detailModal > div > div:nth-child(2),
    #detailsModal > div > div:nth-child(2),
    #recordDetailModal > div > div:nth-child(2) {
        padding: 12px !important;
        flex: 1 1 auto !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch !important;
        box-sizing: border-box !important;
    }

    /* Grids de estatísticas e medições do Raio-X em 2 colunas */
    #recordModal .grid,
    #detailModal .grid,
    #detailsModal .grid,
    #recordDetailModal .grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 6px !important;
        width: 100% !important;
        box-sizing: border-box !important;
    }

    #recordModal .grid > div,
    #detailModal .grid > div,
    #detailsModal .grid > div {
        padding: 8px 10px !important;
        min-width: 0 !important;
        overflow: hidden !important;
    }

    /* Rodapé do Raio-X */
    #recordModal > div > div:last-child,
    #detailModal > div > div:last-child,
    #detailsModal > div > div:last-child,
    #recordDetailModal > div > div:last-child {
        padding: 10px 14px !important;
        flex-shrink: 0 !important;
        padding-bottom: max(10px, env(safe-area-inset-bottom, 0px)) !important;
    }

    /* Popup do Leaflet dentro da tela do celular */
    .leaflet-popup-content-wrapper {
        max-width: calc(100vw - 32px) !important;
        border-radius: 14px !important;
        box-sizing: border-box !important;
    }

    .leaflet-popup-content {
        margin: 10px 12px !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        word-break: break-word !important;
    }
}
"""

    if 'TOOLBAR OPERACIONAL & SELETOR DE PERÍODO 100% RESPONSIVO' not in content:
        content += extra_css
        print(" -> Regras CSS de toolbar e Raio-X mobile adicionadas.")

    with open(CSS_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"{CSS_PATH} salvo.")


def update_js():
    print(f"Atualizando {JS_PATH}...")
    with open(JS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    # Atualiza a função setupUniversalItemInfoSystem para cobrir todos os títulos sem bloqueios indevidos
    old_system_pattern = r'function setupUniversalItemInfoSystem\(\) \{[\s\S]*?createPopoverModalDOM\(\);[\s\S]*?const SELECTORS = \[[\s\S]*?\];[\s\S]*?elements\.forEach\(el => \{[\s\S]*?el\.appendChild\(btn\);[\s\S]*?\}\);[\s\S]*?\}'

    new_system_code = """function setupUniversalItemInfoSystem() {
        createPopoverModalDOM();

        // Seletor cirúrgico e abrangente cobrindo TODOS os títulos de blocos, KPIs e gráficos dos 17 relatórios
        const SELECTORS = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            '.kpi-title', '.chart-card-title', '.filters-title', '.card-title', '.audit-item-title',
            '.chart-card-header .chart-card-title',
            '.card-transition > span:first-child',
            '.kpi-card > span:first-child',
            '.kpis-grid > div > span:first-child',
            'section[class*="grid"] > div[class*="card"] > span:first-child',
            'div[class*="card-transition"] > span[class*="uppercase"]',
            'div[class*="card"] > span[class*="uppercase"]',
            'div[class*="rounded"] > span[class*="uppercase"]'
        ];

        const elements = document.querySelectorAll(SELECTORS.join(', '));

        elements.forEach(el => {
            // REGRA ESTRITA: NUNCA injetar dentro de miolos de gráficos donut, canvas, inputs ou modais!
            if (el.closest('#donutCenterOverlay, [id*="donutCenter"], [id*="centerPerc"], [id*="CenterPerc"], .donut-center-total-sum, canvas, .chart-canvas-container, .popover-card, .site-header, .site-footer, .header-glass, button, .btn-toggle-fullscreen, .timeline-quick-filter-group, #noticeBrocaBanner, [id*="notice"], [id*="Notice"], [class*="notice"], [class*="banner"], .badge-index, .node-label, select, input, #recordModal, #detailModal, #detailsModal, #targetModal')) {
                return;
            }

            // Ignora se o elemento (ou seu irmão direto) já possui o botão de informação
            if (el.querySelector('.btn-info-popover') || el.classList.contains('btn-info-popover') || el.parentElement?.querySelector(':scope > .btn-info-popover')) {
                return;
            }

            const rawText = el.textContent.trim();
            // Ignora textos numéricos puros, datas, marcas de sistema, tags de status ou textos muito curtos
            if (rawText.length < 3 || /^[0-9.,%\s\/:-]+$/.test(rawText) || rawText.includes('Pitangueiras') || rawText.includes('SAFRA 2026') || rawText.includes('Carregando')) {
                return;
            }

            // Se o elemento tiver classe truncate, remove para que o texto e o ícone fiquem visíveis sem corte
            if (el.classList.contains('truncate')) {
                el.classList.remove('truncate');
            }

            // Garante alinhamento inline-flex para títulos que forem spans
            if (window.getComputedStyle(el).display === 'inline') {
                el.style.display = 'inline-flex';
                el.style.alignItems = 'center';
            }

            // Cria o botão de informação com alta precisão visual
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-info-popover';
            btn.title = `Saiba o que significa: ${rawText}`;
            btn.setAttribute('aria-label', `Informações sobre: ${rawText}`);
            btn.innerHTML = ICONS.info;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openInfoPopover(rawText, el);
            });

            // Insere ao lado do texto
            el.appendChild(btn);
        });
    }"""

    if re.search(old_system_pattern, content):
        content = re.sub(old_system_pattern, lambda m: new_system_code, content)
        print(" -> Função setupUniversalItemInfoSystem reescrita com cobertura total de títulos.")

    with open(JS_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"{JS_PATH} salvo.")


if __name__ == '__main__':
    update_css()
    update_js()
    print("Correções aplicadas com sucesso!")
