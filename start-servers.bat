@echo off
title Student Dashboard - Server Launcher
color 0A
echo.
echo  ============================================
echo    Student Dashboard - Starting All Servers
echo  ============================================
echo.

cd /d "%~dp0"

:: Kill anything already on port 8000 or 3000 (optional cleanup)
echo  [1/3] Cleaning up old processes on ports 8000 and 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000.*LISTENING" 2^>nul') do taskkill /PID %%a /F >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING" 2^>nul') do taskkill /PID %%a /F >nul 2>nul
timeout /t 2 /nobreak >nul

:: Start Backend (FastAPI on port 8000)
echo  [2/3] Starting Backend (FastAPI on port 8000)...
start "Backend - FastAPI :8000" cmd /k ".venv\Scripts\python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"
timeout /t 4 /nobreak >nul

:: Start Frontend (Vite React on port 3000)
echo  [3/3] Starting Frontend (React/Vite on port 3000)...
cd /d "%~dp0frontend"
start "Frontend - React :3000" cmd /k "npm run dev"

echo.
echo  ============================================
echo    Both servers are starting...
echo  ============================================
echo.
echo   Backend  API : http://127.0.0.1:8000
echo   Frontend App : http://localhost:3000
echo   API Docs     : http://127.0.0.1:8000/docs
echo.
echo   The frontend proxies /auth and /api to the backend.
echo   Login at: http://localhost:3000
echo.
pause
