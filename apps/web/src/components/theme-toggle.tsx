"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * One button that cycles light → dark → system rather than three segments: the
 * rail is narrow and the product name deserves the space more than a control
 * used once a session.
 */
const ORDER = ["light", "dark", "system"] as const
const META = {
  light: { icon: Sun, label: "Light" },
  dark: { icon: Moon, label: "Dark" },
  system: { icon: Monitor, label: "System" },
} as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // The theme is unknown during SSR; render a stable placeholder so nothing
  // flickers to the wrong icon on hydration.
  useEffect(() => setMounted(true), [])

  const current = (mounted && ORDER.includes(theme as never) ? theme : "system") as
    (typeof ORDER)[number]
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!
  const Icon = META[current].icon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setTheme(next)}
          aria-label={`Theme: ${META[current].label}. Switch to ${META[next].label}.`}
          className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent focus-visible:ring-ring shrink-0 rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {mounted ? `${META[current].label} — switch to ${META[next].label}` : "Theme"}
      </TooltipContent>
    </Tooltip>
  )
}
