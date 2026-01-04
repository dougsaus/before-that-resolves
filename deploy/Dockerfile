ARG ENABLE_PDF=0

FROM node:20-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime-0
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev

COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server/dist ./server/dist

ENV PORT=3001
EXPOSE 3001
CMD ["npm", "start"]

FROM mcr.microsoft.com/playwright:v1.57.0-jammy AS runtime-1
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev

COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server/dist ./server/dist

ENV PORT=3001
EXPOSE 3001
CMD ["npm", "start"]

FROM runtime-${ENABLE_PDF} AS runtime
