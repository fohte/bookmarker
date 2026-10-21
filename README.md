# Bookmarker

Bookmarker is a personal tool for collecting and managing bookmarks across multiple services. The repository contains a web SPA and a Node.js API workspace.

## Getting started

Requires Node.js 24.21.0 and Corepack. With mise installed, run the bootstrap script to install the pinned tools and workspace dependencies:

```sh
./scripts/bootstrap
```

Run the web development server and watch API source changes in separate terminals:

```sh
pnpm --filter web dev
pnpm --filter api dev
```

Run tests and build both workspaces:

```sh
pnpm test
pnpm --filter web build
pnpm --filter api build
```
