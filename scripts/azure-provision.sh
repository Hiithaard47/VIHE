#!/usr/bin/env bash
# Provision Vihe App on Azure (centralindia / Mumbai by default):
#   Resource group, ACR, Postgres Flexible Server, Blob Storage, Container Apps.
#
# Prerequisites:
#   - Azure CLI: brew install azure-cli
#   - az login   (subscription with Owner/Contributor)
#   - Image build/push via GitHub Actions (local Docker optional: SKIP_LOCAL_BUILD=0)
#
# Usage:
#   export ADMIN_EMAIL=you@your.org
#   ./scripts/azure-provision.sh              # full stack
#   ./scripts/azure-provision.sh build-push   # rebuild/push image only
#   ./scripts/azure-provision.sh app-update   # update container app image + env
#   ./scripts/azure-provision.sh summary
#
# Secrets: .azure-deploy-secrets.local (gitignored). Do not commit.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REGION="${AZURE_LOCATION:-centralindia}"
RG="${AZURE_RG:-rg-vihe-app}"
APP_NAME="${AZURE_APP_NAME:-vihe-app}"
ENV_NAME="${AZURE_CAE_NAME:-cae-vihe}"
PG_NAME="${AZURE_PG_NAME:-vihe-pg}"
PG_ADMIN="${AZURE_PG_ADMIN:-viheadmin}"
PG_DB="${AZURE_PG_DB:-vihe_app}"
STORAGE_CONTAINER="${AZURE_STORAGE_CONTAINER:-session-files}"
SECRETS_FILE="${SECRETS_FILE:-$ROOT/.azure-deploy-secrets.local}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_az() {
  command -v az >/dev/null || die "Azure CLI required. Install: brew install azure-cli"
  az account show >/dev/null 2>&1 || die "Not logged in. Run: az login"
}

