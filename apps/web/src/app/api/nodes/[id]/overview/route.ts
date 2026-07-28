import { isCantonApiError } from "@canton/client"
import type { SurfaceError } from "@/lib/types"
import { hasValidator, ledgerFor, validatorFor } from "@/server/client"
import { getPublicNode } from "@/server/nodes"
import { authed, HttpError } from "@/server/route-helpers"

const message = (e: unknown) => (isCantonApiError(e) ? e.message : String(e))

export const GET = authed(async (_req, ctx: RouteContext<"/api/nodes/[id]/overview">, ownerId) => {
  const { id } = await ctx.params
  const node = await getPublicNode(id, ownerId)
  if (!node) throw new HttpError(404, "NODE_NOT_FOUND", `No node registered with id ${id}`)

  const ledger = await ledgerFor(id, ownerId)
  // Packages need the participant id, so it is fetched first; a failure here just
  // means the packages count is unavailable, not that the page is broken.
  const participantId = await ledger.getParticipantId().catch(() => null)

  const [version, ledgerEnd, synchronizers, users, packages, validatorVersion] =
    await Promise.allSettled([
      ledger.getVersion(),
      ledger.getLedgerEnd(),
      ledger.getConnectedSynchronizers(),
      ledger.listUsers({ pageSize: 1000 }),
      participantId ? ledger.listVettedPackages(participantId) : Promise.resolve([]),
      (await hasValidator(id, ownerId))
        ? validatorFor(id, ownerId).then((v) => v.getVersion())
        : Promise.resolve(null),
    ])

  // Each surface settles independently: one broken API degrades to a banner
  // rather than blanking the page.
  const errors: SurfaceError[] = []
  function value<T>(surface: string, r: PromiseSettledResult<T>, fallback: T): T {
    if (r.status === "fulfilled") return r.value
    errors.push({ surface, message: message(r.reason) })
    return fallback
  }

  return {
    node,
    participantId,
    ledgerVersion: value("Ledger version", version, null)?.version ?? null,
    validatorVersion: value("Validator version", validatorVersion, null)?.version ?? null,
    ledgerEnd: value("Ledger offset", ledgerEnd, null),
    synchronizers: value("Synchronizers", synchronizers, []),
    counts: {
      users: value("Users", users, { users: [], nextPageToken: "" }).users.length,
      packages: value("Packages", packages, []).length,
    },
    errors,
  }
})
