import { cn } from "@/lib/utils"

type StatusDotProps = {
  /** true = healthy, false = failing, null = unknown or not configured. */
  ok: boolean | null | undefined
  /** Text beside the dot. Colour is never the only signal. */
  children?: React.ReactNode
  className?: string
}

export function StatusDot({ ok, children, className }: StatusDotProps) {
  const tone = ok === true ? "bg-ok" : ok === false ? "bg-bad" : "bg-muted-foreground/40"
  const state = ok === true ? "healthy" : ok === false ? "failing" : "unknown"

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", tone)} role="img" aria-label={state} />
      {children ? <span className="truncate">{children}</span> : null}
    </span>
  )
}
