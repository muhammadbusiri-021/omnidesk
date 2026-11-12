@echo off
title OmniDesk - Remote Controller
cd /d "%~dp0"

echo ========================================================
echo         OMNIDESK - CONTROLLER CONSOLE
echo ========================================================
echo.
echo [1/2] Memastikan Layanan Berjalan...

:: Jalankan server node di background jika belum berjalan
start /b cmd /c "node server.js > "%TEMP%\omnidesk_server.log" 2>&1"

timeout /t 2 /nobreak >nul

echo [2/2] Membuka Controller Workspace...

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:3920/?mode=controller" --window-size=1200,800
    goto :done
)

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://localhost:3920/?mode=controller" --window-size=1200,800
    goto :done
)

start http://localhost:3920/?mode=controller

:done
echo.
echo ========================================================
echo   OmniDesk Controller Siap Digunakan!
echo   Masukkan Device ID & PIN Host untuk mulai mengontrol.
echo ========================================================
echo.
pause
