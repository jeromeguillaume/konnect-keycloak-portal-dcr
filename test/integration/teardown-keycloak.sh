#!/usr/bin/env bash
# Removes the Keycloak container started by setup-keycloak.sh.
set -euo pipefail
CONTAINER="${KC_CONTAINER:-keycloak-dcr-it}"
echo "[teardown-keycloak] removing container '${CONTAINER}'" >&2
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
