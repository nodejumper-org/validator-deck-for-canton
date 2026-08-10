import type { CcFlowPoint, WalletTransaction } from "@/lib/types"

/**
 * Pure shaping functions for the dashboard charts. No network, no dates from the
 * clock — everything is derived from the payload passed in, which is what makes
 * them testable.
 *
 * Amounts are parsed to numbers here because charts need numbers. That is the one
 * place it is allowed: the decimal strings stay strings everywhere they are
 * stored or compared.
 */

/** The YYYY-MM-DD prefix of an ISO timestamp. */
function day(iso: string): string {
  return iso.slice(0, 10)
}

function num(value: string | undefined): number {
  const n = Number(value ?? "0")
  return Number.isFinite(n) ? n : 0
}

function sortedByDate<T extends { date: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

export function rewardMix(
  txs: WalletTransaction[],
): { date: string; app: number; validator: number; sv: number }[] {
  const totals = new Map<string, { app: number; validator: number; sv: number }>()

  for (const tx of txs) {
    const key = day(tx.date)
    const row = totals.get(key) ?? { app: 0, validator: 0, sv: 0 }
    row.app += num(tx.app_rewards_used)
    row.validator += num(tx.validator_rewards_used)
    row.sv += num(tx.sv_rewards_used)
    totals.set(key, row)
  }

  return sortedByDate(
    [...totals.entries()]
      .map(([date, r]) => ({
        date,
        app: Number(r.app.toFixed(4)),
        validator: Number(r.validator.toFixed(4)),
        sv: Number(r.sv.toFixed(4)),
      }))
      // A day where nothing was claimed would render as an empty column.
      .filter((r) => r.app > 0 || r.validator > 0 || r.sv > 0),
  )
}

/**
 * One validator's wallet history plus the party that owns it. The party is what
 * makes direction decidable; it is null when `getValidatorUser` failed.
 */
export type CcFlowSource = { party: string | null; transactions: WalletTransaction[] }

/**
 * Money in, money out, and the cost of holding it, per day, across every
 * validator in view.
 *
 * The predecessor summed `sender.amount` and called the result "received", which
 * was backwards. Knowing our own party is what fixes it. Amounts come back as
 * positive magnitudes — the chart decides which side of the axis they sit on.
 */
export function ccFlowByDay(sources: CcFlowSource[]): CcFlowPoint[] {
  const totals = new Map<string, { received: number; sent: number; fees: number }>()

  for (const { party, transactions } of sources) {
    for (const tx of transactions) {
      const key = day(tx.date)
      const row = totals.get(key) ?? { received: 0, sent: 0, fees: 0 }

      // Every transaction here came out of our own wallet's history, so the
      // holding fee is ours whether or not the party resolved.
      row.fees += Math.abs(num(tx.holding_fees))

      if (party) {
        for (const r of tx.receivers) {
          if (r.party === party) row.received += Math.abs(num(r.amount))
        }
        if (tx.sender?.party === party) row.sent += Math.abs(num(tx.sender.amount))
      }

      totals.set(key, row)
    }
  }

  return sortedByDate(
    [...totals.entries()]
      .map(([date, r]) => ({
        date,
        received: Number(r.received.toFixed(4)),
        sent: Number(r.sent.toFixed(4)),
        fees: Number(r.fees.toFixed(4)),
      }))
      // A day where nothing moved would render as an empty column.
      .filter((r) => r.received > 0 || r.sent > 0 || r.fees > 0),
  )
}
