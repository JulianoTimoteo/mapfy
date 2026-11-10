@echo off
title Localizador do Raspberry Pi - Usina Pitangueiras
cls
echo =================================================================
echo   LOCALIZADOR AUTOMATICO DO RASPBERRY PI - USINA PITANGUEIRAS
echo =================================================================
echo Buscando a placa na rede da Usina...
python "%~dp0localizar_raspberry.py"
pause
