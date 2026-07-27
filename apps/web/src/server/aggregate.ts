import type { UserRight, VettedPackage, WalletTransaction } from "@/lib/types"

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

export function netAmountByDay(txs: WalletTransaction[]): { date: string; net: number }[] {
  const totals = new Map<string, number>()
  for (const tx of txs) {
    if (!tx.sender) continue
    const key = day(tx.date)
    totals.set(key, (totals.get(key) ?? 0) + num(tx.sender.amount))
  }
  return sortedByDate(
    [...totals.entries()].map(([date, net]) => ({ date, net: Number(net.toFixed(4)) })),
  )
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
 * How many *users* hold each kind of right. A user with three CanActAs rights
 * counts once, because the question is "how many people can act", not "how many
 * grants exist".
 */
export function rightsDistribution(rightsPerUser: UserRight[][]): { kind: string; users: number }[] {
  const counts = new Map<string, number>()
  for (const rights of rightsPerUser) {
    for (const kind of new Set(rights.map((r) => r.kind))) {
      counts.set(kind, (counts.get(kind) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([kind, users]) => ({ kind, users }))
    .sort((a, b) => b.users - a.users || a.kind.localeCompare(b.kind))
}

/** Packages ranked by how many distinct versions are vetted — the upgrade debt. */
export function versionSprawl(
  pkgs: Pick<VettedPackage, "packageName" | "packageVersion">[],
  limit = 10,
): { name: string; versions: number }[] {
  const byName = new Map<string, Set<string>>()
  for (const p of pkgs) {
    const versions = byName.get(p.packageName) ?? new Set<string>()
    versions.add(p.packageVersion)
    byName.set(p.packageName, versions)
  }
  return [...byName.entries()]
    .map(([name, versions]) => ({ name, versions: versions.size }))
    .sort((a, b) => b.versions - a.versions || a.name.localeCompare(b.name))
    .slice(0, limit)
}
