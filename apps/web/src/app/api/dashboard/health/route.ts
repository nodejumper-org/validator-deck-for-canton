import { probeAll } from "@/server/health"
import { authed } from "@/server/route-helpers"

/**
 * Deliberately unfiltered. The dashboard scopes its statistics to one network,
 * but its node table is the fleet view and shows every network at once — an
 * outage on testnet has to be visible while you are looking at mainnet.
 */
export const GET = authed(async (_req, _ctx, ownerId) => ({ nodes: await probeAll(ownerId) }))
