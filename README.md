# agam-plus

Monorepo containing a Next.js web app, a NestJS API, a marketing site and an Expo (Android + iOS) doctor app, managed with pnpm workspaces + Turborepo. The web apps and API each deploy to their own Vercel project; the mobile app builds through EAS.

## Structure

```
apps/
  web/        Next.js (App Router, TypeScript)
  api/        NestJS API
  www/        Marketing site
  doctor/     Expo app for doctors (Android + iOS)
packages/
  shared/     API types + the HTTP client, shared by web and doctor
  mobile-ui/  Theme and React Native components, shared by mobile apps
```

`packages/shared` holds the canonical response types (it is where
`apps/web/src/types/*` now re-exports from) and a storage-agnostic API client.
The client takes a `TokenStore`, so web backs it with `localStorage` and the
doctor app with `expo-secure-store` while everything else — base URL, timeout,
401 retry, error shape — stays identical.

## Requirements

- Node.js 20+
- pnpm 9 (enable via `corepack enable && corepack prepare pnpm@9 --activate`)

## Getting started

```bash
pnpm install

pnpm dev          # run web + api together
pnpm dev:web      # web only  (http://localhost:3000)
pnpm dev:api      # api only  (http://localhost:3000 by default; set PORT to change)
pnpm dev:doctor   # Expo dev server for the mobile app

pnpm build        # build everything
pnpm lint
pnpm test
```

## Deploying to Vercel

Each app is deployed as its **own Vercel project** pointing at the same repo, with a different Root Directory. Vercel's monorepo support installs from the repo root (respecting `pnpm-workspace.yaml`) and then runs the app's build.

> Direct link per project:
> `https://vercel.com/<team>/<project>/settings/build-and-deployment#root-directory`
>
> **The CI deploy must run from the repo root.** `vercel deploy` uploads its
> working directory, so running it inside `apps/web` uploads that folder alone
> — without `pnpm-workspace.yaml`, `pnpm-lock.yaml` or `packages/*`. Vercel
> then finds no pnpm lockfile, falls back to `npm install`, and fails with
> `Unsupported URL Type "workspace:"` on any `workspace:*` dependency. The
> workflows therefore run `vercel deploy` from the root and rely on each
> project's **Root Directory** setting to pick the app. Any app that depends
> on `@agam/shared` needs this; `apps/api` has no workspace dependency and is
> unaffected.

### Web (`apps/web`)

1. Import the repo into a new Vercel project.
2. Project Settings → **Build and Deployment** → Root Directory: `apps/web`. **Required** — the
   CI deploy uploads the whole repo, so without this Vercel builds the root
   `package.json`, which has no `next`, and fails with *No Next.js version
   detected*.
3. Framework Preset: Next.js (auto-detected). No custom build/install commands needed.
4. Repo secret: `VERCEL_PROJECT_ID_WEB`.

### WWW (`apps/www`)

Same shape as web — it also depends on `@agam/shared` (for `/api/version`), so
it has the same two requirements.

1. Import the repo into its own Vercel project.
2. Project Settings → **Build and Deployment** → Root Directory: `apps/www`.
3. Framework Preset: Next.js (auto-detected).
4. Repo secret: `VERCEL_PROJECT_ID_WWW`.

Deployed by `.github/workflows/deploy-www.yml` on pushes touching `apps/www/**`
or `packages/shared/**`.

### API (`apps/api`)

1. Import the repo into its own Vercel project.
2. Project Settings → **Build and Deployment** → Root Directory: `apps/api`.
   Its workflow still deploys from inside `apps/api`, which works only because
   the API has no `workspace:*` dependency.
3. Framework Preset: **Other** (not the NestJS zero-config preset — see note below). Build/Install commands come from `apps/api/vercel.json` (they `cd` back to the repo root so `pnpm`/`turbo` can see the workspace).

The NestJS app itself (`apps/api/src`) is a standard, portable Nest app — `pnpm start:prod` runs it anywhere (AWS, GCP, a container, etc.) via `node dist/main`. The only Vercel-specific code is `apps/api/api/index.ts`, a thin adapter that wraps the same `AppModule` in a single serverless function, plus `apps/api/vercel.json`. Both can be deleted with no changes to `src/` when moving off Vercel.

