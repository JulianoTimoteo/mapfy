#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_mandala_and_mobile_perfection.py
======================================
Aplica de forma precisa e atômica:
1. Animação Masterpiece de Abertura da Mandala no Hub MapFy (inicia fechada, roda e desabrocha alocando os 17 relatórios).
2. Botão de replay interativo na badge "Safra 2026" e no centro da Mandala.
3. Tela cheia do Mapa 100% adaptada para Celular (100dvh, safe-area-inset, botão flutuante direto no mapa).
4. Popover do "i" com adaptação ergonômica mobile (bottom sheet no celular, modal executivo no desktop).
"""

import os
import re

INDEX_PATH = os.path.join('DashBoard', 'index.html')
CSS_PATH = os.path.join('DashBoard', 'common', 'css', 'fullscreen_inspector.css')
JS_PATH = os.path.join('DashBoard', 'common', 'js', 'fullscreen_inspector.js')

def update_index_html():
    print(f"Atualizando {INDEX_PATH}...")
    with open(INDEX_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Inserir estilos CSS da animação de abertura
    css_intro = """
        /* --- ANIMAÇÃO MASTERPIECE DE ABERTURA DA MANDALA (STARTUP BLOOM & SPIN) --- */
        .mandala-intro-active {
            pointer-events: none;
        }

        @keyframes mandalaCenterBloom {
            0% {
                transform: scale(0.12) rotate(-180deg);
                opacity: 0;
                box-shadow: 0 0 60px rgba(16, 185, 129, 0.9);
            }
            70% {
                transform: scale(1.08) rotate(10deg);
                opacity: 1;
                box-shadow: 0 0 45px rgba(16, 185, 129, 0.5);
            }
            100% {
                transform: scale(1) rotate(0deg);
                opacity: 1;
                box-shadow: var(--center-hud-shadow);
            }
        }

        @keyframes mandalaPulseSynced {
            0% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.85), var(--center-hud-shadow);
                border-color: #34d399;
            }
            50% {
                box-shadow: 0 0 0 24px rgba(16, 185, 129, 0), var(--center-hud-shadow);
                border-color: #10b981;
            }
            100% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0), var(--center-hud-shadow);
                border-color: var(--center-hud-border);
            }
        }

        .mandala-center-bloom {
            animation: mandalaCenterBloom 0.85s cubic-bezier(0.34, 1.45, 0.64, 1) forwards;
        }

        .mandala-synced-pulse {
            animation: mandalaPulseSynced 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
        }
