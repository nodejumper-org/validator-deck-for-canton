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
 * you are looking at mainnet. The dot is never the only channel: a network that is
 * not fully up spells the count out beside its name.
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
      className="bg-muted flex items-center gap-1 rounded-lg border p-1"
    >
      {networks.map((network) => {
        const rows = (health ?? []).filter((n) => n.network === network)
        const healthy = rows.filter((n) => n.ledgerOk).length
        const allHealthy = rows.length > 0 && healthy === rows.length
        const isSelected = network === selected

        return (
          <button
            key={network}
            type="button"
            onClick={() => select(network)}
            aria-pressed={isSelected}
            title={health ? `${network} — ${healthy} of ${rows.length} healthy` : network}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium tracking-[0.06em] uppercase transition-colors",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              isSelected
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <StatusDot ok={health ? allHealthy : null}>
              {network}
              {/* Colour alone would carry this, and `title` does not exist on
                  touch. Quiet while a network is fully up, explicit once it is
                  not — which is the case worth interrupting a glance for. */}
              {health && !allHealthy ? (
                <span className="tabular ml-1.5">
                  {healthy}/{rows.length}
                </span>
              ) : null}
            </StatusDot>
          </button>
        )
      })}
    </div>
  )
}
