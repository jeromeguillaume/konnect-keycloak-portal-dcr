# Konnect Portal DCR Handler for keycloak

## Keycloak configuration
Create a `kong-sa` clientId for the `applications` deletion
  Go on Service Account Roles
    Select `realm-management` in `Client Roles` and assign roles: 
      - `create-client`, 
      - `manage-clients`,
      - `query-clients`, 
      - `view-clients`


## Lambda function
Enable function URL
Edit runtime settings
  replace Handler value: index.handler to lambda.handler
Configuration
  Timeout change 3s to 1 min
  Environment Variable:
    KEYCLOAK_CR_INITIAL_AT
    KEYCLOAK_DOMAIN
    KONG_API_TOKENS
