@echo off
title 4 - Executar Testes MapFy
color 07
echo ===============================================================================
echo           MAPFY 2026 - 4. TESTES DE VALIDACAO E INTEGRIDADE
echo ===============================================================================
echo.
set SERVER_DIR=%~dp0server
if not exist "%SERVER_DIR%" (
    echo [ERRO] Pasta 'server' nao encontrada em: %SERVER_DIR%
    timeout /t 3 >nul
    exit /b 1
)
cd /d "%SERVER_DIR%"
set PYTHON_EXE=
if exist "%SERVER_DIR%\.venv\Scripts\python.exe" set PYTHON_EXE=%SERVER_DIR%\.venv\Scripts\python.exe
if not defined PYTHON_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe
if not defined PYTHON_EXE if exist "C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe" set PYTHON_EXE=C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe
if not defined PYTHON_EXE (
    where py.exe >nul 2>&1
    if %errorlevel% equ 0 set PYTHON_EXE=py -3.12
)
if not defined PYTHON_EXE set PYTHON_EXE=python.exe

"%PYTHON_EXE%" -m unittest discover -s tests -p "test_*.py"
set EXIT_CODE=%errorlevel%
echo.
if %EXIT_CODE% neq 0 (
    echo [INFO] Processo finalizado com codigo: %EXIT_CODE%
) else (
    echo [INFO] Processo concluido com sucesso.
)
pause