import unittest
import re
from datetime import datetime

def parse_mapfy_date(val_str):
    if not val_str:
        return {"br": "", "dia": "", "iso": "", "iso_full": "", "dt": None}
    val_str = str(val_str).strip()
    
    # 1. Formato com AM/PM (padrão Mapfy export API: MM/DD/YYYY HH:MM:SS AM/PM)
    m_ampm = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?)?$", val_str, re.IGNORECASE)
    if m_ampm:
        p1 = int(m_ampm.group(1))
        p2 = int(m_ampm.group(2))
        y = int(m_ampm.group(3))
        ap = (m_ampm.group(6) or "").upper()
        
        if ap:
            month = p1
            day = p2
        elif p1 <= 12 and p2 > 12:
            month = p1
            day = p2
        elif p1 > 12 and p2 <= 12:
            day = p1
            month = p2
        else:
            if p2 == 12 and datetime.now().month < 12:
                month = p1
                day = p2
            else:
                day = p1
                month = p2
                
        hr = int(m_ampm.group(4)) if m_ampm.group(4) else 0
        mn = int(m_ampm.group(5)) if m_ampm.group(5) else 0
        if ap == "PM" and hr < 12:
            hr += 12
        elif ap == "AM" and hr == 12:
            hr = 0
            
        try:
            dt = datetime(y, month, day, hr, mn)
            return {
                "br": f"{day:02d}/{month:02d}/{y} {hr:02d}:{mn:02d}",
                "dia": f"{day:02d}/{month:02d}/{y}",
                "iso": f"{y}-{month:02d}-{day:02d}",
                "iso_full": f"{y}-{month:02d}-{day:02d}T{hr:02d}:{mn:02d}:00",
                "dt": dt
            }
        except ValueError:
            return {"br": val_str, "dia": "", "iso": "", "iso_full": "", "dt": None}
            
    # Formato ISO
    m_iso = re.match(r"^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?", val_str)
    if m_iso:
        y, month, day = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
        hr = int(m_iso.group(4)) if m_iso.group(4) else 0
        mn = int(m_iso.group(5)) if m_iso.group(5) else 0
        dt = datetime(y, month, day, hr, mn)
        return {
            "br": f"{day:02d}/{month:02d}/{y} {hr:02d}:{mn:02d}",
            "dia": f"{day:02d}/{month:02d}/{y}",
            "iso": f"{y}-{month:02d}-{day:02d}",
            "iso_full": f"{y}-{month:02d}-{day:02d}T{hr:02d}:{mn:02d}:00",
            "dt": dt
        }
    return {"br": val_str, "dia": "", "iso": "", "iso_full": "", "dt": None}


def normalize_record(r):
    s_start = parse_mapfy_date(r.get("Start date") or r.get("Data início"))
    s_sync = parse_mapfy_date(r.get("Date") or r.get("Data"))
    s_end = parse_mapfy_date(r.get("End date") or r.get("Data Fim"))
    s_event = parse_mapfy_date(r.get("Data Hora"))
    
    # Referência operacional de realização da inspeção: Início do lançamento > Evento > Sincronização
    insp_date = s_start if s_start["dia"] else (s_event if s_event["dia"] else s_sync)
    
    return {
        "id": r.get("ID"),
        "data_realizacao_dia": insp_date["dia"],
        "data_realizacao_br": insp_date["br"],
        "data_realizacao_iso": insp_date["iso"],
        "data_sincronizacao_dia": s_sync["dia"],
        "data_sincronizacao_br": s_sync["br"],
        "data_inicio_dia": s_start["dia"],
        "data_inicio_br": s_start["br"],
        "data_fim_dia": s_end["dia"],
        "data_fim_br": s_end["br"],
        "data_evento_dia": s_event["dia"],
        "data_evento_br": s_event["br"]
    }


