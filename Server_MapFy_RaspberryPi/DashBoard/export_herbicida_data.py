# -*- coding: utf-8 -*-
"""
export_herbicida_data.py
Processamento e exportação da base real de Tratos - Herbicida (MapFy)
Usina Pitangueiras - Safra 2026
"""

import json
import math
import re
import os
from datetime import datetime

SOURCE_JSON = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "Server_MapFy", "relatorios", "Tratos - Herbicida", "dados.json"
)

DEST_JS = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "herbicida", "js", "data.js"
)

def calculate_wet_bulb(t, rh):
    """Fórmula de Stull (2011) para temperatura de bulbo úmido (°C)."""
    tw = (t * math.atan(0.151977 * math.sqrt(rh + 8.313659))
          + math.atan(t + rh)
          - math.atan(rh - 1.676331)
          + 0.00391838 * (rh ** 1.5) * math.atan(0.023101 * rh)
          - 4.686035)
    return tw

def calculate_delta_t(t, rh):
    """Cálculo do Delta T: T_seca - T_bulbo_úmido (°C)."""
    tw = calculate_wet_bulb(t, rh)
    return t - tw

def extract_equipment(obs):
    """Identifica referências a tratores, caminhões e equipamentos nas observações."""
    obs_lower = obs.lower()
    equipments = []
    
    # Trator 11225
    if "11225" in obs_lower:
        equipments.append({"tipo": "Trator", "id": "11225", "nome": "Trator 11225"})
    # Trator 11125
    if "11125" in obs_lower:
        equipments.append({"tipo": "Trator", "id": "11125", "nome": "Trator 11125"})
    # Equipamento 70122
    if "70122" in obs_lower:
        equipments.append({"tipo": "Equipamento", "id": "70122", "nome": "Equipamento 70122"})
    # Caminhão 31817
    if "31817" in obs_lower:
        equipments.append({"tipo": "Caminhão", "id": "31817", "nome": "Caminhão de Calda 31817"})
        
    return equipments

