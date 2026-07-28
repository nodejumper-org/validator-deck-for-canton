import { createNode, listNodes, nodeInputSchema } from "@/server/nodes"
import { authed } from "@/server/route-helpers"

export const GET = authed(async (_req, _ctx, ownerId) => ({ nodes: await listNodes(ownerId) }))

export const POST = authed(async (req, _ctx, ownerId) => {
  const body = nodeInputSchema.parse(await req.json())
  return { node: await createNode(body, ownerId) }
})
