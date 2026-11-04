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

            // 1. Prioridade: recarga dedicada do Dashboard
            if (typeof window.reloadDashboardData === 'function') {
                try {
                    window.reloadDashboardData(dataPayload.records);
                    console.log('[Mapfy API] Dados sincronizados via reloadDashboardData:', dataPayload.records.length);
                    return;
                } catch (e) {
                    console.warn('[Mapfy API] Falha ao recarregar via reloadDashboardData:', e);
                }
            }

            // 2. Normalização automática via Engine do relatório
            let normalizedRecords = dataPayload.records;
            const engine = window.ComplianceEngine || window.SubsolagemEngine || window.CanteirizacaoEngine || 
                           window.SulcacaoEngine || window.DosagemEngine || window.AberturaAsaEngine || 
                           window.ParalelismoEngine;
            
            if (engine && typeof engine.normalizeRecord === 'function') {
                try {
                    normalizedRecords = dataPayload.records.map(engine.normalizeRecord);
                } catch (e) {
                    console.warn('[Mapfy API] Erro ao normalizar dados com engine:', e);
                }
            }

            // 3. Atualiza estado do Dashboard se compatível
            const st = window.dashboardState || window.state;
            if (st) {
                if (Array.isArray(st.allRecords) && normalizedRecords.length > 0) {
                    st.allRecords = normalizedRecords;
                }
                if (Array.isArray(st.rawRecords) && dataPayload.records.length > 0) {
                    st.rawRecords = dataPayload.records;
                }

                // Recalcula maxAvailableDate se possível
                if (Array.isArray(st.allRecords) && st.allRecords.length > 0) {
                    let maxRecord = null;
                    st.allRecords.forEach(r => {
                        const dt = r.dataParsed || (r.data_iso ? new Date(r.data_iso) : null);
                        if (dt && (!maxRecord || dt > maxRecord.dt)) {
                            maxRecord = { dt, r };
                        }
                    });
                    if (maxRecord && maxRecord.r) {
                        if (maxRecord.r.dataBR) st.maxAvailableDateBR = maxRecord.r.dataBR;
                        if (maxRecord.r.isoDate) st.maxAvailableDateISO = maxRecord.r.isoDate;
                    }
                }

                if (typeof window.aplicarFiltros === 'function') {
                    window.aplicarFiltros();
                } else if (typeof window.applyFilters === 'function') {
                    window.applyFilters();
                } else if (typeof window.applyFiltersAndRender === 'function') {
                    window.applyFiltersAndRender();
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

    // Revalidação automática quando o usuário volta para o app no celular
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            initOnlineSync();
        }
    });
    window.addEventListener('focus', () => {
        initOnlineSync();
    });

    window.MapfyApiConnector = {
        fetchOnlineReportData,
        initOnlineSync
    };
})();
