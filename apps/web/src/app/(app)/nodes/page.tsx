"use client"

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { PageHeader } from "@/components/app-shell"
import { Copyable } from "@/components/copyable"
import { DataPanel, EmptyState } from "@/components/data-panel"
import { DeleteNodeDialog } from "@/components/delete-node-dialog"
import { NetworkBadge } from "@/components/network-badge"
import { NodeFormDialog } from "@/components/node-form-dialog"
import { SortableHead } from "@/components/sortable-head"
import { StatusDot } from "@/components/status-dot"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDuration } from "@/lib/format"
import { DEFAULT_NODE_SORT, nextSort, type NodeSort, type NodeSortKey, sortNodes } from "@/lib/node-sort"
import { useFleetHealth, useNodes } from "@/lib/queries"
import type { NodeHealth } from "@/lib/types"

/**
 * Reachability for one row, from the fleet probe the dashboard already runs.
 *
 * No button: the check happens on load, and because both pages read the same
 * `["dashboard", "health"]` query, arriving here from the dashboard costs no
 * request at all. The trade against the old per-node Test call is one latency
 * figure for the node instead of one per surface.
 */
function ConnectionCell({ health, pending }: { health?: NodeHealth; pending: boolean }) {
  if (!health) {
    return pending ? (
      <Skeleton className="h-4 w-28" />
    ) : (
      <span className="text-muted-foreground text-[12px]">Not checked</span>
    )
  }

  return (
    <div className="space-y-1">
      <StatusDot ok={health.ledgerOk} className="text-[12px]">
        <span className="ident">{health.ledgerVersion ?? (health.ledgerOk ? "Up" : "Down")}</span>
        <span className="text-muted-foreground ml-1.5">{formatDuration(health.latencyMs)}</span>
      </StatusDot>
      {health.validatorOk === null ? null : (
        <StatusDot ok={health.validatorOk} className="text-[12px]">
          <span className="ident">
            {health.validatorVersion ?? (health.validatorOk ? "Up" : "Down")}
          </span>
        </StatusDot>
      )}
      {health.error ? (
        <span className="ident text-bad block truncate text-[12px]">{health.error}</span>
      ) : null}
    </div>
  )
}

export default function NodesPage() {
  const { data: nodes, isLoading, error } = useNodes()
  const { data: health, isPending: healthPending } = useFleetHealth()
  const healthById = new Map((health ?? []).map((h) => [h.id, h]))
  // The same comparator and default the dashboard's health table uses, so the
  // two lists of nodes never disagree about what sorted means.
  const [sort, setSort] = useState<NodeSort>(DEFAULT_NODE_SORT)
  const toggle = (key: NodeSortKey) => setSort((s) => nextSort(s, key))
  const rows = sortNodes(nodes ?? [], sort)

  const addButton = (
    <NodeFormDialog
      mode="create"
      trigger={<Button size="sm">Register node</Button>}
    />
  )

  return (
    <>
      <PageHeader
        title="Nodes"
        description="Participant and validator nodes this console can operate. Checked when this page loaded."
        actions={addButton}
      />

      <div className="p-5">
        <DataPanel
          title="Registered nodes"
          isLoading={isLoading}
          error={error as { message: string } | null}
          flush
        >
          {!nodes || nodes.length === 0 ? (
            <EmptyState
              title="No nodes registered yet"
              hint="Add a Canton participant to inspect its users, parties, and packages. You will need its Ledger API URL and OIDC client credentials."
              action={addButton}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead column="name" sort={sort} onSort={toggle} className="w-[18%]">
                      Name
                    </SortableHead>
                    <SortableHead column="network" sort={sort} onSort={toggle} className="w-[8%]">
                      Network
                    </SortableHead>
                    <TableHead className="w-[30%]">Ledger API</TableHead>
                    <TableHead className="w-[14%]">Validator</TableHead>
                    <TableHead className="w-[26%]">Connection</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((node) => (
                    <TableRow key={node.id}>
                      <TableCell>
                        <Link
                          href={`/nodes/${node.id}`}
                          className="font-medium hover:underline underline-offset-2"
                        >
                          {node.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <NetworkBadge network={node.network} />
                      </TableCell>
                      <TableCell className="max-w-0">
                        <Copyable value={node.ledgerApiUrl} className="ident text-muted-foreground">
                          {node.ledgerApiUrl.replace(/^https?:\/\//, "")}
                        </Copyable>
                      </TableCell>
                      <TableCell>
                        <StatusDot ok={node.validatorApiUrl ? true : null} className="text-[12px]">
                          {node.validatorApiUrl ? "Configured" : "Participant only"}
                        </StatusDot>
                      </TableCell>
                      <TableCell>
                        <ConnectionCell
                          health={healthById.get(node.id)}
                          pending={healthPending}
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${node.name}`}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <NodeFormDialog
                              mode="edit"
                              node={node}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Pencil className="size-3.5" />
                                  Edit
                                </DropdownMenuItem>
                              }
                            />
                            <DeleteNodeDialog
                              node={node}
                              trigger={
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="size-3.5" />
                                  Remove
                                </DropdownMenuItem>
                              }
                            />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DataPanel>
      </div>
    </>
  )
}