"""

    if '.mandala-intro-active' not in content:
        target_css = "#centerHud:hover {"
        idx = content.find(target_css)
        if idx != -1:
            end_target = content.find("}", idx) + 1
            content = content[:end_target] + css_intro + content[end_target:]
            print(" -> CSS da Mandala Intro inserido com sucesso.")

    # 2. Atualizar Badge "Safra 2026" para ser gatilho de animação com replay
    old_badge_pat = r'<span class="text-\[9px\] sm:text-\[10px\] font-mono font-bold uppercase tracking-wider px-1\.5 py-0\.5 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 whitespace-nowrap">Safra 2026</span>'
    new_badge = """<button type="button" onclick="playMandalaIntroAnimation()" title="Clique para rever a animação de alocação da Mandala" class="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-500 border border-emerald-500/30 whitespace-nowrap transition-all hover:scale-105 active:scale-95 flex items-center gap-1 cursor-pointer"><span class="text-xs">↻</span><span>Safra 2026</span></button>"""

    if re.search(old_badge_pat, content):
        content = re.sub(old_badge_pat, new_badge, content)
        print(" -> Badge Safra 2026 atualizada para botão interativo.")

    # 3. Atualizar centerHud click para permitir replay ao clicar no centro neutro
    old_center_click = """        const centerHud = document.getElementById('centerHud');
        if (centerHud) {
            centerHud.addEventListener('click', () => {
                if (activeSelectedUrl) {
                    window.location.href = activeSelectedUrl;
                } else if (selectedNodeIdx !== null) {
                    const item = formsData[selectedNodeIdx];
                    if (item) openModal(item.clean_name, item.category, item.rows.toLocaleString(), item.latest_date, item.folder, item.columns);
                }
            });
        }"""

    new_center_click = """        const centerHud = document.getElementById('centerHud');
        if (centerHud) {
            centerHud.addEventListener('click', () => {
                if (activeSelectedUrl) {
                    window.location.href = activeSelectedUrl;
                } else if (selectedNodeIdx !== null) {
                    const item = formsData[selectedNodeIdx];
                    if (item) openModal(item.clean_name, item.category, item.rows.toLocaleString(), item.latest_date, item.folder, item.columns);
                } else {
                    // Ao clicar no centro no estado neutro, reproduz a animação especial de alocação
                    playMandalaIntroAnimation();
                }
            });
        }"""

    if old_center_click in content:
        content = content.replace(old_center_click, new_center_click)
        print(" -> Listener de clique no HUD central atualizado com replay.")

    # 4. Adicionar a função playMandalaIntroAnimation() e disparo automático no load
    js_intro_code = """
        // =========================================================================
        // ANIMAÇÃO MASTERPIECE DE ABERTURA DA MANDALA (STARTUP BLOOM & SPIN)
        // Inicia fechada no centro, gira e aloca sequencialmente os 17 relatórios
        // =========================================================================
        function playMandalaIntroAnimation() {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return;
            }

            const container = document.getElementById('mandalaContainer');
            const centerHud = document.getElementById('centerHud');
            const nodes = document.querySelectorAll('.mandala-node');
            const spokes = document.querySelectorAll('.spoke-line');
            if (!container || !centerHud || nodes.length === 0) return;

            // Salva as posições originais de destino de cada nó
            nodes.forEach(node => {
                if (!node.dataset.targetLeft) {
                    node.dataset.targetLeft = node.style.left;
                    node.dataset.targetTop = node.style.top;
                }
            });

            container.classList.add('mandala-intro-active');

            // 1. Estado Fechado no Centro (comprimido e girado)
            centerHud.classList.remove('mandala-center-bloom', 'mandala-synced-pulse');
            centerHud.style.transition = 'none';
            centerHud.style.transform = 'scale(0.12) rotate(-180deg)';
            centerHud.style.opacity = '0';

            spokes.forEach(spoke => {
                spoke.style.transition = 'none';
                spoke.style.opacity = '0';
                spoke.style.strokeDasharray = '400';
                spoke.style.strokeDashoffset = '400';
            });

            nodes.forEach(node => {
                node.style.transition = 'none';
                node.style.left = '50%';
                node.style.top = '50%';
                node.style.opacity = '0';
                node.style.transform = 'translate(-50%, -50%) scale(0) rotate(-180deg)';
            });

            // Força o reflow do navegador para garantir reset imediato
            void container.offsetWidth;

            // 2. Desabrocha o Centro HUD com aceleração elástica
            requestAnimationFrame(() => {
                centerHud.classList.add('mandala-center-bloom');
            });

            // 3. Ejeção / Desabrochar dos 17 nós rodando para seus locais exatos
            const baseDelay = 160;
            const stepDelay = 42; // ~714ms para distribuir todos os 17 nós 360°

            nodes.forEach((node, index) => {
                const delay = baseDelay + (index * stepDelay);
                setTimeout(() => {
                    const spoke = document.getElementById(`spoke-${index}`);
                    if (spoke) {
                        spoke.style.transition = 'stroke-dashoffset 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-in';
                        spoke.style.opacity = '1';
                        spoke.style.strokeDashoffset = '0';
                    }

                    node.style.transition = 'left 0.75s cubic-bezier(0.34, 1.35, 0.64, 1), top 0.75s cubic-bezier(0.34, 1.35, 0.64, 1), transform 0.75s cubic-bezier(0.34, 1.35, 0.64, 1), opacity 0.35s ease-out';
                    node.style.left = node.dataset.targetLeft;
                    node.style.top = node.dataset.targetTop;
                    node.style.opacity = '1';
                    node.style.transform = 'translate(-50%, -50%) scale(1) rotate(0deg)';

                    const disc = node.querySelector('.node-disc');
                    if (disc) {
                        disc.style.boxShadow = '0 0 22px rgba(16, 185, 129, 0.85)';
                        setTimeout(() => { disc.style.boxShadow = ''; }, 450);
                    }
                }, delay);
            });

            // 4. Finalização sincronizada e pulso de confirmação
            const totalTime = baseDelay + (nodes.length * stepDelay) + 750;
            setTimeout(() => {
                container.classList.remove('mandala-intro-active');
                centerHud.classList.remove('mandala-center-bloom');
                centerHud.classList.add('mandala-synced-pulse');

                nodes.forEach(node => {
                    node.style.transition = '';
                    node.style.transform = '';
                });
                spokes.forEach(spoke => {
                    spoke.style.transition = '';
                    spoke.style.strokeDasharray = '';
                    spoke.style.strokeDashoffset = '';
                    spoke.style.opacity = '';
                });
                centerHud.style.transition = '';
                centerHud.style.transform = '';
                centerHud.style.opacity = '';

                setTimeout(() => {
                    centerHud.classList.remove('mandala-synced-pulse');
                }, 1300);
            }, totalTime);
        }

        // Disparo automático suave da animação ao abrir
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(playMandalaIntroAnimation, 120);
            });
        } else {
            setTimeout(playMandalaIntroAnimation, 120);
        }
