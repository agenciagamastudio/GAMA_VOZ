@echo off
setlocal enabledelayedexpansion
title GAMA Voz CLI
color 0A

REM =====================================================
REM  GAMA VOZ — CLI inicializador (estilo omniroute)
REM  Executa: Backend + Frontend + Ditado Global + OmniRoute
REM  Pasta base: C:\Users\Usuario
REM =====================================================

echo.
echo    ++++++++++++++++++++++++++++++++++++++++++++++++
echo   ++                                                ++
echo   ++          G  A  M  A    V  O  Z              ++
echo   ++              v3.0.0                            ++
echo   ++     Realtime Voice + AI  --  CLI Mode         ++
echo   ++                                                ++
echo    ++++++++++++++++++++++++++++++++++++++++++++++++
echo.

REM --- Caminhos ---
set "GAMA_DIR=C:\Users\Usuario\Desktop\O_GRANDE_PROJETO\GAMA_VOZ"
set "OMNI_HOME=C:\Users\Usuario"
set "BACKEND_DIR=%GAMA_DIR%\backend"
set "FRONTEND_DIR=%GAMA_DIR%\frontend"

echo  [CONFIG] GAMA_DIR  = %GAMA_DIR%
echo  [CONFIG] OMNI_HOME = %OMNI_HOME%
echo.

REM --- Limpeza de portas anteriores ---
echo  [SETUP] Limpando portas anteriores...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :8000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :5000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
timeout /t 2 /nobreak >nul

REM --- 1/4 Backend ---
echo  [1/4] Iniciando Backend ^(Flask — porta 8000^)...
start "GAMA Backend" cmd /k "cd /d %BACKEND_DIR% ^& python app.py"

echo  [2/4] Iniciando Frontend ^(Vite/React — porta 5000^)...
start "GAMA Frontend" cmd /k "cd /d %FRONTEND_DIR% ^& npm run dev"

REM --- 3/4 Ditado Global ---
echo  [3/4] Iniciando Ditado Global ^(Ctrl+Shift+Alt+Z^)...
start "" "C:\python311\pythonw.exe" "%BACKEND_DIR%\ditado_global.py"

REM --- 4/4 OmniRoute ---
echo  [4/4] Iniciando OmniRoute ^(porta 20128^)...
REM O caminho real do binario npm fica em AppData/Roaming/npm/node_modules
start "OmniRoute" cmd /k "cd /d %OMNI_HOME% ^& set DATA_DIR=%OMNI_HOME%\.omniroute ^& node C:\Users\Usuario\AppData\Roaming\npm\node_modules\omniroute\bin\omniroute.mjs serve --port 20128"

echo.
echo   ====================================================
echo    GAMA VOZ iniciado com sucesso!
echo   ====================================================
echo.
echo    App:        http://localhost:5000/
echo    Backend:    http://localhost:8000/
echo    OmniRoute:  http://localhost:20128/
echo.
echo    Ditado Global: Ctrl+Shift+Alt+Z (overlay em qualquer app)
echo.
echo    Acesse via CLI:  C:> gamavoz
echo.
echo   ====================================================
echo.
pause
