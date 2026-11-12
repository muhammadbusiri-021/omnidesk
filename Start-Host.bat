@echo off
title OmniDesk - Host Launcher
cd /d "%~dp0"

echo ========================================================
echo         OMNIDESK - PEER-TO-PEER REMOTE ACCESS
echo ========================================================
echo.
echo [1/2] Memulai Layanan Inti dan Input Engine...

:: Jalankan server node di background jika belum berjalan
start /b cmd /c "node server.js > "%TEMP%\omnidesk_server.log" 2>&1"

:: Tunggu 1.5 detik agar server siap
timeout /t 2 /nobreak >nul

echo [2/2] Membuka Antarmuka OmniDesk Host...

:: Coba buka via Microsoft Edge dalam mode Native Desktop App
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:3920/?mode=host" --window-size=1080,740
    goto :done
)

:: Alternatif Google Chrome dalam mode Native Desktop App
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://localhost:3920/?mode=host" --window-size=1080,740
    goto :done
)

:: Fallback browser default
start http://localhost:3920/?mode=host

:done
echo.
echo ========================================================
echo   Aplikasi OmniDesk Host Telah Aktif!
echo   Layar bagikan sekarang terbuka.
echo   Berikan 9-digit Device ID dan PIN kepada saudaramu.
echo ========================================================
echo.
pause
