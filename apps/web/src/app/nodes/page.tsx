"use client"

import { MoreHorizontal, Pencil, Plug, Trash2 } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/app-shell"
import { Copyable } from "@/components/copyable"
import { DataPanel, EmptyState } from "@/components/data-panel"
import { DeleteNodeDialog } from "@/components/delete-node-dialog"
import { NetworkBadge } from "@/components/network-badge"
import { NodeFormDialog } from "@/components/node-form-dialog"
import { StatusDot } from "@/components/status-dot"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useNodes, useTestNode } from "@/lib/queries"
import type { NodeSummary, TestResult } from "@/lib/types"

function TestCell({ node }: { node: NodeSummary }) {
  const test = useTestNode()
  const result = test.data as TestResult | undefined
  const isThisNode = test.variables === node.id

  if (test.isPending && isThisNode) {
    return <span className="text-muted-foreground text-[12px]">Testing…</span>
  }

  if (result && isThisNode) {
    return (
      <div className="space-y-1">
        <StatusDot ok={result.ledger.ok} className="text-[12px]">
          <span className="ident">{result.ledger.detail}</span>
          <span className="text-muted-foreground ml-1.5">{result.ledger.latencyMs} ms</span>
        </StatusDot>
        {result.validator ? (
          <StatusDot ok={result.validator.ok} className="text-[12px]">
            <span className="ident">{result.validator.detail}</span>
            <span className="text-muted-foreground ml-1.5">{result.validator.latencyMs} ms</span>
          </StatusDot>
        ) : null}
      </div>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={() => test.mutate(node.id)}>
      <Plug className="size-3.5" />
      Test
    </Button>
  )
}

export default function NodesPage() {
  const { data: nodes, isLoading, error } = useNodes()

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
        description="Participant and validator nodes this console can operate."
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
                    <TableHead className="w-[18%]">Name</TableHead>
                    <TableHead className="w-[8%]">Network</TableHead>
                    <TableHead className="w-[30%]">Ledger API</TableHead>
                    <TableHead className="w-[14%]">Validator</TableHead>
                    <TableHead className="w-[26%]">Connection</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nodes.map((node) => (
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
                        <TestCell node={node} />
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
