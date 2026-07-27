import type { ReactNode } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type DataPanelProps = {
  title: string
  description?: ReactNode
  /** Right-aligned controls in the header. */
  actions?: ReactNode
  isLoading?: boolean
  error?: { message: string } | null
  /** Skeleton rows drawn while loading. */
  loadingRows?: number
  className?: string
  /** Removes body padding, for panels whose child is a full-bleed table. */
  flush?: boolean
  children: ReactNode
}

/**
 * The one panel every page uses. Owning loading and error rendering here is what
 * keeps eight pages from each inventing their own spinner and alert.
 */
export function DataPanel({
  title,
  description,
  actions,
  isLoading,
  error,
  loadingRows = 4,
  className,
  flush,
  children,
}: DataPanelProps) {
  return (
    <section className={cn("bg-card rounded-lg border", className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {description ? (
            <p className="text-muted-foreground mt-0.5 text-[13px]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>

      <div className={cn(flush ? "" : "px-4 py-3")}>
        {isLoading ? (
          <div className={cn("space-y-2", flush && "px-4 py-3")}>
            {Array.from({ length: loadingRows }, (_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className={cn(flush && "px-4 py-3")}>
            <Alert variant="destructive">
              <AlertTitle>Could not load {title.toLowerCase()}</AlertTitle>
              {/* Canton's own message, verbatim — operators need the real text. */}
              <AlertDescription className="ident break-words">{error.message}</AlertDescription>
            </Alert>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

/** Centred placeholder for a panel with nothing in it yet. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <p className="text-[14px] font-medium">{title}</p>
      {hint ? <p className="text-muted-foreground max-w-md text-[13px]">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
