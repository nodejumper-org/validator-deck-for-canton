import { NETWORK_ORDER } from "./networks"
import type { NodeHealth } from "./types"

export type HealthSortKey = "name" | "network"
export type HealthSort = { key: HealthSortKey; direction: "asc" | "desc" }

export const DEFAULT_HEALTH_SORT: HealthSort = { key: "network", direction: "asc" }

/**
 * Row order for the fleet health table.
 *
 * Networks sort by `NETWORK_ORDER`, never alphabetically: devnet before
 * mainnet says nothing an operator cares about, while escalating consequence
 * is the order the rest of the UI already speaks in.
 *
 * The name tiebreaker inside a network stays ascending even when the network
 * order is reversed — flipping it too would reshuffle rows the operator never
 * asked to reorder.
 *
 * Pure and client-free on purpose: the ordering is worth testing, and `.tsx`
 * files sit outside vitest's collection.
 */
export function sortHealth(nodes: NodeHealth[], sort: HealthSort): NodeHealth[] {
  const byName = (a: NodeHealth, b: NodeHealth) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })

  const flip = sort.direction === "desc" ? -1 : 1

  return [...nodes].sort((a, b) => {
    if (sort.key === "name") return flip * byName(a, b)
    const byNetwork = NETWORK_ORDER.indexOf(a.network) - NETWORK_ORDER.indexOf(b.network)
    return flip * byNetwork || byName(a, b)
  })
}
