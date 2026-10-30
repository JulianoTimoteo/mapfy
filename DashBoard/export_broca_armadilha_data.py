# -*- coding: utf-8 -*-
"""
export_broca_armadilha_data.py
Processamento e exportação da base real de Infestação de Broca - Armadilha (MapFy)
Usina Pitangueiras - Safra 2026
"""

import json
import os
import re
from datetime import datetime

# Localizar dinamicamente a pasta de origem
base_relatorios = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "Server_MapFy", "relatorios"
)

folder_name = None
for d in os.listdir(base_relatorios):
    if "broca" in d.lower():
        folder_name = d
        break

if not folder_name:
    raise FileNotFoundError("Pasta de Infestação de Broca não encontrada em Server_MapFy/relatorios")

SOURCE_JSON = os.path.join(base_relatorios, folder_name, "dados.json")

DEST_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "broca_armadilha"
)
DEST_JS = os.path.join(DEST_DIR, "js", "data.js")

def parse_responsavel(raw_resp):
    raw_str = (raw_resp or "").strip()
    # Se possui padrão "284860  - Juliana Aparecida...", extrai matrícula e nome limpo
    match = re.match(r"^(\d+)\s*-\s*(.+)$", raw_str)
    if match:
        matricula = match.group(1).strip()
        nome = match.group(2).strip()
        return {
            "orig": raw_str,
            "matricula": matricula,
            "nome_curto": nome,
            "display": f"{matricula} - {nome}"
        }
    else:
        return {
            "orig": raw_str,
            "matricula": None,
            "nome_curto": raw_str,
            "display": raw_str
        }

def parse_local(raw_local):
    raw_str = (raw_local or "").strip()
    fazenda = "N/I"
    talhao = "N/I"
    
    if ">" in raw_str:
        parts = raw_str.split(">")
        fazenda = parts[0].strip()
        talhao = parts[1].strip()
    elif "-" in raw_str:
        parts = raw_str.split("-")
        fazenda = parts[0].strip()
        talhao = parts[1].strip()
    else:
        fazenda = raw_str
        talhao = "0"
        
    return {
        "orig": raw_str,
        "fazenda": fazenda,
        "talhao": talhao,
        "display": f"Fazenda {fazenda} > Talhão {talhao}"
    }

