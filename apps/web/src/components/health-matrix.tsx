"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { DataPanel, EmptyState } from "@/components/data-panel"
import { NetworkBadge } from "@/components/network-badge"
import { SortableHead } from "@/components/sortable-head"
import { StatusDot } from "@/components/status-dot"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCount, formatDuration } from "@/lib/format"
import { DEFAULT_NODE_SORT, nextSort, type NodeSort, type NodeSortKey, sortNodes } from "@/lib/node-sort"
import type { NodeHealth } from "@/lib/types"

export function HealthMatrix({
  nodes,
  isLoading,
  error,
}: {
  nodes: NodeHealth[]
  isLoading?: boolean
  error?: { message: string } | null
}) {
  const router = useRouter()
  // Canonical network order by default, so rows group by network instead of
  // scattering through the table.
  const [sort, setSort] = useState<NodeSort>(DEFAULT_NODE_SORT)
  const rows = sortNodes(nodes, sort)
  const toggle = (key: NodeSortKey) => setSort((s) => nextSort(s, key))

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
                <SortableHead column="name" sort={sort} onSort={toggle} className="w-[22%]">
                  Node
                </SortableHead>
                <SortableHead column="network" sort={sort} onSort={toggle} className="w-[10%]">
                  Network
                </SortableHead>
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
                  className="hover:bg-muted/40 cursor-pointer"
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
