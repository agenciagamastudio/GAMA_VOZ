@echo off
setlocal enabledelayedexpansion

REM ========================================
REM GAMA VOZ - Script de Instalação (Windows)
REM ========================================

echo.
echo ╔════════════════════════════════════════════════╗
echo ║  🎤 GAMA VOZ - Script de Instalação Automática  ║
echo ╚════════════════════════════════════════════════╝
echo.

REM Verificar Node.js
echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js não encontrado. Instale em https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js detectado

REM Verificar Python
echo [2/5] Verificando Python...
python --version >nul 2>&1
if errorlevel 1 (
    python3 --version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Python não encontrado. Instale em https://www.python.org/
        pause
        exit /b 1
    )
    set PYTHON=python3
) else (
    set PYTHON=python
)
echo ✅ Python detectado

REM Instalar dependências do backend
echo [3/5] Instalando dependências do backend...
cd backend
%PYTHON% -m pip install -r requirements.txt >nul 2>&1
if errorlevel 1 (
    echo ❌ Erro ao instalar dependências do backend
    pause
    exit /b 1
)
cd ..
echo ✅ Backend pronto

REM Instalar dependências do frontend
echo [4/5] Instalando dependências do frontend...
cd frontend
call npm install >nul 2>&1
if errorlevel 1 (
    echo ❌ Erro ao instalar dependências do frontend
    pause
    exit /b 1
)
cd ..
echo ✅ Frontend pronto

REM Criar .env.local se não existir
echo [5/5] Configurando variáveis de ambiente...
if not exist "frontend\.env.local" (
    (
        echo VITE_API_BASE_URL=http://localhost:5001
    ) > "frontend\.env.local"
    echo ✅ Arquivo .env.local criado
) else (
    echo ✅ Arquivo .env.local já existe
)

echo.
echo ╔════════════════════════════════════════════════╗
echo ║  ✅ Instalação concluída com sucesso!         ║
echo ╚════════════════════════════════════════════════╝
echo.
echo 🚀 Para iniciar a aplicação, execute:
echo.
echo   1. INSTALAR_GAMA.bat (já foi executado)
echo   2. INICIAR_GAMA.bat (execute agora)
echo.
pause