def main():
    print(f"Lendo fonte real: {SOURCE_JSON}")
    with open(SOURCE_JSON, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
        
    print(f"Total de registros lidos: {len(raw_data)}")
    
    clean_records = []
    
    for r in raw_data:
        rec_id = int(r["ID"])
        usuario = str(r.get("Usuário", "")).strip()
        data_str = str(r.get("Data", "")).strip()
        data_ini_str = str(r.get("Data início", "")).strip()
        data_fim_str = str(r.get("Data Fim", "")).strip()
        
        # Datas e Durações
        try:
            dt = datetime.strptime(data_str, "%d/%m/%Y %H:%M")
            data_iso = dt.strftime("%Y-%m-%d %H:%M")
            data_dia = dt.strftime("%d/%m/%Y")
            hora = dt.strftime("%H:%M")
        except:
            data_iso = data_str
            data_dia = data_str[:10]
            hora = "00:00"
            
        try:
            dt_ini = datetime.strptime(data_ini_str, "%d/%m/%Y %H:%M")
            dt_fim = datetime.strptime(data_fim_str, "%d/%m/%Y %H:%M")
            duracao_min = max(0.0, round((dt_fim - dt_ini).total_seconds() / 60.0, 1))
        except:
            duracao_min = 0.0
            
        # Coordenadas GPS
        lat_str = str(r.get("Latitude", "")).replace(",", ".").strip()
        lon_str = str(r.get("Longitude", "")).replace(",", ".").strip()
        try:
            lat = round(float(lat_str), 6)
            lon = round(float(lon_str), 6)
            has_coords = True
        except:
            lat = 0.0
            lon = 0.0
            has_coords = False
            
        status = str(r.get("Status", "Aberto")).strip()
        score = str(r.get("Score", "0,00")).strip()
        
        # Etapa: INSTALAÇÃO vs RECOLHIMENTO
        etapa_orig = str(r.get("Etapa", "")).strip().upper()
        if "INSTAL" in etapa_orig:
            etapa = "INSTALAÇÃO"
            is_instalacao = True
            is_recolhimento = False
        else:
            etapa = "RECOLHIMENTO"
            is_instalacao = False
            is_recolhimento = True
            
        # Responsável Lançamento
        resp_info = parse_responsavel(r.get("Responsável Lançamento"))
        
        # Local (Fazenda - Talhão)
        local_info = parse_local(r.get("Fazenda - Talhão"))
        
        # Quantidade Machos
        machos_raw = str(r.get("Quantidade Machos", "0")).strip()
        try:
            machos_num = int(float(machos_raw.replace(",", ".")))
        except:
            machos_num = 0
            
        is_zerado = (machos_num == 0)
        is_positivo = (machos_num > 0)
        
        # Classificação de Gravidade / Faixa de Captura
        if is_instalacao:
            faixa_captura = "Armadilha Instalada (Ciclo Iniciado)"
            cor_marcador = "#10B981" # Verde
        elif machos_num == 0:
            faixa_captura = "Zero Capturas (Negativo)"
            cor_marcador = "#06B6D4" # Ciano
        elif machos_num <= 10:
            faixa_captura = "Baixa Captura (1 a 10)"
            cor_marcador = "#EAB308" # Amarelo
        elif machos_num <= 25:
            faixa_captura = "Média Captura (11 a 25)"
            cor_marcador = "#F59E0B" # Laranja
        else:
            faixa_captura = "Alta Captura / Foco Crítico (> 25)"
            cor_marcador = "#EF4444" # Vermelho
            
        clean_records.append({
            "id": rec_id,
            "usuario": usuario,
            "data": data_str,
            "data_iso": data_iso,
            "data_dia": data_dia,
            "hora": hora,
            "duracao_min": duracao_min,
            "lat": lat,
            "lon": lon,
            "has_coords": has_coords,
            "status": status,
            "score": score,
            "etapa": etapa,
            "is_instalacao": is_instalacao,
            "is_recolhimento": is_recolhimento,
            "responsavel_orig": resp_info["orig"],
            "responsavel_nome": resp_info["nome_curto"],
            "responsavel_matricula": resp_info["matricula"],
            "responsavel_display": resp_info["display"],
            "local_orig": local_info["orig"],
            "fazenda": local_info["fazenda"],
            "talhao": local_info["talhao"],
            "local_display": local_info["display"],
            "machos": machos_num,
            "capturas": machos_num,
            "brocas": machos_num,
            "is_zerado": is_zerado,
            "is_positivo": is_positivo,
            "faixa_captura": faixa_captura,
            "cor_marcador": cor_marcador
        })

    # Ordenação decrescente por data/ID
    clean_records.sort(key=lambda x: (x["data_iso"], x["id"]), reverse=True)
    
    os.makedirs(os.path.dirname(DEST_JS), exist_ok=True)
    with open(DEST_JS, "w", encoding="utf-8") as f:
        f.write("// Dataset gerado automaticamente a partir de dados reais do MapFy\n")
        f.write("// Fonte: Server_MapFy/relatorios/Infestação de Broca - Armadilha\n")
        f.write(f"// Total de Registros: {len(clean_records)} | Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
        f.write("window.BROCA_ARMADILHA_DATA = ")
        json.dump(clean_records, f, ensure_ascii=False, indent=2)
        f.write(";\n")
        
    print(f"Exportação concluída com sucesso em: {DEST_JS}")
    print(f"Tamanho gerado: {os.path.getsize(DEST_JS) / 1024:.1f} KB")

if __name__ == "__main__":
    main()
