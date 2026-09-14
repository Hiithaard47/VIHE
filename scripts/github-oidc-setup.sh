#!/usr/bin/env bash
# One-time: IAM OIDC provider + role so GitHub Actions can push to ECR and
# update the ECS Express Mode service (no long-lived AWS keys in GitHub).
#
# Usage:
#   export AWS_REGION=ap-south-1
#   export GITHUB_REPO=parmod-arora/vihe-app   # owner/name
#   ./scripts/github-oidc-setup.sh
#
# Then in the GitHub repo (Settings → Secrets and variables → Actions → Variables):
#   AWS_ACCOUNT_ID = <account id printed below>
# Optional: AWS_REGION, ECR_REPOSITORY, ECS_SERVICE, AWS_ROLE_NAME

set -euo pipefail

AWS="${AWS_CLI:-aws}"
REGION="${AWS_REGION:-ap-south-1}"
GITHUB_REPO="${GITHUB_REPO:-parmod-arora/vihe-app}"
ROLE_NAME="${GITHUB_ACTIONS_ROLE_NAME:-vihe-github-actions}"
ECR_REPO="${ECR_REPO:-vihe-app}"
POLICY_PREFIX="${POLICY_PREFIX:-ViheGitHubActions}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

"$AWS" sts get-caller-identity --region "$REGION" >/dev/null \
  || die "No AWS credentials. Run: aws configure   or   aws sso login"

ACCOUNT_ID="$("$AWS" sts get-caller-identity --query Account --output text)"
OIDC_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# --- OIDC provider ---
if ! "$AWS" iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" >/dev/null 2>&1; then
  log "Creating GitHub OIDC provider"
  THUMBPRINT="6938fd4d98bab03faadb97b34396831e3780aea1"
  "$AWS" iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list "$THUMBPRINT" >/dev/null
else
  log "OIDC provider already exists"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

GITHUB_OWNER="${GITHUB_REPO%%/*}"
GITHUB_NAME="${GITHUB_REPO#*/}"

# GitHub Actions OIDC `sub` may be either:
#   repo:owner/name:ref:...
#   repo:owner@OWNER_ID/name@REPO_ID:ref:...
# Prefer numeric IDs when `gh` can resolve them (required on newer tokens).
SUB_PATTERNS=("repo:${GITHUB_REPO}:*")
if command -v gh >/dev/null 2>&1; then
  REPO_JSON="$(gh api "repos/${GITHUB_REPO}" --jq '{owner:.owner.id,repo:.id}' 2>/dev/null || true)"
  if [[ -n "$REPO_JSON" && "$REPO_JSON" != "null" ]]; then
    OWNER_ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["owner"])' <<<"$REPO_JSON")"
    REPO_ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["repo"])' <<<"$REPO_JSON")"
    SUB_PATTERNS+=("repo:${GITHUB_OWNER}@${OWNER_ID}/${GITHUB_NAME}@${REPO_ID}:*")
  fi
fi
# Fallback wildcard if gh unavailable / private without token
SUB_PATTERNS+=("repo:${GITHUB_OWNER}@*/${GITHUB_NAME}@*:*")

SUB_JSON="$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1:]))' "${SUB_PATTERNS[@]}")"

cat >"$TMP/trust.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${OIDC_ARN}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": ${SUB_JSON}
        }
      }
    }
  ]
}
EOF

cat >"$TMP/ecr.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrAuth",
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken"],
      "Resource": "*"
    },
    {
      "Sid": "EcrPushPull",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeImages",
        "ecr:DescribeRepositories",
        "ecr:GetDownloadUrlForLayer",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ],
      "Resource": "arn:aws:ecr:${REGION}:${ACCOUNT_ID}:repository/${ECR_REPO}"
    }
  ]
}
EOF

cat >"$TMP/ecs.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcsExpressDeploy",
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeClusters",
        "ecs:DescribeExpressGatewayService",
        "ecs:DescribeServiceDeployments",
        "ecs:DescribeServices",
        "ecs:ListServiceDeployments",
        "ecs:ListServices",
        "ecs:UpdateExpressGatewayService",
        "ecs:UpdateService"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassEcsRoles",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::${ACCOUNT_ID}:role/ecsTaskExecutionRole",
        "arn:aws:iam::${ACCOUNT_ID}:role/ecsInfrastructureRoleForExpressServices"
      ],
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": "ecs.amazonaws.com"
        }
      }
    }
  ]
}
EOF

if ! "$AWS" iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  log "Creating role $ROLE_NAME"
  "$AWS" iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "file://${TMP}/trust.json" >/dev/null
else
  log "Updating trust policy on $ROLE_NAME"
  "$AWS" iam update-assume-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-document "file://${TMP}/trust.json"
fi

create_or_update_policy() {
  local name="$1" file="$2"
  local arn="arn:aws:iam::${ACCOUNT_ID}:policy/${name}"
  if "$AWS" iam get-policy --policy-arn "$arn" >/dev/null 2>&1; then
    log "Creating new version of policy $name"
    "$AWS" iam create-policy-version \
      --policy-arn "$arn" \
      --policy-document "file://${file}" \
      --set-as-default >/dev/null
    # Keep at most 5 versions — delete oldest non-default if needed
    local versions
    versions="$("$AWS" iam list-policy-versions --policy-arn "$arn" \
      --query 'Versions[?IsDefaultVersion==`false`].VersionId' --output text)"
    local count
    count="$("$AWS" iam list-policy-versions --policy-arn "$arn" \
      --query 'length(Versions)' --output text)"
    if [[ "$count" -ge 5 && -n "$versions" ]]; then
      local oldest
      oldest="$(echo "$versions" | awk '{print $NF}')"
      "$AWS" iam delete-policy-version --policy-arn "$arn" --version-id "$oldest" || true
    fi
  else
    log "Creating policy $name"
    "$AWS" iam create-policy \
      --policy-name "$name" \
      --policy-document "file://${file}" >/dev/null
  fi
  "$AWS" iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "$arn" 2>/dev/null || true
}

create_or_update_policy "${POLICY_PREFIX}ECR" "$TMP/ecr.json"
create_or_update_policy "${POLICY_PREFIX}ECS" "$TMP/ecs.json"

cat <<EOF

--- GitHub Actions OIDC ready ---
Role ARN:   ${ROLE_ARN}
Repo trust: classic repo:${GITHUB_REPO}:* plus owner@id/repo@id forms
ECR repo:   ${ECR_REPO} (${REGION})

Add in GitHub → Settings → Secrets and variables → Actions → Variables:
  AWS_ACCOUNT_ID=${ACCOUNT_ID}

Optional variables (defaults already match vihe):
  AWS_REGION=${REGION}
  ECR_REPOSITORY=${ECR_REPO}
  ECS_SERVICE=vihe-app
  AWS_ROLE_NAME=${ROLE_NAME}
  ECS_SERVICE_ARN=<from ./scripts/aws-provision.sh summary after first create>

Role ARN used by the workflow:
  ${ROLE_ARN}

OIDC note: GitHub may issue sub as repo:owner@OWNER_ID/name@REPO_ID:ref:...
This script allows both classic and @id subject shapes.

Day-to-day: merge to main (or Actions → Deploy → Run workflow).
First-time ECS service create still: ./scripts/aws-provision.sh ecs-express

EOF
