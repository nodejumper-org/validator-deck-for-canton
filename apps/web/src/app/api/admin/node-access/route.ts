import { listNodeAccess } from "@/server/node-access"
import { adminOnly } from "@/server/route-helpers"

export const GET = adminOnly(async () => ({ nodes: await listNodeAccess() }))
