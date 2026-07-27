import { z } from "zod"
import { ledgerFor } from "@/server/client"
import { invalidateLocalScan } from "@/server/local-parties"
import { handler } from "@/server/route-helpers"

const allocateSchema = z.object({
  partyIdHint: z
    .string()
    .min(1, "Party hint is required")
    .max(255, "Party hints are limited to 255 characters")
    // Canton's PartyIdString: letters, digits, space, colon, minus, underscore.
    .regex(/^[A-Za-z0-9 :\-_]+$/, "Use only letters, digits, space, colon, minus, and underscore"),
})

export const GET = handler(async (req, ctx: RouteContext<"/api/nodes/[id]/parties">) => {
  const { id } = await ctx.params
  const url = new URL(req.url)
  const ledger = await ledgerFor(id)

  return ledger.listParties({
    pageSize: Number(url.searchParams.get("pageSize") ?? 100),
    pageToken: url.searchParams.get("pageToken") ?? "",
    filterParty: url.searchParams.get("filter") ?? "",
  })
})

export const POST = handler(async (req, ctx: RouteContext<"/api/nodes/[id]/parties">) => {
  const { id } = await ctx.params
  const { partyIdHint } = allocateSchema.parse(await req.json())
  const ledger = await ledgerFor(id)
  const party = await ledger.allocateParty({ partyIdHint })

  // The cached local set no longer reflects the node.
  invalidateLocalScan(id)
  return { party }
})
