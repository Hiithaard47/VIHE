#!/usr/bin/env bash
# Provision Vihe App on AWS (ap-south-1 by default): S3, RDS Postgres 16, ECS Express Mode.
#
# App Runner is closed to new customers (30 Apr 2026). Use ecs-express instead.
#
# Prerequisites:
#   - AWS credentials: aws configure   OR   aws sso login
#   - Docker Desktop running (for ECR image build/push)
#
# Usage:
#   export AWS_REGION=ap-south-1
#   export ADMIN_EMAIL=you@your.org
#   ./scripts/aws-provision.sh              # S3 + RDS + ECS Express
#   ./scripts/aws-provision.sh ecs-express  # finish deploy (RDS/S3 already exist)
#   ./scripts/aws-provision.sh ecr-push     # rebuild/push image only
#   ./scripts/aws-provision.sh summary
#
# Secrets are written to .aws-deploy-secrets.local (gitignored). Do not commit.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

AWS="${AWS_CLI:-}"
if [[ -z "$AWS" ]]; then
  if [[ -x "$ROOT/.venv-awscli/bin/aws" ]]; then
    AWS="$ROOT/.venv-awscli/bin/aws"
  else
    AWS="aws"
  fi
fi

REGION="${AWS_REGION:-ap-south-1}"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/parmod-arora/vihe-app}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
SERVICE_NAME="${APPRUNNER_SERVICE_NAME:-vihe-app}"
DB_INSTANCE_ID="${RDS_INSTANCE_ID:-vihe-app-db}"
SECRETS_FILE="${SECRETS_FILE:-$ROOT/.aws-deploy-secrets.local}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_aws() {
  "$AWS" sts get-caller-identity --region "$REGION" >/dev/null \
    || die "No AWS credentials. Run: aws configure   or   aws sso login"
}

load_secrets() {
  if [[ ! -f "$SECRETS_FILE" ]]; then
    return 0
  fi
  # Parse KEY=VALUE lines; values may be single-quoted (needed for & in DATABASE_URL).
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
  local key="$1" val="$2"
  local quoted tmp
  # Single-quote so & ? = in URLs survive shell parse / reloads.
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

account_id() {
  "$AWS" sts get-caller-identity --query Account --output text
}

default_vpc_id() {
  "$AWS" ec2 describe-vpcs --region "$REGION" \
    --filters Name=isDefault,Values=true \
    --query 'Vpcs[0].VpcId' --output text
}

default_subnet_ids() {
  local vpc="$1"
  "$AWS" ec2 describe-subnets --region "$REGION" \
    --filters "Name=vpc-id,Values=$vpc" \
    --query 'Subnets[*].SubnetId' --output text
}

step_s3() {
  require_aws
  load_secrets
  local acct bucket user
  acct="$(account_id)"
  bucket="${S3_BUCKET:-vihe-resources-${acct}}"
  user="${S3_IAM_USER:-vihe-app-s3}"

  log "S3 bucket: $bucket (region $REGION)"
  if ! "$AWS" s3api head-bucket --bucket "$bucket" 2>/dev/null; then
    if [[ "$REGION" == "us-east-1" ]]; then
      "$AWS" s3api create-bucket --bucket "$bucket"
    else
      "$AWS" s3api create-bucket --bucket "$bucket" \
        --create-bucket-configuration "LocationConstraint=$REGION"
    fi
    "$AWS" s3api put-public-access-block --bucket "$bucket" \
      --public-access-block-configuration \
      BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  fi

  if ! "$AWS" iam get-user --user-name "$user" >/dev/null 2>&1; then
    "$AWS" iam create-user --user-name "$user" >/dev/null
  fi

  local policy_name="${user}-policy"
  local policy_doc
  policy_doc="$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:ListBucket","s3:HeadBucket"],
    "Resource": ["arn:aws:s3:::${bucket}", "arn:aws:s3:::${bucket}/*"]
  }]
}
EOF
)"
  local policy_arn
  policy_arn="$("$AWS" iam create-policy --policy-name "$policy_name" --policy-document "$policy_doc" \
    --query Policy.Arn --output text 2>/dev/null || \
    "$AWS" iam list-policies --scope Local --query "Policies[?PolicyName=='${policy_name}'].Arn | [0]" --output text)"

  "$AWS" iam attach-user-policy --user-name "$user" --policy-arn "$policy_arn" 2>/dev/null || true

  if [[ -z "${S3_ACCESS_KEY:-}" || -z "${S3_SECRET_KEY:-}" ]]; then
    log "Creating IAM access key for $user"
    read -r S3_ACCESS_KEY S3_SECRET_KEY <<<"$("$AWS" iam create-access-key --user-name "$user" \
      --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)"
    save_secret S3_ACCESS_KEY "$S3_ACCESS_KEY"
    save_secret S3_SECRET_KEY "$S3_SECRET_KEY"
  fi

  save_secret S3_BUCKET "$bucket"
  save_secret S3_REGION "$REGION"
  log "S3 ready. Bucket=$bucket"
}

