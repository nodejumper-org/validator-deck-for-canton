import type { Network } from "./types"

/**
 * Networks in escalating order of consequence, matching the colour escalation in
 * `NetworkBadge`. Every list of networks in the UI uses this order, and the
 * dashboard defaults to the first one that actually has a node — so registering a
 * mainnet node later moves the default to mainnet on its own.
 */
export const NETWORK_ORDER: readonly Network[] = ["mainnet", "testnet", "devnet", "local"]

export function orderNetworks(networks: Iterable<Network>): Network[] {
  const present = new Set(networks)
  return NETWORK_ORDER.filter((n) => present.has(n))
}

/**
 * The selected network, given whatever the URL said. An unknown value — or one
 * naming a network the operator has no node on — falls back rather than rendering
 * an empty dashboard that looks broken.
 */
export function pickNetwork(
  param: string | null | undefined,
  available: Network[],
): Network | null {
  const ordered = orderNetworks(available)
  if (param && ordered.includes(param as Network)) return param as Network
  return ordered[0] ?? null
}
