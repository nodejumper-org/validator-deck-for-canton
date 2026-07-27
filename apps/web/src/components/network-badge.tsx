import { cn } from "@/lib/utils"

export type Network = "devnet" | "testnet" | "mainnet" | "local"

/**
 * Which network a node is on is the most consequential piece of state in this
 * app — the difference between a harmless experiment and a production change. The
 * colours escalate deliberately: local and devnet stay quiet, testnet warms up,
 * mainnet reads as "stop and think".
 */
const TONE: Record<Network, string> = {
  local: "border-border text-muted-foreground bg-muted",
  devnet: "border-border text-muted-foreground bg-muted",
  testnet: "border-warn/30 text-warn bg-warn/10",
  mainnet: "border-bad/30 text-bad bg-bad/10",
}

export function NetworkBadge({ network, className }: { network: Network; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-px text-[10px] font-medium uppercase tracking-[0.06em]",
        TONE[network] ?? TONE.local,
        className,
      )}
    >
      {network}
    </span>
  )
}
