#!/usr/bin/env bash
# Update an existing ECS Express Mode service to a new container image URI,
# preserving environment variables and other primary-container settings.
#
# Usage:
#   AWS_REGION=ap-south-1 SERVICE_NAME=vihe-app IMAGE_URI=.../vihe-app:sha-abc1234 \
#     ./scripts/ecs-update-image.sh

set -euo pipefail

AWS="${AWS_CLI:-aws}"
REGION="${AWS_REGION:-ap-south-1}"
SERVICE_NAME="${SERVICE_NAME:-vihe-app}"
IMAGE_URI="${IMAGE_URI:?IMAGE_URI is required}"
CLUSTER="${ECS_CLUSTER:-default}"

SERVICE_ARN="$("$AWS" ecs list-services --region "$REGION" --cluster "$CLUSTER" \
  --query "serviceArns[?contains(@, '${SERVICE_NAME}')]|[0]" --output text)"

if [[ -z "$SERVICE_ARN" || "$SERVICE_ARN" == "None" ]]; then
  printf 'ERROR: No ECS service matching %s in cluster %s.\n' "$SERVICE_NAME" "$CLUSTER" >&2
  printf 'Create it once with: ./scripts/aws-provision.sh ecs-express\n' >&2
  exit 1
fi

printf 'Service ARN: %s\n' "$SERVICE_ARN"
DESC="$("$AWS" ecs describe-express-gateway-service --region "$REGION" \
  --service-arn "$SERVICE_ARN" --output json)"

CONTAINER="$(
  DESC="$DESC" IMAGE_URI="$IMAGE_URI" python3 - <<'PY'
import json, os
desc = json.loads(os.environ["DESC"])
image = os.environ["IMAGE_URI"]
svc = desc.get("service") or desc
cfg = (
    svc.get("activeConfiguration")
    or svc.get("currentConfiguration")
    or svc.get("configuration")
    or {}
)
primary = cfg.get("primaryContainer") or svc.get("primaryContainer") or {}
if not (isinstance(primary, dict) and primary.get("image")):
    for key in ("configurations", "serviceConfigurations"):
        items = svc.get(key) or []
        if items and isinstance(items, list):
            cand = items[0].get("primaryContainer") or items[0]
            if isinstance(cand, dict) and cand.get("image"):
                primary = cand
                break
if not isinstance(primary, dict):
    primary = {}
allowed = {
    "image",
    "containerPort",
    "environment",
    "secrets",
    "command",
    "repositoryCredentials",
    "awsLogsConfiguration",
}
primary = {k: v for k, v in primary.items() if k in allowed}
primary["image"] = image
primary.setdefault("containerPort", 8080)
print(json.dumps(primary))
PY
)"

printf 'Updating primary container image → %s\n' "$IMAGE_URI"
"$AWS" ecs update-express-gateway-service --region "$REGION" \
  --service-arn "$SERVICE_ARN" \
  --primary-container "$CONTAINER" \
  --health-check-path /login \
  --monitor-resources

printf 'Deployed %s to %s\n' "$IMAGE_URI" "$SERVICE_NAME"
