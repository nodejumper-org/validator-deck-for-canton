import { drizzle as drizzlePg } from "drizzle-orm/node-postgres"
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Pool } from "pg"
import * as schema from "./schema.js"

export type DrizzleDb = ReturnType<typeof drizzlePg<typeof schema>>

/**
 * Resolved relative to this module rather than the working directory: Next runs
 * from apps/web but Vitest runs from the repo root, and both must find the same
 * migrations.
 */
const MIGRATIONS_FOLDER = resolve(dirname(fileURLToPath(import.meta.url)), "../../drizzle")

async function connect(): Promise<DrizzleDb> {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Run `npm run db:up` and copy .env.example to .env",
    )
  }

  if (url.startsWith("pglite://")) {
    // In-process Postgres: real enums, real timestamptz, real migrations, no
    // Docker. This is what lets `npm test` run anywhere.
    const { PGlite } = await import("@electric-sql/pglite")
    const { drizzle } = await import("drizzle-orm/pglite")
    const { migrate } = await import("drizzle-orm/pglite/migrator")
    const db = drizzle(new PGlite(), { schema })
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
    return db as unknown as DrizzleDb
  }

  const db = drizzlePg(new Pool({ connectionString: url }), { schema })
  await migratePg(db, { migrationsFolder: MIGRATIONS_FOLDER })
  return db
}

// Memoised on the promise, not the resolved value, so concurrent route handlers
// share one connection attempt instead of racing to migrate. Pinned to
// globalThis because Next re-evaluates modules on every dev-mode edit.
const globalForDb = globalThis as unknown as { __cantonDb?: Promise<DrizzleDb> }

export function getDb(): Promise<DrizzleDb> {
  globalForDb.__cantonDb ??= connect()
  return globalForDb.__cantonDb
}

/** Tests only: drop the handle so the next getDb() builds a fresh database. */
export function resetDbForTests(): void {
  globalForDb.__cantonDb = undefined
}