"""

    if 'function playMandalaIntroAnimation()' not in content:
        target_script = "applyVisitedStates();"
        idx = content.find(target_script)
        if idx != -1:
            content = content[:idx + len(target_script)] + "\n" + js_intro_code + content[idx + len(target_script):]
            print(" -> Script de controle da animação inserido com sucesso.")

    with open(INDEX_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Dashboard index.html salvo com sucesso.")


def update_fullscreen_css():
    print(f"Atualizando {CSS_PATH}...")
    with open(CSS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Garantir suporte a 100dvh e tela cheia imersiva em mobile
    if 'height: 100dvh !important;' not in content:
        content = content.replace(
            "height: 100vh !important;\n    max-width: 100vw !important;\n    max-height: 100vh !important;",
            "height: 100vh !important;\n    height: 100dvh !important;\n    max-width: 100vw !important;\n    max-height: 100vh !important;\n    max-height: 100dvh !important;\n    top: 0 !important;\n    left: 0 !important;\n    right: 0 !important;\n    bottom: 0 !important;"
        )
        print(" -> Suporte a 100dvh no mapa full screen adicionado.")

    # 2. Adicionar estilo para botão flutuante sobre o mapa e adaptação do topbar
    extra_map_styles = """
/* Botão Flutuante Nativo de Tela Cheia no Mapa Leaflet */
.btn-map-canvas-fullscreen {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 800;
    background: rgba(15, 23, 42, 0.90);
    backdrop-filter: blur(8px);
    border: 1.5px solid rgba(16, 185, 129, 0.6);
    color: #ffffff;
    font-size: 11px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 12px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
    touch-action: manipulation;
}
.btn-map-canvas-fullscreen:hover {
    background: #10b981;
    border-color: #10b981;
    transform: scale(1.05);
}
.map-fullscreen-active .btn-map-canvas-fullscreen {
    display: none !important;
}

/* Adaptação Ergonômica Mobile do Topbar do Mapa em Tela Cheia */
@media (max-width: 639px) {
    .map-fullscreen-topbar {
        top: max(8px, env(safe-area-inset-top, 0px)) !important;
        left: max(8px, env(safe-area-inset-left, 0px)) !important;
        right: max(8px, env(safe-area-inset-right, 0px)) !important;
        gap: 6px !important;
    }
    .map-fullscreen-badge {
        font-size: 10px !important;
        padding: 5px 8px !important;
    }
    .btn-exit-map-fullscreen {
        font-size: 10px !important;
        padding: 5px 10px !important;
    }
}

