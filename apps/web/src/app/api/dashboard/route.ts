import { isCantonApiError } from "@canton/client"
import type { NetworkDashboard, NodeStats, SurfaceError, VettedPackage } from "@/lib/types"
import { ccFlowByDay, newest, rewardMix, sum, type CcFlowSource } from "@/server/aggregate"
import { ledgerFor, validatorFor } from "@/server/client"
import { listNodes } from "@/server/nodes"
import { authed } from "@/server/route-helpers"
import { networkParamSchema } from "@/server/validation"

const message = (e: unknown) => (isCantonApiError(e) ? e.message : String(e))

const settled = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
  r.status === "fulfilled" ? r.value : fallback

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
        walletOk: false,
        users: 0,
        deactivatedUsers: 0,
        packages: 0,
        unlockedCC: "0",
        lockedCC: "0",
        holdingFees: "0",
        lastActivityAt: null,
      }

      // Distinct reasons only, and each one names the node *and* the surface it
      // came from: with a single node in the network, "something failed" is not a
      // report. Deduplicated because a node with no onboarded wallet fails all
      // three wallet reads with the same "No wallet found", and three identical
      // lines read as a rendering bug rather than as one fact.
      const errors: SurfaceError[] = []
      const fail = (surface: string, reason: string) => {
        const entry = { surface: `${node.name} — ${surface}`, message: reason }
        if (!errors.some((e) => e.surface === entry.surface && e.message === entry.message)) {
          errors.push(entry)
        }
      }

      let ledger
      try {
        ledger = await ledgerFor(node.id, ownerId)
      } catch (e) {
        fail("ledger client", message(e))
        return { stats: base, flow: { party: null, transactions: [] }, errors }
      }

      // A failed participant id is not an absent one. Without it the packages read
      // cannot be issued at all, and its empty fallback would otherwise enter
      // `totals.packages` as if this participant had vetted nothing — a wrong total
      // with no explanation is worse than a visible failure.
      const participant = await ledger
        .getParticipantId()
        .then((id) => ({ id, error: null as string | null }))
        .catch((e) => ({ id: null, error: message(e) }))
      if (participant.error) fail("participant", participant.error)

      const [users, packages, validator] = await Promise.allSettled([
        ledger.listUsers({ pageSize: 1000 }),
        participant.id
          ? ledger.listVettedPackages(participant.id)
          : Promise.resolve([] as VettedPackage[]),
        node.validatorApiUrl
          ? validatorFor(node.id, ownerId).then(async (v) => {
              // Each read still catches, so one broken wallet endpoint cannot take
              // down the other two — but the reason is kept rather than discarded.
              // A `sub` carrying ParticipantAdmin without an onboarded wallet fails
              // all three with "No wallet found", and swallowing that made the node
              // read as perfectly healthy while holding zero CC.
              const failures: string[] = []
              const keep = <T, F>(read: Promise<T>, fallback: F): Promise<T | F> =>
                read.catch((e) => {
                  failures.push(message(e))
                  return fallback
                })

              // Issued together: three sequential round trips per node was the
              // slowest thing on the page, and each read keeps its own catch, so
              // the failure isolation is unchanged.
              const [party, balance, transactions] = await Promise.all([
                keep(
                  v.getValidatorUser().then((u) => u.party_id),
                  null,
                ),
                keep(v.getWalletBalance(), null),
                keep(v.listWalletTransactions({ pageSize: 800 }), []),
              ])
              return { party, balance, transactions, failures }
            })
          : Promise.resolve(null),
      ])

      const userList = settled(users, { users: [], nextPageToken: "" }).users
      const pkgs = settled(packages, [] as VettedPackage[])
      const val = settled(validator, null)

      if (users.status === "rejected") fail("users", message(users.reason))
      if (packages.status === "rejected") fail("packages", message(packages.reason))
      if (validator.status === "rejected") fail("validator", message(validator.reason))
      for (const f of val?.failures ?? []) fail("wallet", f)

      return {
        stats: {
          ...base,
          // Zeros from a failed read must not read as real counts downstream.
          ok:
            users.status === "fulfilled" &&
            packages.status === "fulfilled" &&
            participant.id !== null,
          // Same rule for the wallet, which fails on its own: without this a
          // "No wallet found" node reports `lastActivityAt: null` and the
          // attention rules call it "no wallet activity yet", which is a claim the
          // route knows to be false.
          walletOk: validator.status === "fulfilled" && (val?.failures.length ?? 0) === 0,
          users: userList.length,
          deactivatedUsers: userList.filter((u) => u.isDeactivated).length,
          packages: pkgs.length,
          unlockedCC: val?.balance?.effective_unlocked_qty ?? "0",
          lockedCC: val?.balance?.effective_locked_qty ?? "0",
          holdingFees: val?.balance?.total_holding_fees ?? "0",
          lastActivityAt: newest(val?.transactions ?? []),
        },
        flow: { party: val?.party ?? null, transactions: val?.transactions ?? [] },
        errors,
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
