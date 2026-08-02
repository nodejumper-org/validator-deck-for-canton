import { cn } from "@/lib/utils"

/**
 * The mark is the app's own typography made emblem: every Canton identity here
 * is `hint::fingerprint`, and PartyId splits it into a strong half and a dimmed
 * one. Four Plex-style square dots read as `::` — the left colon carries the
 * hint side in brand indigo, the right one recedes like the fingerprint.
 *
 * `app/icon.svg` is the same drawing with literal colours; keep them in step.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden focusable="false" className={cn("shrink-0", className)}>
      <rect x="5.5" y="4.5" width="9" height="9" rx="2.5" className="fill-primary" />
      <rect x="5.5" y="18.5" width="9" height="9" rx="2.5" className="fill-primary" />
      <rect x="17.5" y="4.5" width="9" height="9" rx="2.5" className="fill-muted-foreground" />
      <rect x="17.5" y="18.5" width="9" height="9" rx="2.5" className="fill-muted-foreground" />
    </svg>
  )
}
