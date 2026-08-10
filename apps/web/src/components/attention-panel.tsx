"use client"

import { DataPanel, EmptyState } from "@/components/data-panel"
import type { AttentionItem, AttentionSeverity } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Severity is a dot plus its own sentence — colour is never the only channel. */
const TONE: Record<AttentionSeverity, string> = {
  bad: "bg-bad",
  warn: "bg-warn",
  info: "bg-muted-foreground/40",
}

/** What the dot is read out as. The wire values are internal shorthand. */
const SEVERITY_LABEL: Record<AttentionSeverity, string> = {
  bad: "problem",
  warn: "warning",
  info: "note",
}

export function AttentionPanel({
  items,
  isLoading,
}: {
  items: AttentionItem[]
  isLoading?: boolean
}) {
  return (
    <DataPanel
      title="Needs attention"
      description="Everything in this network that an operator should act on."
      isLoading={isLoading}
      loadingRows={2}
    >
      {items.length === 0 ? (
        <EmptyState
          title="Nothing needs attention"
          hint="Every node in this network is reachable, synchronized, and earning."
        />
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-2.5">
              <span
                className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE[item.severity])}
                role="img"
                aria-label={SEVERITY_LABEL[item.severity]}
              />
              <div className="min-w-0">
                <p className="text-[13px]">
                  <span className="font-medium">{item.nodeName}</span>
                  <span className="text-muted-foreground"> — </span>
                  {item.title}
                </p>
                {item.detail ? (
                  <p className="text-muted-foreground mt-0.5 text-[12px]">{item.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DataPanel>
  )
}
