import { expect, test } from "vitest"
import type { WalletTransaction } from "@/lib/types"
import { ccFlowByDay, rewardMix } from "./aggregate"

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

const flowTx = (over: Partial<WalletTransaction> & { date: string }): WalletTransaction => ({
  transaction_type: "transfer",
  event_id: `#${over.date}`,
  sender: null,
  receivers: [],
  holding_fees: "0",
  app_rewards_used: "0",
  validator_rewards_used: "0",
  sv_rewards_used: "0",
  ...over,
})

test("credits amounts received by our own party", () => {
  const rows = ccFlowByDay([
    {
      party: SELF,
      transactions: [
        flowTx({
          date: "2026-07-25T10:00:00Z",
          receivers: [
            { party: SELF, amount: "10" },
            { party: "other::1", amount: "99" },
          ],
        }),
      ],
    },
  ])
  expect(rows).toEqual([{ date: "2026-07-25", received: 10, sent: 0, fees: 0 }])
})

test("debits amounts our own party sent", () => {
  const rows = ccFlowByDay([
    {
      party: SELF,
      transactions: [
        flowTx({ date: "2026-07-25T10:00:00Z", sender: { party: SELF, amount: "4" } }),
        flowTx({ date: "2026-07-25T11:00:00Z", sender: { party: "other::1", amount: "7" } }),
      ],
    },
  ])
  expect(rows).toEqual([{ date: "2026-07-25", received: 0, sent: 4, fees: 0 }])
})

test("returns magnitudes, so a negative sender amount still reads as sent", () => {
  const rows = ccFlowByDay([
    {
      party: SELF,
      transactions: [flowTx({ date: "2026-07-25T10:00:00Z", sender: { party: SELF, amount: "-4" } })],
    },
  ])
  expect(rows).toEqual([{ date: "2026-07-25", received: 0, sent: 4, fees: 0 }])
})

test("counts holding fees even when the party could not be resolved", () => {
  const rows = ccFlowByDay([
    {
      party: null,
      transactions: [
        flowTx({
          date: "2026-07-25T10:00:00Z",
          holding_fees: "0.25",
          receivers: [{ party: SELF, amount: "10" }],
        }),
      ],
    },
  ])
  expect(rows).toEqual([{ date: "2026-07-25", received: 0, sent: 0, fees: 0.25 }])
})

test("merges several validators onto the same day", () => {
  const rows = ccFlowByDay([
    { party: "a::1", transactions: [flowTx({ date: "2026-07-25T10:00:00Z", receivers: [{ party: "a::1", amount: "3" }] })] },
    { party: "b::1", transactions: [flowTx({ date: "2026-07-25T11:00:00Z", receivers: [{ party: "b::1", amount: "4" }] })] },
  ])
  expect(rows).toEqual([{ date: "2026-07-25", received: 7, sent: 0, fees: 0 }])
})

test("drops days where nothing moved at all", () => {
  const rows = ccFlowByDay([
    { party: SELF, transactions: [flowTx({ date: "2026-07-25T10:00:00Z" })] },
  ])
  expect(rows).toEqual([])
})

test("returns days in ascending order regardless of input order", () => {
  const rows = ccFlowByDay([
    {
      party: SELF,
      transactions: [
        flowTx({ date: "2026-07-26T01:00:00Z", holding_fees: "1" }),
        flowTx({ date: "2026-07-24T01:00:00Z", holding_fees: "1" }),
      ],
    },
  ])
  expect(rows.map((r) => r.date)).toEqual(["2026-07-24", "2026-07-26"])
})

test("treats no sources as an empty series", () => {
  expect(ccFlowByDay([])).toEqual([])
})
