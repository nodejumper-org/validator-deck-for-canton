import type { AdminAccount } from "@/lib/types"
import { getDb } from "./db"
import { user } from "./schema"

/**
 * The sign-up gate: registration is open only while the user table is empty.
 * One indexed `limit 1` probe, not a count — this runs on every sign-up
 * attempt and on both auth pages.
 */
export async function anyAccountExists(): Promise<boolean> {
  const db = await getDb()
  const rows = await db.select({ id: user.id }).from(user).limit(1)
  return rows.length > 0
}

/**
 * The role of a user row about to be written.
 *
 * Registration ORDER is the whole rule: the first account bootstraps the
 * instance and owns it, everyone after is a plain user that first admin
 * created. It takes no incoming role on purpose — the admin plugin stamps its
 * default onto every new row, so honouring what arrives would hand the very
 * first sign-up a plain account and leave the deck with no admin at all.
 *
 * Promoting a second admin is a separate, deliberate act on the /accounts page,
 * not something a creation call can ask for.
 */
export async function roleForNewUser(): Promise<"admin" | "user"> {
  return (await anyAccountExists()) ? "user" : "admin"
}

/**
 * Every account, for the admin page.
 *
 * Unpaginated, as the better-auth call it replaces effectively was with its
 * limit of 500. A deck has operators, not users at scale; if that stops being
 * true this is the one route to page.
 */
export async function listAccounts(): Promise<AdminAccount[]> {
  const db = await getDb()

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(user.createdAt)

  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
}
