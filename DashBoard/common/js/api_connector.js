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

    const LIVE_DATA_URL = window.MAPFY_LIVE_DATA_URL || new URL('../live_data/', window.location.href).href;

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

    async function fetchOnlineReportData(baseUrl, slug) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        try {
            const resp = await fetch(
                `${baseUrl}${encodeURIComponent(slug)}.json?t=${Date.now()}`,
                {
                    method: 'GET',
                    signal: controller.signal,
                    cache: 'no-store'
                }
            );
            if (!resp.ok) return null;
            return await resp.json();
        } catch (e) {
            return null;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    function createServerStatusBadge(isOnline, totalRecords, updatedAt) {
        // Remove quaisquer barras legadas antigas para evitar elementos gigantes
        const oldBadges = document.querySelectorAll('#server-live-status-badge, #mapfy-server-live-badge');
        oldBadges.forEach(b => b.remove());

        // Atualiza o widget 24/7 circular compacto fixado no cantinho esquerdo
        const badge247 = document.getElementById('badgeStatus247');
        const dot247 = document.getElementById('badge247Dot');
        const ring247 = document.getElementById('badge247ProgressRing');

        if (badge247) {
            if (isOnline) {
                badge247.title = 'Dados publicados no GitHub Pages pelo servidor MapFy.';
                if (dot247) {
                    dot247.style.backgroundColor = '#10b981';
                    dot247.style.boxShadow = '0 0 6px #10b981';
                }
                if (ring247) {
                    ring247.style.stroke = '#10b981';
                }
            } else {
                badge247.title = 'Mostrando os dados integrados ao Dashboard; a última publicação não está disponível.';
                if (dot247) {
                    dot247.style.backgroundColor = '#f59e0b';
                    dot247.style.boxShadow = '0 0 6px #f59e0b';
                }
                if (ring247) {
                    ring247.style.stroke = '#f59e0b';
                }
            }
        }
    }

    async function initOnlineSync() {
        const slug = detectReportSlug();
        if (!slug) return;

        const dataPayload = await fetchOnlineReportData(LIVE_DATA_URL, slug);
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
            createServerStatusBadge(false);
        }
    }

    // Inicializa verificação em background sem travar a renderização
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initOnlineSync, 600));
    } else {
        setTimeout(initOnlineSync, 600);
    }

    window.MapfyApiConnector = {
        fetchOnlineReportData,
        initOnlineSync
    };
})();
