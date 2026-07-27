import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type StatTileProps = {
  label: string
  value: ReactNode
  hint?: ReactNode
  /** Amber is reserved for monetary figures (CC). */
  tone?: "default" | "value"
  isLoading?: boolean
  className?: string
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  isLoading,
  className,
}: StatTileProps) {
  return (
    <div className={cn("bg-card rounded-lg border px-3.5 py-3", className)}>
      <p className="eyebrow">{label}</p>
      {isLoading ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <p
          className={cn(
            "tabular mt-1 font-mono text-[22px] leading-tight font-medium",
            tone === "value" && "text-value",
          )}
        >
          {value}
        </p>
      )}
      {hint ? <p className="text-muted-foreground mt-0.5 text-[12px]">{hint}</p> : null}
    </div>
  )
}
