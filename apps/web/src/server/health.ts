import { isCantonApiError } from "@canton/client"
import type { NodeHealth } from "@/lib/types"
import { ledgerFor, validatorFor } from "./client"
import { listNodes, type PublicNode } from "./nodes"

const message = (e: unknown) => (isCantonApiError(e) ? e.message : String(e))

const settled = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
  r.status === "fulfilled" ? r.value : fallback

/**
 * Reachability only — four calls per node.
 *
 * Everything expensive (users, packages, wallet history) belongs to the
 * network-scoped statistics route. Keeping them apart is what lets the fleet
 * table paint while the statistics are still in flight, and stops a devnet
 * dashboard from waiting on the mainnet participant, which answers far slower.
 */
export async function probeNode(node: PublicNode, ownerId: string): Promise<NodeHealth> {
  const started = performance.now()
  const elapsed = () => Math.round(performance.now() - started)

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

  let ledger
  try {
    ledger = await ledgerFor(node.id, ownerId)
  } catch (e) {
    return { ...base, error: message(e), latencyMs: elapsed() }
  }

  const [version, end, syncs, validator] = await Promise.allSettled([
    ledger.getVersion(),
    ledger.getLedgerEnd(),
    ledger.getConnectedSynchronizers(),
    node.validatorApiUrl
      ? validatorFor(node.id, ownerId).then((v) => v.getVersion())
      : Promise.resolve(null),
  ])

  const firstFailure = [version, end, syncs].find((r) => r.status === "rejected")

  return {
    ...base,
    ledgerOk: version.status === "fulfilled",
    validatorOk: node.validatorApiUrl ? validator.status === "fulfilled" : null,
    synchronizerConnected: settled(syncs, []).length > 0,
    ledgerEnd: settled(end, null),
    ledgerVersion: settled(version, null)?.version ?? null,
    validatorVersion: settled(validator, null)?.version ?? null,
    latencyMs: elapsed(),
    error: firstFailure ? message(firstFailure.reason) : null,
  }
}

export async function probeAll(ownerId: string): Promise<NodeHealth[]> {
  const nodes = await listNodes(ownerId)
  return Promise.all(nodes.map((node) => probeNode(node, ownerId)))
}
