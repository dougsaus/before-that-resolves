#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID=${PROJECT_ID:-before-that-resolves}
REGION=${REGION:-us-central1}
SERVICE_NAME=${SERVICE_NAME:-before-that-resolves}
REPO=${REPO:-before-that-resolves}
IMAGE_NAME=${IMAGE_NAME:-before-that-resolves}
ENABLE_PDF=${ENABLE_PDF:-1}
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE_NAME}"

printf 'Using project %s in %s\n' "$PROJECT_ID" "$REGION"

gcloud config set project "$PROJECT_ID" > /dev/null

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com

if ! gcloud artifacts repositories describe "$REPO" --location "$REGION" > /dev/null 2>&1; then
  gcloud artifacts repositories create "$REPO" \
    --location "$REGION" \
    --repository-format docker
fi

gcloud builds submit \
  --config deploy/cloudbuild.yaml \
  --substitutions=_IMAGE="${IMAGE}",_ENABLE_PDF="${ENABLE_PDF}" \
  .

DEPLOY_FLAGS=(
  --image "${IMAGE}"
  --region "${REGION}"
  --allow-unauthenticated
  --set-env-vars NODE_ENV=production
)

gcloud run deploy "$SERVICE_NAME" "${DEPLOY_FLAGS[@]}"
