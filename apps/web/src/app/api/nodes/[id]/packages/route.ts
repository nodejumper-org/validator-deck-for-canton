import { ledgerFor } from "@/server/client"
import { handler } from "@/server/route-helpers"

export const GET = handler(async (_req, ctx: RouteContext<"/api/nodes/[id]/packages">) => {
  const { id } = await ctx.params
  const ledger = await ledgerFor(id)

  // The participant filter is mandatory — without it the node answers with the
  // first 100 participants on the synchronizer and usually omits ours.
  const participantId = await ledger.getParticipantId()
  const packages = await ledger.listVettedPackages(participantId)

  const byName = new Map<string, Set<string>>()
  for (const p of packages) {
    const versions = byName.get(p.packageName) ?? new Set<string>()
    versions.add(p.packageVersion)
    byName.set(p.packageName, versions)
  }

  // Ranked by how many distinct versions are vetted: the top of this list is the
  // node's upgrade debt.
  const versionsByName = [...byName.entries()]
    .map(([name, versions]) => ({ name, versions: [...versions].sort() }))
    .sort((a, b) => b.versions.length - a.versions.length || a.name.localeCompare(b.name))

  return { packages, participantId, versionsByName }
})
