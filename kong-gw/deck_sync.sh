#!/bin/bash
deck gateway sync --konnect-token $KONNECT_TOKEN --konnect-addr https://eu.api.konghq.com --konnect-control-plane-name "DCR Bridge" --select-tag keycloak-dcr kong-keycloak-dcr.yaml