step_network_sg() {
  require_aws
  load_secrets
  local vpc="${VPC_ID:-$(default_vpc_id)}"
  [[ "$vpc" != "None" && -n "$vpc" ]] || die "No default VPC in $REGION. Create a VPC or set VPC_ID."

  if [[ -z "${APPRUNNER_CONNECTOR_SG:-}" ]]; then
    APPRUNNER_CONNECTOR_SG="$("$AWS" ec2 create-security-group --region "$REGION" \
      --group-name vihe-apprunner-connector --description "Vihe App Runner VPC connector" \
      --vpc-id "$vpc" --query GroupId --output text 2>/dev/null || \
      "$AWS" ec2 describe-security-groups --region "$REGION" \
        --filters "Name=group-name,Values=vihe-apprunner-connector" "Name=vpc-id,Values=$vpc" \
        --query 'SecurityGroups[0].GroupId' --output text)"
    save_secret APPRUNNER_CONNECTOR_SG "$APPRUNNER_CONNECTOR_SG"
  fi

  if [[ -z "${RDS_SG:-}" ]]; then
    RDS_SG="$("$AWS" ec2 create-security-group --region "$REGION" \
      --group-name vihe-rds --description "Vihe RDS Postgres" \
      --vpc-id "$vpc" --query GroupId --output text 2>/dev/null || \
      "$AWS" ec2 describe-security-groups --region "$REGION" \
        --filters "Name=group-name,Values=vihe-rds" "Name=vpc-id,Values=$vpc" \
        --query 'SecurityGroups[0].GroupId' --output text)"
    save_secret RDS_SG "$RDS_SG"
    "$AWS" ec2 authorize-security-group-ingress --region "$REGION" \
      --group-id "$RDS_SG" --protocol tcp --port 5432 \
      --source-group "$APPRUNNER_CONNECTOR_SG" 2>/dev/null || true
  fi

  VPC_ID="$vpc"
  save_secret VPC_ID "$VPC_ID"
  log "Security groups: connector=$APPRUNNER_CONNECTOR_SG rds=$RDS_SG vpc=$VPC_ID"
}

