@echo off
echo Starting FreeWhisper backend...
echo First run will download the large-v3 model (~1.5 GB) — this only happens once.
echo.
cd /d "%~dp0backend"
python -m uvicorn main:app --host 127.0.0.1 --port 8000
