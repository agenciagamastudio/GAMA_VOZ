@echo off
setlocal enabledelayedexpansion

REM ========== GAMA VOZ v2.0 - START SCRIPT ==========
REM Configurar aqui a chave da API (obtenha em https://groq.com)
REM SUBSTITUA "sua_groq_api_key_aqui" pela sua chave
set GROQ_API_KEY=sua_groq_api_key_aqui

REM Verificar se .env existe, se nao cria
if not exist .env (
    echo GROQ_API_KEY=%GROQ_API_KEY% > .env
)

cls
echo.
echo ========================================
echo GAMA Voz v2.0
echo ========================================
echo.
echo 1. Instalando dependencias...
echo.
call pip install -r requirements.txt >nul 2>&1
call npm install >nul 2>&1

echo 2. Iniciando Backend (porta 5001)...
start "GAMA VOZ Backend" cmd /k "cd backend && set GROQ_API_KEY=%GROQ_API_KEY% && python app.py"

echo 3. Aguardando 3 segundos...
timeout /t 3 /nobreak

echo 4. Iniciando Frontend (porta 5002)...
start "GAMA VOZ Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo PRONTO!
echo ========================================
echo.
echo Abra o navegador em: http://localhost:5002
echo.
echo Backend: http://localhost:5001
echo API Key: Configurada automaticamente
echo.
echo Para parar: Feche as janelas do Terminal
echo.
pause