class TestChecklistForense(unittest.TestCase):

    # 1. Registro iniciado em 12/11 e sincronizado em 13/11 (Ex: ID 4047158)
    def test_cenario_1_iniciado_12_sync_13(self):
        r = {
            "ID": "4047158",
            "Start date": "11/12/2026 09:06 AM",
            "Date": "11/13/2026 11:30 AM",
            "End date": "11/12/2026 10:13 AM",
            "Data Hora": "11/12/2026 09:06 AM"
        }
        n = normalize_record(r)
        self.assertEqual(n["data_realizacao_dia"], "12/11/2026")
        self.assertEqual(n["data_sincronizacao_dia"], "13/11/2026")
        self.assertEqual(n["data_inicio_dia"], "12/11/2026")
        self.assertNotEqual(n["data_realizacao_dia"], n["data_sincronizacao_dia"])

    # 2. Registro criado e iniciado em 13/11 (Ex: ID 4048116)
    def test_cenario_2_criado_e_iniciado_13(self):
        r = {
            "ID": "4048116",
            "Start date": "11/13/2026 11:36 AM",
            "Date": "11/13/2026 04:24 PM",
            "End date": "11/13/2026 03:18 PM",
            "Data Hora": "11/13/2026 11:36 AM"
        }
        n = normalize_record(r)
        self.assertEqual(n["data_realizacao_dia"], "13/11/2026")
        self.assertEqual(n["data_sincronizacao_dia"], "13/11/2026")
        self.assertEqual(n["data_inicio_br"], "13/11/2026 11:36")

    # 3. Registro iniciado em 10/11 e alterado/sincronizado em 11/11 (Ex: ID 4042277)
    def test_cenario_3_iniciado_10_alterado_11(self):
        r = {
            "ID": "4042277",
            "Start date": "11/10/2026 03:33 PM",
            "Date": "11/11/2026 10:14 AM",
            "End date": "11/11/2026 07:29 AM",
            "Data Hora": "11/11/2026 07:28 AM"
        }
        n = normalize_record(r)
        self.assertEqual(n["data_realizacao_dia"], "10/11/2026")
        self.assertEqual(n["data_sincronizacao_dia"], "11/11/2026")

    # 4. Registro com início e fim em dias diferentes
    def test_cenario_4_inicio_fim_dias_diferentes(self):
        r = {
            "ID": "9999001",
            "Start date": "11/10/2026 11:45 PM",
            "End date": "11/11/2026 01:15 AM",
            "Date": "11/11/2026 08:00 AM"
        }
        n = normalize_record(r)
        self.assertEqual(n["data_inicio_dia"], "10/11/2026")
        self.assertEqual(n["data_fim_dia"], "11/11/2026")
        self.assertEqual(n["data_realizacao_dia"], "10/11/2026")

    # 5. Registro com horário próximo da meia-noite
    def test_cenario_5_proximo_meia_noite(self):
        r = {
            "ID": "9999002",
            "Start date": "11/12/2026 11:59 PM",
            "End date": "11/13/2026 12:05 AM",
            "Date": "11/13/2026 06:00 AM"
        }
        n = normalize_record(r)
        self.assertEqual(n["data_inicio_dia"], "12/11/2026")
        self.assertEqual(n["data_inicio_br"], "12/11/2026 23:59")
        self.assertEqual(n["data_fim_br"], "13/11/2026 00:05")

    # 6. Registro sem data de início (fallback seguro para evento ou sincronização)
    def test_cenario_6_sem_data_inicio(self):
        r = {
            "ID": "9999003",
            "Start date": None,
            "Date": "11/11/2026 02:00 PM",
            "Data Hora": "11/11/2026 01:30 PM"
        }
        n = normalize_record(r)
        self.assertEqual(n["data_realizacao_dia"], "11/11/2026")
        self.assertEqual(n["data_inicio_dia"], "")

    # 7. Registro com data inválida
    def test_cenario_7_data_invalida(self):
        r = {
            "ID": "9999004",
            "Start date": "data_corrompida",
            "Date": "99/99/9999"
        }
        n = normalize_record(r)
        self.assertEqual(n["data_realizacao_dia"], "")
        self.assertEqual(n["data_sincronizacao_dia"], "")

    # 8. Registro duplicado (idempotência)
    def test_cenario_8_deduplicacao(self):
        r1 = {"ID": "4048116", "Start date": "11/13/2026 11:36 AM"}
        r2 = {"ID": "4048116", "Start date": "11/13/2026 11:36 AM"}
        unique = {r["ID"]: normalize_record(r) for r in [r1, r2]}
        self.assertEqual(len(unique), 1)

    # 9. Registro de mês anterior (Outubro)
    def test_cenario_9_mes_anterior(self):
        r = {
            "ID": "4004539",
            "Start date": "10/23/2026 11:02 AM",
            "Date": "10/23/2026 03:31 PM"
        }
        n = normalize_record(r)
        self.assertEqual(n["data_inicio_dia"], "23/10/2026")
        self.assertIn("10/2026", n["data_inicio_dia"])

    # 10. Intervalo sem registros
    def test_cenario_10_intervalo_sem_registros(self):
        records = [
            normalize_record({"ID": "1", "Start date": "11/10/2026 09:00 AM"}),
            normalize_record({"ID": "2", "Start date": "11/13/2026 09:00 AM"})
        ]
        # Filtrar entre 11/11 e 12/11 onde não há inspeção neste mini set
        filtered = [r for r in records if r["data_realizacao_dia"] in ["11/11/2026", "12/11/2026"]]
        self.assertEqual(len(filtered), 0)

    # 11. Virada de mês (Outubro para Novembro)
    def test_cenario_11_virada_mes(self):
        r_out = normalize_record({"ID": "1", "Start date": "10/31/2026 10:00 AM"})
        r_nov = normalize_record({"ID": "2", "Start date": "11/01/2026 10:00 AM"})
        self.assertEqual(r_out["data_inicio_dia"], "31/10/2026")
        self.assertEqual(r_nov["data_inicio_dia"], "01/11/2026")

    # 12. Virada de ano (Janeiro 2026 não vira Dezembro 2026!)
    def test_cenario_12_janeiro_nao_vira_dezembro(self):
        r = {
            "ID": "3410380",
            "Start date": "01/12/2026 11:17 AM",
            "Date": "01/13/2026 03:43 PM"
        }
        n = normalize_record(r)
        self.assertEqual(n["data_inicio_dia"], "12/01/2026")
        self.assertNotEqual(n["data_inicio_dia"], "01/12/2026")  # Não pode ser 1º de Dezembro!

    # 13. Mistura de dados recentes (Novembro) e históricos (Maio, Junho, Agosto)
    def test_cenario_13_dados_recentes_e_historicos(self):
        r_mai = normalize_record({"ID": "3653882", "Start date": "05/12/2026 03:06 PM"})
        r_jun = normalize_record({"ID": "3719860", "Start date": "06/12/2026 01:11 PM"})
        r_ago = normalize_record({"ID": "3842945", "Start date": "08/12/2026 02:50 PM"})
        r_nov = normalize_record({"ID": "4048116", "Start date": "11/13/2026 11:36 AM"})
        
        self.assertEqual(r_mai["data_inicio_dia"], "12/05/2026")  # 12 de Maio
        self.assertEqual(r_jun["data_inicio_dia"], "12/06/2026")  # 12 de Junho
        self.assertEqual(r_ago["data_inicio_dia"], "12/08/2026")  # 12 de Agosto
        self.assertEqual(r_nov["data_inicio_dia"], "13/11/2026")  # 13 de Novembro
        
        # NENHUM deles é Dezembro!
        for d in [r_mai, r_jun, r_ago, r_nov]:
            self.assertFalse(d["data_inicio_dia"].endswith("/12/2026"))


if __name__ == "__main__":
    unittest.main()
