import { deleteNode, getPublicNode, nodeUpdateSchema, updateNode } from "@/server/nodes"
import { handler, HttpError } from "@/server/route-helpers"

export const GET = handler(async (_req, ctx: RouteContext<"/api/nodes/[id]">) => {
  const { id } = await ctx.params
  const node = await getPublicNode(id)
  if (!node) throw new HttpError(404, "NODE_NOT_FOUND", `No node registered with id ${id}`)
  return { node }
})

export const PATCH = handler(async (req, ctx: RouteContext<"/api/nodes/[id]">) => {
  const { id } = await ctx.params
  const body = nodeUpdateSchema.parse(await req.json())
  return { node: await updateNode(id, body) }
})

export const DELETE = handler(async (_req, ctx: RouteContext<"/api/nodes/[id]">) => {
  const { id } = await ctx.params
  await deleteNode(id)
  return undefined
})
