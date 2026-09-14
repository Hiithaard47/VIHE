#!/usr/bin/env bash
# One-time: Azure AD app + federated credential so GitHub Actions can
# push to ACR and update the Container App (no long-lived client secrets).
#
# Usage:
#   export GITHUB_REPO=parmod-arora/vihe-app
#   ./scripts/azure-oidc-setup.sh
#
# Then set GitHub Actions secrets/variables printed at the end.

set -euo pipefail

command -v az >/dev/null || { echo "Azure CLI required"; exit 1; }
az account show >/dev/null 2>&1 || { echo "Run: az login"; exit 1; }

GITHUB_REPO="${GITHUB_REPO:-parmod-arora/vihe-app}"
APP_NAME="${AZURE_OIDC_APP_NAME:-vihe-github-actions}"
RG="${AZURE_RG:-rg-vihe-app}"
SUB_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"

log() { printf '==> %s\n' "$*"; }

log "Creating Azure AD app $APP_NAME (idempotent)"
APP_ID="$(az ad app list --display-name "$APP_NAME" --query '[0].appId' -o tsv)"
if [[ -z "$APP_ID" || "$APP_ID" == "None" ]]; then
  APP_ID="$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)"
fi

SP_ID="$(az ad sp list --filter "appId eq '$APP_ID'" --query '[0].id' -o tsv)"
if [[ -z "$SP_ID" || "$SP_ID" == "None" ]]; then
  SP_ID="$(az ad sp create --id "$APP_ID" --query id -o tsv)"
fi

log "Assigning Contributor on subscription (and RG if it exists)"
az role assignment create \
  --assignee "$APP_ID" \
  --role Contributor \
  --scope "/subscriptions/${SUB_ID}" \
  --output none 2>/dev/null || true
if az group show --name "$RG" >/dev/null 2>&1; then
  az role assignment create \
    --assignee "$APP_ID" \
    --role Contributor \
    --scope "/subscriptions/${SUB_ID}/resourceGroups/${RG}" \
    --output none 2>/dev/null || true
fi
# AcrPush for registry pushes
az role assignment create \
  --assignee "$APP_ID" \
  --role AcrPush \
  --scope "/subscriptions/${SUB_ID}" \
  --output none 2>/dev/null || true

FED_NAME="github-${GITHUB_REPO//\//-}"
log "Federated credential $FED_NAME for repo $GITHUB_REPO (main + environment)"
# Remove existing same-name cred if present
EXISTING="$(az ad app federated-credential list --id "$APP_ID" --query "[?name=='$FED_NAME'].name" -o tsv)"
if [[ -n "$EXISTING" ]]; then
  az ad app federated-credential delete --id "$APP_ID" --federated-credential-id "$FED_NAME" >/dev/null 2>&1 || true
fi

TMP="$(mktemp)"
cat >"$TMP" <<EOF
{
  "name": "${FED_NAME}",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:${GITHUB_REPO}:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"],
  "description": "GitHub Actions main branch"
}
EOF
az ad app federated-credential create --id "$APP_ID" --parameters @"$TMP" --output none

# Also allow workflow_dispatch from any ref under the repo via environment subject
FED_ENV="github-${GITHUB_REPO//\//-}-env"
EXISTING_ENV="$(az ad app federated-credential list --id "$APP_ID" --query "[?name=='$FED_ENV'].name" -o tsv)"
if [[ -n "$EXISTING_ENV" ]]; then
  az ad app federated-credential delete --id "$APP_ID" --federated-credential-id "$FED_ENV" >/dev/null 2>&1 || true
fi
cat >"$TMP" <<EOF
{
  "name": "${FED_ENV}",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:${GITHUB_REPO}:environment:production",
  "audiences": ["api://AzureADTokenExchange"],
  "description": "GitHub Actions production environment"
}
EOF
az ad app federated-credential create --id "$APP_ID" --parameters @"$TMP" --output none || true
rm -f "$TMP"

cat <<EOF

--- Azure GitHub OIDC ready ---
Tenant:         ${TENANT_ID}
Subscription:   ${SUB_ID}
App (client):   ${APP_ID}

Add GitHub → Settings → Secrets and variables → Actions → Secrets:
  AZURE_CLIENT_ID       = ${APP_ID}
  AZURE_TENANT_ID       = ${TENANT_ID}
  AZURE_SUBSCRIPTION_ID = ${SUB_ID}

Variables (optional; defaults match provision script):
  AZURE_RG           = ${RG}
  AZURE_APP_NAME     = vihe-app
  AZURE_ACR_NAME     = <from .azure-deploy-secrets.local ACR_NAME>
  AZURE_LOCATION     = centralindia

Day-to-day: merge to main (or Actions → Deploy → Run workflow).
First-time: ./scripts/azure-provision.sh

EOF
