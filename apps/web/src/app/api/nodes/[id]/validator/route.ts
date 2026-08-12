import { isCantonApiError } from "@validator-deck/canton-client"
import type { SurfaceError } from "@/lib/types"
import { validatorFor } from "@/server/client"
import { authed } from "@/server/route-helpers"

const message = (e: unknown) => (isCantonApiError(e) ? e.message : String(e))

export const GET = authed(async (_req, ctx: RouteContext<"/api/nodes/[id]/validator">, ownerId) => {
  const { id } = await ctx.params
  // Throws NO_VALIDATOR for a participant-only node, which the page renders as a
  // friendly explanation rather than a failure.
  const validator = await validatorFor(id, ownerId)

  const [version, ready, validatorUser, dsoPartyId, onboardedUsers, balance, transactions] =
    await Promise.allSettled([
      validator.getVersion(),
      validator.isReady(),
      validator.getValidatorUser(),
      validator.getDsoPartyId(),
      validator.listOnboardedUsers(),
      validator.getWalletBalance(),
      validator.listWalletTransactions({ pageSize: 50 }),
    ])

  const errors: SurfaceError[] = []
  function value<T>(surface: string, r: PromiseSettledResult<T>, fallback: T): T {
    if (r.status === "fulfilled") return r.value
    errors.push({ surface, message: message(r.reason) })
    return fallback
  }

  return {
    version: value("Version", version, null)?.version ?? null,
    ready: value("Readiness", ready, false),
    validatorUser: value("Validator user", validatorUser, null),
    dsoPartyId: value("DSO party", dsoPartyId, null),
    onboardedUsers: value("Onboarded users", onboardedUsers, []),
    balance: value("Wallet balance", balance, null),
    transactions: value("Wallet activity", transactions, []),
    errors,
  }
})