step_rds() {
  require_aws
  load_secrets
  step_network_sg
  load_secrets

  local vpc="${VPC_ID:?missing VPC_ID}"
  local subnets
  subnets="$(default_subnet_ids "$vpc")"
  [[ -n "$subnets" ]] || die "No subnets in VPC $vpc"

  local subnet_group="vihe-app-db-subnets"
  if ! "$AWS" rds describe-db-subnet-groups --region "$REGION" \
    --db-subnet-group-name "$subnet_group" >/dev/null 2>&1; then
    log "Creating DB subnet group $subnet_group"
    # shellcheck disable=SC2086
    "$AWS" rds create-db-subnet-group --region "$REGION" \
      --db-subnet-group-name "$subnet_group" \
      --db-subnet-group-description "Vihe App Runner RDS" \
      --subnet-ids $subnets
  fi

  if [[ -z "${RDS_MASTER_PASSWORD:-}" ]]; then
    RDS_MASTER_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
    save_secret RDS_MASTER_PASSWORD "$RDS_MASTER_PASSWORD"
  fi
  RDS_MASTER_USER="${RDS_MASTER_USER:-vihe}"

  if "$AWS" rds describe-db-instances --region "$REGION" \
    --db-instance-identifier "$DB_INSTANCE_ID" >/dev/null 2>&1; then
    log "RDS instance $DB_INSTANCE_ID already exists"
  else
    log "Creating RDS $DB_INSTANCE_ID (10–15 min). Class db.t4g.micro, Postgres 16, not public."
    "$AWS" rds create-db-instance --region "$REGION" \
      --db-instance-identifier "$DB_INSTANCE_ID" \
      --db-instance-class "${RDS_INSTANCE_CLASS:-db.t4g.micro}" \
      --engine postgres \
      --engine-version "${RDS_ENGINE_VERSION:-16}" \
      --master-username "$RDS_MASTER_USER" \
      --master-user-password "$RDS_MASTER_PASSWORD" \
      --allocated-storage "${RDS_STORAGE_GB:-20}" \
      --db-name vihe_app \
      --db-subnet-group-name "$subnet_group" \
      --vpc-security-group-ids "$RDS_SG" \
      --no-publicly-accessible \
      --backup-retention-period 7 \
      --storage-encrypted \
      --tags Key=app,Value=vihe-app
  fi

  log "Waiting for RDS to become available..."
  "$AWS" rds wait db-instance-available --region "$REGION" \
    --db-instance-identifier "$DB_INSTANCE_ID"

  local host
  host="$("$AWS" rds describe-db-instances --region "$REGION" \
    --db-instance-identifier "$DB_INSTANCE_ID" \
    --query 'DBInstances[0].Endpoint.Address' --output text)"

  local db_url
  db_url="postgresql://${RDS_MASTER_USER}:${RDS_MASTER_PASSWORD}@${host}:5432/vihe_app?schema=public&sslmode=require"
  save_secret RDS_HOST "$host"
  save_secret DATABASE_URL "$db_url"
  log "RDS ready. Host=$host (DATABASE_URL saved to $SECRETS_FILE)"
}

step_vpc_connector() {
  require_aws
  load_secrets
  step_network_sg
  load_secrets

  local vpc="${VPC_ID:?missing VPC_ID}"
  local subnets connector_name="vihe-apprunner-vpc"
  subnets="$(default_subnet_ids "$vpc")"

  if [[ -z "${VPC_CONNECTOR_ARN:-}" ]]; then
    VPC_CONNECTOR_ARN="$("$AWS" apprunner list-vpc-connectors --region "$REGION" \
      --query "VpcConnectors[?VpcConnectorName=='${connector_name}'].VpcConnectorArn | [0]" \
      --output text 2>/dev/null || true)"
    if [[ "$VPC_CONNECTOR_ARN" == "None" || -z "$VPC_CONNECTOR_ARN" ]]; then
      log "Creating App Runner VPC connector"
      # shellcheck disable=SC2086
      VPC_CONNECTOR_ARN="$("$AWS" apprunner create-vpc-connector --region "$REGION" \
        --vpc-connector-name "$connector_name" \
        --subnets $subnets \
        --security-groups "$APPRUNNER_CONNECTOR_SG" \
        --query VpcConnector.VpcConnectorArn --output text)"
    fi
    save_secret VPC_CONNECTOR_ARN "$VPC_CONNECTOR_ARN"
  fi
  log "VPC connector: $VPC_CONNECTOR_ARN"
}

