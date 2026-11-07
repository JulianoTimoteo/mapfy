"""
data_loader.py
==============
Módulo de integração para o DashBoard.
Lê e carrega os dados consolidados gerados automaticamente pelo Server_MapFy.
"""

from __future__ import annotations

import json
from pathlib import Path
import pandas as pd

SERVER_DIR = Path(__file__).resolve().parent.parent / "Server_MapFy"
RELATORIOS_DIR = SERVER_DIR / "relatorios"


def list_available_forms() -> list[str]:
    """Retorna os nomes de todos os formulários ativos consolidados."""
    if not RELATORIOS_DIR.exists():
        return []
    return sorted([
        f.name for f in RELATORIOS_DIR.iterdir()
        if f.is_dir() and (f / "dados.csv").exists() and (f / "dados.csv").stat().st_size > 0
    ])


def load_form_dataframe(form_name: str) -> pd.DataFrame:
    """Carrega o DataFrame com os dados consolidados do formulário solicitado."""
    csv_file = RELATORIOS_DIR / form_name / "dados.csv"
    if not csv_file.exists():
        raise FileNotFoundError(f"Relatório '{form_name}' não encontrado em {RELATORIOS_DIR}")
    return pd.read_csv(csv_file, sep=";", encoding="utf-8-sig", dtype=str)


def load_form_json(form_name: str) -> list[dict]:
    """Retorna a lista de registros estruturados em formato JSON do formulário."""
    json_file = RELATORIOS_DIR / form_name / "dados.json"
    if not json_file.exists():
        raise FileNotFoundError(f"JSON '{form_name}' não encontrado em {RELATORIOS_DIR}")
    with open(json_file, "r", encoding="utf-8") as f:
        return json.load(f)


def load_all_forms_summary() -> list[dict]:
    """Retorna um resumo com o nome e total de registros de cada formulário."""
    summary = []
    for name in list_available_forms():
        csv_file = RELATORIOS_DIR / name / "dados.csv"
        rows = 0
        with open(csv_file, "r", encoding="utf-8-sig", errors="ignore") as f:
            rows = sum(1 for _ in f) - 1
        summary.append({
            "formulario": name,
            "total_registros": max(0, rows),
            "csv_path": str(csv_file),
            "json_path": str(RELATORIOS_DIR / name / "dados.json")
        })
    return summary


if __name__ == "__main__":
    forms = list_available_forms()
    print(f"Total de formulários consolidados disponíveis: {len(forms)}")
    for f in forms:
        df = load_form_dataframe(f)
        print(f" • {f[:45]:<45} | {len(df):>5} registros | Colunas: {len(df.columns)}")
