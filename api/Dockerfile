# syntax=docker/dockerfile:1

# Keep the Node.js version in sync with .mise.toml.
FROM node:24.21.0-slim AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Node.js 25+ no longer bundles Corepack: https://github.com/nodejs/corepack
RUN npm install -g corepack@0.35.0 && npm cache clean --force && corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/
COPY api/package.json api/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Local development stage. Bind-mount the repo over /app (e.g. from
# docker compose, with an anonymous volume on /app/node_modules to keep
# this image's install instead of the host's) for live-reload without
# rebuilding the image.
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/api/node_modules ./api/node_modules
WORKDIR /app/api
CMD ["pnpm", "dev"]

FROM deps AS builder
COPY . .
RUN pnpm --filter api build

# Built fresh from `base`, not `builder`, so the runtime image doesn't inherit
# dev dependencies or source files left over from the build stage.
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/
COPY api/package.json api/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod
COPY --from=builder /app/api/dist ./api/dist
USER node
WORKDIR /app/api
EXPOSE 8080
CMD ["node", "--import", "@fohte/service-kit/otel-register", "dist/index.js"]
