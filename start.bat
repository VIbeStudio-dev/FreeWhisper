@echo off
title FreeWhisper Launcher

echo ===============================
echo   Starting FreeWhisper
echo ===============================
echo.

echo [1/2] Starting backend (FastAPI)...
start "FreeWhisper Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000"

echo     Waiting for backend to boot...
timeout /t 4 /nobreak >nul

echo [2/2] Starting frontend (Tauri)...
cd /d "%~dp0frontend"
npm run tauri dev

echo.
echo Frontend closed. You can close the backend window manually.
pause
