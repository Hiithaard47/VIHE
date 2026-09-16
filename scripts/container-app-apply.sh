#!/usr/bin/env bash
# Apply an image (and optional env / revision suffix) to an existing Container App.
# Usage: container-app-apply.sh NAME RESOURCE_GROUP IMAGE TARGET_PORT [REVISION_SUFFIX] [KEY=VAL ...]
# Pass an empty REVISION_SUFFIX ("") to skip --revision-suffix.
set -euo pipefail

if [[ $# -lt 4 ]]; then
  echo "usage: $0 NAME RESOURCE_GROUP IMAGE TARGET_PORT [REVISION_SUFFIX] [KEY=VAL ...]" >&2
  exit 1
fi

NAME=$1
RG=$2
IMAGE=$3
PORT=$4
shift 4

SUFFIX=""
if [[ $# -gt 0 && "$1" != *=* ]]; then
  SUFFIX=$1
  shift
fi

az containerapp ingress update \
  --name "$NAME" \
  --resource-group "$RG" \
  --target-port "$PORT" \
  --output none

args=(
  --name "$NAME"
  --resource-group "$RG"
  --image "$IMAGE"
)
if [[ -n "$SUFFIX" ]]; then
  args+=(--revision-suffix "$SUFFIX")
fi
if [[ $# -gt 0 ]]; then
  args+=(--set-env-vars "$@")
fi
az containerapp update "${args[@]}" --output none
