import {
  getLocalParties,
  invalidateLocalScan,
  isStale,
  startLocalScanFor,
} from "@/server/local-parties"
import { authed } from "@/server/route-helpers"

type Ctx = RouteContext<"/api/nodes/[id]/parties/local">

/**
 * Reads the stored result and kicks off a scan when it is cold or stale. The
 * client polls this while `status` is "scanning".
 */
export const GET = authed(async (_req, ctx: Ctx, ownerId) => {
  const { id } = await ctx.params
  const state = await getLocalParties(id, ownerId)

  if (state.status === "idle" || isStale(state)) {
    await startLocalScanFor(id, ownerId)
    return getLocalParties(id, ownerId)
  }
  return state
})

/** Force a rescan, discarding a fresh result. This is the button in the UI. */
export const POST = authed(async (_req, ctx: Ctx, ownerId) => {
  const { id } = await ctx.params
  await invalidateLocalScan(id)
  await startLocalScanFor(id, ownerId)
  return getLocalParties(id, ownerId)
})
