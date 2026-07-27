import { isCantonApiError, type LedgerClient } from "@canton/client"
import type { NodeHealth, UserRight, VettedPackage, WalletTransaction } from "@/lib/types"
import { netAmountByDay, rewardMix, rightsDistribution, versionSprawl } from "@/server/aggregate"
import { ledgerFor, validatorFor } from "@/server/client"
import { listNodes } from "@/server/nodes"
import { handler } from "@/server/route-helpers"

const message = (e: unknown) => (isCantonApiError(e) ? e.message : String(e))

/** Rights are fetched per user; cap the fan-out so one busy node cannot stall the page. */
const MAX_USERS_FOR_RIGHTS = 200

const settled = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
  r.status === "fulfilled" ? r.value : fallback

type NodeSnapshot = {
  health: NodeHealth
  userIds: string[]
  ledger: LedgerClient | null
  packages: VettedPackage[]
  transactions: WalletTransaction[]
  balanceCC: number
  synchronizers: number
}

export const GET = handler(async () => {
  const nodes = await listNodes()

  // Nothing here blocks on the local-party scan: the dashboard only calls the
  // endpoints that answer in well under a second.
  const snapshots = await Promise.all(
    nodes.map(async (node): Promise<NodeSnapshot> => {
      const started = performance.now()

      const base: NodeHealth = {
        id: node.id,
        name: node.name,
        network: node.network,
        ledgerOk: false,
        validatorOk: node.validatorApiUrl ? false : null,
        synchronizerConnected: false,
        ledgerEnd: null,
        ledgerVersion: null,
        validatorVersion: null,
        latencyMs: 0,
        error: null,
      }

      let ledger: LedgerClient | null = null
      try {
        ledger = await ledgerFor(node.id)
      } catch (e) {
        return {
          health: { ...base, error: message(e), latencyMs: Math.round(performance.now() - started) },
          userIds: [],
          ledger: null,
          packages: [],
          transactions: [],
          balanceCC: 0,
          synchronizers: 0,
        }
      }

      const participantId = await ledger.getParticipantId().catch(() => null)

      const [version, end, syncs, users, packages, validator] = await Promise.allSettled([
        ledger.getVersion(),
        ledger.getLedgerEnd(),
        ledger.getConnectedSynchronizers(),
        ledger.listUsers({ pageSize: 1000 }),
        participantId ? ledger.listVettedPackages(participantId) : Promise.resolve([]),
        node.validatorApiUrl
          ? validatorFor(node.id).then(async (v) => ({
              version: (await v.getVersion()).version,
              balance: await v.getWalletBalance().catch(() => null),
              transactions: await v.listWalletTransactions({ pageSize: 800 }).catch(() => []),
            }))
          : Promise.resolve(null),
      ])

      const synchronizers = settled(syncs, []).length
      const validatorData = settled(validator, null)
      const firstFailure = [version, end, syncs, users].find((r) => r.status === "rejected")

      return {
        health: {
          ...base,
          ledgerOk: version.status === "fulfilled",
          validatorOk: node.validatorApiUrl ? validatorData !== null : null,
          synchronizerConnected: synchronizers > 0,
          ledgerEnd: settled(end, null),
          ledgerVersion: settled(version, null)?.version ?? null,
          validatorVersion: validatorData?.version ?? null,
          latencyMs: Math.round(performance.now() - started),
          error: firstFailure ? message(firstFailure.reason) : null,
        },
        userIds: settled(users, { users: [], nextPageToken: "" }).users.map((u) => u.id),
        ledger,
        packages: settled(packages, []),
        transactions: validatorData?.transactions ?? [],
        balanceCC: Number(validatorData?.balance?.effective_unlocked_qty ?? "0"),
        synchronizers,
      }
    }),
  )

  // Rights need one request per user, so they are gathered after the per-node
  // fan-out rather than inside it.
  const rightsPerUser: UserRight[][] = (
    await Promise.all(
      snapshots.flatMap((s) =>
        s.ledger
          ? s.userIds
              .slice(0, MAX_USERS_FOR_RIGHTS)
              .map((userId) => s.ledger!.listUserRights(userId).catch((): UserRight[] => []))
          : [],
      ),
    )
  ).filter((rights) => rights.length > 0)

  const allTransactions = snapshots.flatMap((s) => s.transactions)
  const allPackages = snapshots.flatMap((s) => s.packages)
  const totalBalance = snapshots.reduce((sum, s) => sum + s.balanceCC, 0)

  return {
    nodes: snapshots.map((s) => s.health),
    totals: {
      nodes: nodes.length,
      healthy: snapshots.filter((s) => s.health.ledgerOk).length,
      users: snapshots.reduce((sum, s) => sum + s.userIds.length, 0),
      packages: allPackages.length,
      balanceCC: totalBalance.toFixed(4),
      synchronizers: snapshots.reduce((sum, s) => sum + s.synchronizers, 0),
    },
    charts: {
      walletActivity: netAmountByDay(allTransactions),
      rightsDistribution: rightsDistribution(rightsPerUser),
      versionSprawl: versionSprawl(allPackages),
      rewardMix: rewardMix(allTransactions),
    },
  }
})
