from pathlib import Path
import py_compile

def patch_extractor(p: Path):
    text = p.read_text(encoding="utf-8")
    
    old_target = """    new_df = read_csv_smart(new_csv)
    if new_df.empty:
        return 0, 0"""
        
    replacement = """    new_df = read_csv_smart(new_csv)
    if new_df.empty:
        return 0, 0

    # Normalização de BOM e cabeçalhos em inglês para português
    def _clean_header(c):
        cl = c.replace("\\ufeff", "").strip()
        if cl.lower() == "date": return "Data"
        if cl.lower() == "user": return "Usuário"
        if cl.lower() == "start date": return "Data início"
        if cl.lower() == "end date": return "Data Fim"
        return cl
    new_df.columns = [_clean_header(c) for c in new_df.columns]

    # Conversão de datas de formato americano (MM/DD/YYYY AM/PM) para formato brasileiro (DD/MM/YYYY HH:MM)
    def _to_br_dt(val):
        if not val or pd.isna(val): return ""
        v_str = str(val).strip()
        for f in ["%m/%d/%Y %I:%M %p", "%m/%d/%Y %I:%M:%S %p", "%m/%d/%Y %H:%M", "%d/%m/%Y %H:%M", "%d/%m/%Y"]:
            try:
                return datetime.strptime(v_str, f).strftime("%d/%m/%Y %H:%M")
            except ValueError:
                pass
        return v_str

    for dcol in ["Data", "Data início", "Data Fim", "Data Hora"]:
        if dcol in new_df.columns:
            new_df[dcol] = new_df[dcol].apply(_to_br_dt)"""

    if old_target in text:
        text = text.replace(old_target, replacement)
        p.write_text(text, encoding="utf-8")
        py_compile.compile(str(p), doraise=True)
        print(f"Patched {p.name} successfully!")
    else:
        print(f"Target not found in {p.name}")

p1 = Path(r"C:\Users\julianotimoteo\OneDrive - Pitangueiras Acucar e Alcool Ltda (1)\Server_Funcionando\server\mapfy_extractor.py")
p2 = Path(r"Server_MapFy\server\mapfy_extractor.py")
patch_extractor(p1)
patch_extractor(p2)
