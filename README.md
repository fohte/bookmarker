# Bookmarker

Bookmarker is a personal tool for collecting and managing bookmarks across multiple services. The repository contains a web SPA and a Node.js API workspace.

## Getting started

Requires Node.js 24.21.0 and Corepack. With mise installed, run the bootstrap script to install the pinned tools and workspace dependencies:

```sh
./scripts/bootstrap
```

For local API development, copy the shared environment template and load it in the API terminal:

```sh
cp .env.example .env
set -a
source .env
set +a
```

The template enables the development auth bypass for the loopback API listener. Keep the browser origin at `http://localhost:5173`; the Vite server proxies `/api` to `http://127.0.0.1:8080`, so browser requests use the same origin and the API applies its normal JSON and Origin checks to writes.

Run the web development server and watch API source changes in separate terminals:

```sh
pnpm --filter web dev
pnpm --filter api dev
```

Run `pnpm --filter api dev` in the terminal where `.env` was loaded. The API binds to loopback when `NODE_ENV=development`, `DEV_AUTH_BYPASS=true`, and `APP_ORIGIN` is a loopback origin. The bypass is unavailable in test and production environments.

Run tests and build both workspaces:

```sh
pnpm test
pnpm --filter web build
pnpm --filter api build
```
