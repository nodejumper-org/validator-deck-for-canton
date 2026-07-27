"use client"

import { Check, Copy } from "lucide-react"
import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type CopyableProps = {
  /** The full value placed on the clipboard, regardless of what is rendered. */
  value: string
  /** What to show. Defaults to the value itself. */
  children?: ReactNode
  className?: string
  /** Announced to screen readers, e.g. "participant ID". */
  label?: string
}

/**
 * Click-to-copy for identifiers. The copy affordance stays reserved rather than
 * hidden — an icon that only appears on hover is invisible to touch and to anyone
 * scanning the page — but it stays low-contrast until the row is hovered.
 */
export function Copyable({ value, children, className, label }: CopyableProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // Clipboard access can be denied; the value is still selectable by hand.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={value}
      aria-label={label ? `Copy ${label}` : `Copy ${value}`}
      className={cn(
        "group/copy inline-flex max-w-full items-center gap-1.5 rounded-sm text-left",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
        className,
      )}
    >
      <span className="truncate">{children ?? value}</span>
      {copied ? (
        <Check className="text-ok size-3 shrink-0" aria-hidden />
      ) : (
        <Copy
          className="text-muted-foreground/40 group-hover/copy:text-muted-foreground size-3 shrink-0 transition-colors"
          aria-hidden
        />
      )}
    </button>
  )
}
