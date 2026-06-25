#!/usr/bin/env bash
#
# Spins up a live Keycloak in Docker and provisions the realm + `kong-sa`
# service-account client that the DCR bridge needs, then prints the bridge
# environment (KEYCLOAK_* / KONG_API_TOKENS) on stdout as `KEY=VALUE` lines.
#
# Notably it does NOT create a Client Registration Initial Access Token (IAT):
# the whole point of the fix is that `kong-sa` (which holds the `create-client`
# role) is sufficient for every operation, including client creation.
#
# Provisioning is done through the Keycloak Admin REST API with curl + jq, so
# it does not depend on the in-container `kcadm.sh` (whose JVM crashes with
# SIGILL on some Apple Silicon / vz setups).
#
# Usage:
#   eval "$(test/integration/setup-keycloak.sh)"   # provision + export env
#   test/integration/teardown-keycloak.sh          # remove the container
#
# All diagnostics go to stderr so stdout stays clean for `eval`.
set -euo pipefail

CONTAINER="${KC_CONTAINER:-keycloak-dcr-it}"
IMAGE="${KC_IMAGE:-quay.io/keycloak/keycloak:26.0}"
PORT="${KC_PORT:-8080}"
REALM="${KC_REALM:-dcr-test}"
ADMIN_USER="${KC_ADMIN_USER:-admin}"
ADMIN_PASS="${KC_ADMIN_PASS:-admin}"
CLIENT_ID="${KC_CLIENT_ID:-kong-sa}"
API_KEY="${KC_API_KEY:-an-integration-test-api-key}"
BASE="http://localhost:${PORT}"

log() { echo "[setup-keycloak] $*" >&2; }

# 1) Start Keycloak if it is not already running.
if [ -z "$(docker ps -q -f "name=^${CONTAINER}$")" ]; then
  log "starting Keycloak container '${CONTAINER}' from ${IMAGE}"
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  # -XX:UseSVE=0 avoids a JDK SIGILL on Apple Silicon / vz VMs.
  docker run -d --name "$CONTAINER" -p "${PORT}:8080" \
    -e KC_BOOTSTRAP_ADMIN_USERNAME="$ADMIN_USER" \
    -e KC_BOOTSTRAP_ADMIN_PASSWORD="$ADMIN_PASS" \
    -e JAVA_OPTS_APPEND="-XX:UseSVE=0" \
    "$IMAGE" start-dev >/dev/null
else
  log "reusing already-running container '${CONTAINER}'"
fi

# 2) Wait until the master realm answers.
log "waiting for Keycloak to become ready at ${BASE} ..."
for i in $(seq 1 60); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/realms/master")" = "200" ]; then
    log "Keycloak ready"
    break
  fi
  sleep 2
  if [ "$i" = "60" ]; then log "ERROR: Keycloak did not become ready"; exit 1; fi
done

# --- Admin REST helpers --------------------------------------------------
admin_token() {
  curl -s --fail "${BASE}/realms/master/protocol/openid-connect/token" \
    -d "grant_type=password" -d "client_id=admin-cli" \
    -d "username=${ADMIN_USER}" -d "password=${ADMIN_PASS}" | jq -r .access_token
}
TOKEN="$(admin_token)"
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || { log "ERROR: could not obtain admin token"; exit 1; }
log "obtained admin access token"

api() { # METHOD PATH [JSON_BODY]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -w '\n%{http_code}' -X "$method" "${BASE}/admin/realms/${path}" \
      -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -d "$body"
  else
    curl -s -w '\n%{http_code}' -X "$method" "${BASE}/admin/realms/${path}" \
      -H "Authorization: Bearer ${TOKEN}"
  fi
}
api_get() { curl -s --fail "${BASE}/admin/realms/$1" -H "Authorization: Bearer ${TOKEN}"; }

# 3) Create the realm (idempotent).
if api_get "${REALM}" >/dev/null 2>&1; then
  log "realm '${REALM}' already exists"
else
  api POST "" "{\"realm\":\"${REALM}\",\"enabled\":true}" >/dev/null
  log "created realm '${REALM}'"
fi

# 4) Create the `kong-sa` confidential client with service accounts enabled
#    (idempotent).
CID="$(api_get "${REALM}/clients?clientId=${CLIENT_ID}" | jq -r '.[0].id // empty')"
if [ -z "$CID" ]; then
  api POST "${REALM}/clients" "$(jq -nc \
    --arg cid "$CLIENT_ID" \
    '{clientId:$cid, enabled:true, publicClient:false, serviceAccountsEnabled:true, standardFlowEnabled:true, directAccessGrantsEnabled:true, redirectUris:["http://*","https://*"]}')" >/dev/null
  CID="$(api_get "${REALM}/clients?clientId=${CLIENT_ID}" | jq -r '.[0].id // empty')"
  log "created client '${CLIENT_ID}' (id=${CID})"
else
  log "client '${CLIENT_ID}' already exists (id=${CID})"
fi
[ -n "$CID" ] || { log "ERROR: could not resolve client id"; exit 1; }

# 5) Assign the realm-management roles to kong-sa's service account.
#    `create-client` is the role that makes the OIDC client-registration
#    endpoint accept kong-sa's bearer token in place of an IAT.
SA_USER_ID="$(api_get "${REALM}/clients/${CID}/service-account-user" | jq -r '.id')"
RM_CID="$(api_get "${REALM}/clients?clientId=realm-management" | jq -r '.[0].id')"
RM_ROLES="$(api_get "${REALM}/clients/${RM_CID}/roles")"
ROLES_PAYLOAD="$(echo "$RM_ROLES" | jq -c '[ .[] | select(.name=="create-client" or .name=="manage-clients" or .name=="query-clients" or .name=="view-clients") | {id, name} ]')"
api POST "${REALM}/users/${SA_USER_ID}/role-mappings/clients/${RM_CID}" "$ROLES_PAYLOAD" >/dev/null
log "assigned realm-management roles: create-client manage-clients query-clients view-clients"

# 6) Read back the generated client secret.
SECRET="$(api_get "${REALM}/clients/${CID}/client-secret" | jq -r '.value')"
[ -n "$SECRET" ] && [ "$SECRET" != "null" ] || { log "ERROR: could not read client secret"; exit 1; }
log "fetched client secret for '${CLIENT_ID}'"

# 7) Emit the bridge environment on stdout.
cat <<EOF
KEYCLOAK_CLIENT_ID=${CLIENT_ID}
KEYCLOAK_CLIENT_SECRET=${SECRET}
KEYCLOAK_DOMAIN=${BASE}/realms/${REALM}/
KONG_API_TOKENS=${API_KEY}
EOF