def classify_occurrence(obs, r):
    """Classifica semanticamente as observações operacionais e campos de inspeção."""
    obs_clean = (obs or "").strip()
    obs_lower = obs_clean.lower()
    
    categories = []
    tags = []
    
    # Clima / Interrupção
    is_clima = False
    if any(k in obs_lower for k in ["clima", "climática", "climáticas", "temperatura alta", "umidade baixa", "vento", "delta t", "amarela na tabela", "fora da tabela"]):
        is_clima = True
        categories.append("Condições Climáticas")
        tags.append("Alerta Climático")
        
    is_parada_clima = False
    if "parada devido" in obs_lower or "parar a operação" in obs_lower or "não havia sido iniciada" in obs_lower or "orientado a parar" in obs_lower or "não realizar a operação" in obs_lower or "não dar continuidade" in obs_lower:
        is_parada_clima = True
        tags.append("Operação Parada/Orientada")
        
    # Vazamentos
    is_vazamento = False
    if "vazamento" in obs_lower or "vazam" in obs_lower or "desperdício" in obs_lower:
        is_vazamento = True
        categories.append("Vazamentos")
        tags.append("Vazamento Identificado")
        
    # Problemas em Bicos e Barra
    is_problema_bico = False
    if "bico" in obs_lower or "bicos" in obs_lower or "vedação" in obs_lower or "barra traseira" in obs_lower:
        if any(k in obs_lower for k in ["danificado", "vazam", "vazamento", "falta", "borracha", "não esta saindo", "arrumar bico"]):
            is_problema_bico = True
            categories.append("Problema no Sistema de Aplicação")
            tags.append("Bico/Barra Danificado")
            
    # Vazamento Hidráulico
    if "hidráulico" in obs_lower:
        tags.append("Vazamento Hidráulico")
        
    # Ações Corretivas / Manutenção
    has_acao = False
    if "plano de ação" in obs_lower or "reparo foi realizado" in obs_lower:
        has_acao = True
        tags.append("Reparo Concluído")
    elif "oficina" in obs_lower:
        has_acao = True
        tags.append("Oficina Acionada")
    elif "orientado" in obs_lower or "orientada" in obs_lower:
        has_acao = True
        tags.append("Operador Orientado")
    elif "compra" in obs_lower and "não foi feito" in obs_lower:
        has_acao = True
        tags.append("Compra Pendente")

    # Status NOK estruturados
    filtro_nok = str(r.get("Limpeza de filtros da bomba do implemento ", "")).strip().upper() == "NOK"
    bico_nok = str(r.get("Limpeza de bicos", "")).strip().upper() == "NOK"
    mapa_nok = str(r.get("O responsável possui a Ordem de Serviço e o Mapa da Área disponíveis na frente?", "")).strip().upper() == "NOK"

    if filtro_nok:
        categories.append("Manutenção de Filtros")
        tags.append("Filtro Bomba NOK")
    if bico_nok:
        categories.append("Manutenção de Bicos")
        tags.append("Limpeza Bicos NOK")
    if mapa_nok:
        categories.append("Conformidade Operacional")
        tags.append("OS/Mapa Ausente")
        
    if not categories and not tags:
        if obs_clean:
            categories.append("Outras Observações")
            tags.append("Nota Operacional")
        else:
            categories.append("Sem Ocorrências")
            tags.append("Conforme")

    return {
        "categorias": list(set(categories)),
        "tags": list(set(tags)),
        "is_clima": is_clima,
        "is_parada_clima": is_parada_clima,
        "is_vazamento": is_vazamento,
        "is_problema_bico": is_problema_bico,
        "has_acao": has_acao,
        "tem_ocorrencia": bool(is_clima or is_vazamento or is_problema_bico or filtro_nok or bico_nok or mapa_nok or is_parada_clima)
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
            
        # Coordenadas
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
        fazenda = str(r.get("Fazenda", "")).strip()
        os_str = str(r.get("Ordem de Serviço", "")).strip()
        operacao = str(r.get("Operação", "")).strip()
        planta_soca = str(r.get("Planta ou Soca", "")).strip()
        if planta_soca in ["None", "", "null"]:
            planta_soca = "Não Informado"
            
        aval_previa = str(r.get("O responsável realizou a avaliação de qualidade antes de iniciar a operação?", "OK")).strip()
        mapa_os = str(r.get("O responsável possui a Ordem de Serviço e o Mapa da Área disponíveis na frente?", "OK")).strip()
        
        # Meteorologia
        vento_raw = str(r.get("Vento", "")).strip()
        ur_raw = str(r.get("Umidade Relativa", "")).strip()
        temp_raw = str(r.get("Temperatura ", "")).strip()
        
        has_weather = False
        vento_num = None
        ur_num = None
        temp_num = None
        tw_num = None
        delta_t_num = None
        delta_t_classe = "Sem Telemetria Estruturada"
        
        try:
            if vento_raw and vento_raw not in ["None", "null", ""] and \
               ur_raw and ur_raw not in ["None", "null", ""] and \
               temp_raw and temp_raw not in ["None", "null", ""]:
                
                vento_num = round(float(vento_raw.replace(",", ".")), 1)
                ur_num = round(float(ur_raw.replace(",", ".")), 1)
                temp_num = round(float(temp_raw.replace(",", ".")), 1)
                
                tw = calculate_wet_bulb(temp_num, ur_num)
                dt_val = temp_num - tw
                tw_num = round(tw, 2)
                delta_t_num = round(dt_val, 2)
                has_weather = True
                
                if delta_t_num < 2.0:
                    delta_t_classe = "Inversão (< 2°C)"
                elif delta_t_num <= 8.0:
                    delta_t_classe = "Ideal (2-8°C)"
                elif delta_t_num <= 10.0:
                    delta_t_classe = "Atenção (8-10°C)"
                else:
                    delta_t_classe = "Crítico (> 10°C)"
        except Exception as e:
            has_weather = False
            
        # Regulagem e Pulverizador
        esp_raw = str(r.get("Espaçamento de Bico", "")).strip()
        if esp_raw in ["None", "null", ""]:
            esp_orig = "Não Informado"
            esp_grupo = "Não Informado"
            esp_num_cm = None
        else:
            esp_orig = esp_raw
            try:
                val_esp = float(esp_raw.replace(",", "."))
                if val_esp == 0.0:
                    esp_grupo = "Zero (Manual/Específico)"
                    esp_num_cm = 0.0
                elif val_esp < 2.0: # Metros: 0.49, 0.50, 0.51, 0.52, 1.40
                    esp_grupo = "Metros (Escala 0.49 - 1.40 m)"
                    esp_num_cm = round(val_esp * 100, 1)
                elif val_esp in [49.0, 50.0, 51.0]: # Centímetros
                    esp_grupo = "Centímetros (Escala 49 - 51 cm)"
                    esp_num_cm = val_esp
                else:
                    esp_grupo = f"Outros ({esp_raw})"
                    esp_num_cm = val_esp
            except:
                esp_grupo = "Não Padronizado"
                esp_num_cm = None
                
        leque = str(r.get("Abertura do leque", "OK")).strip()
        if leque in ["None", "null", ""]:
            leque = "Não Informado"
            
        filtro_bomba = str(r.get("Limpeza de filtros da bomba do implemento ", "OK")).strip()
        limpeza_bicos = str(r.get("Limpeza de bicos", "OK")).strip()
        
        vazao_raw = str(r.get("Vazão", "")).strip()
        if vazao_raw in ["None", "null", ""]:
            vazao_orig = "Não Informado"
            vazao_num = None
        else:
            vazao_orig = vazao_raw + " L/ha"
            try:
                vazao_num = float(vazao_raw.replace(",", "."))
            except:
                vazao_num = None
                
        obs = str(r.get("Observações", "") or "").strip()
        
        # Inteligência e Extração Semântica
        equipamentos = extract_equipment(obs)
        analise_ocorr = classify_occurrence(obs, r)
        
        # Consolidação de NOK
        is_nok_filtro = filtro_bomba.upper() == "NOK"
        is_nok_bico = limpeza_bicos.upper() == "NOK"
        is_nok_mapa = mapa_os.upper() == "NOK"
        tem_nok_estruturado = is_nok_filtro or is_nok_bico or is_nok_mapa
        
        # Determinação da cor do pino do mapa
        if analise_ocorr["is_parada_clima"] or delta_t_classe == "Crítico (> 10°C)":
            pin_color = "#EF4444" # Vermelho (Parada / Risco Crítico)
        elif is_nok_filtro or is_nok_bico or analise_ocorr["is_vazamento"] or analise_ocorr["is_problema_bico"]:
            pin_color = "#F59E0B" # Laranja / Âmbar (Problema Mecânico / Vazamento)
        elif delta_t_classe == "Atenção (8-10°C)":
            pin_color = "#EAB308" # Amarelo (Atenção Climática)
        else:
            pin_color = "#10B981" # Verde (Conforme / Aplicação Regular)
            
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
            "fazenda": fazenda,
            "os": os_str,
            "operacao": operacao,
            "planta_soca": planta_soca,
            "aval_previa": aval_previa,
            "mapa_os": mapa_os,
            "has_weather": has_weather,
            "vento": vento_raw,
            "vento_num": vento_num,
            "ur": ur_raw,
            "ur_num": ur_num,
            "temp": temp_raw,
            "temp_num": temp_num,
            "tw_num": tw_num,
            "delta_t_num": delta_t_num,
            "delta_t_classe": delta_t_classe,
            "esp_orig": esp_orig,
            "esp_grupo": esp_grupo,
            "esp_num_cm": esp_num_cm,
            "leque": leque,
            "filtro_bomba": filtro_bomba,
            "limpeza_bicos": limpeza_bicos,
            "vazao_orig": vazao_orig,
            "vazao_num": vazao_num,
            "obs": obs,
            "equipamentos": equipamentos,
            "equipamentos_nomes": [e["nome"] for e in equipamentos],
            "categorias": analise_ocorr["categorias"],
            "tags": analise_ocorr["tags"],
            "is_clima": analise_ocorr["is_clima"],
            "is_parada_clima": analise_ocorr["is_parada_clima"],
            "is_vazamento": analise_ocorr["is_vazamento"],
            "is_problema_bico": analise_ocorr["is_problema_bico"],
            "has_acao": analise_ocorr["has_acao"],
            "tem_ocorrencia": analise_ocorr["tem_ocorrencia"],
            "is_nok_filtro": is_nok_filtro,
            "is_nok_bico": is_nok_bico,
            "is_nok_mapa": is_nok_mapa,
            "tem_nok_estruturado": tem_nok_estruturado,
            "pin_color": pin_color
        })

    # Ordenação decrescente por data/ID
    clean_records.sort(key=lambda x: (x["data_iso"], x["id"]), reverse=True)
    
    os.makedirs(os.path.dirname(DEST_JS), exist_ok=True)
    with open(DEST_JS, "w", encoding="utf-8") as f:
        f.write("// Dataset gerado automaticamente a partir de dados reais do MapFy\n")
        f.write("// Fonte: Server_MapFy/relatorios/Tratos - Herbicida\n")
        f.write(f"// Total de Registros: {len(clean_records)} | Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
        f.write("window.HERBICIDA_DATA = ")
        json.dump(clean_records, f, ensure_ascii=False, indent=2)
        f.write(";\n")
        
    print(f"Exportação concluída com sucesso em: {DEST_JS}")
    print(f"Tamanho gerado: {os.path.getsize(DEST_JS) / 1024:.1f} KB")

if __name__ == "__main__":
    main()
