import { ledgerFor } from "@/server/client"
import { authed } from "@/server/route-helpers"
import { rightsBodySchema } from "@/server/validation"

type Ctx = RouteContext<"/api/nodes/[id]/users/[userId]/rights">

// `ownerId` is the signed-in account; `userId` is the Canton ledger user in the
// path. They are unrelated and must never be confused.

export const GET = authed(async (_req, ctx: Ctx, ownerId) => {
  const { id, userId } = await ctx.params
  const ledger = await ledgerFor(id, ownerId)
  return { rights: await ledger.listUserRights(userId) }
})

/** Grant. */
export const POST = authed(async (req, ctx: Ctx, ownerId) => {
  const { id, userId } = await ctx.params
  const { rights } = rightsBodySchema.parse(await req.json())
  const ledger = await ledgerFor(id, ownerId)
  return { rights: await ledger.grantUserRights(userId, rights) }
})

/** Revoke — Canton models this as a PATCH on the rights collection. */
export const PATCH = authed(async (req, ctx: Ctx, ownerId) => {
  const { id, userId } = await ctx.params
  const { rights } = rightsBodySchema.parse(await req.json())
  const ledger = await ledgerFor(id, ownerId)
  return { rights: await ledger.revokeUserRights(userId, rights) }
})
