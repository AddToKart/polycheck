@echo off
echo ========================================================
echo       Stopping Polycheck Local Stack
echo ========================================================
echo.

docker compose -f docker-compose.local.yml down

echo.
echo Polycheck local stack has been stopped.
pause

