# 🍓 MapFy Server 24/7 - Raspberry Pi Edition (ARMv6 / 512MB RAM)

> **Usina Pitangueiras • Açúcar e Álcool Ltda • Safra 2026**  
> Servidor Autônomo de Alta Disponibilidade para Dashboard, Mapas e Relatórios em Tempo Real.

---

## 📋 Visão Geral da Arquitetura

Este clone foi customizado pela equipe de engenharia para operar de forma perfeitamente fluida e estável na **Raspberry Pi 1 Model B+ v1.2 (2014)**, aproveitando ao máximo seus recursos de hardware limitados (Broadcom BCM2835 ARMv6 @ 700MHz, 512MB RAM):

```
                        [ Cabo Ethernet eth0 ]
                                  │
                                  ▼
      ┌────────────────────────────────────────────────────────┐
      │         Raspberry Pi 1 Model B+ (Linux Lite)           │
      │                                                        │
      │   ┌────────────────────────────────────────────────┐   │
      │   │  API Gateway & DashBoard Web (Porta 8000)      │   │
      │   │  - FastAPI + Uvicorn (ARMv6 otimizado)         │   │
      │   │  - Servidor de Mapas GeoJSON + MBTiles SQLite  │   │
      │   │  - Ingestão PUSH em tempo real (/sync/push)    │   │
      │   └────────────────────────────────────────────────┘   │
      │                           │                            │
      │   ┌───────────────────────┴────────────────────────┐   │
      │   │  Sentinel Heartbeat Agent & Telemetria         │   │
      │   │  - Monitoramento de temperatura e RAM          │   │
      │   │  - Sinais HMAC-SHA256 para o Telegram Monitor  │   │
      │   └────────────────────────────────────────────────┘   │
      │                           │                            │
      │   ┌───────────────────────┴────────────────────────┐   │
      │   │  Telegram Sentinel Monitor (Porta 8765)        │   │
      │   │  - Alertas automáticos via @MapfySentinelBot   │   │
      │   └────────────────────────────────────────────────┘   │
      └────────────────────────────────────────────────────────┘
```

---

## 🚀 Como Inicializar no Raspberry Pi

### Passo 1: Ligar o Raspberry Pi
1. Insira o Cartão MicroSD na entrada da Raspberry Pi 1 B+.
2. Conecte o **Cabo de Rede Ethernet (RJ-45)** na porta de rede da placa.
3. Conecte a fonte de alimentação Micro-USB (5V / 2A).
4. O LED vermelho acenderá (Power) e o LED verde começará a piscar (leitura do cartão).

### Passo 2: Acesso via Rede
O sistema está configurado com rede automática (DHCP) e resolução de nomes mDNS:
* **Pelo Navegador de qualquer computador/celular:**
  * Acesse: `http://mapfy-server.local:8000/`
  * Ou pelo IP da placa: `http://<IP_DO_RASPBERRY>:8000/`
* **Acesso SSH:**
  * Usuário: `pi`
  * Senha: `mapfy2026`
  * Comando: `ssh pi@mapfy-server.local` ou `ssh pi@<IP>`

### Passo 3: Ativação dos Serviços 24/7 (Autostart)
No terminal do Raspberry Pi (ou via SSH), execute o comando único de instalação:
```bash
cd /home/pi/Server_MapFy
sudo ./setup_autostart.sh
```
O instalador irá:
1. Instalar as dependências leves necessárias via `apt` e `pip`.
2. Registrar os serviços no `systemd` (`mapfy-server.service` e `mapfy-monitor.service`).
3. Ativar a inicialização automática no boot (`systemctl enable`).
4. Disparar uma notificação no Telegram confirmando que o servidor está online!

---

## 🔄 Sincronização de Dados em Tempo Real

Para manter os relatórios da Usina sempre atualizados no Raspberry Pi sem sobrecarregar seu processador de 700MHz, existem **dois métodos de sincronização em tempo real**:

### 1. Ingestão PUSH Direta (PC Extrator ➔ Raspberry Pi)
O API Gateway possui o endpoint `/api/v1/sync/push`. Quando o extrator rodar na máquina de monitoramento, ele pode enviar os dados atualizados para a Raspberry Pi instantaneamente:
```python
import httpx

rpi_url = "http://mapfy-server.local:8000/api/v1/sync/push"
headers = {"X-API-Key": "PuvCM8x25CfaflVLEJs6phZVFics58K4DE7dDW8QDdRO0Ar7ne7NM_WzrmlYUXvN"}
payload = {
    "report_name": "CHECK LIST VEICULAR",
    "records": [...], # lista de registros
}
httpx.post(rpi_url, json=payload, headers=headers)
```

### 2. Sincronização Autônoma via GitHub (PULL)
O serviço `data_sync_worker.py` roda em segundo plano e monitora a branch de relatórios no GitHub. Sempre que novos commits forem publicados, o Raspberry Pi detecta a alteração, baixa os dados e recarrega a contagem sem precisar reiniciar o servidor.

---

## 🛠️ Comandos de Gestão Rápida

| Ação | Comando |
| :--- | :--- |
| **Verificar Status e Temperatura** | `sudo ./status_server.sh` |
| **Iniciar Serviços** | `sudo ./start_server.sh` |
| **Parar Serviços** | `sudo ./stop_server.sh` |
| **Ver Logs em Tempo Real** | `sudo journalctl -u mapfy-server.service -f` |

---

## ⚙️ Otimizações de Memória Aplicadas

* **Alocação de GPU:** Reduzida para `16MB` em `config.txt` (`gpu_mem=16`), liberando **496MB de RAM** exclusiva para o sistema Linux e o servidor MapFy.
* **Stack Assíncrona Leve:** Utiliza asyncio puro do Python com FastAPI, sem bibliotecas pesadas de compilação C++, mantendo o consumo total abaixo de **90MB de RAM**.
* **Compressão GZip:** Respostas HTTP comprimidas nativamente, acelerando o carregamento dos mapas e relatórios na rede cabeada.
