import { expect, test } from "vitest"
import { attentionItems, STALE_ACTIVITY_MS } from "./attention"
import type { NodeHealth, NodeStats } from "./types"

const NOW = Date.parse("2026-08-10T12:00:00Z")
const DAY = 24 * 60 * 60 * 1000

const health = (over: Partial<NodeHealth> = {}): NodeHealth => ({
  id: "n1",
  name: "mainnet-1",
  network: "mainnet",
  ledgerOk: true,
  validatorOk: true,
  synchronizerConnected: true,
  ledgerEnd: 12,
  ledgerVersion: "3.4.0",
  validatorVersion: "0.4.2",
  latencyMs: 40,
  error: null,
  ...over,
})

const stats = (over: Partial<NodeStats> = {}): NodeStats => ({
  id: "n1",
  name: "mainnet-1",
  hasValidator: true,
  ok: true,
  walletOk: true,
  users: 4,
  deactivatedUsers: 0,
  packages: 42,
  unlockedCC: "100",
  lockedCC: "0",
  holdingFees: "1",
  lastActivityAt: "2026-08-10T11:00:00Z",
  ...over,
})

const titles = (items: { title: string }[]) => items.map((i) => i.title)

test("a healthy node needs no attention", () => {
  expect(attentionItems({ health: [health()], stats: [stats()], now: NOW })).toEqual([])
})

test("an unreachable node reports once and suppresses every other rule", () => {
  const items = attentionItems({
    health: [health({ ledgerOk: false, synchronizerConnected: false, error: "connect ECONNREFUSED" })],
    stats: [stats({ ok: false, packages: 0, users: 0 })],
    now: NOW,
  })
  expect(titles(items)).toEqual(["Node unreachable"])
  expect(items[0]!.detail).toBe("connect ECONNREFUSED")
})

test("a reachable node with no synchronizer is a bad finding", () => {
  const items = attentionItems({
    health: [health({ synchronizerConnected: false })],
    stats: [stats()],
    now: NOW,
  })
  expect(titles(items)).toEqual(["Synchronizer disconnected"])
  expect(items[0]!.severity).toBe("bad")
})

test("an unreachable validator suppresses the wallet activity rule", () => {
  const items = attentionItems({
    health: [health({ validatorOk: false })],
    stats: [stats({ lastActivityAt: null })],
    now: NOW,
  })
  expect(titles(items)).toEqual(["Validator unreachable"])
})

test("an unreachable validator suppresses only the wallet rules, not the ledger ones", () => {
  const items = attentionItems({
    health: [health({ validatorOk: false })],
    stats: [stats({ lastActivityAt: null, deactivatedUsers: 2, packages: 0 })],
    now: NOW,
  })
  expect(titles(items)).toEqual([
    "Validator unreachable",
    "2 deactivated ledger users",
    "No packages vetted",
  ])
})

// A credential carrying ParticipantAdmin without an onboarded wallet answers
// `getVersion` — so health says the validator is up — and fails every wallet read
// with "No wallet found". The silence is a failed read, not an idle wallet.
test("a failed wallet read is not reported as an absent wallet history", () => {
  const items = attentionItems({
    health: [health()],
    stats: [stats({ walletOk: false, lastActivityAt: null })],
    now: NOW,
  })
  expect(items).toEqual([])
})

test("a failed wallet read is not reported as a stale wallet either", () => {
  const items = attentionItems({
    health: [health()],
    stats: [
      stats({ walletOk: false, lastActivityAt: new Date(NOW - 5 * DAY).toISOString() }),
    ],
    now: NOW,
  })
  expect(items).toEqual([])
})

test("a failed wallet read leaves the ledger rules alone", () => {
  const items = attentionItems({
    health: [health()],
    stats: [stats({ walletOk: false, lastActivityAt: null, packages: 0 })],
    now: NOW,
  })
  expect(titles(items)).toEqual(["No packages vetted"])
})

