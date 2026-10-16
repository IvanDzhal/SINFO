#!/usr/bin/env bash
# Оновлення на сервері (після заливки файлів через FileZilla): ./deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker image prune -f
docker compose -f docker-compose.prod.yml --env-file .env.production ps
