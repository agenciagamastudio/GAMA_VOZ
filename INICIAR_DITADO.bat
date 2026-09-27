@echo off
title GAMA Voz - Ditado Global
echo ============================================
echo   GAMA Voz - Ditado Global
echo   Segure Ctrl+Shift+Alt+Z e fale.
echo   O texto vai sendo digitado onde o cursor estiver.
echo ============================================
cd /d "%~dp0backend"
python ditado_global.py
pause
