@echo off
REM =========================================================
REM  GAMA VOZ — CLI Installer v1
REM  Copia gamavoz.bat para C:\Users\Usuario
REM  Adiciona C:\Users\Usuario ao PATH do usuario
REM  Cria uninstall.bat
REM  Resultado: "C:\Users\Usuario> gamavoz" funciona em qualquer CMD
REM =========================================================
setlocal enabledelayedexpansion
title GAMA VOZ - Instalador
color 0B

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║        GAMA VOZ - Instalador CLI v1.0             ║
echo  ╚══════════════════════════════════════════════════╝
echo.

set "SRC_DIR=C:\Users\Usuario\Desktop\O_GRANDE_PROJETO\GAMA_VOZ"
set "DST_DIR=C:\Users\Usuario"
set "DST_BIN=%DST_DIR%\bin"
set "EXE=%DST_BIN%\gamavoz.bat"
set "UNINSTALLER=%DST_BIN%\gamavoz-uninstall.bat"

REM --- Checagens ---
echo  [CHECK] Verificando arquivos-fonte...
if not exist "%SRC_DIR%\gamavoz.bat" (
    echo  [ERROR] gamavoz.bat nao encontrado em %SRC_DIR%
    echo  Execute o instalador dentro do GAMA_VOZ.
    pause & exit /b 1
)
if not exist "%SRC_DIR%\backend\app.py" (
    echo  [ERROR] backend/app.py nao encontrado
    pause & exit /b 1
)
if not exist "%SRC_DIR%\frontend\package.json" (
    echo  [ERROR] frontend/package.json nao encontrado
    pause & exit /b 1
)
echo         OK ^(gamavoz.bat, backend, frontend^)
echo.

REM --- Criar diretorio de binarios ---
if not exist "%DST_BIN%" (
    echo  [1/4] Criando %DST_BIN%...
    mkdir "%DST_BIN%"
) else (
    echo  [1/4] %DST_BIN% ja existe.
)

REM --- Copiar executavel ---
echo  [2/4] Instalando gamavoz.bat em %EXE%...
copy /Y "%SRC_DIR%\gamavoz.bat" "%EXE%" >nul
if errorlevel 1 (
    echo  [ERROR] Falha ao copiar. Tente como Administrador.
    pause & exit /b 1
)
echo         OK
echo.

REM --- Adicionar C:\Users\Usuario\bin ao PATH do usuario ---
echo  [3/4] Adicionando C:\Users\Usuario\bin ao PATH do usuario...
set "CURRENT_PATH="
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "CURRENT_PATH=%%b"

echo %CURRENT_PATH% | findstr /C:"%DST_BIN%" >nul
if errorlevel 1 (
    set "NEW_PATH=%CURRENT_PATH%;%DST_BIN%"
    reg add "HKCU\Environment" /v PATH /t REG_EXPAND_SZ /d "!NEW_PATH!" /f >nul
    echo         Adicionado: %DST_BIN%
) else (
    echo         Ja estava no PATH. OK
)

REM --- Atualizar PATH do processo atual tambem ---
set "PATH=%DST_BIN%;%PATH%"
echo.

REM --- Criar uninstaller ---
echo  [4/4] Criando uninstaller em %UNINSTALLER%...
(
    echo @echo off
    echo title GAMA VOZ - Desinstalador
    echo color 0C
    echo echo.
    echo echo  ╔══════════════════════════════════════════════════╗
    echo echo  ║      GAMA VOZ - Desinstalador CLI v1.0            ║
    echo echo  ╚══════════════════════════════════════════════════╝
    echo echo.
    echo echo  [1/3] Removendo executavel...
    echo if exist "%EXE%" ^(
    echo     del /q "%EXE%"
    echo     echo         OK
    echo ^) else echo         Ja removido.
    echo echo.
    echo echo  [2/3] Removendo C:\Users\Usuario\bin do PATH do usuario...
    echo set "CURRENT_PATH="
    echo for /f "tokens=2*" %%%%a in ^('reg query "HKCU\Environment" /v PATH 2^^^>nul'^) do set "CURRENT_PATH=%%%%b"
    echo set "NEW_PATH=!CURRENT_PATH:;%DST_BIN%=!"
    echo set "NEW_PATH=!NEW_PATH:%DST_BIN%;=!"
    echo set "NEW_PATH=!NEW_PATH:%DST_BIN%=!"
    echo reg add "HKCU\Environment" /v PATH /t REG_EXPAND_SZ /d "!NEW_PATH!" /f ^>nul
    echo echo         OK
    echo echo.
    echo echo  [3/3] Opcional: remover diretorio bin se vazio...
    echo rmdir "%DST_BIN%" 2^^^>nul
    echo if exist "%DST_BIN%" ^(
    echo     echo         Diretorio nao vazio, mantemos.
    echo ^) else echo         Diretorio removido.
    echo echo.
    echo echo  GAMA VOZ CLI desinstalado.
    echo pause
) > "%UNINSTALLER%"

echo         OK
echo.

echo  ═══════════════════════════════════════════════════
echo   GAMA VOZ CLI instalado com sucesso!
echo  ═══════════════════════════════════════════════════
echo.
echo   Uso:
echo.
echo     C:\^> gamavoz
echo.
echo   Resultado: inicia os 4 componentes e mostra URLs.
echo.
echo   Desinstalar:
echo     C:\^> gamavoz-uninstall
echo.
echo   NOTA: abra um NOVO terminal para o PATH pegar efeito.
echo   Ou execute em CMD ja aberto:
echo.
echo     set PATH=%%PATH%%;C:\Users\Usuario\bin
echo.
echo  ═══════════════════════════════════════════════════
echo.
pause
