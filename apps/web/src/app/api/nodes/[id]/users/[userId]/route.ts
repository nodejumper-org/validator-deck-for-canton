import { ledgerFor } from "@/server/client"
import { authed } from "@/server/route-helpers"
import { updateUserSchema } from "@/server/validation"

type Ctx = RouteContext<"/api/nodes/[id]/users/[userId]">

// `ownerId` is the signed-in account; `userId` is the Canton ledger user in the
// path. They are unrelated and must never be confused.

export const GET = authed(async (_req, ctx: Ctx, ownerId) => {
  const { id, userId } = await ctx.params
  const ledger = await ledgerFor(id, ownerId)
  return { user: await ledger.getUser(userId) }
})

export const PATCH = authed(async (req, ctx: Ctx, ownerId) => {
  const { id, userId } = await ctx.params
  const body = updateUserSchema.parse(await req.json())
  const ledger = await ledgerFor(id, ownerId)
  return { user: await ledger.updateUser({ userId, ...body }) }
})

export const DELETE = authed(async (_req, ctx: Ctx, ownerId) => {
  const { id, userId } = await ctx.params
  const ledger = await ledgerFor(id, ownerId)
  await ledger.deleteUser(userId)
  return undefined
})
