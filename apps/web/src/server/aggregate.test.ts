import { expect, test } from "vitest"
import type { UserRight, WalletTransaction } from "@/lib/types"
import { netAmountByDay, rewardMix, rightsDistribution, versionSprawl } from "./aggregate"

const SELF = "me::122"

const tx = (
  date: string,
  amount: string,
  rewards = { app: "0", validator: "0", sv: "0" },
): WalletTransaction => ({
  transaction_type: "transfer",
  event_id: `#${date}-${amount}`,
  date,
  sender: { party: SELF, amount },
  receivers: [],
  holding_fees: "0",
  app_rewards_used: rewards.app,
  validator_rewards_used: rewards.validator,
  sv_rewards_used: rewards.sv,
})

test("sums amounts per calendar day", () => {
  const rows = netAmountByDay([
    tx("2026-07-25T10:00:00Z", "10.5"),
    tx("2026-07-25T22:00:00Z", "4.5"),
    tx("2026-07-26T01:00:00Z", "2.0"),
  ])
  expect(rows).toEqual([
    { date: "2026-07-25", net: 15 },
    { date: "2026-07-26", net: 2 },
  ])
})

test("returns days in ascending order regardless of input order", () => {
  const rows = netAmountByDay([tx("2026-07-26T01:00:00Z", "1"), tx("2026-07-24T01:00:00Z", "1")])
  expect(rows.map((r) => r.date)).toEqual(["2026-07-24", "2026-07-26"])
})

test("treats an empty transaction list as an empty series", () => {
  expect(netAmountByDay([])).toEqual([])
})

test("ignores transactions with no sender", () => {
  const withoutSender: WalletTransaction = { ...tx("2026-07-25T10:00:00Z", "5"), sender: null }
  expect(netAmountByDay([withoutSender])).toEqual([])
})

test("counts users per right kind, not rights per kind", () => {
  const rows = rightsDistribution([
    [
      { kind: "ParticipantAdmin" },
      { kind: "CanActAs", party: "a::1" },
      { kind: "CanActAs", party: "b::1" },
    ],
    [{ kind: "CanActAs", party: "c::1" }],
  ] as UserRight[][])

  expect(rows).toContainEqual({ kind: "ParticipantAdmin", users: 1 })
  // Two CanActAs rights on one user still counts that user once.
  expect(rows).toContainEqual({ kind: "CanActAs", users: 2 })
})

test("omits right kinds nobody holds", () => {
  const rows = rightsDistribution([[{ kind: "ParticipantAdmin" }]])
  expect(rows.map((r) => r.kind)).toEqual(["ParticipantAdmin"])
})

test("ranks packages by distinct version count", () => {
  const pkg = (packageName: string, packageVersion: string) => ({
    packageId: `${packageName}-${packageVersion}`,
    packageName,
    packageVersion,
  })
  const rows = versionSprawl([
    pkg("splice-amulet", "0.1.1"),
    pkg("splice-amulet", "0.1.2"),
    pkg("splice-amulet", "0.1.2"),
    pkg("daml-stdlib", "3.5.2"),
  ])
  expect(rows[0]).toEqual({ name: "splice-amulet", versions: 2 })
  expect(rows[1]).toEqual({ name: "daml-stdlib", versions: 1 })
})

test("limits the sprawl ranking", () => {
  const rows = versionSprawl(
    ["a", "b", "c"].flatMap((n) => [
      { packageId: `${n}1`, packageName: n, packageVersion: "1" },
      { packageId: `${n}2`, packageName: n, packageVersion: "2" },
    ]),
    2,
  )
  expect(rows).toHaveLength(2)
})

test("splits reward usage by kind per day", () => {
  const rows = rewardMix([
    tx("2026-07-25T10:00:00Z", "1", { app: "5", validator: "2", sv: "0" }),
    tx("2026-07-25T11:00:00Z", "1", { app: "1", validator: "0", sv: "3" }),
  ])
  expect(rows).toEqual([{ date: "2026-07-25", app: 6, validator: 2, sv: 3 }])
})

test("drops days where no rewards were used", () => {
  expect(rewardMix([tx("2026-07-25T10:00:00Z", "1")])).toEqual([])
})
