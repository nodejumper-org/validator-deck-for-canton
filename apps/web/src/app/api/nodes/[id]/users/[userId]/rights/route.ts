import { ledgerFor } from "@/server/client"
import { handler } from "@/server/route-helpers"
import { rightsBodySchema } from "@/server/validation"

type Ctx = RouteContext<"/api/nodes/[id]/users/[userId]/rights">

export const GET = handler(async (_req, ctx: Ctx) => {
  const { id, userId } = await ctx.params
  const ledger = await ledgerFor(id)
  return { rights: await ledger.listUserRights(userId) }
})

/** Grant. */
export const POST = handler(async (req, ctx: Ctx) => {
  const { id, userId } = await ctx.params
  const { rights } = rightsBodySchema.parse(await req.json())
  const ledger = await ledgerFor(id)
  return { rights: await ledger.grantUserRights(userId, rights) }
})

/** Revoke — Canton models this as a PATCH on the rights collection. */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const { id, userId } = await ctx.params
  const { rights } = rightsBodySchema.parse(await req.json())
  const ledger = await ledgerFor(id)
  return { rights: await ledger.revokeUserRights(userId, rights) }
})