step_github_connection() {
  require_aws
  local name="${GITHUB_CONNECTION_NAME:-vihe-github}"
  local arn status
  arn="$("$AWS" apprunner list-connections --region "$REGION" \
    --query "ConnectionSummaryList[?ConnectionName=='${name}'].ConnectionArn | [0]" --output text 2>/dev/null || true)"

  if [[ "$arn" == "None" || -z "$arn" ]]; then
    log "Creating GitHub connection '$name' (PENDING_HANDSHAKE)"
    arn="$("$AWS" apprunner create-connection --region "$REGION" \
      --connection-name "$name" --provider-type GITHUB \
      --query Connection.ConnectionArn --output text)"
  fi

  # AWS CLI v1 has no describe-connection; status comes from list-connections.
  status="$("$AWS" apprunner list-connections --region "$REGION" \
    --query "ConnectionSummaryList[?ConnectionArn=='${arn}'].Status | [0]" --output text)"

  save_secret GITHUB_CONNECTION_ARN "$arn"
  log "Connection ARN: $arn"
  log "Status: $status"

  if [[ "$status" != "AVAILABLE" ]]; then
    cat <<EOF

Complete GitHub authorization in the AWS Console:
  https://${REGION}.console.aws.amazon.com/apprunner/home?region=${REGION}#/connections
Open connection "${name}", choose "Complete connection", and authorize GitHub access to ${GITHUB_REPO}.

Re-run: ./scripts/aws-provision.sh apprunner
EOF
    exit 1
  fi
}

step_apprunner() {
  require_aws
  load_secrets
  step_s3
  step_vpc_connector

  [[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL missing. Run: ./scripts/aws-provision.sh rds"
  [[ -n "${GITHUB_CONNECTION_ARN:-}" ]] || step_github_connection

  local conn_status
  conn_status="$("$AWS" apprunner list-connections --region "$REGION" \
    --query "ConnectionSummaryList[?ConnectionArn=='${GITHUB_CONNECTION_ARN}'].Status | [0]" --output text)"
  [[ "$conn_status" == "AVAILABLE" ]] || die "GitHub connection not AVAILABLE ($conn_status). Run: ./scripts/aws-provision.sh github-connection"

  if [[ -z "${AUTH_SECRET:-}" ]]; then
    AUTH_SECRET="$(openssl rand -base64 32)"
    save_secret AUTH_SECRET "$AUTH_SECRET"
  fi
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 16 | tr -d '/+=' | head -c 16)}"
  save_secret ADMIN_EMAIL "$ADMIN_EMAIL"
  save_secret ADMIN_PASSWORD "$ADMIN_PASSWORD"

  local existing
  existing="$("$AWS" apprunner list-services --region "$REGION" \
    --query "ServiceSummaryList[?ServiceName=='${SERVICE_NAME}'].ServiceArn | [0]" --output text)"

  if [[ "$existing" != "None" && -n "$existing" ]]; then
    log "App Runner service already exists: $existing"
    save_secret APPRUNNER_SERVICE_ARN "$existing"
    print_summary
    return
  fi

  # Placeholder until the service URL exists; updated after the first RUNNING state.
  AUTH_URL="${AUTH_URL:-https://placeholder.local}"
  save_secret AUTH_URL "$AUTH_URL"

  log "Creating App Runner service $SERVICE_NAME (first deploy may take several minutes)"

  local tmp
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' EXIT

  cat >"$tmp" <<EOF
{
  "ServiceName": "${SERVICE_NAME}",
  "SourceConfiguration": {
    "AuthenticationConfiguration": {
      "ConnectionArn": "${GITHUB_CONNECTION_ARN}"
    },
    "AutoDeploymentsEnabled": true,
    "CodeRepository": {
      "RepositoryUrl": "${GITHUB_REPO}",
      "SourceCodeVersion": {
        "Type": "BRANCH",
        "Value": "${GITHUB_BRANCH}"
      },
      "CodeConfiguration": {
        "ConfigurationSource": "REPOSITORY",
        "CodeConfigurationValues": {
          "RuntimeEnvironmentVariables": {
            "DATABASE_URL": "${DATABASE_URL}",
            "AUTH_URL": "${AUTH_URL}",
            "AUTH_SECRET": "${AUTH_SECRET}",
            "ADMIN_EMAIL": "${ADMIN_EMAIL}",
            "ADMIN_PASSWORD": "${ADMIN_PASSWORD}",
            "S3_REGION": "${S3_REGION}",
            "S3_BUCKET": "${S3_BUCKET}",
            "S3_ACCESS_KEY": "${S3_ACCESS_KEY}",
            "S3_SECRET_KEY": "${S3_SECRET_KEY}",
            "PORT": "8080"
          },
          "Port": "8080"
        }
      }
    }
  },
  "InstanceConfiguration": {
    "Cpu": "1024",
    "Memory": "2048"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/login",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  },
  "NetworkConfiguration": {
    "EgressConfiguration": {
      "EgressType": "VPC",
      "VpcConnectorArn": "${VPC_CONNECTOR_ARN}"
    }
  },
  "Tags": [
    {"Key": "app", "Value": "vihe-app"}
  ]
}
EOF

  local service_arn
  service_arn="$("$AWS" apprunner create-service --region "$REGION" \
    --cli-input-json "file://$tmp" \
    --query 'Service.ServiceArn' --output text)"

  save_secret APPRUNNER_SERVICE_ARN "$service_arn"

  log "Waiting for service to reach RUNNING (build + deploy)..."
  "$AWS" apprunner wait service-running --region "$REGION" --service-arn "$service_arn" || true

  local url
  url="$("$AWS" apprunner describe-service --region "$REGION" \
    --service-arn "$service_arn" --query 'Service.ServiceUrl' --output text)"

  if [[ -n "$url" && "$url" != "None" ]]; then
    AUTH_URL="https://${url}"
    save_secret AUTH_URL "$AUTH_URL"
    log "Updating runtime env (AUTH_URL + secrets)..."
    update_apprunner_env "$service_arn"
  fi

  print_summary
}