load_secrets() {
  [[ -f "$SECRETS_FILE" ]] || return 0
  local key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    if [[ "$val" == \'*\' ]]; then
      val="${val:1:${#val}-2}"
      val="${val//\'\\\'\'/\'}"
    fi
    printf -v "$key" '%s' "$val"
    export "$key"
  done <"$SECRETS_FILE"
}

save_secret() {
  local key="$1" val="$2" quoted tmp
  quoted="'${val//\'/\'\\\'\'}'"
  touch "$SECRETS_FILE"
  chmod 600 "$SECRETS_FILE"
  tmp="$(mktemp)"
  if grep -q "^${key}=" "$SECRETS_FILE" 2>/dev/null; then
    awk -v k="$key" -v v="$quoted" 'BEGIN{FS=OFS="="} $1==k {$0=k"="v} {print}' "$SECRETS_FILE" >"$tmp"
    mv "$tmp" "$SECRETS_FILE"
  else
    rm -f "$tmp"
    printf '%s=%s\n' "$key" "$quoted" >>"$SECRETS_FILE"
  fi
  chmod 600 "$SECRETS_FILE"
}

rand_alnum() {
  openssl rand -hex 4
}

unique_storage_name() {
  # Storage account: 3-24 lowercase alphanumeric
  printf 'vihest%s' "$(openssl rand -hex 4)"
}

unique_acr_name() {
  # ACR: 5-50 alphanumeric
  printf 'viheacr%s' "$(openssl rand -hex 3)"
}

step_providers() {
  require_az
  local ns
  # Fresh Pay-As-You-Go subscriptions often lack these until first use.
  for ns in \
    Microsoft.ContainerRegistry \
    Microsoft.App \
    Microsoft.DBforPostgreSQL \
    Microsoft.Storage \
    Microsoft.OperationalInsights \
    Microsoft.Network \
    Microsoft.Insights
  do
    local state
    state="$(az provider show --namespace "$ns" --query registrationState -o tsv 2>/dev/null || true)"
    if [[ "$state" != "Registered" ]]; then
      log "Registering provider $ns (was: ${state:-unknown})"
      az provider register --namespace "$ns" --wait --output none
    else
      log "Provider $ns already registered"
    fi
  done
}

step_rg() {
  require_az
  log "Resource group $RG ($REGION)"
  az group create --name "$RG" --location "$REGION" --output none
  save_secret AZURE_RG "$RG"
  save_secret AZURE_LOCATION "$REGION"
}

step_acr() {
  load_secrets
  if [[ -z "${ACR_NAME:-}" ]]; then
    ACR_NAME="$(unique_acr_name)"
  fi
  log "ACR $ACR_NAME"
  if ! az acr show --name "$ACR_NAME" --resource-group "$RG" >/dev/null 2>&1; then
    az acr create --name "$ACR_NAME" --resource-group "$RG" --sku Basic --admin-enabled true --output none
  fi
  ACR_LOGIN_SERVER="$(az acr show --name "$ACR_NAME" --resource-group "$RG" --query loginServer -o tsv)"
  save_secret ACR_NAME "$ACR_NAME"
  save_secret ACR_LOGIN_SERVER "$ACR_LOGIN_SERVER"
}

step_storage() {
  load_secrets
  if [[ -z "${STORAGE_ACCOUNT:-}" ]]; then
    STORAGE_ACCOUNT="$(unique_storage_name)"
  fi
  log "Storage account $STORAGE_ACCOUNT / container $STORAGE_CONTAINER"
  if ! az storage account show --name "$STORAGE_ACCOUNT" --resource-group "$RG" >/dev/null 2>&1; then
    az storage account create \
      --name "$STORAGE_ACCOUNT" \
      --resource-group "$RG" \
      --location "$REGION" \
      --sku Standard_LRS \
      --kind StorageV2 \
      --allow-blob-public-access false \
      --output none
  fi
  AZURE_STORAGE_CONNECTION_STRING="$(az storage account show-connection-string \
    --name "$STORAGE_ACCOUNT" --resource-group "$RG" --query connectionString -o tsv)"
  az storage container create \
    --name "$STORAGE_CONTAINER" \
    --connection-string "$AZURE_STORAGE_CONNECTION_STRING" \
    --output none >/dev/null || true
  save_secret STORAGE_ACCOUNT "$STORAGE_ACCOUNT"
  save_secret AZURE_STORAGE_CONNECTION_STRING "$AZURE_STORAGE_CONNECTION_STRING"
  save_secret AZURE_STORAGE_CONTAINER "$STORAGE_CONTAINER"
}

step_postgres() {
  load_secrets
  if [[ -z "${PG_PASSWORD:-}" ]]; then
    PG_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
    save_secret PG_PASSWORD "$PG_PASSWORD"
  fi
  log "Postgres Flexible Server $PG_NAME (may take several minutes)"
  if ! az postgres flexible-server show --name "$PG_NAME" --resource-group "$RG" >/dev/null 2>&1; then
    az postgres flexible-server create \
      --name "$PG_NAME" \
      --resource-group "$RG" \
      --location "$REGION" \
      --admin-user "$PG_ADMIN" \
      --admin-password "$PG_PASSWORD" \
      --sku-name Standard_B1ms \
      --tier Burstable \
      --storage-size 32 \
      --version 16 \
      --public-access 0.0.0.0-255.255.255.255 \
      --yes \
      --output none
  fi
  az postgres flexible-server db create \
    --resource-group "$RG" \
    --server-name "$PG_NAME" \
    --database-name "$PG_DB" \
    --output none >/dev/null 2>&1 || true

  PG_FQDN="$(az postgres flexible-server show --name "$PG_NAME" --resource-group "$RG" --query fullyQualifiedDomainName -o tsv)"
  # URL-encode password for DATABASE_URL
  PG_PASSWORD_ENC="$(
    PG_PASSWORD="$PG_PASSWORD" python3 -c 'import urllib.parse,os; print(urllib.parse.quote(os.environ["PG_PASSWORD"], safe=""))'
  )"
  DATABASE_URL="postgresql://${PG_ADMIN}:${PG_PASSWORD_ENC}@${PG_FQDN}:5432/${PG_DB}?schema=public&sslmode=require"
  save_secret PG_NAME "$PG_NAME"
  save_secret PG_FQDN "$PG_FQDN"
  save_secret PG_ADMIN "$PG_ADMIN"
  save_secret DATABASE_URL "$DATABASE_URL"
  log "Postgres ready: $PG_FQDN"
}

step_build_push() {
  require_az
  load_secrets
  [[ -n "${ACR_NAME:-}" ]] || die "ACR_NAME missing. Run full provision first."
  [[ -n "${ACR_LOGIN_SERVER:-}" ]] || ACR_LOGIN_SERVER="$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)"

  # Primary path: GitHub Actions builds/pushes. Local Docker is opt-in only.
  if [[ "${SKIP_LOCAL_BUILD:-1}" == "1" ]]; then
    IMAGE_URI="${IMAGE_URI:-${ACR_LOGIN_SERVER}/${APP_NAME}:latest}"
    save_secret IMAGE_URI "$IMAGE_URI"
    log "Skipping local Docker build (SKIP_LOCAL_BUILD=1)."
    log "Push image via GitHub Actions: gh workflow run Deploy"
    log "Expected image: $IMAGE_URI"
    return 0
  fi

  IMAGE_URI="${ACR_LOGIN_SERVER}/${APP_NAME}:${IMAGE_TAG}"
  if ! command -v docker >/dev/null; then
    die "Docker CLI not found. Use GitHub Actions (default) or install Docker Desktop."
  fi
  if ! docker info >/dev/null 2>&1; then
    die "Docker daemon not running. Start Docker, or use: SKIP_LOCAL_BUILD=1 (GitHub Actions)."
  fi

  log "Building linux/amd64 locally → $IMAGE_URI"
  az acr login --name "$ACR_NAME"
  docker build --platform linux/amd64 -t "$IMAGE_URI" "$ROOT"
  docker push "$IMAGE_URI"
  save_secret IMAGE_URI "$IMAGE_URI"
  log "Image pushed: $IMAGE_URI"
}

wait_for_acr_image() {
  require_az
  load_secrets
  [[ -n "${ACR_NAME:-}" ]] || die "ACR_NAME missing"
  local repo="${APP_NAME}"
  local tag="${IMAGE_TAG:-latest}"
  local i=0
  log "Waiting for ACR image ${ACR_NAME}/${repo}:${tag} (from GitHub Actions)…"
  while true; do
    if az acr repository show-tags --name "$ACR_NAME" --repository "$repo" --query "[?@=='${tag}']" -o tsv 2>/dev/null | grep -qx "$tag"; then
      IMAGE_URI="${ACR_LOGIN_SERVER}/${repo}:${tag}"
      save_secret IMAGE_URI "$IMAGE_URI"
      log "Found $IMAGE_URI"
      return 0
    fi
    i=$((i + 1))
    if [[ $i -gt 90 ]]; then
      die "Timed out waiting for ${repo}:${tag}. Run: gh workflow run Deploy — then re-run app-update"
    fi
    sleep 20
  done
}

step_container_app() {
  require_az
  load_secrets
  [[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL missing"
  [[ -n "${ACR_NAME:-}" && -n "${ACR_LOGIN_SERVER:-}" ]] || die "ACR missing"

  # Prefer an image already in ACR (from GitHub Actions). Fallback: public placeholder,
  # then re-run app-update after Actions pushes the real image.
  if [[ -z "${IMAGE_URI:-}" ]]; then
    if az acr repository show-tags --name "$ACR_NAME" --repository "$APP_NAME" --query "[?@=='latest']" -o tsv 2>/dev/null | grep -qx latest; then
      IMAGE_URI="${ACR_LOGIN_SERVER}/${APP_NAME}:latest"
      save_secret IMAGE_URI "$IMAGE_URI"
    elif [[ "${WAIT_FOR_IMAGE:-0}" == "1" ]]; then
      wait_for_acr_image
      load_secrets
    else
      IMAGE_URI="${PLACEHOLDER_IMAGE:-mcr.microsoft.com/k8se/quickstart:latest}"
      log "No ACR image yet — creating app with placeholder $IMAGE_URI (GHA will replace it)"
    fi
  fi
  load_secrets

  if [[ -z "${AUTH_SECRET:-}" ]]; then
    AUTH_SECRET="$(openssl rand -base64 32)"
    save_secret AUTH_SECRET "$AUTH_SECRET"
  fi
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
  if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
    ADMIN_PASSWORD="$(openssl rand -base64 16 | tr -d '/+=' | head -c 16)"
  fi
  save_secret ADMIN_EMAIL "$ADMIN_EMAIL"
  save_secret ADMIN_PASSWORD "$ADMIN_PASSWORD"

  log "Ensuring Container Apps extension"
  az extension add --name containerapp --upgrade --yes >/dev/null 2>&1 || true
  az provider register --namespace Microsoft.App --wait >/dev/null 2>&1 || true
  az provider register --namespace Microsoft.OperationalInsights --wait >/dev/null 2>&1 || true

  log "Log Analytics workspace"
  LAW_NAME="${LAW_NAME:-law-vihe}"
  if ! az monitor log-analytics workspace show --resource-group "$RG" --workspace-name "$LAW_NAME" >/dev/null 2>&1; then
    az monitor log-analytics workspace create \
      --resource-group "$RG" \
      --workspace-name "$LAW_NAME" \
      --location "$REGION" \
      --output none
  fi
  LAW_ID="$(az monitor log-analytics workspace show --resource-group "$RG" --workspace-name "$LAW_NAME" --query customerId -o tsv)"
  LAW_KEY="$(az monitor log-analytics workspace get-shared-keys --resource-group "$RG" --workspace-name "$LAW_NAME" --query primarySharedKey -o tsv)"
  save_secret LAW_NAME "$LAW_NAME"

  log "Container Apps environment $ENV_NAME"
  if ! az containerapp env show --name "$ENV_NAME" --resource-group "$RG" >/dev/null 2>&1; then
    az containerapp env create \
      --name "$ENV_NAME" \
      --resource-group "$RG" \
      --location "$REGION" \
      --logs-workspace-id "$LAW_ID" \
      --logs-workspace-key "$LAW_KEY" \
      --output none
  fi

  ACR_USER="$(az acr credential show --name "$ACR_NAME" --query username -o tsv)"
  ACR_PASS="$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)"

  # Placeholder AUTH_URL until FQDN known
  AUTH_URL="${AUTH_URL:-https://placeholder.local}"
  save_secret AUTH_URL "$AUTH_URL"

  local target_port=8080
  if [[ "$IMAGE_URI" == *"/k8se/quickstart"* ]]; then
    target_port=80
  fi

  local registry_args=()
  if [[ "$IMAGE_URI" == "${ACR_LOGIN_SERVER}"/* ]]; then
    registry_args=(
      --registry-server "$ACR_LOGIN_SERVER"
      --registry-username "$ACR_USER"
      --registry-password "$ACR_PASS"
    )
  fi

  if az containerapp show --name "$APP_NAME" --resource-group "$RG" >/dev/null 2>&1; then
    log "Updating Container App $APP_NAME"
    if [[ "$IMAGE_URI" == "${ACR_LOGIN_SERVER}"/* ]]; then
      az containerapp registry set \
        --name "$APP_NAME" \
        --resource-group "$RG" \
        --server "$ACR_LOGIN_SERVER" \
        --username "$ACR_USER" \
        --password "$ACR_PASS" \
        --output none
    fi
    az containerapp ingress update \
      --name "$APP_NAME" \
      --resource-group "$RG" \
      --target-port "$target_port" \
      --output none 2>/dev/null || true
    az containerapp update \
      --name "$APP_NAME" \
      --resource-group "$RG" \
      --image "$IMAGE_URI" \
      --set-env-vars \
        "DATABASE_URL=$DATABASE_URL" \
        "AUTH_URL=$AUTH_URL" \
        "AUTH_SECRET=$AUTH_SECRET" \
        "ADMIN_EMAIL=$ADMIN_EMAIL" \
        "ADMIN_PASSWORD=$ADMIN_PASSWORD" \
        "AZURE_STORAGE_CONNECTION_STRING=$AZURE_STORAGE_CONNECTION_STRING" \
        "AZURE_STORAGE_CONTAINER=$STORAGE_CONTAINER" \
        "PORT=8080" \
      --output none
  else
    log "Creating Container App $APP_NAME"
    az containerapp create \
      --name "$APP_NAME" \
      --resource-group "$RG" \
      --environment "$ENV_NAME" \
      --image "$IMAGE_URI" \
      "${registry_args[@]}" \
      --target-port "$target_port" \
      --ingress external \
      --cpu 0.5 \
      --memory 1.0Gi \
      --min-replicas 1 \
      --max-replicas 2 \
      --env-vars \
        "DATABASE_URL=$DATABASE_URL" \
        "AUTH_URL=$AUTH_URL" \
        "AUTH_SECRET=$AUTH_SECRET" \
        "ADMIN_EMAIL=$ADMIN_EMAIL" \
        "ADMIN_PASSWORD=$ADMIN_PASSWORD" \
        "AZURE_STORAGE_CONNECTION_STRING=$AZURE_STORAGE_CONNECTION_STRING" \
        "AZURE_STORAGE_CONTAINER=$STORAGE_CONTAINER" \
        "PORT=8080" \
      --output none
  fi

  FQDN="$(az containerapp show --name "$APP_NAME" --resource-group "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
  AUTH_URL="https://${FQDN}"
  save_secret AUTH_URL "$AUTH_URL"
  save_secret APP_FQDN "$FQDN"

  log "Setting AUTH_URL=$AUTH_URL"
  az containerapp update \
    --name "$APP_NAME" \
    --resource-group "$RG" \
    --set-env-vars "AUTH_URL=$AUTH_URL" \
    --output none

  print_summary
  if [[ "$IMAGE_URI" == *"/k8se/quickstart"* ]]; then
    log "Placeholder image is live. After GitHub Actions pushes to ACR, run: ./scripts/azure-provision.sh app-update"
  fi
}

print_summary() {
  load_secrets
  cat <<EOF

--- Vihe Azure deploy (${REGION}) ---
Resource group: ${RG}
Container App:  ${APP_NAME}
Image:          ${IMAGE_URI:-}
Service URL:    ${AUTH_URL:-}
Admin login:    ${ADMIN_EMAIL:-} / ${ADMIN_PASSWORD:-}
Postgres:       ${PG_FQDN:-}
Storage:        ${STORAGE_ACCOUNT:-} / ${STORAGE_CONTAINER:-}
Secrets file:   ${SECRETS_FILE}  (chmod 600 — do not commit)

Sign in at /login once the URL is healthy.
Migrations run on container start (prisma migrate deploy).

EOF
}

run_all() {
  step_providers
  step_rg
  step_acr
  step_storage
  step_postgres
  # Image build/push is GitHub Actions (see .github/workflows/deploy.yml).
  SKIP_LOCAL_BUILD=1 step_build_push
  step_container_app
}

main() {
  if [[ $# -eq 0 ]]; then
    run_all
    return
  fi
  for cmd in "$@"; do
    case "$cmd" in
      providers) step_providers ;;
      rg) step_rg ;;
      acr) step_acr ;;
      storage) step_storage ;;
      postgres) step_postgres ;;
      build-push) step_build_push ;;
      app-update|container-app) step_container_app ;;
      summary) print_summary ;;
      *) die "Unknown step: $cmd (try: providers rg acr storage postgres build-push app-update summary)" ;;
    esac
  done
}

main "$@"
