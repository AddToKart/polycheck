@echo off
echo ========================================================
echo       Stopping PolyCheck Local Stack
echo ========================================================
echo.

docker compose -f docker-compose.local.yml down

echo.
echo PolyCheck local stack has been stopped.
pause