update_apprunner_env() {
  local service_arn="$1"
  load_secrets
  local tmp
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' EXIT

  cat >"$tmp" <<EOF
{
  "ServiceArn": "${service_arn}",
  "SourceConfiguration": {
    "AuthenticationConfiguration": {
      "ConnectionArn": "${GITHUB_CONNECTION_ARN}"
    },
    "AutoDeploymentsEnabled": true,
    "CodeRepository": {
      "RepositoryUrl": "${GITHUB_REPO}",
      "SourceCodeVersion": {"Type": "BRANCH", "Value": "${GITHUB_BRANCH}"},
      "CodeConfiguration": {
        "ConfigurationSource": "REPOSITORY",
        "CodeConfigurationValues": {
          "RuntimeEnvironmentVariables": {
            "DATABASE_URL": "${DATABASE_URL}",
            "AUTH_URL": "${AUTH_URL}",
            "AUTH_SECRET": "${AUTH_SECRET}",
            "ADMIN_EMAIL": "${ADMIN_EMAIL}",
            "ADMIN_PASSWORD": "${ADMIN_PASSWORD}",
            "S3_REGION": "${S3_REGION}",
            "S3_BUCKET": "${S3_BUCKET}",
            "S3_ACCESS_KEY": "${S3_ACCESS_KEY}",
            "S3_SECRET_KEY": "${S3_SECRET_KEY}",
            "PORT": "8080"
          },
          "Port": "8080"
        }
      }
    }
  }
}
EOF

  "$AWS" apprunner update-service --region "$REGION" --cli-input-json "file://$tmp" >/dev/null
}

# --- Amazon ECS Express Mode (recommended; App Runner closed to new customers) ---

step_rds_allow_vpc() {
  require_aws
  load_secrets
  [[ -n "${RDS_SG:-}" && -n "${VPC_ID:-}" ]] || die "RDS_SG/VPC_ID missing. Run: ./scripts/aws-provision.sh rds"
  local cidr
  cidr="$("$AWS" ec2 describe-vpcs --region "$REGION" --vpc-ids "$VPC_ID" \
    --query 'Vpcs[0].CidrBlock' --output text)"
  log "Allowing Postgres from VPC $cidr on RDS SG $RDS_SG (for ECS Express tasks)"
  "$AWS" ec2 authorize-security-group-ingress --region "$REGION" \
    --group-id "$RDS_SG" --protocol tcp --port 5432 --cidr "$cidr" 2>/dev/null || true
}

