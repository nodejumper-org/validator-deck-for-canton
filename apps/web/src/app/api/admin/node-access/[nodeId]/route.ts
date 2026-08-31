import { nodeAccessInputSchema, setNodeAccess } from "@/server/node-access"
import { adminOnly } from "@/server/route-helpers"

// `nodeId`, not `id`: this route is about a node's grants, and the `[id]` name
// is spoken for by the node routes it must not be confused with.
export const PUT = adminOnly(async (req, ctx: RouteContext<"/api/admin/node-access/[nodeId]">) => {
  const { nodeId } = await ctx.params
  const { userIds } = nodeAccessInputSchema.parse(await req.json())
  return { node: await setNodeAccess(nodeId, userIds) }
})
