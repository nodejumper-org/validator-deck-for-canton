import type { ReactNode } from "react"

/** Label/value pair used by every identity and detail panel. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b py-2 last:border-b-0">
      <dt className="text-muted-foreground w-40 shrink-0 text-[13px]">{label}</dt>
      <dd className="min-w-0 flex-1 text-[13px]">{children}</dd>
    </div>
  )
}

export function DetailList({ children }: { children: ReactNode }) {
  return <dl className="-my-2">{children}</dl>
}
