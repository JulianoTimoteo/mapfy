#!/usr/bin/env bash
# ==============================================================================
# start_server.sh - Inicia os serviços do Servidor MapFy
# ==============================================================================
if [ "$EUID" -ne 0 ]; then
  echo "[-] Execute com sudo (sudo ./start_server.sh)"
  exit 1
fi

echo "[+] Iniciando serviços do MapFy Server..."
systemctl start mapfy-monitor.service
sleep 1
systemctl start mapfy-server.service

ETH_IP=$(ip -4 addr show eth0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1 || echo "127.0.0.1")
echo "[✓] Serviços ativos! Acesse: http://$ETH_IP:8000/"
