import type { LedgerUser } from "@canton/client"
import { ledgerFor } from "@/server/client"
import { authed } from "@/server/route-helpers"
import { createUserSchema } from "@/server/validation"

/** Guard against a runaway loop; participants hold far fewer users than this. */
const MAX_USERS = 1000

export const GET = authed(async (_req, ctx: RouteContext<"/api/nodes/[id]/users">, ownerId) => {
  const { id } = await ctx.params
  const ledger = await ledgerFor(id, ownerId)

  const users: LedgerUser[] = []
  let pageToken = ""
  do {
    const page = await ledger.listUsers({ pageSize: 1000, pageToken })
    users.push(...page.users)
    pageToken = page.nextPageToken
  } while (pageToken && users.length < MAX_USERS)

  return { users }
})

export const POST = authed(async (req, ctx: RouteContext<"/api/nodes/[id]/users">, ownerId) => {
  const { id } = await ctx.params
  const body = createUserSchema.parse(await req.json())
  const ledger = await ledgerFor(id, ownerId)
  return { user: await ledger.createUser(body) }
})
