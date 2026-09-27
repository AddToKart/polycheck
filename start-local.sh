#!/usr/bin/env bash
set -e

echo "========================================================"
echo "      Polycheck Attendance System - Local Setup"
echo "========================================================"
echo ""

# 1. Check if Docker is installed and running
if ! docker info >/dev/null 2>&1; then
    echo "[ERROR] Docker is not running or not installed!"
    echo "Please ensure Docker Desktop / Docker daemon is running."
    exit 1
fi

# 2. Ensure .env.docker.local exists
if [ ! -f ".env.docker.local" ] && [ -f ".env.docker.local.example" ]; then
    echo "[INFO] Creating .env.docker.local from template..."
    cp ".env.docker.local.example" ".env.docker.local"
fi

# 3. Boot compose
echo "[INFO] Starting Polycheck stack (Postgres, Redis, Migrations, Seed, Backend, Frontend)..."
docker compose -f docker-compose.local.yml up -d --build

echo ""
echo "Waiting for services to become healthy..."
for i in {1..30}; do
    if curl -s http://localhost:4000/api/health/ready >/dev/null 2>&1; then
        break
    fi
    echo "... waiting for backend and database readiness (attempt $i/30) ..."
    sleep 2
done

echo ""
echo "========================================================"
echo "      Polycheck is LIVE!"
echo "========================================================"
echo ""
echo "  Web Dashboard:  http://localhost:3000/login"
echo "  Backend API:    http://localhost:4000/api"
echo "  Health Probe:   http://localhost:4000/api/health/ready"
echo ""
echo "  Seeded Test Accounts (Default Password: PolycheckLocal1!)"
echo "    - Super Admin:  mcreyes@pup.edu.ph"
echo "    - Teacher:      jmdelacruz@pup.edu.ph"
echo "    - Student:      2024-00001-MN-0"
echo "========================================================"

# Try opening in browser if available
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:3000/login" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
    open "http://localhost:3000/login" >/dev/null 2>&1 &
fi
