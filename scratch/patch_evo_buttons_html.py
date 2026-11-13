import os
import re

targets = ['sulcacao', 'abertura_asa', 'paralelismo', 'dosagem_sulco']

btn_sync_html = """                        <div class="flex items-center gap-2 flex-wrap">
                            <!-- Botão de Sincronização com Filtro Global do Topo -->
                            <button type="button" id="btnSyncGlobalFilter" class="px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-emerald-600 text-white border-emerald-500 shadow-sm" title="Quando ativo, este gráfico e as análises obedecem ao Filtro Principal do topo. Clique para alternar para modo autônomo.">
                                <span id="syncIcon">🔒</span>
                                <span id="syncText">Filtro Global Ativo</span>
                            </button>

                            <!-- Botões de Período Local: Todos, 15D, 7D (Padrão 7D) -->
                            <div id="evoPeriodControls" class="inline-flex p-0.5 rounded-lg border text-xs font-semibold shadow-xs" style="background: var(--bg-kpi); border-color: var(--border-color);">
                                <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-slate-700 dark:text-white hover:text-emerald-500 opacity-40 cursor-not-allowed pointer-events-none" data-evo-range="ALL" disabled title="Exibir todo o histórico da safra">Todos</button>
                                <button type="button" class="btn-evo-filter px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-slate-700 dark:text-white hover:text-emerald-500 opacity-40 cursor-not-allowed pointer-events-none" data-evo-range="15D" disabled title="Últimos 15 dias com medições">15D</button>
                                <button type="button" class="btn-evo-filter active px-2.5 py-1 rounded-md text-[11px] font-bold transition-all text-white bg-emerald-600 shadow-xs opacity-40 cursor-not-allowed pointer-events-none" data-evo-range="7D" disabled title="Últimos 7 dias com medições (Padrão)">7D</button>
                            </div>
                        </div>"""

for t in targets:
    html_file = f'DashBoard/{t}/index.html'
    with open(html_file, 'r', encoding='utf-8') as f:
        html = f.read()

    # Substituir o container com btn-evo-filter
    html = re.sub(
        r'<div class="inline-flex[^>]*style="background:\s*var\(--bg-kpi\)[^"]*"[^>]*>[\s\S]*?btn-evo-filter[\s\S]*?</div>',
        btn_sync_html,
        html,
        count=1
    )

    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"Substituído com sucesso em: {t}")
