#!/usr/bin/env bash
echo "Stopping Polycheck local stack..."
docker compose -f docker-compose.local.yml down
echo "Done."
