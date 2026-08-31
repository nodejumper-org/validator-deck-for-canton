import { NETWORK_ORDER } from "./networks"
import type { Network } from "./types"

export type NodeSortKey = "name" | "network"
export type NodeSort = { key: NodeSortKey; direction: "asc" | "desc" }

export const DEFAULT_NODE_SORT: NodeSort = { key: "network", direction: "asc" }

/** Every node-shaped row sorts the same way, whatever else it carries. */
type Sortable = { name: string; network: Network }

/**
 * Row order for the tables that list nodes — the dashboard's health matrix and
 * the Nodes page. One comparator for both, so the two never drift into
 * disagreeing about what "sorted by network" means.
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
export function sortNodes<T extends Sortable>(rows: T[], sort: NodeSort): T[] {
  const byName = (a: Sortable, b: Sortable) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })

  const flip = sort.direction === "desc" ? -1 : 1

  return [...rows].sort((a, b) => {
    if (sort.key === "name") return flip * byName(a, b)
    const byNetwork = NETWORK_ORDER.indexOf(a.network) - NETWORK_ORDER.indexOf(b.network)
    return flip * byNetwork || byName(a, b)
  })
}

/** Clicking the active column flips it; clicking another starts it ascending. */
export function nextSort(current: NodeSort, key: NodeSortKey): NodeSort {
  return current.key === key
    ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
    : { key, direction: "asc" }
}
