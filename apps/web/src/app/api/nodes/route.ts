import { createNode, listNodes, nodeInputSchema } from "@/server/nodes"
import { handler } from "@/server/route-helpers"

export const GET = handler(async () => ({ nodes: await listNodes() }))

export const POST = handler(async (req) => {
  const body = nodeInputSchema.parse(await req.json())
  return { node: await createNode(body) }
})
