import { and, eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { getDb, resetDbForTests } from "./db"
import { nodeAccess, user } from "./schema"

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

/**
 * Grants a node to an account the way an admin would. Inserted directly, the
 * same way createTestUser inserts a user row: it keeps the registry tests about
 * the registry rather than about the admin API that will write these rows.
 */
export async function grantTestAccess(nodeId: string, userId: string): Promise<void> {
  const db = await getDb()
  await db.insert(nodeAccess).values({ nodeId, userId })
}

export async function revokeTestAccess(nodeId: string, userId: string): Promise<void> {
  const db = await getDb()
  await db
    .delete(nodeAccess)
    .where(and(eq(nodeAccess.nodeId, nodeId), eq(nodeAccess.userId, userId)))
}
