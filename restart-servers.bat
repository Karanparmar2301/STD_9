@echo off
echo ========================================
echo  RESTARTING STUDENT DASHBOARD SERVERS
echo ========================================
echo.

echo [1/4] Stopping existing processes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM python.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/4] Starting Backend Server (Port 8000)...
start "Backend - FastAPI" cmd /k "cd /d "%~dp0" && .venv\Scripts\python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"
timeout /t 3 /nobreak >nul

echo [3/4] Starting Frontend Server (Port 3000)...
start "Frontend - React" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 2 /nobreak >nul

echo [4/4] Servers starting...
echo.
echo ========================================
echo  SERVERS ARE RUNNING
echo ========================================
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:3000
echo ========================================
echo.
echo Press any key to close this window...
pause >nul
