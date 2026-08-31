import { eq, inArray } from "drizzle-orm"
import { z } from "zod"
import type { AccountRef, NodeAccessRow } from "@/lib/types"
import { getDb } from "./db"
import { HttpError } from "./route-helpers"
import { nodeAccess, nodes, user } from "./schema"

/**
 * Who may reach which node, from the admin's side.
 *
 * The authorization rule itself is `reachableBy` in nodes.ts and is not
 * repeated here — this module only writes the table that predicate reads, and
 * reads it back for the admin page.
 */

export const nodeAccessInputSchema = z.object({
  userIds: z.array(z.string().min(1)),
})
export type NodeAccessInput = z.infer<typeof nodeAccessInputSchema>

/** Every node in the deck, whoever owns it. Admin surfaces only. */
export async function listNodeAccess(): Promise<NodeAccessRow[]> {
  const db = await getDb()

  const owned = await db
    .select({
      id: nodes.id,
      name: nodes.name,
      network: nodes.network,
      ownerId: user.id,
      ownerName: user.name,
      ownerEmail: user.email,
    })
    .from(nodes)
    .innerJoin(user, eq(nodes.userId, user.id))
    .orderBy(nodes.createdAt)

  const grants = await db
    .select({
      nodeId: nodeAccess.nodeId,
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(nodeAccess)
    .innerJoin(user, eq(nodeAccess.userId, user.id))
    .orderBy(user.email)

  // Two queries grouped in memory rather than one with an aggregate: a deck
  // holds tens of nodes, and this shape needs no SQL anyone has to re-read.
  const byNode = new Map<string, AccountRef[]>()
  for (const g of grants) {
    const list = byNode.get(g.nodeId) ?? []
    list.push({ id: g.id, name: g.name, email: g.email })
    byNode.set(g.nodeId, list)
  }

  return owned.map((n) => ({
    id: n.id,
    name: n.name,
    network: n.network,
    owner: { id: n.ownerId, name: n.ownerName, email: n.ownerEmail },
    grantees: byNode.get(n.id) ?? [],
  }))
}

/**
 * Replaces a node's grants with exactly `userIds`.
 *
 * The whole set, not a diff: two admins editing the same node cannot interleave
 * into a state neither of them chose. The owner is filtered out — a grant row
 * for them would be redundant and would make them look like a grantee.
 */
export async function setNodeAccess(nodeId: string, userIds: string[]): Promise<NodeAccessRow> {
  const db = await getDb()

  const [node] = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1)
  if (!node) throw new HttpError(404, "NODE_NOT_FOUND", `No node registered with id ${nodeId}`)

  const wanted = [...new Set(userIds)].filter((id) => id !== node.userId)

  // Checked before the write so an unknown id is a 400 naming it, rather than a
  // foreign-key violation surfacing as a 500 that reads like our bug.
  if (wanted.length > 0) {
    const found = await db.select({ id: user.id }).from(user).where(inArray(user.id, wanted))
    const known = new Set(found.map((r) => r.id))
    const missing = wanted.filter((id) => !known.has(id))
    if (missing.length > 0) {
      throw new HttpError(400, "UNKNOWN_ACCOUNT", `No account with id ${missing.join(", ")}`)
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(nodeAccess).where(eq(nodeAccess.nodeId, nodeId))
    if (wanted.length > 0) {
      await tx.insert(nodeAccess).values(wanted.map((userId) => ({ nodeId, userId })))
    }
  })

  const row = (await listNodeAccess()).find((r) => r.id === nodeId)
  return row!
}
