import { ledgerFor } from "@/server/client"
import { handler } from "@/server/route-helpers"
import { updateUserSchema } from "@/server/validation"

export const GET = handler(async (_req, ctx: RouteContext<"/api/nodes/[id]/users/[userId]">) => {
  const { id, userId } = await ctx.params
  const ledger = await ledgerFor(id)
  return { user: await ledger.getUser(userId) }
})

export const PATCH = handler(async (req, ctx: RouteContext<"/api/nodes/[id]/users/[userId]">) => {
  const { id, userId } = await ctx.params
  const body = updateUserSchema.parse(await req.json())
  const ledger = await ledgerFor(id)
  return { user: await ledger.updateUser({ userId, ...body }) }
})

export const DELETE = handler(async (_req, ctx: RouteContext<"/api/nodes/[id]/users/[userId]">) => {
  const { id, userId } = await ctx.params
  const ledger = await ledgerFor(id)
  await ledger.deleteUser(userId)
  return undefined
})
