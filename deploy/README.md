# Containerized deploy (Docker)

This repo is set up for a single-service container that serves both the API and the built UI from the same server.

## Local Docker

Prereqs:
- Docker

### Local Postgres (for deck persistence)

Start Postgres:

```bash
docker compose -f deploy/docker-compose.yml up -d
```

Set your DB env (example):

```bash
export DATABASE_URL=postgresql://btr:btr@localhost:5432/btr
```

Build the image:

```bash
npm run container:build
```

(Apple Silicon: `npm run container:build:arm` or `docker build --platform linux/arm64 -f deploy/Dockerfile -t before-that-resolves .`)

Run the container:

```bash
npm run container:run
```

Then open http://localhost:3001.

Notes:
- The build runs `npm run build`, which produces `client/dist` and `server/dist`.
- Set `DATABASE_URL` when running the container (e.g. `docker run -e DATABASE_URL=postgresql://btr:btr@host.docker.internal:5432/btr ...`).
- PDF export is disabled by default. To include Playwright + Chromium, build with `ENABLE_PDF=1` (e.g. `npm run container:build:pdf`), which switches the runtime base image to `mcr.microsoft.com/playwright:v1.57.0-jammy`.

## GCP / Cloud Run

Prereqs:
- gcloud CLI
- Access to the GCP project
- Cloud SQL Postgres instance (see below)

One-time setup:

```bash
gcloud auth login
gcloud config set project before-that-resolves
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

Cloud SQL (one-time):

```bash
gcloud services enable sqladmin.googleapis.com
gcloud sql instances create btr-postgres \
  --database-version=POSTGRES_16 \
  --region=us-central1 \
  --tier=db-f1-micro \
  --storage-size=10 \
  --storage-type=HDD

gcloud sql databases create btr --instance btr-postgres
gcloud sql users create btr --instance btr-postgres --password YOUR_STRONG_PASSWORD
```

IAM roles (minimums):
- `roles/run.admin`
- `roles/iam.serviceAccountUser`
- `roles/artifactregistry.writer`
- `roles/cloudbuild.builds.editor`
- `roles/cloudsql.client`

Note: the Cloud Build service account (`PROJECT_NUMBER@cloudbuild.gserviceaccount.com`) must have `roles/artifactregistry.writer` to push images.

Deploy (build + push + run):

```bash
deploy/cloudrun-deploy.sh
```

One-command deploy (from repo root):

```bash
npm run deploy:cloudrun
```

Common options (environment variables):
- `PROJECT_ID` (default: `before-that-resolves`)
- `REGION` (default: `us-central1`)
- `SERVICE_NAME` (default: `before-that-resolves`)
- `REPO` (default: `before-that-resolves`)
- `IMAGE_NAME` (default: `before-that-resolves`)
- `ENABLE_PDF` (default: `1`)
- `VITE_GOOGLE_CLIENT_ID` (Google login client ID baked into the build)
- `GOOGLE_CLIENT_ID` (required for Google login / deck collections)
- `CLOUD_SQL_INSTANCE` (e.g. `before-that-resolves:us-central1:btr-postgres`)
- `DB_NAME` (default: `btr`)
- `DB_USER` (default: `btr`)
- `DB_PASSWORD` (required)
- `DB_SSL` (default: `false`)

Cloud Run expects a Cloud SQL connection when `CLOUD_SQL_INSTANCE` is set; the deploy script attaches the instance and uses a Unix socket (`/cloudsql/...`) for `DB_HOST`.

The service expects the OpenAI API key to be supplied by the client (via the UI or the request headers).

Verify:

```bash
curl -s https://YOUR_SERVICE_URL/health
```

Cloud Run sets `PORT=8080` at runtime. The container starts with `npm start` from the repo root, which launches `server/dist/index.js` and serves the built UI.

## Continuous Deployment (GitHub Actions)

The workflow in `.github/workflows/cd.yml` deploys on every merge to `main`.

Required GitHub secrets:
- `GCP_SA_KEY` (service account JSON for deploying to Cloud Run)
- `GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_CLIENT_ID`
- `CLOUD_SQL_INSTANCE` (e.g. `before-that-resolves:us-central1:btr-postgres`)
- `DB_PASSWORD`

Optional GitHub variables:
- `GCP_PROJECT_ID` (default: `before-that-resolves`)
- `GCP_REGION` (default: `us-central1`)
- `GCP_SERVICE_NAME` (default: `before-that-resolves`)
- `GCP_ARTIFACT_REPO` (default: `before-that-resolves`)
- `GCP_IMAGE_NAME` (default: `before-that-resolves`)
- `ENABLE_PDF` (default: `1`)
- `DB_NAME` (default: `btr`)
- `DB_USER` (default: `btr`)
- `DB_SSL` (default: `false`)

Version bumping is still manual. If you want versioned releases, bump `package.json` before merging to `main` (for example: `npm version patch`).

### Setup (GitHub Actions)

1) Create a service account with deploy permissions (one-time):
- Roles: `roles/run.admin`, `roles/iam.serviceAccountUser`, `roles/artifactregistry.writer`, `roles/cloudbuild.builds.editor`, `roles/cloudsql.client`
- Download a JSON key

2) Store secrets/variables in GitHub (example with `gh`):

```bash
gh secret set GCP_SA_KEY -b "$(cat /path/to/deploy-cloud-run.key.json)"
gh secret set GOOGLE_CLIENT_ID -b "YOUR_GOOGLE_CLIENT_ID"
gh secret set VITE_GOOGLE_CLIENT_ID -b "YOUR_GOOGLE_CLIENT_ID"
gh secret set CLOUD_SQL_INSTANCE -b "PROJECT:REGION:INSTANCE"
gh secret set DB_PASSWORD -b "YOUR_DB_PASSWORD"

gh variable set GCP_PROJECT_ID -b "before-that-resolves"
gh variable set GCP_REGION -b "us-central1"
gh variable set GCP_SERVICE_NAME -b "before-that-resolves"
gh variable set GCP_ARTIFACT_REPO -b "before-that-resolves"
gh variable set GCP_IMAGE_NAME -b "before-that-resolves"
gh variable set ENABLE_PDF -b "1"
gh variable set DB_NAME -b "btr"
gh variable set DB_USER -b "btr"
gh variable set DB_SSL -b "false"
```

After this, merges to `main` will trigger a Cloud Build + Cloud Run deploy using the same script as local deploys (`deploy/cloudrun-deploy.sh`).
