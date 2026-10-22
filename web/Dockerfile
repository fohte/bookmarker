# syntax=docker/dockerfile:1

# Keep the Node.js version in sync with .mise.toml.
FROM node:24.21.0-slim AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Node.js 25+ no longer bundles Corepack: https://nodejs.org/api/corepack.html
RUN npm install -g corepack@0.35.0 && npm cache clean --force && corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/
COPY api/package.json api/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS builder
COPY api/ api/
COPY web/ web/
RUN pnpm --filter web build

FROM nginx:stable-alpine AS runtime
# Kubernetes must replace Docker's embedded DNS address with its cluster DNS IP.
# NGINX resolver does not apply the Pod's search list, so use the Service FQDN.
ENV API_BACKEND_URL=http://api.bookmarker.svc.cluster.local:8080 \
    NGINX_RESOLVER=127.0.0.11 \
    NGINX_ENVSUBST_FILTER="^(API_BACKEND_URL|NGINX_RESOLVER)$"
COPY --from=builder /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 -O /dev/null http://127.0.0.1/health || exit 1

LABEL org.opencontainers.image.source=https://github.com/fohte/bookmarker