step_ecs_roles() {
  require_aws
  local exec_role="${ECS_EXEC_ROLE:-ecsTaskExecutionRole}"
  local infra_role="${ECS_INFRA_ROLE:-ecsInfrastructureRoleForExpressServices}"
  local acct
  acct="$(account_id)"

  if ! "$AWS" iam get-role --role-name "$exec_role" >/dev/null 2>&1; then
    log "Creating IAM role $exec_role"
    "$AWS" iam create-role --role-name "$exec_role" --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]
    }' >/dev/null
    "$AWS" iam attach-role-policy --role-name "$exec_role" \
      --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
  fi

  if ! "$AWS" iam get-role --role-name "$infra_role" >/dev/null 2>&1; then
    log "Creating IAM role $infra_role"
    "$AWS" iam create-role --role-name "$infra_role" --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{"Effect":"Allow","Principal":{"Service":"ecs.amazonaws.com"},"Action":"sts:AssumeRole"}]
    }' >/dev/null
    "$AWS" iam attach-role-policy --role-name "$infra_role" \
      --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices
  fi

  # Brief wait for IAM eventual consistency on first create
  sleep 5

  save_secret ECS_EXEC_ROLE_ARN "arn:aws:iam::${acct}:role/${exec_role}"
  save_secret ECS_INFRA_ROLE_ARN "arn:aws:iam::${acct}:role/${infra_role}"
  log "ECS roles ready"
}

step_ecr_push() {
  require_aws
  load_secrets
  command -v docker >/dev/null || die "Docker is required to build/push the image"
  local acct repo tag uri
  acct="$(account_id)"
  repo="${ECR_REPO:-vihe-app}"
  tag="${IMAGE_TAG:-latest}"

  if ! "$AWS" ecr describe-repositories --region "$REGION" --repository-names "$repo" >/dev/null 2>&1; then
    log "Creating ECR repository $repo"
    "$AWS" ecr create-repository --region "$REGION" --repository-name "$repo" \
      --image-scanning-configuration scanOnPush=true >/dev/null
  fi

  uri="${acct}.dkr.ecr.${REGION}.amazonaws.com/${repo}:${tag}"
  log "Building linux/amd64 image and pushing $uri"
  "$AWS" ecr get-login-password --region "$REGION" \
    | docker login --username AWS --password-stdin "${acct}.dkr.ecr.${REGION}.amazonaws.com"
  docker build --platform linux/amd64 -t "$uri" "$ROOT"
  docker push "$uri"
  save_secret ECR_IMAGE_URI "$uri"
  log "Image pushed: $uri"
}

