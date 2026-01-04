# Containerized deploy (Docker)

This repo is set up for a single-service container that serves both the API and the built UI from the same server.

## Local Docker

Prereqs:
- Docker

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
- PDF export is disabled by default. To include Playwright + Chromium, build with `ENABLE_PDF=1` (e.g. `npm run container:build:pdf`), which switches the runtime base image to `mcr.microsoft.com/playwright:v1.57.0-jammy`.

## GCP / Cloud Run

Prereqs:
- gcloud CLI
- Access to the GCP project

One-time setup:

```bash
gcloud auth login
gcloud config set project before-that-resolves
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

IAM roles (minimums):
- `roles/run.admin`
- `roles/iam.serviceAccountUser`
- `roles/artifactregistry.writer`
- `roles/cloudbuild.builds.editor`

Note: the Cloud Build service account (`PROJECT_NUMBER@cloudbuild.gserviceaccount.com`) must have `roles/artifactregistry.writer` to push images.

Deploy (build + push + run):

```bash
deploy/cloudrun-deploy.sh
```

Common options (environment variables):
- `PROJECT_ID` (default: `before-that-resolves`)
- `REGION` (default: `us-central1`)
- `SERVICE_NAME` (default: `before-that-resolves`)
- `REPO` (default: `before-that-resolves`)
- `IMAGE_NAME` (default: `before-that-resolves`)
- `ENABLE_PDF` (default: `1`)

The service expects the OpenAI API key to be supplied by the client (via the UI or the request headers).

Verify:

```bash
curl -s https://YOUR_SERVICE_URL/health
```

Cloud Run sets `PORT=8080` at runtime. The container starts with `npm start` from the repo root, which launches `server/dist/index.js` and serves the built UI.
