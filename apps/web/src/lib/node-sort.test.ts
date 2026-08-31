import { expect, test } from "vitest"
import { DEFAULT_NODE_SORT, nextSort, type NodeSort, sortNodes } from "./node-sort"
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

const names = (sort: NodeSort) => sortNodes(rows, sort).map((n) => n.name)

test("defaults to network order, then name", () => {
  expect(names({ key: "network", direction: "asc" })).toEqual(["alpha", "bravo", "mike", "zulu"])
})

// devnet/mainnet/testnet alphabetically would put devnet first, which says
// nothing about consequence. NETWORK_ORDER is the order the whole UI uses.
test("sorts networks by consequence, not alphabetically", () => {
  const networks = sortNodes(rows, { key: "network", direction: "asc" }).map((n) => n.network)
  expect(networks).toEqual(["mainnet", "testnet", "devnet", "devnet"])
})

test("reverses the network order when descending", () => {
  const networks = sortNodes(rows, { key: "network", direction: "desc" }).map((n) => n.network)
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
  expect(sortNodes(mixed, { key: "name", direction: "asc" }).map((n) => n.name)).toEqual([
    "alpha",
    "Beta",
    "Gamma",
  ])
})

test("does not mutate the input", () => {
  const input = [...rows]
  sortNodes(input, { key: "name", direction: "desc" })
  expect(input.map((n) => n.name)).toEqual(["zulu", "alpha", "mike", "bravo"])
})

// Both node tables share the comparator, so it must not require the health
// fields — the Nodes page rows carry URLs and credentials instead.
test("sorts any row that has a name and a network", () => {
  const summaries = [
    { id: "1", name: "zulu", network: "devnet" as const, ledgerApiUrl: "https://z" },
    { id: "2", name: "alpha", network: "mainnet" as const, ledgerApiUrl: "https://a" },
  ]
  const sorted = sortNodes(summaries, { key: "network", direction: "asc" })
  expect(sorted.map((n) => n.name)).toEqual(["alpha", "zulu"])
  // The element type survives: callers still see their own fields.
  expect(sorted[0]!.ledgerApiUrl).toBe("https://a")
})

test("the default sort is network, ascending", () => {
  expect(DEFAULT_NODE_SORT).toEqual({ key: "network", direction: "asc" })
})

test("clicking the active column flips its direction", () => {
  expect(nextSort({ key: "name", direction: "asc" }, "name")).toEqual({
    key: "name",
    direction: "desc",
  })
})

test("clicking a different column starts it ascending", () => {
  expect(nextSort({ key: "name", direction: "desc" }, "network")).toEqual({
    key: "network",
    direction: "asc",
  })
})