step_ecs_express() {
  require_aws
  load_secrets
  step_s3
  step_rds_allow_vpc
  step_ecs_roles
  load_secrets

  [[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL missing. Run: ./scripts/aws-provision.sh rds"
  [[ -n "${ECR_IMAGE_URI:-}" ]] || step_ecr_push
  load_secrets

  if [[ -z "${AUTH_SECRET:-}" ]]; then
    AUTH_SECRET="$(openssl rand -base64 32)"
    save_secret AUTH_SECRET "$AUTH_SECRET"
  fi
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 16 | tr -d '/+=' | head -c 16)}"
  save_secret ADMIN_EMAIL "$ADMIN_EMAIL"
  save_secret ADMIN_PASSWORD "$ADMIN_PASSWORD"

  local service_name="${ECS_SERVICE_NAME:-vihe-app}"
  local existing
  existing="$("$AWS" ecs list-services --region "$REGION" --cluster default \
    --query "serviceArns[?contains(@, '${service_name}')]" --output text 2>/dev/null || true)"

  # Placeholder AUTH_URL; update after URL is known
  AUTH_URL="${AUTH_URL:-https://placeholder.local}"
  save_secret AUTH_URL "$AUTH_URL"

  local container_json
  container_json="$(ECR_IMAGE_URI="$ECR_IMAGE_URI" DATABASE_URL="$DATABASE_URL" AUTH_URL="$AUTH_URL" \
    AUTH_SECRET="$AUTH_SECRET" ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    S3_REGION="$S3_REGION" S3_BUCKET="$S3_BUCKET" S3_ACCESS_KEY="$S3_ACCESS_KEY" S3_SECRET_KEY="$S3_SECRET_KEY" \
    python3 - <<'PY'
import json, os
print(json.dumps({
  "image": os.environ["ECR_IMAGE_URI"],
  "containerPort": 8080,
  "environment": [
    {"name": "DATABASE_URL", "value": os.environ["DATABASE_URL"]},
    {"name": "AUTH_URL", "value": os.environ["AUTH_URL"]},
    {"name": "AUTH_SECRET", "value": os.environ["AUTH_SECRET"]},
    {"name": "ADMIN_EMAIL", "value": os.environ["ADMIN_EMAIL"]},
    {"name": "ADMIN_PASSWORD", "value": os.environ["ADMIN_PASSWORD"]},
    {"name": "S3_REGION", "value": os.environ["S3_REGION"]},
    {"name": "S3_BUCKET", "value": os.environ["S3_BUCKET"]},
    {"name": "S3_ACCESS_KEY", "value": os.environ["S3_ACCESS_KEY"]},
    {"name": "S3_SECRET_KEY", "value": os.environ["S3_SECRET_KEY"]},
    {"name": "PORT", "value": "8080"},
  ],
}))
PY
)"

  if [[ -n "$existing" && "$existing" != "None" ]]; then
    log "Updating existing ECS Express service $service_name"
    local service_arn
    service_arn="$("$AWS" ecs describe-express-gateway-service --region "$REGION" \
      --service-arn "$existing" --query 'service.serviceArn' --output text 2>/dev/null || echo "$existing")"
    "$AWS" ecs update-express-gateway-service --region "$REGION" \
      --service-arn "$service_arn" \
      --primary-container "$container_json" \
      --health-check-path /login \
      --monitor-resources || true
    save_secret ECS_SERVICE_ARN "$service_arn"
  else
    log "Creating ECS Express Mode service $service_name (ALB + Fargate; several minutes)"
    local out
    out="$("$AWS" ecs create-express-gateway-service --region "$REGION" \
      --service-name "$service_name" \
      --execution-role-arn "$ECS_EXEC_ROLE_ARN" \
      --infrastructure-role-arn "$ECS_INFRA_ROLE_ARN" \
      --primary-container "$container_json" \
      --cpu 1 \
      --memory 2 \
      --health-check-path /login \
      --scaling-target '{"minTaskCount":1,"maxTaskCount":2}' \
      --monitor-resources \
      --output json 2>&1)" || {
        printf '%s\n' "$out"
        die "create-express-gateway-service failed"
      }
    printf '%s\n' "$out" | tee /tmp/vihe-ecs-express-out.json >/dev/null
    local service_arn
    service_arn="$(python3 -c "import json,sys; d=json.load(open('/tmp/vihe-ecs-express-out.json')); print(d.get('service',d).get('serviceArn') or d.get('serviceArn') or '')" 2>/dev/null || true)"
    if [[ -z "$service_arn" ]]; then
      service_arn="$("$AWS" ecs list-services --region "$REGION" --cluster default \
        --query "serviceArns[?contains(@, '${service_name}')]|[0]" --output text)"
    fi
    save_secret ECS_SERVICE_ARN "$service_arn"
  fi

  load_secrets
  # Resolve public URL
  local desc url
  desc="$("$AWS" ecs describe-express-gateway-service --region "$REGION" \
    --service-arn "${ECS_SERVICE_ARN}" --output json 2>/dev/null || echo '{}')"
  url="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); s=d.get('service',d);
