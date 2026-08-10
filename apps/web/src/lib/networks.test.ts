import { expect, test } from "vitest"
import { NETWORK_ORDER, orderNetworks, pickNetwork } from "./networks"

test("orders networks by consequence, most serious first", () => {
  expect(NETWORK_ORDER).toEqual(["mainnet", "testnet", "devnet", "local"])
})

test("sorts an arbitrary set into canonical order and drops duplicates", () => {
  expect(orderNetworks(["devnet", "mainnet", "devnet"])).toEqual(["mainnet", "devnet"])
})

test("omits networks that are not present", () => {
  expect(orderNetworks(["testnet"])).toEqual(["testnet"])
})

test("honours a valid parameter", () => {
  expect(pickNetwork("devnet", ["mainnet", "devnet"])).toBe("devnet")
})

test("falls back to the first available when the parameter is unknown", () => {
  expect(pickNetwork("wat", ["devnet", "mainnet"])).toBe("mainnet")
})

test("falls back when the parameter names a network with no nodes", () => {
  expect(pickNetwork("mainnet", ["devnet"])).toBe("devnet")
})

test("falls back when there is no parameter at all", () => {
  expect(pickNetwork(null, ["testnet", "devnet"])).toBe("testnet")
})

test("returns null when no network has a node", () => {
  expect(pickNetwork("mainnet", [])).toBeNull()
})
