import * as path from 'path';

// Point mongodb-memory-server at the binary cache `pnpm install`'s postinstall
// script already populated (apps/api's node_modules is a pnpm symlink whose
// default cache-dir resolution lands elsewhere, e.g. ~/.cache/mongodb-binaries,
// triggering a slow re-download per test run without this).
process.env.MONGOMS_DOWNLOAD_DIR ??= path.resolve(__dirname, '../../../../node_modules/.cache/mongodb-memory-server');
