import { ledgerFor } from "@/server/client"
import { authed } from "@/server/route-helpers"

export const GET = authed(async (_req, ctx: RouteContext<"/api/nodes/[id]/packages">, ownerId) => {
  const { id } = await ctx.params
  const ledger = await ledgerFor(id, ownerId)

  // The participant filter is mandatory — without it the node answers with the
  // first 100 participants on the synchronizer and usually omits ours.
  const participantId = await ledger.getParticipantId()
  const packages = await ledger.listVettedPackages(participantId)

  return { packages, participantId }
})
