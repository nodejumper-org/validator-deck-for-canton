"use client"

import { useRouter } from "next/navigation"
import { DataPanel, EmptyState } from "@/components/data-panel"
import { NetworkBadge } from "@/components/network-badge"
import { StatusDot } from "@/components/status-dot"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCount, formatDuration } from "@/lib/format"
import { NETWORK_ORDER } from "@/lib/networks"
import type { Network, NodeHealth } from "@/lib/types"
import { cn } from "@/lib/utils"

export function HealthMatrix({
  nodes,
  selectedNetwork,
  isLoading,
  error,
}: {
  nodes: NodeHealth[]
  /** Rows outside the selected network stay visible, but dimmed: the table is
      the fleet view, while everything below it is scoped to one network. */
  selectedNetwork?: Network | null
  isLoading?: boolean
  error?: { message: string } | null
}) {
  const router = useRouter()

  // Canonical network order, so the dimmed rows group into blocks instead of
  // scattering through the table.
  const rows = [...nodes].sort(
    (a, b) =>
      NETWORK_ORDER.indexOf(a.network) - NETWORK_ORDER.indexOf(b.network) ||
      a.name.localeCompare(b.name),
  )

  return (
    <DataPanel
      title="Node health"
      description="Every registered node, in every network. Checked when this page loaded."
      isLoading={isLoading}
      error={error}
      flush
    >
      {rows.length === 0 ? (
        <EmptyState title="No nodes registered" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[22%]">Node</TableHead>
                <TableHead className="w-[10%]">Network</TableHead>
                <TableHead className="w-[14%]">Ledger</TableHead>
                <TableHead className="w-[14%]">Validator</TableHead>
                <TableHead className="w-[14%]">Synchronizer</TableHead>
                <TableHead className="w-[14%] text-right">Offset</TableHead>
                <TableHead className="text-right">Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((n) => (
                <TableRow
                  key={n.id}
                  onClick={() => router.push(`/nodes/${n.id}`)}
                  className={cn(
                    "hover:bg-muted/40 cursor-pointer",
                    // 70, not 50: two thirds of a three-network operator's table is
                    // dimmed, and at 50% the node name and the 12px latency cell
                    // fall below AA. This still reads as secondary.
                    selectedNetwork && n.network !== selectedNetwork && "opacity-70",
                  )}
                >
                  <TableCell>
                    <span className="font-medium">{n.name}</span>
                    {n.error ? (
                      <span className="ident text-bad mt-0.5 block truncate">{n.error}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <NetworkBadge network={n.network} />
                  </TableCell>
                  <TableCell>
                    <StatusDot ok={n.ledgerOk} className="text-[13px]">
                      {n.ledgerVersion ?? (n.ledgerOk ? "Up" : "Down")}
                    </StatusDot>
                  </TableCell>
                  <TableCell>
                    <StatusDot ok={n.validatorOk} className="text-[13px]">
                      {n.validatorOk === null
                        ? "None"
                        : (n.validatorVersion ?? (n.validatorOk ? "Up" : "Down"))}
                    </StatusDot>
                  </TableCell>
                  <TableCell>
                    <StatusDot ok={n.synchronizerConnected} className="text-[13px]">
                      {n.synchronizerConnected ? "Connected" : "Disconnected"}
                    </StatusDot>
                  </TableCell>
                  <TableCell className="tabular text-right font-mono text-[13px]">
                    {n.ledgerEnd != null ? formatCount(n.ledgerEnd) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular text-right text-[12px]">
                    {formatDuration(n.latencyMs)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </DataPanel>
  )
}
