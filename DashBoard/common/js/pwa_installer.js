/**
 * MapFy 2026 - PWA Instant Installer & Mobile Lifecycle Controller
 * Usina Pitangueiras • Safra 2026
 *
 * Funcionalidades:
 * 1. Auto-atualização transparente e agressiva para dispositivos móveis (Android / iOS).
 * 2. Detecção e revalidação ao desbloquear celular ou alternar abas (visibilitychange / focus).
 * 3. Função universal de forçar sincronização imediata (window.forceMapfyUpdate).
 * 4. Convite de instalação direta em 1 clique (3 segundos de exibição).
 */
(function () {
    'use strict';

    // 1. Registro e Gerenciamento Ativo do Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            const swPath = window.location.pathname.includes('/DashBoard/') && !window.location.pathname.endsWith('/DashBoard/') && !window.location.pathname.endsWith('/index.html')
                ? '../sw.js'
                : './sw.js';

            navigator.serviceWorker.register(swPath).then((reg) => {
                // Força busca imediata de novas versões no servidor
                try { reg.update(); } catch (e) {}

                reg.onupdatefound = () => {
                    const installing = reg.installing;
                    if (installing) {
                        installing.onstatechange = () => {
                            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('[Mapfy PWA] Nova versão disponível. Atualizando celular...');
                                window.location.reload();
                            }
                        };
                    }
                };
            }).catch(() => {});
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    }

    // 2. Revalidação Imediata ao Desbloquear o Celular ou Voltar para o App
    function revalidateOnResume() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then((reg) => {
                if (reg) {
                    try { reg.update(); } catch (e) {}
                }
            }).catch(() => {});
        }

        // Se estiver no Hub Mandala
        if (typeof window.syncDynamicCounts === 'function') {
            try { window.syncDynamicCounts(); } catch (e) {}
        }

        // Se estiver em um sub-relatório
        if (window.MapfyApiConnector && typeof window.MapfyApiConnector.initOnlineSync === 'function') {
            try { window.MapfyApiConnector.initOnlineSync(); } catch (e) {}
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            revalidateOnResume();
        }
    });
    window.addEventListener('focus', revalidateOnResume);

    // 3. Função Universal de Forçar Limpeza de Cache no Celular
    window.forceMapfyUpdate = async function () {
        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg && reg.active) {
                    reg.active.postMessage({ action: 'CLEAR_CACHE_AND_RELOAD' });
                }
            }
        } catch (e) {}

        const cleanUrl = window.location.pathname.split('?')[0];
        window.location.href = cleanUrl + '?v=' + Date.now();
    };

    // 4. Verificação de Instalação PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const isAlreadyInstalled = localStorage.getItem('mapfy_pwa_installed') === 'true';

    if (isStandalone || isAlreadyInstalled) {
        return;
    }

    let deferredPrompt = null;
    let installBannerTimer = null;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        triggerAutoInstallToast();
    });

    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (!deferredPrompt && !isStandalone && !isAlreadyInstalled && isMobileDevice()) {
                triggerAutoInstallToast();
            }
        }, 1200);
    });

    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 800;
    }

    function triggerAutoInstallToast() {
        if (document.getElementById('mapfy-pwa-install-toast')) return;
        if (localStorage.getItem('mapfy_pwa_installed') === 'true') return;

        const isRelatorio = window.location.pathname.includes('/DashBoard/') && !window.location.pathname.endsWith('/DashBoard/') && !window.location.pathname.endsWith('/index.html');
        const logoPath = isRelatorio ? '../assets/logo_pitangueiras.png' : 'assets/logo_pitangueiras.png';

        const toast = document.createElement('div');
        toast.id = 'mapfy-pwa-install-toast';
        toast.className = 'mapfy-pwa-banner-animate';
        toast.style.cssText = `
            position: fixed;
            bottom: calc(16px + env(safe-area-inset-bottom, 0px));
            left: 12px;
            right: 12px;
            max-width: 480px;
            margin: 0 auto;
            z-index: 99999999;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1.5px solid rgba(16, 185, 129, 0.6);
            border-radius: 18px;
            padding: 10px 14px;
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5), 0 0 18px rgba(16, 185, 129, 0.25);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            color: #ffffff;
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            transform: translateY(20px);
            opacity: 0;
            pointer-events: auto;
        `;

        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                <div style="width: 36px; height: 36px; border-radius: 10px; background: #ffffff; padding: 3px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                    <img src="${logoPath}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;">
                </div>
                <div style="min-width: 0; flex: 1;">
                    <div style="font-size: 12px; font-weight: 800; color: #f8fafc; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        Instalar MapFy 2026
                    </div>
                    <div style="font-size: 10px; color: #34d399; font-weight: 600; font-family: monospace;">
                        Versão Celular • Acesso Rápido
                    </div>
                </div>
            </div>
            <button id="btnPwaActionInstall" type="button" style="
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: #ffffff;
                font-size: 11px;
                font-weight: 800;
                padding: 8px 14px;
                border-radius: 12px;
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
                display: flex;
                align-items: center;
                gap: 5px;
                flex-shrink: 0;
                touch-action: manipulation;
                transition: transform 0.15s ease;
            ">
                <span>📲</span>
                <span>Instalar</span>
            </button>
        `;

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });

        installBannerTimer = setTimeout(() => {
            dismissToast(toast);
        }, 3000);

        const btnInstall = toast.querySelector('#btnPwaActionInstall');
        if (btnInstall) {
            btnInstall.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (installBannerTimer) clearTimeout(installBannerTimer);
                localStorage.setItem('mapfy_pwa_installed', 'true');
                btnInstall.innerHTML = '<span>⏳</span><span>Instalando...</span>';

                if (deferredPrompt) {
                    try {
                        deferredPrompt.prompt();
                        const { outcome } = await deferredPrompt.userChoice;
                        deferredPrompt = null;
                    } catch (err) {}
                }
                dismissToast(toast);
            });
        }
    }

    function dismissToast(toast) {
        if (!toast) return;
        toast.style.transform = 'translateY(25px)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 350);
    }
})();
