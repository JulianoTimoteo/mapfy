@echo off
title 4 - Executar Testes
color 07

echo ===============================================================================
echo            MAPFY 2026 - 4. TESTES DE VALIDACAO E INTEGRIDADE
echo ===============================================================================
echo.

set SCRIPT_DIR=%~dp0
set SERVER_DIR=%~dp0server

if not exist "%SERVER_DIR%" (
    echo [ERRO] A pasta 'server' nao foi encontrada em: %SERVER_DIR%
    echo Certifique-se de manter a pasta 'server' junto deste arquivo.
    echo.
    pause
    exit /b 1
)

cd /d "%SERVER_DIR%"

set PYTHON_EXE=

if exist "%SERVER_DIR%\.venv\Scripts\python.exe" set PYTHON_EXE=%SERVER_DIR%\.venv\Scripts\python.exe
if not defined PYTHON_EXE if exist "%SCRIPT_DIR%\.venv\Scripts\python.exe" set PYTHON_EXE=%SCRIPT_DIR%\.venv\Scripts\python.exe
if not defined PYTHON_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe
if not defined PYTHON_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python315\python.exe" set PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python315\python.exe
if not defined PYTHON_EXE if exist "C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe" set PYTHON_EXE=C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe
if not defined PYTHON_EXE if exist "C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python315\python.exe" set PYTHON_EXE=C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python315\python.exe
if not defined PYTHON_EXE if exist "C:\Python312\python.exe" set PYTHON_EXE=C:\Python312\python.exe
if not defined PYTHON_EXE if exist "%ProgramFiles%\Python312\python.exe" set PYTHON_EXE=%ProgramFiles%\Python312\python.exe

if not defined PYTHON_EXE (
    where py.exe >nul 2>&1
    if %errorlevel% equ 0 set PYTHON_EXE=py -3.12
)

if not defined PYTHON_EXE (
    echo [ERRO] Python 3.10+ nao foi encontrado neste computador.
    echo Verificados: server\.venv, AppData\Programs\Python e py launcher.
    echo.
    echo Instale o Python 3.12 ou configure o ambiente virtual.
    echo.
    pause
    exit /b 2
)

echo [INFO] Runtime localizado: %PYTHON_EXE%
echo [INFO] Executando comando no diretorio server...
echo.

"%PYTHON_EXE%" -m unittest discover -s tests -p "test_*.py"

:concluido
set EXIT_CODE=%errorlevel%
echo.
if %EXIT_CODE% neq 0 (
    echo [INFO] Processo finalizado com codigo: %EXIT_CODE%
) else (
    echo [INFO] Processo concluido com sucesso.
)
pause
