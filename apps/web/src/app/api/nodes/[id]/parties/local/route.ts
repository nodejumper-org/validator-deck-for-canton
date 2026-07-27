import { ledgerFor } from "@/server/client"
import { getLocalParties, invalidateLocalScan, isStale, startLocalScan } from "@/server/local-parties"
import { handler } from "@/server/route-helpers"

type Ctx = RouteContext<"/api/nodes/[id]/parties/local">

/**
 * Returns whatever the cache holds and kicks off a scan when it is cold or stale.
 * The client polls this while `status` is "scanning" — no job queue needed.
 */
export const GET = handler(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params
  const state = getLocalParties(id)

  if (state.status === "idle" || isStale(state)) {
    startLocalScan(id, await ledgerFor(id))
  }
  return getLocalParties(id)
})

/** Force a rescan, discarding a fresh cache. */
export const POST = handler(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params
  invalidateLocalScan(id)
  startLocalScan(id, await ledgerFor(id))
  return getLocalParties(id)
})
