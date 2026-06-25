#----------------------------------------------------------------
# Usually in Docker/Kubernetes environment we don't update the 
# environment variables with this static file but at the runtime
#----------------------------------------------------------------

# 'client' creation, deletion and refresh token => use client_id / client_secret
# of the `kong-sa` service account (which holds the `create-client` role)
# KEYCLOAK_CLIENT_ID=
# KEYCLOAK_CLIENT_SECRET=

## The base domain for the Identity Provider
# KEYCLOAK_DOMAIN=

## Comma-separated tokens from Konnect
# KONG_API_TOKENS=

