@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo       Polycheck Attendance System - Local Setup
echo ========================================================
echo.

:: 1. Check if Docker is installed and running
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker is not running or not installed!
    echo Please make sure Docker Desktop is started, then try again.
    echo.
    pause
    exit /b 1
)

:: 2. Ensure .env.docker.local exists
if not exist ".env.docker.local" (
    if exist ".env.docker.local.example" (
        echo [INFO] Creating .env.docker.local from template...
        copy ".env.docker.local.example" ".env.docker.local" >nul
    )
)

:: 3. Run docker compose up with build
echo [INFO] Starting Polycheck stack (Postgres, Redis, Migrations, Seed, Backend, Frontend)...
echo [INFO] Building images and initializing services...
echo.

docker compose -f docker-compose.local.yml up -d --build

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Docker compose failed to start!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo       Waiting for services to become healthy...
echo ========================================================
echo.

:: Poll until http://localhost:4000/api/health/ready responds
for /l %%i in (1,1,30) do (
    timeout /t 2 /nobreak >nul
    curl -s http://localhost:4000/api/health/ready >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        goto ready
    )
    echo ... waiting for backend and database readiness [attempt %%i/30] ...
)

:ready
echo.
echo ========================================================
echo       Polycheck is LIVE!
echo ========================================================
echo.
echo   Web Dashboard:  http://localhost:3000/login
echo   Backend API:    http://localhost:4000/api
echo   Health Probe:   http://localhost:4000/api/health/ready
echo.
echo   Seeded Test Accounts (Default Password: PolycheckLocal1!)
echo     - Super Admin:  mcreyes@pup.edu.ph
echo     - Teacher:      jmdelacruz@pup.edu.ph
echo     - Student:      2024-00001-MN-0
echo.
echo ========================================================
echo Opening web dashboard in default browser...
start http://localhost:3000/login
echo.
pause

