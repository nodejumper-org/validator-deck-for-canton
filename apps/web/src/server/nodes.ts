import { clearTokenCache } from "@canton/client"
import { and, eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"
import type { NodeSummary } from "@/lib/types"
import { seal } from "./crypto"
import { getDb } from "./db"
import { HttpError } from "./route-helpers"
import { nodes, type NodeRecord } from "./schema"

/** Accepts a URL or an empty string, normalising "" to undefined. */
const optionalUrl = z
  .union([z.url(), z.literal("")])
  .optional()
  .transform((v) => (v ? v : undefined))

export const nodeInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  network: z.enum(["devnet", "testnet", "mainnet", "local"]).default("devnet"),
  ledgerApiUrl: z.url("Must be a valid URL"),
  validatorApiUrl: optionalUrl,
  authTokenUrl: z.url("Must be a valid URL"),
  authClientId: z.string().min(1, "Client ID is required"),
  authClientSecret: z.string().min(1, "Client secret is required"),
  authAudience: z.string().optional(),
  authScope: z.string().optional(),
})
export type NodeInput = z.infer<typeof nodeInputSchema>

/**
 * Every field optional on update. A blank `authClientSecret` means "keep the
 * stored one", which is what the edit form sends when the operator does not
 * retype it.
 */
export const nodeUpdateSchema = nodeInputSchema.partial().extend({
  authClientSecret: z.string().optional(),
  validatorApiUrl: z.union([z.url(), z.literal("")]).optional(),
})
export type NodeUpdate = z.infer<typeof nodeUpdateSchema>

export type PublicNode = Omit<
  NodeRecord,
  "authClientSecretEnc" | "userId" | "createdAt" | "updatedAt"
> & {
  hasSecret: boolean
  createdAt: string
  updatedAt: string
}

/**
 * The only way a node crosses to the browser. Dropping the sealed secret here,
 * rather than at each call site, is what makes "secrets never leave the server"
 * a property of the type instead of a habit.
 */
export function toPublic(node: NodeRecord): PublicNode {
  const { authClientSecretEnc, userId, createdAt, updatedAt, ...rest } = node
  void userId
  return {
    ...rest,
    hasSecret: authClientSecretEnc.length > 0,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  }
}

// Compile-time proof that the wire type the browser reads matches what we send.
const _publicNodeMatchesWireType: NodeSummary = null as unknown as PublicNode
void _publicNodeMatchesWireType

/**
 * Every read and write is scoped by `userId`. A node id alone is never enough to
 * reach a node: an id belonging to someone else simply reads as not found, which
 * is also why callers get 404 rather than 403 — the existence of another user's
 * node is not ours to disclose.
 */
export async function listNodes(userId: string): Promise<PublicNode[]> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(nodes)
    .where(eq(nodes.userId, userId))
    .orderBy(nodes.createdAt)
  return rows.map(toPublic)
}

export async function getNode(id: string, userId: string): Promise<NodeRecord | undefined> {
  const db = await getDb()
  const [row] = await db
    .select()
    .from(nodes)
    .where(and(eq(nodes.id, id), eq(nodes.userId, userId)))
    .limit(1)
  return row
}

export async function getPublicNode(id: string, userId: string): Promise<PublicNode | undefined> {
  const node = await getNode(id, userId)
  return node ? toPublic(node) : undefined
}

/** Used by the scheduler, which runs system-wide rather than for one user. */
export async function listAllNodes(): Promise<NodeRecord[]> {
  const db = await getDb()
  return db.select().from(nodes).orderBy(nodes.createdAt)
}

export async function createNode(input: NodeInput, userId: string): Promise<PublicNode> {
  const parsed = nodeInputSchema.parse(input)
  const db = await getDb()
  const [row] = await db
    .insert(nodes)
    .values({
      id: nanoid(12),
      userId,
      name: parsed.name,
      network: parsed.network,
      ledgerApiUrl: parsed.ledgerApiUrl,
      validatorApiUrl: parsed.validatorApiUrl ?? null,
      authTokenUrl: parsed.authTokenUrl,
      authClientId: parsed.authClientId,
      authClientSecretEnc: seal(parsed.authClientSecret),
      authAudience: parsed.authAudience ?? null,
      authScope: parsed.authScope ?? null,
    })
    .returning()
  return toPublic(row!)
}

export async function updateNode(
  id: string,
  input: NodeUpdate,
  userId: string,
): Promise<PublicNode> {
  const parsed = nodeUpdateSchema.parse(input)
  const db = await getDb()

  const patch: Partial<NodeRecord> = { updatedAt: new Date() }
  if (parsed.name !== undefined) patch.name = parsed.name
  if (parsed.network !== undefined) patch.network = parsed.network
  if (parsed.ledgerApiUrl !== undefined) patch.ledgerApiUrl = parsed.ledgerApiUrl
  if (parsed.validatorApiUrl !== undefined) patch.validatorApiUrl = parsed.validatorApiUrl || null
  if (parsed.authTokenUrl !== undefined) patch.authTokenUrl = parsed.authTokenUrl
  if (parsed.authClientId !== undefined) patch.authClientId = parsed.authClientId
  if (parsed.authAudience !== undefined) patch.authAudience = parsed.authAudience ?? null
  if (parsed.authScope !== undefined) patch.authScope = parsed.authScope ?? null
  // Only overwrite the secret when a fresh one was actually supplied.
  if (parsed.authClientSecret) patch.authClientSecretEnc = seal(parsed.authClientSecret)

  const [row] = await db
    .update(nodes)
    .set(patch)
    .where(and(eq(nodes.id, id), eq(nodes.userId, userId)))
    .returning()
  if (!row) throw new HttpError(404, "NODE_NOT_FOUND", `No node registered with id ${id}`)

  // Any credential change invalidates the bearer token cached for this node.
  if (parsed.authClientSecret || parsed.authClientId || parsed.authTokenUrl) {
    clearTokenCache(id)
  }
  return toPublic(row)
}

export async function deleteNode(id: string, userId: string): Promise<void> {
  const db = await getDb()
  await db.delete(nodes).where(and(eq(nodes.id, id), eq(nodes.userId, userId)))
  clearTokenCache(id)
}
