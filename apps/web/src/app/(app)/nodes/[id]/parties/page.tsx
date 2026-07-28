"use client"

import { RefreshCw } from "lucide-react"
import { use, useState } from "react"
import { AllocatePartyDialog } from "@/components/allocate-party-dialog"
import { PageHeader } from "@/components/app-shell"
import { DataPanel, EmptyState } from "@/components/data-panel"
import { PartyId } from "@/components/party-id"
import { StatusDot } from "@/components/status-dot"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCount, formatRelativeTime } from "@/lib/format"
import { useLocalParties, useParties, useRescanLocalParties } from "@/lib/queries"
import type { PartyDetails } from "@/lib/types"

function PartyTable({ parties, showLocal }: { parties: PartyDetails[]; showLocal: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[70%]">Party ID</TableHead>
            {showLocal ? <TableHead className="w-[15%]">Hosted here</TableHead> : null}
            <TableHead>Identity provider</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parties.map((p) => (
            <TableRow key={p.party}>
              <TableCell className="max-w-0">
                <PartyId value={p.party} fingerprintChars={16} />
              </TableCell>
              {showLocal ? (
                <TableCell>
                  <StatusDot ok={p.isLocal ? true : null} className="text-[13px]">
                    {p.isLocal ? "Local" : "Remote"}
                  </StatusDot>
                </TableCell>
              ) : null}
              <TableCell className="text-muted-foreground text-[12px]">
                {p.identityProviderId || "default"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function AllPartiesTab({ nodeId }: { nodeId: string }) {
  const [filter, setFilter] = useState("")
  // A stack of tokens, so Previous can walk back without refetching from the top.
  const [tokens, setTokens] = useState<string[]>([""])
  const pageToken = tokens[tokens.length - 1] ?? ""

  const { data, isLoading, error, isFetching } = useParties(nodeId, { filter, pageToken })

  function onFilterChange(value: string) {
    setFilter(value)
    setTokens([""]) // A new filter restarts paging.
  }

  return (
    <DataPanel
      title="All known parties"
      description="Every party this participant knows about, including those hosted elsewhere."
      actions={
        <Input
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Party ID starts with…"
          className="h-8 w-64"
          aria-label="Filter parties by ID prefix"
        />
      }
      isLoading={isLoading}
      error={error as { message: string } | null}
      flush
    >
      {!data || data.parties.length === 0 ? (
        <EmptyState
          title={filter ? `No party ID starts with "${filter}"` : "No parties found"}
          hint={
            filter
              ? "The filter matches the start of the party ID, not any part of it."
              : undefined
          }
        />
      ) : (
        <>
          <PartyTable parties={data.parties} showLocal />
          <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5">
            <p className="text-muted-foreground text-[12px]">
              {formatCount(data.parties.length)} on this page
              {isFetching ? " · updating…" : ""}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={tokens.length <= 1}
                onClick={() => setTokens((t) => t.slice(0, -1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.nextPageToken}
                onClick={() => setTokens((t) => [...t, data.nextPageToken])}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </DataPanel>
  )
}

function LocalPartiesTab({ nodeId, active }: { nodeId: string; active: boolean }) {
  const { data, isLoading, error } = useLocalParties(nodeId, active)
  const rescan = useRescanLocalParties(nodeId)

  const scanning = data?.status === "scanning"

  return (
    <DataPanel
      title="Local parties"
      description="Parties hosted by this participant, refreshed on a schedule and stored so this page loads instantly."
      actions={
        <Button
          variant="outline"
          size="sm"
          disabled={scanning || rescan.isPending}
          onClick={() => rescan.mutate()}
        >
          <RefreshCw className={scanning ? "size-3.5 animate-spin" : "size-3.5"} />
          {scanning ? "Scanning…" : "Refresh"}
        </Button>
      }
      isLoading={isLoading}
      error={
        (error as { message: string } | null) ??
        (data?.status === "error" ? { message: data.message } : null)
      }
      flush
    >
      {scanning ? (
        <div className="px-4 py-8 text-center">
          <p className="text-[14px] font-medium">Scanning the party list…</p>
          <p className="text-muted-foreground mt-1 text-[13px]">
            {formatCount(data.progress.pages)}{" "}
            {data.progress.pages === 1 ? "page" : "pages"} read,{" "}
            {formatCount(data.progress.seen)} parties examined.
          </p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-lg text-[12px]">
            Local parties are identified by the participant&rsquo;s namespace, which the node
            cannot filter on, so the whole list has to be read. On devnet that takes about a
            minute. The result is stored, so you only wait for this once.
          </p>
        </div>
      ) : data?.status === "ready" ? (
        data.parties.length === 0 ? (
          <EmptyState
            title="This participant hosts no parties"
            hint="Allocate a party to start transacting from this node."
          />
        ) : (
          <>
            <PartyTable parties={data.parties} showLocal={false} />
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 border-t px-4 py-2.5 text-[12px]">
              <span>
                {formatCount(data.parties.length)} local of {formatCount(data.total)} known
              </span>
              <span aria-hidden>·</span>
              <span>last refreshed {formatRelativeTime(data.scannedAt)}</span>
              <span aria-hidden>·</span>
              <span>refreshes automatically every 30 minutes</span>
            </div>
          </>
        )
      ) : (
        <EmptyState
          title="Not scanned yet"
          hint="Press Refresh to read the full party list. It is stored afterwards, so this is a one-time wait."
        />
      )}
    </DataPanel>
  )
}

export default function PartiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [tab, setTab] = useState("all")

  return (
    <>
      <PageHeader
        title="Parties"
        description="Parties are the ledger identities that hold contracts."
        actions={
          <AllocatePartyDialog
            nodeId={id}
            trigger={<Button size="sm">Allocate party</Button>}
          />
        }
      />

      <div className="p-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="local">Local</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <AllPartiesTab nodeId={id} />
          </TabsContent>
          <TabsContent value="local">
            <LocalPartiesTab nodeId={id} active={tab === "local"} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
