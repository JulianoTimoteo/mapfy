import json, os, re
from datetime import datetime

input_json = "Server_MapFy/relatorios/CHECK LIST VEICULAR/dados.json"
output_dir = "DashBoard/checklist_veicular/js"
output_js = os.path.join(output_dir, "data.js")

os.makedirs(output_dir, exist_ok=True)

with open(input_json, "r", encoding="utf-8") as f:
    raw_data = json.load(f)

print(f"Lendo {len(raw_data)} registros brutos de CHECK LIST VEICULAR...")

normalized_records = []

# Mapeamento oficial dos 17 componentes encontrados
COMPONENT_CATEGORIES = {
    "Luz de Placa": "Iluminação e Sinalização",
    "Luz Baixa": "Iluminação e Sinalização",
    "Lanterna": "Iluminação e Sinalização",
    "Luz de Ré": "Iluminação e Sinalização",
    "Luz de Freio": "Iluminação e Sinalização",
    "Luz Alta": "Iluminação e Sinalização",
    "Para-choque Dianteiro": "Carroceria e Estrutura",
    "Para-choque Traseiro": "Carroceria e Estrutura",
    "Portas": "Carroceria e Estrutura",
    "Esguicho": "Visibilidade e Vidros",
    "Limpador de Para-brisa": "Visibilidade e Vidros",
    "Acionador de Vidros": "Visibilidade e Vidros",
    "Ar-Condicionado": "Climatização e Conforto",
    "Estado dos Bancos": "Climatização e Conforto",
    "Macaco /Chave de Roda": "Segurança e Emergência",
    "Macaco / Chave de Roda": "Segurança e Emergência",
    "Triângulo": "Segurança e Emergência",
    "Sistema de Suspensão": "Segurança e Emergência"
}

def parse_date_br(d_str):
    if not d_str or str(d_str).strip() in ("", "None"):
        return None
    d_clean = str(d_str).strip()
    # Padrão: DD/MM/AAAA HH:MM ou DD/MM/AAAA
    try:
        if len(d_clean) >= 16:
            return datetime.strptime(d_clean[:16], "%d/%m/%Y %H:%M")
        elif len(d_clean) >= 10:
            return datetime.strptime(d_clean[:10], "%d/%m/%Y")
    except:
        pass
    return None

