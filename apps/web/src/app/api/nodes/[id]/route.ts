import { deleteNode, getPublicNode, nodeUpdateSchema, updateNode } from "@/server/nodes"
import { authed, HttpError } from "@/server/route-helpers"

export const GET = authed(async (_req, ctx: RouteContext<"/api/nodes/[id]">, ownerId) => {
  const { id } = await ctx.params
  const node = await getPublicNode(id, ownerId)
  if (!node) throw new HttpError(404, "NODE_NOT_FOUND", `No node registered with id ${id}`)
  return { node }
})

export const PATCH = authed(async (req, ctx: RouteContext<"/api/nodes/[id]">, ownerId) => {
  const { id } = await ctx.params
  const body = nodeUpdateSchema.parse(await req.json())
  return { node: await updateNode(id, body, ownerId) }
})

export const DELETE = authed(async (_req, ctx: RouteContext<"/api/nodes/[id]">, ownerId) => {
  const { id } = await ctx.params
  await deleteNode(id, ownerId)
  return undefined
})
