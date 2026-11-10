#!/usr/bin/env bash
# ==============================================================================
# status_server.sh - Painel de Status em Tempo Real do Raspberry Pi
# ==============================================================================

echo "================================================================="
echo "        PAINEL DE STATUS EM TEMPO REAL - MAPFY SERVER RPI        "
echo "================================================================="

ETH_IP=$(ip -4 addr show eth0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1 || echo "Desconectado")
echo "📡 IP Ethernet (Cabo): $ETH_IP"
echo "🌐 URL Dashboard:      http://$ETH_IP:8000/"
echo "🌐 URL mDNS:           http://mapfy-server.local:8000/"

echo ""
echo "--- Saúde do Hardware (ARMv6 BCM2835) ---"
if [ -f "/sys/class/thermal/thermal_zone0/temp" ]; then
  RAW_TEMP=$(cat /sys/class/thermal/thermal_zone0/temp)
  TEMP_C=$(awk "BEGIN {print $RAW_TEMP / 1000}")
  echo "🌡️  Temperatura da CPU: ${TEMP_C}°C"
fi
echo "⏱️  Uptime: $(uptime -p 2>/dev/null || uptime)"
echo "🧠 Memória RAM:"
free -h 2>/dev/null || free -m

echo ""
echo "--- Status dos Serviços Systemd ---"
SERVER_STATUS=$(systemctl is-active mapfy-server.service 2>/dev/null || echo "inativo")
MONITOR_STATUS=$(systemctl is-active mapfy-monitor.service 2>/dev/null || echo "inativo")

echo "  • mapfy-server:  [$SERVER_STATUS]"
echo "  • mapfy-monitor: [$MONITOR_STATUS]"

echo ""
echo "--- Últimos Logs do Servidor ---"
journalctl -u mapfy-server.service -n 15 --no-pager 2>/dev/null || tail -n 15 server/mapfy_server.log 2>/dev/null || true
echo "================================================================="
