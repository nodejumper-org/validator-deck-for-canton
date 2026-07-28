import { isCantonApiError } from "@canton/client"
import { hasValidator, ledgerFor, validatorFor } from "@/server/client"
import { authed } from "@/server/route-helpers"
import type { Probe } from "@/lib/types"

/**
 * Probes each surface independently and reports both outcomes rather than
 * failing on the first: knowing the ledger answered but the validator did not is
 * exactly what an operator needs to fix a misconfigured node.
 */
async function probe(run: () => Promise<string>): Promise<Probe> {
  const started = performance.now()
  try {
    return { ok: true, detail: await run(), latencyMs: Math.round(performance.now() - started) }
  } catch (e) {
    return {
      ok: false,
      detail: isCantonApiError(e) ? e.message : String(e),
      latencyMs: Math.round(performance.now() - started),
    }
  }
}

export const POST = authed(async (_req, ctx: RouteContext<"/api/nodes/[id]/test">, ownerId) => {
  const { id } = await ctx.params

  const ledger = await probe(async () => {
    const client = await ledgerFor(id, ownerId)
    return `Ledger API ${(await client.getVersion()).version}`
  })

  const validator = (await hasValidator(id, ownerId))
    ? await probe(async () => {
        const client = await validatorFor(id, ownerId)
        return `Splice ${(await client.getVersion()).version}`
      })
    : null

  return { ledger, validator }
})
