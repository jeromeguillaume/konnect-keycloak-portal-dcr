#!/usr/bin/env bash
#
# End-to-end integration run:
#   1. start + provision a live Keycloak (realm + kong-sa service account)
#   2. export the bridge environment
#   3. run the live Jest integration tests
#   4. tear the container down (unless KEEP_KEYCLOAK=1)
#
# Requires: docker (a running daemon), curl, jq.
set -euo pipefail
cd "$(dirname "$0")/../.."

cleanup() {
  if [ "${KEEP_KEYCLOAK:-0}" = "1" ]; then
    echo "[run] KEEP_KEYCLOAK=1 -> leaving Keycloak container running" >&2
  else
    bash test/integration/teardown-keycloak.sh
  fi
}
trap cleanup EXIT

# Provision Keycloak and load KEYCLOAK_* / KONG_API_TOKENS into the environment.
ENV_FILE="$(mktemp)"
bash test/integration/setup-keycloak.sh > "$ENV_FILE"
set -a; . "$ENV_FILE"; set +a
rm -f "$ENV_FILE"

echo "[run] running integration tests against ${KEYCLOAK_DOMAIN}" >&2
npx jest --config jest.integration.config.js "$@"
