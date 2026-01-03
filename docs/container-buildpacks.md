# Containerized deploy (buildpacks)

This repo is set up for a single-service container that serves both the API and the built UI from the same server. It uses cloud-native buildpacks (no Dockerfile).

## Local Docker (buildpacks + pack)

Prereqs:
- Docker
- pack CLI (https://buildpacks.io/docs/tools/pack/)

Build the image:

```bash
npm run container:build
```

Run the container:

```bash
npm run container:run
```

Then open http://localhost:3001.

Notes:
- The build uses `npm run build`, which produces `client/dist` and `server/dist`.
- Playwright browsers + OS deps are installed during build when `PLAYWRIGHT_INSTALL_WITH_DEPS=1` is set.

## Cloud Run (buildpacks)

Cloud Run buildpacks need the same build-time environment so Playwright can install browsers and OS deps.

Build-time env vars to set:
- `BP_NODE_RUN_SCRIPTS=build`
- `PLAYWRIGHT_INSTALL_WITH_DEPS=1`
- `PLAYWRIGHT_BROWSERS_PATH=0`

Runtime env vars:
- `PORT=8080` (Cloud Run defaults to this)

The app starts with `npm start` from the repo root, which launches `server/dist/index.js` and serves the built UI.
