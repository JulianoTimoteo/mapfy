@echo off
chcp 65001 > nul
title [Mapfy 2026 - Servidor 24/7 Ativo - Usina Pitangueiras]
color 0A

echo ==============================================================================
echo       MAPFY 2026 - SERVIÇO EM ALTA DISPONIBILIDADE (24/7)
echo       Usina Pitangueiras • Safra 2026
echo ==============================================================================
echo.
echo [INFO] Servidor configurado para execucao ininterrupta.
echo [INFO] Se o processo sofrer qualquer interrupcao, ele reiniciara automaticamente.
echo [INFO] Para encerrar voluntariamente, feche esta janela ou pressione Ctrl+C.
echo.

cd /d "%~dp0"

:: Ativa o ambiente virtual se existir
if exist "..\.venv\Scripts\activate.bat" (
    call "..\.venv\Scripts\activate.bat"
) else if exist ".venv\Scripts\activate.bat" (
    call ".venv\Scripts\activate.bat"
)

:loop
echo [%date% %time%] Iniciando Watchdog Guardian do Servidor Mapfy...
python watchdog_service.py

echo.
echo [ALERTA] Processo do Watchdog foi encerrado em %date% as %time%!
echo [INFO] Reiniciando automaticamente em 5 segundos...
echo ==============================================================================
timeout /t 5 /nobreak > nul
goto loop
