@echo off
chcp 65001 > nul
title [Instalação Inicial - Servidor MapFy 24/7]
color 0B

echo ==============================================================================
echo       MAPFY 2026 - INSTALADOR AUTOMÁTICO DE AMBIENTE
echo       Usina Pitangueiras • Safra 2026
echo ==============================================================================
echo.
echo [1/3] Verificando instalação do Python...
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo [ERRO] Python não foi encontrado no PATH do Windows!
    echo Por favor, instale o Python 3.10 ou superior e marque a opcao:
    echo "Add python.exe to PATH" durante a instalacao.
    echo.
    pause
    exit /b 1
)

python --version
echo.
echo [2/3] Instalando dependências necessárias (FastAPI, Uvicorn, Playwright)...
cd /d "%~dp0"
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo.
echo [3/3] Instalando navegador Chromium para o robô de extração do Mapfy...
python -m playwright install chromium

echo.
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" > nul
        echo [AVISO] Arquivo .env criado a partir de .env.example.
        echo Lembre-se de configurar seu usuário e senha do Mapfy nele!
    )
)

echo ==============================================================================
echo       INSTALAÇÃO CONCLUÍDA COM SUCESSO!
echo ==============================================================================
echo Agora você já pode iniciar o servidor clicando em:
echo   --> INICIAR_SERVIDOR_24_7.bat
echo.
pause
