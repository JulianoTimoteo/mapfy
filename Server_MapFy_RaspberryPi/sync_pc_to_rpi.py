#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sync_pc_to_rpi.py
=================
Script complementar para ser executado no computador da Usina Pitangueiras.
Localiza a Raspberry Pi na rede local e envia os relatórios recém-extraídos
diretamente para o servidor 24/7 via HTTP POST.

Usina Pitangueiras • Safra 2026
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
import urllib.request
import urllib.error

# Configurações do Servidor Raspberry Pi
RPI_HOST = os.getenv("MAPFY_RPI_HOST", "mapfy-server.local")
RPI_PORT = os.getenv("MAPFY_RPI_PORT", "8000")
API_KEY = os.getenv("MAPFY_API_KEY", "PuvCM8x25CfaflVLEJs6phZVFics58K4DE7dDW8QDdRO0Ar7ne7NM_WzrmlYUXvN")

# Diretório dos relatórios no PC local
LOCAL_REPORTS_DIR = Path(__file__).resolve().parent.parent / "Server_MapFy" / "server" / "relatorios"


def test_rpi_connection(host: str) -> bool:
    url = f"http://{host}:{RPI_PORT}/api/v1/health"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MapFySyncClient/1.0"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                print(f"[✓] Conectado ao Raspberry Pi com sucesso!")
                print(f"    • Uptime: {data.get('uptime_formatted')}")
                print(f"    • Temperatura CPU: {data.get('cpu_temp_celsius')}°C")
                print(f"    • Relatórios disponíveis: {data.get('reports_available')}")
                return True
    except Exception as e:
        print(f"[-] Não foi possível conectar a {url}: {e}")
    return False


def push_report(host: str, report_folder: Path):
    csv_file = report_folder / "dados.csv"
    json_file = report_folder / "dados.json"

    if not csv_file.is_file() and not json_file.is_file():
        return

    report_name = report_folder.name
    print(f"[*] Enviando '{report_name}' para o Raspberry Pi...")

    records = None
    if json_file.is_file():
        try:
            with open(json_file, "r", encoding="utf-8") as jf:
                records = json.load(jf)
        except Exception:
            records = None

    csv_content = None
    if csv_file.is_file():
        try:
            with open(csv_file, "r", encoding="utf-8-sig") as cf:
                csv_content = cf.read()
        except Exception:
            csv_content = None

    payload = {
        "report_name": report_name,
        "records": records,
        "csv_content": csv_content,
    }

    url = f"http://{host}:{RPI_PORT}/api/v1/sync/push"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-API-Key": API_KEY,
            "User-Agent": "MapFySyncClient/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                print(f"    [✓] '{report_name}' sincronizado com sucesso!")
            else:
                print(f"    [-] Erro ao sincronizar: HTTP {resp.status}")
    except Exception as e:
        print(f"    [-] Falha no envio: {e}")


def main():
    print("=================================================================")
    print("      SINCRONIZADOR PC ➔ RASPBERRY PI (MAPFY SERVER 24/7)        ")
    print("=================================================================")

    target_host = RPI_HOST
    if not test_rpi_connection(target_host):
        # Tenta fallback para localhost se estiver testando local
        if target_host != "127.0.0.1" and test_rpi_connection("127.0.0.1"):
            target_host = "127.0.0.1"
        else:
            print("\n[-] Raspberry Pi ainda não respondeu na rede.")
            print("    Dica: Certifique-se de que o Raspberry Pi está ligado e conectado ao cabo de rede.")
            print("    Você também pode definir o IP manualmente executando:")
            print("    set MAPFY_RPI_HOST=192.168.X.X && python sync_pc_to_rpi.py\n")
            return

    if not LOCAL_REPORTS_DIR.is_dir():
        print(f"[-] Pasta de relatórios locais não encontrada: {LOCAL_REPORTS_DIR}")
        return

    folders = [f for f in LOCAL_REPORTS_DIR.iterdir() if f.is_dir()]
    print(f"\n[+] Localizados {len(folders)} relatórios para sincronização.")

    for folder in folders:
        push_report(target_host, folder)

    print("\n=================================================================")
    print("✅ SINCRONIZAÇÃO COMPLETA FINALIZADA!")
    print("=================================================================")


if __name__ == "__main__":
    main()