for r in raw_data:
    rec_id = str(r.get("ID", "")).strip()
    usuario = str(r.get("Usuário", "")).strip()
    data_str = str(r.get("Data", "")).strip()
    data_inicio_str = str(r.get("Data início", "")).strip()
    data_fim_str = str(r.get("Data Fim", "")).strip()
    status = str(r.get("Status", "Aberto")).strip()
    score_raw = str(r.get("Score", "0,00")).strip()
    frota_raw = str(r.get("Frota", "")).strip()
    gestor = str(r.get("GESTORES", "")).strip()
    condutor = str(r.get("Condutor", "")).strip()
    data_hora_str = str(r.get("Data Hora", "")).strip()
    video_raw = str(r.get("VIDEOTELEMTRIA", "NÃO")).strip()
    itens_raw = r.get("Itens Danificados")
    criticidade_raw = str(r.get("Estado de Criticidade Veículo", "")).strip()
    obs_raw = str(r.get("Observacoes", "")).strip()
    id_colab = str(r.get("ID COLABORADOR", "")).strip()
    id_aval = str(r.get("ID DO AVALIADOR(A)", "")).strip()
    
    # Tratamento da chave com espaço 'Abrir Os '
    abrir_os_raw = str(r.get("Abrir Os ", r.get("Abrir Os", "NÃO"))).strip()
    if not abrir_os_raw or abrir_os_raw == "None":
        abrir_os_raw = "NÃO"
    os_num_raw = str(r.get("Os", "")).strip()
    if os_num_raw == "None":
        os_num_raw = ""

    # Coordenadas
    try:
        lat = float(str(r.get("Latitude", "0")).replace(",", "."))
        lon = float(str(r.get("Longitude", "0")).replace(",", "."))
    except:
        lat, lon = -21.047, -48.265

    # Parser da Frota
    frota_codigo = ""
    frota_modelo = ""
    frota_placa = ""
    frota_tipo = "PRÓPRIO"
    frota_identificacao_obs = False

    if frota_raw and frota_raw != "None":
        m = re.match(r'^(\d+)\s*-\s*([^(\n]+?)(?:\s*-\s*([^(\n]+?))?(?:\(([^)]+)\))?$', frota_raw)
        if m:
            frota_codigo = m.group(1).strip()
            p1 = m.group(2).strip() if m.group(2) else ""
            p2 = m.group(3).strip() if m.group(3) else ""
            frota_placa = m.group(4).strip() if m.group(4) else ""
            if "ALUGAD" in frota_raw.upper():
                frota_tipo = "ALUGADO"
            frota_modelo = f"{p1} {p2}".replace("ALUGADO", "").replace("ALUGADA", "").strip(" -")
        else:
            parts = frota_raw.split("-")
            frota_codigo = parts[0].strip() if parts else frota_raw
            frota_modelo = frota_raw
            if "ALUGAD" in frota_raw.upper():
                frota_tipo = "ALUGADO"
    else:
        # Investigar menção na observação (ex: Frota: 469026)
        m_obs = re.search(r'frota[:\s]+([0-9]{5,7})', obs_raw, re.IGNORECASE)
        if m_obs:
            frota_codigo = m_obs.group(1).strip()
            frota_modelo = f"Frota {frota_codigo} (Identificado em Observação)"
            frota_identificacao_obs = True
            frota_tipo = "PENDENTE_CONFIRMAÇÃO"
        else:
            frota_codigo = "NÃO_IDENTIFICADA"
            frota_modelo = "Veículo Sem Identificação de Frota"
            frota_tipo = "NÃO_INFORMADO"

    # Parser da Criticidade
    criticidade_norm = "Leve"
    if "moderado" in criticidade_raw.lower():
        criticidade_norm = "Moderado"
    elif "grave" in criticidade_raw.lower() or "alto" in criticidade_raw.lower():
        criticidade_norm = "Grave"
    elif not criticidade_raw or criticidade_raw == "None":
        criticidade_norm = "Não Classificado"

    # Parser de Itens Danificados
    componentes_list = []
    if itens_raw and str(itens_raw).strip() and str(itens_raw).strip() != "None":
        parts = [p.strip() for p in str(itens_raw).split(",") if p.strip()]
        for p in parts:
            m_comp = re.match(r'^(\d+)\.\s*(.+)$', p)
            if m_comp:
                c_code, c_name = m_comp.group(1), m_comp.group(2).strip()
            else:
                c_code, c_name = "", p
            cat = COMPONENT_CATEGORIES.get(c_name, "Outros Componentes")
            componentes_list.append({
                "codigo": c_code,
                "nome": c_name,
                "categoria": cat,
                "raw": p
            })

    # Parser de Videotelemetria
    tem_video = "SIM" if video_raw.upper() == "SIM" else "NÃO"

    # Parser de OS
    tem_abrir_os = "SIM" if abrir_os_raw.upper() == "SIM" else "NÃO"
    tem_os_numero = bool(os_num_raw and os_num_raw != "None")
    
    # Classificação analítica de Manutenção / OS
    if tem_abrir_os == "SIM" and tem_os_numero:
        status_os_cat = "OS Aberta (Com Número)"
    elif tem_abrir_os == "SIM" and not tem_os_numero:
        status_os_cat = "Solicitada Abertura (Sem Número)"
    elif tem_abrir_os == "NÃO" and tem_os_numero:
        status_os_cat = "OS Informada Direta"
    else:
        status_os_cat = "Sem Solicitação de OS"

    # Datas e Durações
    dt_lancamento = parse_date_br(data_str)
    dt_inicio = parse_date_br(data_inicio_str)
    dt_fim = parse_date_br(data_fim_str)
    
    duracao_min = 0
    if dt_inicio and dt_fim:
        duracao_min = round((dt_fim - dt_inicio).total_seconds() / 60.0, 1)

    # Classificação textual da Observação
    obs_lower = obs_raw.lower()
    obs_sem_avaria = any(w in obs_lower for w in ["sem avaria", "sem a avaria", "sem avarias", "sem avai"])
    
    # Inconsistências / Pontos de Auditoria
    inconsistencias = []
    if frota_identificacao_obs:
        inconsistencias.append("Frota vazia na origem preenchida via Observação")
    if frota_codigo == "NÃO_IDENTIFICADA":
        inconsistencias.append("Veículo sem código de frota")
    if len(componentes_list) > 0 and obs_sem_avaria:
        inconsistencias.append("Contradição: Componente Danificado listado, mas Observação informa Sem Avaria")
    if len(componentes_list) == 0 and not obs_sem_avaria and obs_raw and obs_raw != "None":
        inconsistencias.append("Atenção: Sem item danificado oficial, mas Observação descreve problema")
    if criticidade_norm == "Moderado" and len(componentes_list) == 0 and obs_sem_avaria:
        inconsistencias.append("Criticidade Moderada sem danos declarados")
    if tem_abrir_os == "SIM" and not tem_os_numero:
        inconsistencias.append("Abrir OS = SIM porém número da OS não informado")
    if duracao_min < 0:
        inconsistencias.append("Duração da inspeção negativa (Data Fim anterior à Data Início)")
    if duracao_min > 180:
        inconsistencias.append("Duração da inspeção atipicamente longa (> 3 horas)")

    item_rec = {
        "id": rec_id,
        "usuario": usuario,
        "data": data_str,
        "data_iso": dt_lancamento.strftime("%Y-%m-%d %H:%M") if dt_lancamento else "",
        "data_dia": dt_lancamento.strftime("%d/%m/%Y") if dt_lancamento else "",
        "data_inicio": data_inicio_str,
        "data_fim": data_fim_str,
        "duracao_min": duracao_min,
        "status": status,
        "score": score_raw,
        "frota_raw": frota_raw,
        "frota_codigo": frota_codigo,
        "frota_modelo": frota_modelo,
        "frota_placa": frota_placa,
        "frota_tipo": frota_tipo,
        "frota_identificacao_obs": frota_identificacao_obs,
        "gestor": gestor if gestor and gestor != "None" else "NÃO INFORMADO",
        "condutor": condutor if condutor and condutor != "None" else "NÃO INFORMADO",
        "id_colaborador": id_colab if id_colab and id_colab != "None" else "",
        "id_avaliador": id_aval if id_aval and id_aval != "None" else "",
        "videotelemetria": tem_video,
        "criticidade_raw": criticidade_raw,
        "criticidade": criticidade_norm,
        "itens_danificados_raw": str(itens_raw) if itens_raw else "",
        "componentes": componentes_list,
        "qtd_componentes": len(componentes_list),
        "tem_avaria": len(componentes_list) > 0 or (not obs_sem_avaria and bool(obs_raw) and obs_raw != "None"),
        "observacoes": obs_raw if obs_raw and obs_raw != "None" else "",
        "obs_sem_avaria": obs_sem_avaria,
        "abrir_os": tem_abrir_os,
        "os_numero": os_num_raw,
        "status_os": status_os_cat,
        "lat": lat,
        "lon": lon,
        "inconsistencias": inconsistencias,
        "tem_inconsistencia": len(inconsistencias) > 0
    }
    normalized_records.append(item_rec)

# Salvar em data.js
js_content = f"/**\n * Dados Consolidados da Gestão de Frota e Inspeção Veicular\n * Usina Pitangueiras • Safra 2026\n * Total de Registros: {len(normalized_records)}\n */\nconst CHECKLIST_DATA = {json.dumps(normalized_records, ensure_ascii=False, indent=2)};\n"

with open(output_js, "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"Sucesso: {len(normalized_records)} registros normalizados e exportados para {output_js}!")
