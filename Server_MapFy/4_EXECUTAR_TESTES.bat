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

set "PYTHON_EXE="

if exist "%SERVER_DIR%\runtime\python.exe" (

    set "PYTHON_EXE=%SERVER_DIR%\runtime\python.exe"

    goto :PY_RESOLVED

)

if exist "%SERVER_DIR%\.venv\Scripts\python.exe" (

    set "PYTHON_EXE=%SERVER_DIR%\.venv\Scripts\python.exe"

    goto :PY_RESOLVED

)

if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (

    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"

    goto :PY_RESOLVED

)

if exist "C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe" (

    set "PYTHON_EXE=C:\Users\julianotimoteo\AppData\Local\Programs\Python\Python312\python.exe"

    goto :PY_RESOLVED

)

if exist "C:\Python312\python.exe" (

    set "PYTHON_EXE=C:\Python312\python.exe"

    goto :PY_RESOLVED

)

:PY_RESOLVED

if not defined PYTHON_EXE (

    echo [ERRO] Python portatil nao foi localizado em: %SERVER_DIR%\runtime\python.exe

    echo Certifique-se de que a pasta 'server\runtime' esta presente.

    pause

    exit /b 2

)



echo [INFO] Interpretador: %PYTHON_EXE%

echo [INFO] Executando cada conjunto em um processo isolado...
echo.

set "EXIT_CODE=0"
for %%T in (tests\test_*.py) do (
    echo [INFO] %%~nxT
    "%PYTHON_EXE%" -m unittest discover -s tests -p "%%~nxT"
    if errorlevel 1 set "EXIT_CODE=1"
)
echo.
if %EXIT_CODE% neq 0 (
    echo [ERRO] Um ou mais conjuntos de testes falharam.
) else (
    echo [OK] Todos os conjuntos de testes passaram.
)
pause
exit /b %EXIT_CODE%
