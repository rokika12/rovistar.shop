@echo off
setlocal
chcp 65001 >nul
title ROVISTAR MARKET - Startup

echo ========================================
echo       ROVISTAR MARKET - Local Startup
echo ========================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python មិនឃើញទេ។ សូមដំឡើង Python 3.11+ មុនសិន៖ https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js មិនឃើញទេ។ សូមដំឡើង Node.js 16+ មុនសិន៖ https://nodejs.org/
    pause
    exit /b 1
)

echo [1/3] Setting up Backend...
cd /d "%~dp0Backend_API"

if not exist venv\Scripts\python.exe (
    echo       Creating Python virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

if not exist .env (
    echo       Creating .env from template...
    copy .env.example .env >nul
    echo       [INFO] Please edit Backend_API\.env and set your database and secret key.
)

pip install -q -r requirements.txt
echo       Backend dependencies installed.

echo.
echo [2/3] Setting up Frontend_User...
cd /d "%~dp0Frontend_User"
if not exist node_modules (
    echo       Installing npm packages...
    call npm install --silent
)
echo       Frontend_User ready.

echo.
echo [3/3] Setting up Dashboard...
cd /d "%~dp0Frontend_Dashboard_User"
if not exist node_modules (
    echo       Installing npm packages...
    call npm install --silent
)
echo       Dashboard ready.

echo.
echo ========================================
echo       Starting services...
echo ========================================
echo.

REM Start Backend
echo [Backend] Starting FastAPI on http://localhost:8000
cd /d "%~dp0Backend_API"
start "ROVISTAR MARKET - Backend" cmd /c "call venv\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8000"

REM Wait for backend to start
echo       Waiting for backend...
timeout /t 3 /nobreak >nul

REM Start Frontend_User
echo [Storefront] Starting on http://localhost:3000
cd /d "%~dp0Frontend_User"
start "ROVISTAR MARKET - Storefront" cmd /c "set PORT=3000 && npm start"

REM Start Dashboard
echo [Dashboard] Starting on http://localhost:3002
cd /d "%~dp0Frontend_Dashboard_User"
start "ROVISTAR MARKET - Dashboard" cmd /c "set PORT=3002 && npm start"

echo.
echo ========================================
echo       All services started!
echo ========================================
echo.
echo   Storefront : http://localhost:3000
echo   Dashboard  : http://localhost:3002
echo   Backend    : http://localhost:8000
echo   API Docs   : http://localhost:8000/docs
echo.
echo   Default accounts:
echo   - Admin   : admin / ChangeMe123!
echo   - Demo    : demo / demo123
echo.
echo   Press any key to stop all services...
pause >nul

REM Kill all child processes
taskkill /FI "WINDOWTITLE eq ROVISTAR MARKET - *" /F >nul 2>&1
endlocal