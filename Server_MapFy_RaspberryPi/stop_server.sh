#!/usr/bin/env bash
# ==============================================================================
# stop_server.sh - Encerra os serviços do Servidor MapFy
# ==============================================================================
if [ "$EUID" -ne 0 ]; then
  echo "[-] Execute com sudo (sudo ./stop_server.sh)"
  exit 1
fi

echo "[-] Encerrando serviços do MapFy Server..."
systemctl stop mapfy-server.service || true
systemctl stop mapfy-monitor.service || true
echo "[✓] Serviços parados com sucesso."
