import type { AttentionItem, AttentionSeverity, NodeHealth, NodeStats } from "./types"

/**
 * A validator silent this long is worth surfacing: rewards normally land every
 * mining round, so two days of nothing means something stopped.
 */
export const STALE_ACTIVITY_MS = 48 * 60 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

const SEVERITY_RANK: Record<AttentionSeverity, number> = { bad: 0, warn: 1, info: 2 }

/**
 * What an operator should act on, for one network.
 *
 * Suppression matters more than the rules: an unreachable node also reports zero
 * users and zero packages, and emitting those as separate findings buries the one
 * that matters. The clock is a parameter so this stays testable.
 */
export function attentionItems({
  health,
  stats,
  now,
}: {
  health: NodeHealth[]
  stats: NodeStats[]
  now: number
}): AttentionItem[] {
  const byId = new Map(stats.map((s) => [s.id, s]))
  const items: AttentionItem[] = []

  for (const node of health) {
    const add = (rule: string, severity: AttentionSeverity, title: string, detail?: string) =>
      items.push({
        key: `${node.id}:${rule}`,
        severity,
        nodeId: node.id,
        nodeName: node.name,
        title,
        detail,
      })

    if (!node.ledgerOk) {
      add("unreachable", "bad", "Node unreachable", node.error ?? "The ledger API did not answer.")
      continue
    }

    // Strictly `false`: null means the synchronizer read itself failed, and a
    // disconnection is only ever asserted from a read that succeeded.
    if (node.synchronizerConnected === false) {
      add(
        "synchronizer",
        "bad",
        "Synchronizer disconnected",
        "The participant is connected to no synchronizer, so it can neither submit nor receive transactions.",
      )
    }

    // Statistics are absent while their query is in flight, and untrustworthy when
    // it failed — zeros would then read as real counts.
    const s = byId.get(node.id)
    const counted = s?.ok ? s : null

    // The wallet fails on its own: `validatorOk` comes from the health probe's
    // `getVersion`, which answers happily for a credential that has no onboarded
    // wallet, while all three wallet reads fail with "No wallet found". Reading
    // the resulting `lastActivityAt: null` as "no activity" would state as fact
    // something the statistics route recorded as a failure, so rules 4 and 5 need
    // `walletOk` exactly as they need `validatorOk` — and *only* `walletOk`. One
    // flag per source: `ok` says nothing about the wallet reads, and a credential
    // that lost ParticipantAdmin fails the ledger reads while its onboarded
    // wallet still answers, so gating on `ok` too would swallow a real five-day
    // silence. `hasValidator` is node configuration, not a read result, and needs
    // no flag at all.

    if (node.validatorOk === false) {
      add("validator", "bad", "Validator unreachable", "The Splice validator API did not answer.")
    } else if (s?.hasValidator && s.walletOk) {
      if (s.lastActivityAt === null) {
        add(
          "no-activity",
          "warn",
          "No wallet activity yet",
          "This validator has no recorded wallet transactions.",
        )
      } else {
        const age = now - Date.parse(s.lastActivityAt)
        if (age >= STALE_ACTIVITY_MS) {
          add(
            "no-activity",
            "warn",
            `No wallet activity for ${Math.floor(age / DAY_MS)} days`,
            "Rewards normally land every mining round.",
          )
        }
      }
    }

    if (counted && counted.deactivatedUsers > 0) {
      const n = counted.deactivatedUsers
      add(
        "deactivated",
        "warn",
        `${n} deactivated ledger ${n === 1 ? "user" : "users"}`,
        "A deactivated user cannot act on the ledger.",
      )
    }

    if (counted && counted.packages === 0) {
      add(
        "packages",
        "warn",
        "No packages vetted",
        "The participant has vetted no packages, so no contract can be created on it.",
      )
    }

    if (node.validatorOk === null) {
      add(
        "participant-only",
        "info",
        "Participant only",
        "No validator API is configured, so wallet, rewards, and onboarding are unavailable.",
      )
    }
  }

  // Sort is stable, so items keep rule order within one node and severity.
  return items.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.nodeName.localeCompare(b.nodeName),
  )
}
