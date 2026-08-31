"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { DataPanel, EmptyState } from "@/components/data-panel"
import { NetworkBadge } from "@/components/network-badge"
import { StatusDot } from "@/components/status-dot"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCount, formatDuration } from "@/lib/format"
import {
  DEFAULT_HEALTH_SORT,
  type HealthSort,
  type HealthSortKey,
  sortHealth,
} from "@/lib/health-sort"
import type { Network, NodeHealth } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * A header that sorts. Defined outside HealthMatrix on purpose: a component
 * declared in a render body is a new type every render, so React unmounts and
 * remounts it instead of updating it.
 *
 * The arrow occupies its space even when inactive, so switching columns does
 * not shift the header text sideways.
 */
function SortableHead({
  column,
  sort,
  onSort,
  children,
}: {
  column: HealthSortKey
  sort: HealthSort
  onSort: (key: HealthSortKey) => void
  children: string
}) {
  const active = sort.key === column
  const Arrow = active && sort.direction === "desc" ? ChevronDown : ChevronUp
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="hover:text-foreground -m-1 flex items-center gap-1 p-1"
    >
      {children}
      <Arrow className={cn("size-3", active ? "opacity-100" : "opacity-0")} aria-hidden />
    </button>
  )
}

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
  // Canonical network order by default, so the dimmed rows group into blocks
  // instead of scattering through the table.
  const [sort, setSort] = useState<HealthSort>(DEFAULT_HEALTH_SORT)
  const rows = sortHealth(nodes, sort)

  /** Clicking the active column flips it; clicking another starts it ascending. */
  const toggle = (key: HealthSortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, direction: s.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    )

  // aria-sort belongs on the cell, but the click target has to be the button
  // for keyboard users, so the header cell carries the state and the button
  // carries the interaction.
  const ariaSort = (key: HealthSortKey) =>
    sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"

  return (
    <DataPanel
      title="Node health"
      description="Every registered node, in every network. Checked when this page loaded. Sort by node or network."
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
                <TableHead className="w-[22%]" aria-sort={ariaSort("name")}>
                  <SortableHead column="name" sort={sort} onSort={toggle}>
                    Node
                  </SortableHead>
                </TableHead>
                <TableHead className="w-[10%]" aria-sort={ariaSort("network")}>
                  <SortableHead column="network" sort={sort} onSort={toggle}>
                    Network
                  </SortableHead>
                </TableHead>
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
                      {n.synchronizerConnected === true
                        ? "Connected"
                        : n.synchronizerConnected === false
                          ? "Disconnected"
                          : "Unknown"}
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