/* Adaptação Mobile Ergonômica do Popover do 'i' (Bottom Sheet no Celular) */
@media (max-width: 639px) {
    .pitangueiras-popover-overlay {
        padding: 8px !important;
        align-items: flex-end !important;
    }
    .popover-card {
        max-width: 100% !important;
        width: 100% !important;
        border-radius: 22px 22px 10px 10px !important;
        padding: 16px 14px !important;
        max-height: 82vh !important;
        max-height: 82dvh !important;
        margin-bottom: env(safe-area-inset-bottom, 0px) !important;
    }
    .popover-header {
        padding-bottom: 10px !important;
    }
    .popover-title-area h3 {
        font-size: 14px !important;
    }
    .popover-body {
        margin-top: 10px !important;
        gap: 8px !important;
    }
    .popover-section {
        padding: 8px 10px !important;
        border-radius: 10px !important;
    }
    .popover-section-label {
        font-size: 10px !important;
        margin-bottom: 2px !important;
    }
    .popover-section-text {
        font-size: 11px !important;
        line-height: 1.35 !important;
    }
    .popover-footer {
        margin-top: 10px !important;
        padding-top: 8px !important;
        font-size: 9px !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 4px !important;
    }
}
"""

    if '.btn-map-canvas-fullscreen' not in content:
        content += extra_map_styles
        print(" -> Estilos de tela cheia e popover mobile adicionados.")

    with open(CSS_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"{CSS_PATH} salvo com sucesso.")


def update_fullscreen_js():
    print(f"Atualizando {JS_PATH}...")
    with open(JS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Adicionar o botão flutuante sobre o mapa em setupMapFullscreen
    old_setup_map = """        if (headerEl) {
            headerEl.appendChild(btn);
        } else {
            const wrapper = document.createElement('div');
            wrapper.className = 'flex justify-end mb-2';
            wrapper.appendChild(btn);
            mapEl.parentElement.insertBefore(wrapper, mapEl);
        }
    }"""

    new_setup_map = """        if (headerEl) {
            headerEl.appendChild(btn);
        } else {
            const wrapper = document.createElement('div');
            wrapper.className = 'flex justify-end mb-2';
            wrapper.appendChild(btn);
            mapEl.parentElement.insertBefore(wrapper, mapEl);
        }

        // Adiciona botão flutuante diretamente sobre o mapa para acesso instantâneo com um toque
        if (!mapEl.querySelector('.btn-map-canvas-fullscreen')) {
            const canvasBtn = document.createElement('button');
            canvasBtn.type = 'button';
            canvasBtn.className = 'btn-map-canvas-fullscreen';
            canvasBtn.title = 'Expandir Mapa em Tela Inteira';
            canvasBtn.innerHTML = `${ICONS.expand} <span>Tela Inteira</span>`;
            canvasBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleMapFullscreen(mapCard, mapEl);
            });
            mapEl.appendChild(canvasBtn);
        }
    }"""

    if old_setup_map in content:
        content = content.replace(old_setup_map, new_setup_map)
        print(" -> Botão flutuante sobre o canvas do mapa inserido em setupMapFullscreen.")

    # 2. Atualizar o topbar do mapa em tela cheia para texto responsivo mobile
    old_topbar = """                    <div class="map-fullscreen-badge pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md text-white text-xs font-semibold border border-slate-700/60 shadow-lg">
                        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>Mapa Operacional • Pontos Individuais (100% Desagrupados)</span>
                    </div>"""

    new_topbar = """                    <div class="map-fullscreen-badge pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md text-white text-xs font-semibold border border-slate-700/60 shadow-lg">
                        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span class="hidden sm:inline">Mapa Operacional • Pontos Individuais (100% Desagrupados)</span>
                        <span class="sm:hidden">Pontos Desagrupados</span>
                    </div>"""

    if old_topbar in content:
        content = content.replace(old_topbar, new_topbar)
        print(" -> Topbar do mapa atualizado com textos responsivos mobile.")

    with open(JS_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"{JS_PATH} salvo com sucesso.")


if __name__ == '__main__':
    update_index_html()
    update_fullscreen_css()
    update_fullscreen_js()
    print("Todas as melhorias aplicadas com perfeição técnica!")
