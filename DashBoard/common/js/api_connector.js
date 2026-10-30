/**
 * api_connector.js
 * ================
 * Conector de Alta Resiliência para Consumo Online do Servidor MapFy 24/7.
 * 
 * Funcionalidades:
 * 1. Conexão Híbrida Inteligente:
 *    - Inicializa instantaneamente com os dados em cache/locais (Zero tela branca).
 *    - Consulta o Server_MapFy em background.
 *    - Se o servidor 24/7 responder, sincroniza os dados mais recentes em tempo real.
 * 2. Suporte a Servidor Local, IP da Usina ou Cloudflare Tunnel / Ngrok.
 * 3. Badge interativo de status no cabeçalho (Online 24/7 vs Contingência Offline).
 * 
 * Usina Pitangueiras • Safra 2026
 */

(function () {
    'use strict';

    // Configuração de Endereço da API do Servidor 24/7
    // Pode ser sobrescrito dinamicamente via localStorage: localStorage.setItem('mapfy_api_url', 'http://192.168.1.100:8000')
    const DEFAULT_API_URL = window.MAPFY_API_URL || localStorage.getItem('mapfy_api_url') || 'http://127.0.0.1:8000';

    // Descobre o slug do relatório atual a partir da URL da pasta
    function detectReportSlug() {
        const pathParts = window.location.pathname.replace(/\\/g, '/').split('/');
        const dashIdx = pathParts.indexOf('DashBoard');
        if (dashIdx !== -1 && pathParts[dashIdx + 1]) {
            return pathParts[dashIdx + 1];
        }
        // Fallback: penúltimo segmento da URL
        return pathParts.filter(Boolean).slice(-2, -1)[0] || '';
    }

    async function checkServerHealth(baseUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            const resp = await fetch(`${baseUrl}/api/v1/health`, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return resp.ok;
        } catch (e) {
            return false;
        }
    }

    async function fetchOnlineReportData(baseUrl, slug) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const resp = await fetch(`${baseUrl}/api/v1/dashboard/${slug}/data`, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!resp.ok) return null;
            return await resp.json();
        } catch (e) {
            return null;
        }
    }

    function createServerStatusBadge(isOnline, totalRecords, updatedAt) {
        const headerContainer = document.querySelector('header .flex.items-center.gap-3.justify-end, header .flex.items-center.justify-end, .header-glass div:last-child');
        if (!headerContainer) return;

        let badge = document.getElementById('mapfy-server-live-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'mapfy-server-live-badge';
            badge.className = 'cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition shadow-sm';
            badge.title = 'Clique para configurar o endereço do Servidor MapFy 24/7';
            badge.addEventListener('click', promptConfigureApiUrl);
            headerContainer.insertBefore(badge, headerContainer.firstChild);
        }

        if (isOnline) {
            badge.className = 'cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 transition shadow-sm';
            badge.innerHTML = `
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Base Online 24/7</span>
            `;
        } else {
            badge.className = 'cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition shadow-sm';
            badge.innerHTML = `
                <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Base Local (Cache)</span>
            `;
        }
    }

    function promptConfigureApiUrl() {
        const current = localStorage.getItem('mapfy_api_url') || DEFAULT_API_URL;
        const input = window.prompt(
            'Configurar endereço do Servidor MapFy 24/7:\n(Ex: http://192.168.1.100:8000 ou https://seu-tunnel.cloudflare.com)',
            current
        );
        if (input !== null) {
            const cleaned = input.trim().replace(/\/+$/, '');
            if (cleaned) {
                localStorage.setItem('mapfy_api_url', cleaned);
                window.location.reload();
            } else {
                localStorage.removeItem('mapfy_api_url');
                window.location.reload();
            }
        }
    }

    async function initOnlineSync() {
        const slug = detectReportSlug();
        if (!slug) return;

        const apiUrl = localStorage.getItem('mapfy_api_url') || DEFAULT_API_URL;
        const isOnline = await checkServerHealth(apiUrl);

        if (!isOnline) {
            createServerStatusBadge(false);
            return;
        }

        const dataPayload = await fetchOnlineReportData(apiUrl, slug);
        if (dataPayload && dataPayload.status === 'ok' && Array.isArray(dataPayload.records)) {
            createServerStatusBadge(true, dataPayload.total_records, dataPayload.updated_at);

            // Atualiza estado do Dashboard se compatível
            const st = window.dashboardState || window.state;
            if (st) {
                const currentArr = Array.isArray(st.allRecords) ? st.allRecords : (Array.isArray(st.rawRecords) ? st.rawRecords : []);
                const incomingArr = dataPayload.records;
                
                let isCompatible = true;
                if (currentArr.length > 0 && incomingArr.length > 0) {
                    const curSample = currentArr[0];
                    const incSample = incomingArr[0];
                    // Se o estado atual usa 'id' minúsculo e os dados recebidos têm apenas 'ID' maiúsculo sem 'id', rejeita para não quebrar referências
                    if ('id' in curSample && !('id' in incSample) && ('ID' in incSample)) {
                        console.warn('[Mapfy API] Formato recebido não normalizado. Preservando dataset estruturado.');
                        isCompatible = false;
                    }
                }

                if (isCompatible) {
                    if (Array.isArray(st.allRecords) && dataPayload.records.length > 0) {
                        st.allRecords = dataPayload.records;
                        if (typeof window.aplicarFiltros === 'function') {
                            window.aplicarFiltros();
                        }
                    } else if (Array.isArray(st.rawRecords) && dataPayload.records.length > 0) {
                        st.rawRecords = dataPayload.records;
                        if (typeof window.applyFiltersAndRender === 'function') {
                            window.applyFiltersAndRender();
                        }
                    }
                }
            }
        } else {
            createServerStatusBadge(true);
        }
    }

    // Inicializa verificação em background sem travar a renderização
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initOnlineSync, 600));
    } else {
        setTimeout(initOnlineSync, 600);
    }

    window.MapfyApiConnector = {
        checkServerHealth,
        fetchOnlineReportData,
        initOnlineSync
    };
})();
