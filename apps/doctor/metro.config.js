// Monorepo-aware Metro config.
//
// Metro does not walk up out of the app directory on its own, so the workspace
// root has to be watched explicitly for @agam/shared and @agam/mobile-ui edits
// to trigger a reload.
//
// pnpm's default (symlinked) layout is kept deliberately: forcing
// node-linker=hoisted lifts deprecated stub packages such as @types/minimatch
// into the root node_modules/@types, where TypeScript auto-loads them as
// implicit type libraries and breaks `tsc` in apps/web and apps/api. Metro has
// followed symlinks by default since 0.79, so hoisting buys nothing here.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Workspace packages ship TypeScript source rather than a build artifact, so
// Metro must not prefer a stale `main` field from a sibling install.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
