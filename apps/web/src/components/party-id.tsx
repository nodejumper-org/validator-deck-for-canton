"use client"

import { Copyable } from "@/components/copyable"
import { namespaceHue, parseParty } from "@/lib/format"
import { cn } from "@/lib/utils"

type PartyIdProps = {
  value: string
  /** How much of the fingerprint to show. */
  fingerprintChars?: number
  /** Render the whole fingerprint — for detail rows where there is room. */
  full?: boolean
  className?: string
  label?: string
}

/**
 * The signature element of this console.
 *
 * A Canton identity is `hint::fingerprint`, and the two halves mean different
 * things: the hint is the chosen name, the fingerprint is the owning namespace.
 * Rendering them at one weight — the usual "0x1234…abcd" elision — throws away
 * the part operators actually read and keeps the part they never do.
 *
 * So: the hint is set in foreground weight and never truncates, the separator
 * recedes, the fingerprint is dimmed and elided, and a 2px rule carries a stable
 * colour per namespace. A page of parties becomes a striped pattern where one
 * colour is "mine" and the rest are not.
 */
export function PartyId({ value, fingerprintChars = 8, full, className, label }: PartyIdProps) {
  const { hint, fingerprint, plain } = parseParty(value)

  if (plain) {
    return (
      <Copyable value={value} label={label} className={cn("ident", className)}>
        {value}
      </Copyable>
    )
  }

  const shown = full ? fingerprint : fingerprint.slice(0, fingerprintChars)

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span
        aria-hidden
        className="h-3.5 w-0.5 shrink-0 rounded-full"
        style={{ backgroundColor: `oklch(0.62 0.17 ${namespaceHue(fingerprint)})` }}
      />
      <Copyable value={value} label={label ?? "party ID"} className="ident min-w-0">
        <span className="text-foreground font-medium">{hint}</span>
        <span className="text-muted-foreground/50">::</span>
        <span className="text-muted-foreground">
          {shown}
          {!full && fingerprint.length > fingerprintChars ? "…" : ""}
        </span>
      </Copyable>
    </span>
  )
}
