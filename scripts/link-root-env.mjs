#!/usr/bin/env node
/**
 * This monorepo keeps one .env at the root, but Next only reads .env from the
 * app directory and Turbopack runs route handlers in a worker process, so
 * mutating process.env from next.config.ts does not reach them.
 *
 * Linking the root .env into apps/web is the least surprising fix: one source of
 * truth, no duplicated secrets, and no build-time inlining. Runs before dev,
 * build, and start. Silent when there is nothing to do.
 */
import { copyFileSync, existsSync, lstatSync, symlinkSync, unlinkSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = resolve(repoRoot, ".env")
const target = resolve(repoRoot, "apps/web/.env")

if (!existsSync(source)) {
  console.warn("[env] No .env at the repo root. Copy .env.example to .env before running the app.")
  process.exit(0)
}

// A stale link (root .env deleted and recreated) still reports as existing, so
// replace anything that is already a symlink rather than trusting it.
if (existsSync(target) || isSymlink(target)) {
  if (!isSymlink(target)) process.exit(0) // A real file here is the user's own; leave it.
  unlinkSync(target)
}

try {
  symlinkSync(source, target)
} catch {
  // Windows without developer mode cannot create symlinks; a copy still works.
  copyFileSync(source, target)
}

function isSymlink(path) {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}
