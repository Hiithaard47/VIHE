#!/bin/sh
# Keep at least 2 App Runner instances. Requires AWS CLI + a service ARN.
#   AWS_REGION=ap-south-1 SERVICE_ARN=arn:aws:apprunner:... ./scripts/apprunner-min-size.sh
set -eu

REGION="${AWS_REGION:?set AWS_REGION}"
SERVICE_ARN="${SERVICE_ARN:?set SERVICE_ARN}"
NAME="${SCALING_NAME:-vihe-min-2}"
MIN="${MIN_SIZE:-1}"
MAX="${MAX_SIZE:-2}"

ARN=$(aws apprunner create-auto-scaling-configuration \
  --region "$REGION" \
  --auto-scaling-configuration-name "$NAME" \
  --min-size "$MIN" \
  --max-size "$MAX" \
  --max-concurrency 50 \
  --query 'AutoScalingConfiguration.AutoScalingConfigurationArn' \
  --output text)

aws apprunner update-service \
  --region "$REGION" \
  --service-arn "$SERVICE_ARN" \
  --auto-scaling-configuration-arn "$ARN"

echo "Service now uses $NAME (min $MIN, max $MAX)"
echo "$ARN"
