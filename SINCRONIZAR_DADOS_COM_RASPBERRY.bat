@echo off
title Sincronizador MapFy PC -> Raspberry Pi
cls
echo =================================================================
echo   SINCRONIZADOR MAPFY PC -> RASPBERRY PI (USINA PITANGUEIRAS)
echo =================================================================
python "%~dp0Server_MapFy_RaspberryPi\sync_pc_to_rpi.py"
pause
