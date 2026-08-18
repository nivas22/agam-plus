# agam-plus

Monorepo containing a Next.js web app and a NestJS API, managed with pnpm workspaces + Turborepo. Each app deploys to its own Vercel project.

## Structure

```
apps/
  web/      Next.js (App Router, TypeScript)
  api/      NestJS API
packages/
  shared/   Shared TypeScript types used by both apps
```

## Requirements

- Node.js 20+
- pnpm 9 (enable via `corepack enable && corepack prepare pnpm@9 --activate`)

## Getting started

```bash
pnpm install

pnpm dev          # run web + api together
pnpm dev:web      # web only  (http://localhost:3000)
pnpm dev:api      # api only  (http://localhost:3000 by default; set PORT to change)

pnpm build        # build everything
pnpm lint
pnpm test
```

`packages/shared` is a workspace dependency (`@agam-plus/shared`) — `pnpm build` compiles it before the apps that depend on it (Turborepo's `^build` dependency).

## Deploying to Vercel

Each app is deployed as its **own Vercel project** pointing at the same repo, with a different Root Directory. Vercel's monorepo support installs from the repo root (respecting `pnpm-workspace.yaml`) and then runs the app's build.

### Web (`apps/web`)

1. Import the repo into a new Vercel project.
2. Project Settings → General → Root Directory: `apps/web`.
3. Framework Preset: Next.js (auto-detected). No custom build/install commands needed.

### API (`apps/api`)

1. Import the repo into a second Vercel project.
2. Project Settings → General → Root Directory: `apps/api`.
3. Framework Preset: Other. Build/Install commands come from `apps/api/vercel.json` (they `cd` back to the repo root so `pnpm`/`turbo` can see the workspace).

The NestJS app itself (`apps/api/src`) is a standard, portable Nest app — `pnpm start:prod` runs it anywhere (AWS, GCP, a container, etc.) via `node dist/main`. The only Vercel-specific code is `apps/api/api/index.ts`, a thin adapter that wraps the same `AppModule` in a single serverless function, plus `apps/api/vercel.json`. Both can be deleted with no changes to `src/` when moving off Vercel.

## Environment variables

Set per-app environment variables in each Vercel project's Settings → Environment Variables. Locally, copy `.env.example` files (if present in an app) to `.env.local` / `.env`.
