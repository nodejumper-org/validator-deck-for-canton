"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { StatusDot } from "@/components/status-dot"
import { orderNetworks } from "@/lib/networks"
import type { Network, NodeHealth } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Exactly one network at a time, with no "all": summing a mainnet balance into a
 * devnet one produces a number that means nothing.
 *
 * Each segment carries its own health dot, which is what keeps fleet awareness
 * once the statistics below are scoped — an outage on testnet stays visible while
 * you are looking at mainnet. The dot is never the only channel: the segment is
 * labelled and titled with the same fact.
 */
export function NetworkSwitcher({
  available,
  selected,
  health,
}: {
  available: Network[]
  selected: Network | null
  health: NodeHealth[] | undefined
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const networks = orderNetworks(available)

  if (networks.length === 0) return null

  const select = (network: Network) => {
    const next = new URLSearchParams(searchParams)
    next.set("network", network)
    router.replace(`?${next}`, { scroll: false })
  }

  return (
    <div
      role="group"
      aria-label="Network"
      className="bg-muted flex items-center gap-0.5 rounded-md p-0.5"
    >
      {networks.map((network) => {
        const rows = (health ?? []).filter((n) => n.network === network)
        const healthy = rows.filter((n) => n.ledgerOk).length
        const isSelected = network === selected

        return (
          <button
            key={network}
            type="button"
            onClick={() => select(network)}
            aria-pressed={isSelected}
            title={health ? `${network} — ${healthy} of ${rows.length} healthy` : network}
            className={cn(
              "flex items-center gap-2 rounded-[5px] px-2.5 py-1 text-[12px] font-medium tracking-[0.06em] uppercase transition-colors",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              isSelected
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <StatusDot ok={health ? rows.length > 0 && healthy === rows.length : null} />
            {network}
          </button>
        )
      })}
    </div>
  )
}
