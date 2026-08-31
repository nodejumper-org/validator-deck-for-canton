import { and, eq } from "drizzle-orm"
import type { AdminAccount } from "@/lib/types"
import { getDb } from "./db"
import { OIDC_PROVIDER_ID } from "./oidc"
import { account, user } from "./schema"

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
 * Two sources, deliberately split. Registration ORDER decides for password
 * accounts — the first one bootstraps the instance and owns it. The Keycloak
 * GROUP decides for OIDC accounts: `mapOidcProfile` has already put `admin` on
 * the incoming record by the time this runs, and without the first branch a
 * rule written for a different question would demote every operator arriving
 * through single sign-on.
 *
 * Only `admin` counts as a decision taken upstream. The admin plugin stamps
 * every new row with its default role, so an incoming `user` is indis-
 * tinguishable from an unset one — honouring it would hand the very first
 * password sign-up a plain account and leave the deck with no admin at all.
 */
export async function roleForNewUser(incoming: { role?: unknown }): Promise<"admin" | "user"> {
  if (incoming.role === "admin") return "admin"
  return (await anyAccountExists()) ? "user" : "admin"
}

/**
 * Whether an account signs in through the identity provider.
 *
 * `providerId` is the literal `oidc` — the same constant the generic OAuth
 * provider is registered under. Renaming it orphans every existing link, and
 * would silently unguard the role check that reads this.
 */
export async function hasOidcAccount(userId: string): Promise<boolean> {
  const db = await getDb()
  const rows = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, OIDC_PROVIDER_ID)))
    .limit(1)
  return rows.length > 0
}

/**
 * Every account, with the providers it signs in through.
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

  const links = await db
    .select({ userId: account.userId, providerId: account.providerId })
    .from(account)

  const byUser = new Map<string, Set<string>>()
  for (const l of links) {
    const set = byUser.get(l.userId) ?? new Set<string>()
    set.add(l.providerId)
    byUser.set(l.userId, set)
  }

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    providers: [...(byUser.get(r.id) ?? [])].sort(),
  }))
}
