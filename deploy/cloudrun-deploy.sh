#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID=${PROJECT_ID:-before-that-resolves}
REGION=${REGION:-us-central1}
SERVICE_NAME=${SERVICE_NAME:-before-that-resolves}
REPO=${REPO:-before-that-resolves}
IMAGE_NAME=${IMAGE_NAME:-before-that-resolves}
ENABLE_PDF=${ENABLE_PDF:-1}
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE_NAME}"

OPENAI_SECRET_NAME=${OPENAI_SECRET_NAME:-openai-api-key}

printf 'Using project %s in %s\n' "$PROJECT_ID" "$REGION"

gcloud config set project "$PROJECT_ID" > /dev/null

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com

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

if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  if ! gcloud secrets describe "$OPENAI_SECRET_NAME" > /dev/null 2>&1; then
    gcloud secrets create "$OPENAI_SECRET_NAME" --replication-policy=automatic
  fi
  printf '%s' "$OPENAI_API_KEY" | gcloud secrets versions add "$OPENAI_SECRET_NAME" --data-file=-
  DEPLOY_FLAGS+=(--set-secrets "OPENAI_API_KEY=${OPENAI_SECRET_NAME}:latest")
fi

gcloud run deploy "$SERVICE_NAME" "${DEPLOY_FLAGS[@]}"
