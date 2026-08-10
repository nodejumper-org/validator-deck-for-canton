import { isCantonApiError } from "@canton/client"
import type {
  NetworkDashboard,
  NodeStats,
  SurfaceError,
  VettedPackage,
  WalletTransaction,
} from "@/lib/types"
import { ccFlowByDay, rewardMix, type CcFlowSource } from "@/server/aggregate"
import { ledgerFor, validatorFor } from "@/server/client"
import { listNodes } from "@/server/nodes"
import { authed } from "@/server/route-helpers"
import { networkParamSchema } from "@/server/validation"

const message = (e: unknown) => (isCantonApiError(e) ? e.message : String(e))

const settled = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
  r.status === "fulfilled" ? r.value : fallback

/** Amounts stay strings on the wire; this is the one place they are added up. */
const sum = (values: string[]): string =>
  values.reduce((total, v) => total + (Number(v) || 0), 0).toFixed(4)

const newest = (txs: WalletTransaction[]): string | null =>
  txs.reduce<string | null>((max, tx) => (max === null || tx.date > max ? tx.date : max), null)

type Snapshot = { stats: NodeStats; flow: CcFlowSource; errors: SurfaceError[] }

/**
 * Statistics for one network. Health lives at `/api/dashboard/health` and covers
 * every network, because the node table is the fleet view.
 *
 * There is deliberately no per-user rights fan-out here. The chart that needed it
 * was a bar chart over three categories, and it cost up to 200 requests per node.
 */
export const GET = authed(async (req, _ctx, ownerId) => {
  const network = networkParamSchema.parse(new URL(req.url).searchParams.get("network"))
  const nodes = (await listNodes(ownerId)).filter((n) => n.network === network)

  const snapshots = await Promise.all(
    nodes.map(async (node): Promise<Snapshot> => {
      const base: NodeStats = {
        id: node.id,
        name: node.name,
        hasValidator: Boolean(node.validatorApiUrl),
        ok: false,
        users: 0,
        deactivatedUsers: 0,
        packages: 0,
        unlockedCC: "0",
        lockedCC: "0",
        holdingFees: "0",
        lastActivityAt: null,
      }

      let ledger
      try {
        ledger = await ledgerFor(node.id, ownerId)
      } catch (e) {
        return {
          stats: base,
          flow: { party: null, transactions: [] },
          errors: [{ surface: node.name, message: message(e) }],
        }
      }

      const participantId = await ledger.getParticipantId().catch(() => null)

      const [users, packages, validator] = await Promise.allSettled([
        ledger.listUsers({ pageSize: 1000 }),
        participantId
          ? ledger.listVettedPackages(participantId)
          : Promise.resolve([] as VettedPackage[]),
        node.validatorApiUrl
          ? validatorFor(node.id, ownerId).then(async (v) => ({
              party: await v
                .getValidatorUser()
                .then((u) => u.party_id)
                .catch(() => null),
              balance: await v.getWalletBalance().catch(() => null),
              transactions: await v.listWalletTransactions({ pageSize: 800 }).catch(() => []),
            }))
          : Promise.resolve(null),
      ])

      const userList = settled(users, { users: [], nextPageToken: "" }).users
      const pkgs = settled(packages, [] as VettedPackage[])
      const val = settled(validator, null)

      return {
        stats: {
          ...base,
          // Zeros from a failed read must not read as real counts downstream.
          ok:
            users.status === "fulfilled" &&
            packages.status === "fulfilled" &&
            participantId !== null,
          users: userList.length,
          deactivatedUsers: userList.filter((u) => u.isDeactivated).length,
          packages: pkgs.length,
          unlockedCC: val?.balance?.effective_unlocked_qty ?? "0",
          lockedCC: val?.balance?.effective_locked_qty ?? "0",
          holdingFees: val?.balance?.total_holding_fees ?? "0",
          lastActivityAt: newest(val?.transactions ?? []),
        },
        flow: { party: val?.party ?? null, transactions: val?.transactions ?? [] },
        errors: [users, packages, validator]
          .filter((r) => r.status === "rejected")
          .map((r) => ({ surface: node.name, message: message(r.reason) })),
      }
    }),
  )

  const result: NetworkDashboard = {
    network,
    nodes: snapshots.map((s) => s.stats),
    totals: {
      users: snapshots.reduce((t, s) => t + s.stats.users, 0),
      packages: snapshots.reduce((t, s) => t + s.stats.packages, 0),
      unlockedCC: sum(snapshots.map((s) => s.stats.unlockedCC)),
      lockedCC: sum(snapshots.map((s) => s.stats.lockedCC)),
      holdingFees: sum(snapshots.map((s) => s.stats.holdingFees)),
    },
    charts: {
      ccFlow: ccFlowByDay(snapshots.map((s) => s.flow)),
      rewardMix: rewardMix(snapshots.flatMap((s) => s.flow.transactions)),
    },
    errors: snapshots.flatMap((s) => s.errors),
  }
  return result
})
