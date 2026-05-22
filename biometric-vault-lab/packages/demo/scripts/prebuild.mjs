#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────
// Cross-platform prebuild: build the two workspace packages this demo
// depends on (@muulorigin/biometric-vault-core and -react) before vite
// bundles. Lets `npm run build` succeed even when CI (e.g. Vercel) runs
// it from packages/demo instead of the monorepo root.
// ──────────────────────────────────────────────────────────────────────

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_PACKAGES = resolve(__dirname, '..', '..');

const targets = [
  { name: '@muulorigin/biometric-vault-core', dir: join(REPO_PACKAGES, 'biometric-vault-core') },
  { name: '@muulorigin/biometric-vault-react', dir: join(REPO_PACKAGES, 'biometric-vault-react') },
];

for (const t of targets) {
  if (!existsSync(t.dir)) {
    console.error(`[prebuild] missing package directory: ${t.dir}`);
    process.exit(1);
  }
  const distIndex = join(t.dir, 'dist', 'index.js');
  console.log(`[prebuild] building ${t.name} (cwd=${t.dir})`);
  execSync('npm run build', { cwd: t.dir, stdio: 'inherit' });
  if (!existsSync(distIndex)) {
    console.error(`[prebuild] build completed but ${distIndex} not present`);
    process.exit(1);
  }
  console.log(`[prebuild] ${t.name}: dist/index.js ready`);
}

console.log('[prebuild] all workspace packages built — vite can resolve imports');
