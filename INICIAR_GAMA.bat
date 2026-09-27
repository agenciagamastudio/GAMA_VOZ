@echo off
setlocal enabledelayedexpansion
title GAMA Voz - Frontend e Backend
color 0A

echo.
echo ================================================
echo   GAMA VOZ - Inicializando Sistema...
echo ================================================
echo.

REM Matar APENAS processos GAMA anteriores (por porta, nao por nome)
echo [SETUP] Limpando portas anteriores...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :8000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :5000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo [1/3] Iniciando Backend (Flask - porta 8000)...
cd /d "%~dp0backend"
start "GAMA Backend" cmd /k python app.py
timeout /t 3 /nobreak >nul

echo [2/3] Iniciando Frontend (Vite/React - porta 5000)...
cd /d "%~dp0frontend"
start "GAMA Frontend" cmd /k npm run dev

echo [3/3] Iniciando Ditado Global (Ctrl+Shift+Alt+Z)...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe' or Name='pythonw.exe'\" | Where-Object { $_.CommandLine -match 'ditado_global' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
cd /d "%~dp0backend"
start "" "C:\python311\pythonw.exe" ditado_global.py

echo.
echo ================================================
echo   GAMA Voz iniciado com sucesso!
echo ================================================
echo.
echo Acesse em seu navegador:
echo.
echo   App:       http://localhost:5000/
echo   Backend:   http://localhost:8000/
echo.
echo   Ditado Global ativo: segure Ctrl+Shift+Alt+Z em
echo   qualquer app e fale (overlay no canto da tela).
echo.
echo (O backend demora ~30s no primeiro carregamento do modelo)
echo.
pause