print(s.get('endpoint') or s.get('url') or s.get('serviceUrl') or '')" "$desc" 2>/dev/null || true)"
  if [[ -z "$url" || "$url" == "None" ]]; then
    # Common Express Mode URL pattern
    url="https://${service_name}.ecs.${REGION}.on.aws"
  fi
  [[ "$url" == https://* ]] || url="https://${url}"
  AUTH_URL="$url"
  save_secret AUTH_URL "$AUTH_URL"

  # Refresh env with correct AUTH_URL
  container_json="$(ECR_IMAGE_URI="$ECR_IMAGE_URI" DATABASE_URL="$DATABASE_URL" AUTH_URL="$AUTH_URL" \
    AUTH_SECRET="$AUTH_SECRET" ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    S3_REGION="$S3_REGION" S3_BUCKET="$S3_BUCKET" S3_ACCESS_KEY="$S3_ACCESS_KEY" S3_SECRET_KEY="$S3_SECRET_KEY" \
    python3 - <<'PY'
import json, os
print(json.dumps({
  "image": os.environ["ECR_IMAGE_URI"],
  "containerPort": 8080,
  "environment": [
    {"name": "DATABASE_URL", "value": os.environ["DATABASE_URL"]},
    {"name": "AUTH_URL", "value": os.environ["AUTH_URL"]},
    {"name": "AUTH_SECRET", "value": os.environ["AUTH_SECRET"]},
    {"name": "ADMIN_EMAIL", "value": os.environ["ADMIN_EMAIL"]},
    {"name": "ADMIN_PASSWORD", "value": os.environ["ADMIN_PASSWORD"]},
    {"name": "S3_REGION", "value": os.environ["S3_REGION"]},
    {"name": "S3_BUCKET", "value": os.environ["S3_BUCKET"]},
    {"name": "S3_ACCESS_KEY", "value": os.environ["S3_ACCESS_KEY"]},
    {"name": "S3_SECRET_KEY", "value": os.environ["S3_SECRET_KEY"]},
    {"name": "PORT", "value": "8080"},
  ],
}))
PY
)"
  log "Updating service with AUTH_URL=$AUTH_URL"
  "$AWS" ecs update-express-gateway-service --region "$REGION" \
    --service-arn "$ECS_SERVICE_ARN" \
    --primary-container "$container_json" \
    --health-check-path /login \
    --monitor-resources || true

  print_summary
}

print_summary() {
  load_secrets
  cat <<EOF

--- Vihe AWS deploy (${REGION}) ---
ECS Express:   ${ECS_SERVICE_ARN:-not created}
Image:         ${ECR_IMAGE_URI:-}
Service URL:   ${AUTH_URL:-}
Admin login:   ${ADMIN_EMAIL:-} / ${ADMIN_PASSWORD:-}
Secrets file:  ${SECRETS_FILE}  (chmod 600 — do not commit)

Sign in at /login once the URL is healthy.
App Runner path is deprecated for new AWS accounts (closed Apr 30, 2026).

EOF
}

run_all() {
  step_s3
  step_rds
  step_ecs_express
}

main() {
  if [[ $# -eq 0 ]]; then
    run_all
    return
  fi
  for cmd in "$@"; do
    case "$cmd" in
      s3) step_s3 ;;
      network) step_network_sg ;;
      rds) step_rds ;;
      rds-allow-vpc) step_rds_allow_vpc ;;
      vpc-connector) step_vpc_connector ;;
      github-connection) step_github_connection ;;
      apprunner) step_apprunner ;;
      ecs-roles) step_ecs_roles ;;
      ecr-push) step_ecr_push ;;
      ecs-express) step_ecs_express ;;
      summary) print_summary ;;
      *) die "Unknown step: $cmd (try: s3 rds ecs-express ecr-push summary)" ;;
    esac
  done
}

main "$@"
