#!/usr/bin/env bash
# ==============================================================================
# setup_autostart.sh
# ==============================================================================
# Script de Instalação e Ativação do Autostart 24/7 no Raspberry Pi
# Usina Pitangueiras • Safra 2026
# ==============================================================================

set -e

echo "================================================================="
echo "   INSTALADOR DE AUTOSTART 24/7 - SERVIDOR MAPFY RASPBERRY PI    "
echo "================================================================="

if [ "$EUID" -ne 0 ]; then
  echo "[-] Por favor, execute este script como root (sudo ./setup_autostart.sh)"
  exit 1
fi

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "[+] Diretório do projeto: $BASE_DIR"

# 1. Garante dependências do sistema Linux
echo "[+] Verificando pacotes do sistema (python3, pip, avahi-daemon)..."
apt-get update -qq || true
apt-get install -y -qq python3 python3-pip python3-setuptools avahi-daemon libatlas-base-dev

# 2. Instala requisitos do Python no Raspberry Pi
echo "[+] Instalando dependências leves do Python (FastAPI, Uvicorn, Dotenv)..."
pip3 install --break-system-packages -q -r "$BASE_DIR/server/requirements_rpi.txt" || \
pip3 install -q -r "$BASE_DIR/server/requirements_rpi.txt"

# 3. Configura permissões
chown -R pi:pi "$BASE_DIR" || true
chmod +x "$BASE_DIR"/*.sh || true
chmod +x "$BASE_DIR/server/"*.py || true
chmod +x "$BASE_DIR/MapFy_Telegram_Monitor/"*.py || true

# 4. Instala unidades do systemd
echo "[+] Instalando serviços no systemd..."
cp "$BASE_DIR/systemd/mapfy-server.service" /etc/systemd/system/
cp "$BASE_DIR/systemd/mapfy-monitor.service" /etc/systemd/system/

systemctl daemon-reload

# 5. Ativa e inicia os serviços no boot
echo "[+] Ativando serviços para inicialização automática no boot..."
systemctl enable avahi-daemon
systemctl enable mapfy-server.service
systemctl enable mapfy-monitor.service

echo "[+] Iniciando os serviços agora..."
systemctl restart avahi-daemon
systemctl restart mapfy-monitor.service
sleep 2
systemctl restart mapfy-server.service

sleep 3

# 6. Exibe status e endereços
ETH_IP=$(ip -4 addr show eth0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1 || echo "Conectando...")
WLAN_IP=$(ip -4 addr show wlan0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1 || echo "")

echo ""
echo "================================================================="
echo "✅ SERVIDOR MAPFY INSTALADO E OPERACIONAL 24/7!"
echo "================================================================="
echo "📡 Cabo de Rede (Ethernet): $ETH_IP"
[ -n "$WLAN_IP" ] && echo "📶 Wi-Fi: $WLAN_IP"
echo "🌐 Acesso ao Dashboard Web: http://$ETH_IP:8000/"
echo "🌐 Acesso via nome de rede: http://mapfy-server.local:8000/"
echo "📡 Monitor Telegram API:    http://$ETH_IP:8765/"
echo "================================================================="
echo "Comandos úteis:"
echo "  sudo ./status_server.sh  (Verifica saúde, temperatura e logs)"
echo "  sudo ./stop_server.sh    (Pausa os serviços)"
echo "  sudo ./start_server.sh   (Reinicia os serviços)"
echo "================================================================="
