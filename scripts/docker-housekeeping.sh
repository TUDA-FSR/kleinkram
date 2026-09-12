#!/usr/bin/env bash
# Weekly reclaim of rebuild leftovers. Each `docker compose build` leaves the
# previous image dangling and adds build-cache layers; nothing else removes them
# (one day of rebuilds added ~28 GB). Touches only unused cache, dangling
# images and stopped one-off containers - never volumes, never running images.
set -euo pipefail
echo "== $(date -Is) before: $(df -h / | awk 'NR==2{print $3" used, "$4" free"}')"
docker container prune -f --filter "until=24h" | tail -1
docker image prune -f | tail -1
docker builder prune -f --keep-storage 4GB | tail -1
echo "== after: $(df -h / | awk 'NR==2{print $3" used, "$4" free"}')"
