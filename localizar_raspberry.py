#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
localizar_raspberry.py
======================
Localizador Automático do Raspberry Pi na Rede da Usina Pitangueiras.
Varre a tabela ARP em busca de endereços MAC da Raspberry Pi Foundation
(prefixos B8:27:EB, DC:A6:32, E4:5F:01, 28:CD:C1) e testa as portas 8000 (MapFy) e 22 (SSH).

Usina Pitangueiras • Safra 2026
"""

from __future__ import annotations

import re
import socket
import subprocess
import sys
import time
import urllib.request
import urllib.error
import json
import webbrowser

# Prefixos OUI oficiais da Raspberry Pi Foundation
RPI_MAC_PREFIXES = (
    "b8-27-eb",  # Raspberry Pi 1 Model B+ / Zero / 2 / 3
    "b8:27:eb",
    "dc-a6-32",  # Raspberry Pi 4
    "dc:a6:32",
    "e4-5f-01",  # Raspberry Pi 4 / 400
    "e4:5f:01",
    "28-cd-c1",  # Raspberry Pi 5
    "28:cd:c1",
)


def get_arp_table() -> list[tuple[str, str]]:
    """Lê a tabela ARP do Windows para listar todos os dispositivos conectados na rede local."""
    devices = []
    try:
        output = subprocess.check_output("arp -a", shell=True, text=True, errors="ignore")
        for line in output.splitlines():
            line = line.strip().lower()
            # Procura linhas com padrão: IP ... MAC ... Tipo
            match = re.search(r"(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-f]{2}[:-][0-9a-f]{2}[:-][0-9a-f]{2}[:-][0-9a-f]{2}[:-][0-9a-f]{2}[:-][0-9a-f]{2})", line)
            if match:
                ip, mac = match.groups()
                devices.append((ip, mac))
    except Exception as e:
        print(f"[-] Erro ao ler tabela ARP: {e}")
    return devices


def test_port(ip: str, port: int, timeout: float = 0.8) -> bool:
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def test_mapfy_api(ip: str, port: int = 8000) -> dict | None:
    url = f"http://{ip}:{port}/api/v1/health"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MapFyLocator/1.0"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8"))
    except Exception:
        pass
    return None


def main():
    print("=================================================================")
    print("   LOCALIZADOR AUTOMATICO DO RASPBERRY PI - USINA PITANGUEIRAS   ")
    print("=================================================================")
    print("[+] Varrendo conexões de rede em busca do Raspberry Pi 1 B+...")

    # 1. Primeiro teste rápido via mDNS
    print("[*] Testando resolucao direta por nome 'mapfy-server.local'...")
    try:
        resolved_ip = socket.gethostbyname("mapfy-server.local")
        print(f"[✓] Nome resolvido com sucesso: mapfy-server.local -> {resolved_ip}")
        info = test_mapfy_api(resolved_ip)
        show_success(resolved_ip, info, "mDNS (mapfy-server.local)")
        return
    except Exception:
        print("    (mDNS indisponível ou ainda inicializando, procurando via ARP...)")

    # 2. Busca na tabela ARP por MAC do Raspberry Pi
    max_attempts = 15
    for attempt in range(1, max_attempts + 1):
        print(f"\n[*] Tentativa {attempt}/{max_attempts}: Consultando dispositivos na rede local...")
        devices = get_arp_table()
        rpi_candidates = []

        for ip, mac in devices:
            mac_clean = mac.lower().replace(":", "-")
            if any(mac_clean.startswith(prefix.replace(":", "-")) for prefix in RPI_MAC_PREFIXES):
                rpi_candidates.append((ip, mac))

        if rpi_candidates:
            print(f"[✓] Encontrada(s) {len(rpi_candidates)} placa(s) Raspberry Pi pelo endereco MAC:")
            for ip, mac in rpi_candidates:
                print(f"    • IP: {ip} | MAC: {mac}")
                # Testa porta 8000 (MapFy Server)
                info = test_mapfy_api(ip)
                if info:
                    show_success(ip, info, f"MAC Oficial Raspberry Pi ({mac})")
                    return
                # Testa porta 22 (SSH)
                if test_port(ip, 22):
                    print(f"    [+] Porta 22 (SSH) ativa! O servidor MapFy pode estar concluindo o boot...")
                    show_success(ip, None, f"MAC Oficial Raspberry Pi ({mac}) - SSH Aberto")
                    return

        # 3. Se não achou por MAC, testa dispositivos com porta 8000 aberta
        for ip, mac in devices:
            if ip.startswith("172.16.") or ip.startswith("192.168."):
                if test_port(ip, 8000, timeout=0.3):
                    info = test_mapfy_api(ip)
                    if info:
                        show_success(ip, info, f"Porta 8000 MapFy Detectada ({ip})")
                        return

        print("[-] Placa ainda não respondeu. Aguardando 4 segundos para próxima checagem...")
        time.sleep(4)

    print("\n=================================================================")
    print("[-] A Raspberry Pi ainda não foi localizada na rede.")
    print("    Dicas para resolução:")
    print("    1. Verifique se o cabo de rede Ethernet está bem conectado (LEDs do conector acesos).")
    print("    2. Verifique se a placa está ligada em uma fonte de 5V 2A na tomada.")
    print("    3. Aguarde cerca de 1 a 2 minutos para a conclusão do primeiro boot.")
    print("=================================================================")


def show_success(ip: str, info: dict | None, metodo: str):
    print("\n=================================================================")
    print("🍓 RASPBERRY PI LOCALIZADA COM SUCESSO NA REDE!")
    print("=================================================================")
    print(f"📡 Endereço IP na Usina:  {ip}")
    print(f"🔍 Identificado via:      {metodo}")
    print(f"🌐 Dashboard MapFy Web:   http://{ip}:8000/")
    print(f"📡 API Health Check:      http://{ip}:8000/api/v1/health")
    print(f"💻 Acesso SSH:            ssh pi@{ip}  (senha: mapfy2026)")
    if info:
        print(f"⏱️  Uptime da Placa:       {info.get('uptime_formatted', 'Recém-iniciado')}")
        print(f"🌡️  Temperatura do Chip:   {info.get('cpu_temp_celsius', 'N/D')}°C")
        print(f"📊 Relatórios Ativos:     {info.get('reports_available', 0)}")
    print("=================================================================")
    
    # Pergunta se deseja abrir no navegador
    try:
        webbrowser.open(f"http://{ip}:8000/")
    except Exception:
        pass


if __name__ == "__main__":
    main()