test("a silent wallet is flagged once it passes the stale threshold", () => {
  const items = attentionItems({
    health: [health()],
    stats: [stats({ lastActivityAt: new Date(NOW - STALE_ACTIVITY_MS).toISOString() })],
    now: NOW,
  })
  expect(titles(items)).toEqual(["No wallet activity for 2 days"])
})

test("a wallet just inside the threshold is not flagged", () => {
  const items = attentionItems({
    health: [health()],
    stats: [stats({ lastActivityAt: new Date(NOW - STALE_ACTIVITY_MS + 1000).toISOString() })],
    now: NOW,
  })
  expect(items).toEqual([])
})

test("a validator that never earned anything is flagged", () => {
  const items = attentionItems({
    health: [health()],
    stats: [stats({ lastActivityAt: null })],
    now: NOW,
  })
  expect(titles(items)).toEqual(["No wallet activity yet"])
})

test("deactivated ledger users are counted, and the noun agrees", () => {
  const one = attentionItems({ health: [health()], stats: [stats({ deactivatedUsers: 1 })], now: NOW })
  const many = attentionItems({ health: [health()], stats: [stats({ deactivatedUsers: 3 })], now: NOW })
  expect(titles(one)).toEqual(["1 deactivated ledger user"])
  expect(titles(many)).toEqual(["3 deactivated ledger users"])
})

test("a participant with nothing vetted is flagged", () => {
  const items = attentionItems({ health: [health()], stats: [stats({ packages: 0 })], now: NOW })
  expect(titles(items)).toEqual(["No packages vetted"])
})

test("a node with no validator configured is informational, not a problem", () => {
  const items = attentionItems({
    health: [health({ validatorOk: null })],
    stats: [stats({ hasValidator: false })],
    now: NOW,
  })
  expect(titles(items)).toEqual(["Participant only"])
  expect(items[0]!.severity).toBe("info")
})

test("statistics rules are skipped when the statistics query failed", () => {
  const items = attentionItems({
    health: [health()],
    stats: [stats({ ok: false, packages: 0, deactivatedUsers: 5, lastActivityAt: null })],
    now: NOW,
  })
  expect(items).toEqual([])
})

test("statistics rules are skipped while the statistics query is still in flight", () => {
  expect(attentionItems({ health: [health()], stats: [], now: NOW })).toEqual([])
})

test("sorts by severity, then node name", () => {
  const items = attentionItems({
    health: [
      health({ id: "b", name: "beta", validatorOk: null }),
      health({ id: "a", name: "alpha", synchronizerConnected: false }),
      health({ id: "c", name: "gamma" }),
    ],
    stats: [
      stats({ id: "b", name: "beta", hasValidator: false }),
      stats({ id: "a", name: "alpha" }),
      stats({ id: "c", name: "gamma", packages: 0 }),
    ],
    now: NOW,
  })
  expect(items.map((i) => i.severity)).toEqual(["bad", "warn", "info"])
  expect(items.map((i) => i.nodeName)).toEqual(["alpha", "gamma", "beta"])
})

test("two findings of the same severity are ordered by node name", () => {
  const items = attentionItems({
    health: [health({ id: "z", name: "zeta" }), health({ id: "a", name: "alpha" })],
    stats: [
      stats({ id: "z", name: "zeta", packages: 0 }),
      stats({ id: "a", name: "alpha", packages: 0 }),
    ],
    now: NOW,
  })
  expect(items.map((i) => i.severity)).toEqual(["warn", "warn"])
  expect(items.map((i) => i.nodeName)).toEqual(["alpha", "zeta"])
})

test("keys are stable and unique per node and rule", () => {
  const items = attentionItems({
    health: [health()],
    stats: [stats({ packages: 0, deactivatedUsers: 2 })],
    now: NOW,
  })
  expect(items.map((i) => i.key)).toEqual(["n1:deactivated", "n1:packages"])
})

test("a day counter rounds down", () => {
  const items = attentionItems({
    health: [health()],
    stats: [stats({ lastActivityAt: new Date(NOW - 3.9 * DAY).toISOString() })],
    now: NOW,
  })
  expect(titles(items)).toEqual(["No wallet activity for 3 days"])
})
