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
