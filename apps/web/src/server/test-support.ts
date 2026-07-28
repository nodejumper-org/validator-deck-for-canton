import { nanoid } from "nanoid"
import { getDb, resetDbForTests } from "./db"
import { user } from "./schema"

/**
 * Test fixtures for the server layer.
 *
 * Nodes are owned by a user, so anything touching the registry needs one to
 * exist first. Better-auth normally creates these rows; inserting directly keeps
 * the registry tests focused on the registry.
 */
export async function freshDb() {
  resetDbForTests()
  return getDb()
}

export async function createTestUser(email = `${nanoid(8)}@example.test`): Promise<string> {
  const db = await getDb()
  const id = nanoid(16)
  const now = new Date()
  await db.insert(user).values({
    id,
    name: email.split("@")[0]!,
    email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  })
  return id
}
