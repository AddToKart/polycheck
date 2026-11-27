#!/usr/bin/env bash
echo "Stopping PolyCheck local stack..."
docker compose -f docker-compose.local.yml down
echo "Done."

