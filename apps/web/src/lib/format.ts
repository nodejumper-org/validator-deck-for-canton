/**
 * Canton identities are two-part: `hint::fingerprint`. The hint is the name a
 * human chose; the fingerprint is the namespace of the participant that owns it.
 * Operators read the hint and only ever compare fingerprints, so the two parts
 * are formatted differently everywhere in this app.
 */
export type ParsedParty = {
  hint: string
  fingerprint: string
  /** True when the id had no `::` separator — a plain string, shown as-is. */
  plain: boolean
}

export function parseParty(partyId: string): ParsedParty {
  const idx = partyId.indexOf("::")
  if (idx === -1) return { hint: partyId, fingerprint: "", plain: true }
  return { hint: partyId.slice(0, idx), fingerprint: partyId.slice(idx + 2), plain: false }
}

/** Short form for tight columns: full hint, elided fingerprint. */
export function formatParty(partyId: string, fingerprintChars = 8): string {
  const { hint, fingerprint, plain } = parseParty(partyId)
  if (plain) return hint
  return `${hint}::${fingerprint.slice(0, fingerprintChars)}…`
}

/**
 * A stable hue per namespace. Operators juggle several namespaces at once — their
 * own participant plus every remote one — and a consistent colour turns "is this
 * mine?" into a glance instead of comparing 68 hex characters. Colour is only ever
 * an accelerator: the fingerprint text is always present too.
 */
export function namespaceHue(fingerprint: string): number {
  if (!fingerprint) return 220
  let hash = 0
  for (let i = 0; i < fingerprint.length; i += 1) {
    hash = (hash * 31 + fingerprint.charCodeAt(i)) % 360
  }
  return hash
}

/** Wallet amounts arrive as decimal strings. Parsed for display only, never for storage. */
export function formatAmount(value: string | number, fractionDigits = 4): string {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)
  return n.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/** Compact form for tiles where four decimals would not fit. */
export function formatAmountShort(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toFixed(2)
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US")
}

export function formatRelativeTime(input: string | number | Date): string {
  const then = new Date(input).getTime()
  if (Number.isNaN(then)) return String(input)

  const seconds = Math.round((then - Date.now()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
  ]

  let value = seconds
  for (const [unit, size] of units) {
    if (Math.abs(value) < size) {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(value), unit)
    }
    value /= size
  }
  return new Date(input).toLocaleDateString()
}

export function formatTimestamp(input: string | number | Date): string {
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? String(input) : d.toLocaleString()
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

/** Byte size for DAR uploads. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