> **Why not Vercel's zero-config NestJS support?** Vercel added a "zero-config" NestJS Function that auto-wraps `src/main.ts` — but as of writing it expects the entrypoint to export a handler, and fails at runtime (`No exports found in module`) against a standard `bootstrap()` + `app.listen()` file like ours. The custom adapter avoids that. If Vercel's NestJS support matures, this file can be dropped in favor of it.

## Identifying a deployed version

Nothing bumps `version` in package.json, so it cannot tell you what is live —
the **git commit is the build number** for everything that deploys from CI.
Every app reports the same shape (`packages/shared/src/version.ts`):

```json
{ "app": "api", "release": "0.0.1", "build": "a1b2c3d",
  "environment": "production", "branch": "main",
  "display": "api 0.0.1 (a1b2c3d) · production" }
```

| App | Where to read it |
|-----|------------------|
| api | `GET /version`, and now included in `GET /health` |
| web | `GET /api/version` |
| www | `GET /api/version` |
| doctor | **More → About → Version** (tap to copy) |

```bash
curl -s https://<api-host>/version | jq .display
curl -s https://<web-host>/api/version | jq .display
```

The web and www values come from Vercel's system environment variables, which
requires **Settings → Environment Variables → Automatically expose System
Environment Variables** to be on for each project. If it is off, `build` reads
`unknown` — that is the signal.

The mobile app is the exception: a store binary is identified by its build
number, not a commit, so `build` there is the iOS `buildNumber` / Android
`versionCode` that EAS increments. See the doctor-app section above.

## Environment variables

Set per-app environment variables in each Vercel project's Settings → Environment Variables. Locally, copy `.env.example` files (if present in an app) to `.env.local` / `.env`.

## Doctor app (`apps/doctor`)

Expo + expo-router, one TypeScript codebase for Android and iOS.

```bash
cp apps/doctor/.env.example apps/doctor/.env
pnpm dev:doctor
```

`EXPO_PUBLIC_AGAM_API_URL` must point at a reachable API. On a physical device
that means your machine's LAN IP (`http://192.168.1.20:3001`), not `localhost`.

The auth token is kept in `expo-secure-store` (Keychain / Android Keystore)
rather than AsyncStorage, because the JWT grants access to patient records.

### Platform adaptation

The app is one codebase that renders as two native apps. `packages/mobile-ui`
holds the split: `tokens.ts` carries the per-platform type ramp, radii, section
headers and depth model (iOS shadows, Android elevation — never both), and each
component decides its own platform shape so screens never branch on
`Platform.OS` themselves.

What actually differs, screen by screen: iOS puts the large title in the scroll
content so it collapses into the nav bar, shows a labelled back chevron
("‹ Today"), inset grouped lists with disclosure chevrons, a true segmented
control, and bottom action buttons. Material uses a large top app bar with an
overflow menu, a bare up arrow, full-bleed dividers, wrapping choice chips, an
extended FAB, and a snackbar. The FAB and snackbar render `null` on iOS rather
than being faked.

`tokens.ts` defines a light palette only, so `app.json` pins
`userInterfaceStyle` to `light` — leaving it on `automatic` would render the
light palette against a dark system chrome.

### Native builds

The app uses Expo's managed workflow, so `android/` and `ios/` are generated by
`expo prebuild` and are gitignored. Builds run through EAS:

```bash
cd apps/doctor
eas build --platform all --profile preview
```

Fill in the `REPLACE_WITH_*_API_URL` placeholders in `apps/doctor/eas.json`
before the first preview or production build. CI (`.github/workflows/
build-doctor.yml`) typechecks every push and builds on `main` or on a manual
dispatch; it needs an `EXPO_TOKEN` repo secret.

> **Note on pnpm:** the workspace deliberately uses pnpm's default symlinked
> layout. Setting `node-linker=hoisted` for Metro's benefit lifts deprecated
> stub packages (e.g. `@types/minimatch`) into the root `node_modules/@types`,
> where TypeScript auto-loads them as implicit type libraries and breaks `tsc`
> in `apps/web` and `apps/api`. Metro has followed symlinks by default since
> 0.79, so `apps/doctor/metro.config.js` only needs the workspace root added to
> `watchFolders`.
