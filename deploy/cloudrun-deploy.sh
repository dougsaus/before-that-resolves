#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID=${PROJECT_ID:-before-that-resolves}
REGION=${REGION:-us-central1}
SERVICE_NAME=${SERVICE_NAME:-before-that-resolves}
REPO=${REPO:-before-that-resolves}
IMAGE_NAME=${IMAGE_NAME:-before-that-resolves}
ENABLE_PDF=${ENABLE_PDF:-1}
SKIP_SERVICE_ENABLE=${SKIP_SERVICE_ENABLE:-0}
SKIP_ARTIFACT_REPO_CREATE=${SKIP_ARTIFACT_REPO_CREATE:-0}
VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
CLOUD_SQL_INSTANCE=${CLOUD_SQL_INSTANCE:-}
DB_NAME=${DB_NAME:-btr}
DB_USER=${DB_USER:-btr}
DB_PASSWORD=${DB_PASSWORD:-}
DB_HOST=${DB_HOST:-}
DB_SSL=${DB_SSL:-false}
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE_NAME}"

printf 'Using project %s in %s\n' "$PROJECT_ID" "$REGION"

gcloud config set project "$PROJECT_ID" > /dev/null

if [[ "$SKIP_SERVICE_ENABLE" != "1" ]]; then
  gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com
fi

if [[ "$SKIP_ARTIFACT_REPO_CREATE" != "1" ]]; then
  if ! gcloud artifacts repositories describe "$REPO" --location "$REGION" > /dev/null 2>&1; then
    gcloud artifacts repositories create "$REPO" \
      --location "$REGION" \
      --repository-format docker
  fi
fi

gcloud builds submit \
  --config deploy/cloudbuild.yaml \
  --substitutions=_IMAGE="${IMAGE}",_ENABLE_PDF="${ENABLE_PDF}",_VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID}" \
  --suppress-logs \
  .

DEPLOY_FLAGS=(
  --image "${IMAGE}"
  --region "${REGION}"
  --allow-unauthenticated
)

ENV_VARS=("NODE_ENV=production")

if [[ -n "$GOOGLE_CLIENT_ID" ]]; then
  ENV_VARS+=("GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}")
fi

if [[ -n "$CLOUD_SQL_INSTANCE" ]]; then
  if [[ -z "$DB_HOST" ]]; then
    DB_HOST="/cloudsql/${CLOUD_SQL_INSTANCE}"
  fi
  DEPLOY_FLAGS+=(--add-cloudsql-instances "${CLOUD_SQL_INSTANCE}")
fi

if [[ -n "$DB_HOST" ]]; then
  ENV_VARS+=("DB_HOST=${DB_HOST}")
  ENV_VARS+=("DB_NAME=${DB_NAME}")
  ENV_VARS+=("DB_USER=${DB_USER}")
  ENV_VARS+=("DB_PASSWORD=${DB_PASSWORD}")
  ENV_VARS+=("DB_SSL=${DB_SSL}")
fi

if [[ "${#ENV_VARS[@]}" -gt 0 ]]; then
  DEPLOY_FLAGS+=(--set-env-vars "$(IFS=,; echo "${ENV_VARS[*]}")")
fi

gcloud run deploy "$SERVICE_NAME" "${DEPLOY_FLAGS[@]}"
