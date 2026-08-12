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
