import { expect, test } from "vitest"
import { type HealthSort, sortHealth } from "./health-sort"
import type { NodeHealth } from "./types"

const node = (name: string, network: NodeHealth["network"]): NodeHealth => ({
  id: name,
  name,
  network,
  ledgerOk: true,
  validatorOk: null,
  synchronizerConnected: null,
  ledgerEnd: null,
  ledgerVersion: null,
  validatorVersion: null,
  latencyMs: 0,
  error: null,
})

const rows = [
  node("zulu", "devnet"),
  node("alpha", "mainnet"),
  node("mike", "devnet"),
  node("bravo", "testnet"),
]

const names = (sort: HealthSort) => sortHealth(rows, sort).map((n) => n.name)

test("defaults to network order, then name", () => {
  expect(names({ key: "network", direction: "asc" })).toEqual(["alpha", "bravo", "mike", "zulu"])
})

// devnet/mainnet/testnet alphabetically would put devnet first, which says
// nothing about consequence. NETWORK_ORDER is the order the whole UI uses.
test("sorts networks by consequence, not alphabetically", () => {
  const networks = sortHealth(rows, { key: "network", direction: "asc" }).map((n) => n.network)
  expect(networks).toEqual(["mainnet", "testnet", "devnet", "devnet"])
})

test("reverses the network order when descending", () => {
  const networks = sortHealth(rows, { key: "network", direction: "desc" }).map((n) => n.network)
  expect(networks).toEqual(["devnet", "devnet", "testnet", "mainnet"])
})

// Within one network the secondary name sort stays ascending: flipping it too
// would shuffle rows the operator did not ask to reorder.
test("keeps names ascending inside a network when the network order flips", () => {
  expect(names({ key: "network", direction: "desc" })).toEqual(["mike", "zulu", "bravo", "alpha"])
})

test("sorts by name across every network", () => {
  expect(names({ key: "name", direction: "asc" })).toEqual(["alpha", "bravo", "mike", "zulu"])
})

test("reverses the name sort when descending", () => {
  expect(names({ key: "name", direction: "desc" })).toEqual(["zulu", "mike", "bravo", "alpha"])
})

test("compares names case-insensitively", () => {
  const mixed = [node("Beta", "devnet"), node("alpha", "devnet"), node("Gamma", "devnet")]
  expect(sortHealth(mixed, { key: "name", direction: "asc" }).map((n) => n.name)).toEqual([
    "alpha",
    "Beta",
    "Gamma",
  ])
})

test("does not mutate the input", () => {
  const input = [...rows]
  sortHealth(input, { key: "name", direction: "desc" })
  expect(input.map((n) => n.name)).toEqual(["zulu", "alpha", "mike", "bravo"])
})
