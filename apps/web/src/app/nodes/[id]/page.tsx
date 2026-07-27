"use client"

import { use } from "react"
import { PageHeader } from "@/components/app-shell"
import { Copyable } from "@/components/copyable"
import { DataPanel, EmptyState } from "@/components/data-panel"
import { DetailList, DetailRow } from "@/components/detail-row"
import { NetworkBadge } from "@/components/network-badge"
import { PartyId } from "@/components/party-id"
import { StatTile } from "@/components/stat-tile"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCount } from "@/lib/format"
import { useOverview } from "@/lib/queries"

export default function NodeOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, error } = useOverview(id)

  const dash = "—"

  return (
    <>
      <PageHeader
        title={data?.node.name ?? "Node"}
        description={
          data ? (
            <span className="flex items-center gap-2">
              <NetworkBadge network={data.node.network} />
              <span>{data.node.validatorApiUrl ? "Participant + validator" : "Participant"}</span>
            </span>
          ) : null
        }
      />

      <div className="space-y-5 p-5">
        {data && data.errors.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>Some data could not be loaded</AlertTitle>
            <AlertDescription>
              <ul className="space-y-1">
                {data.errors.map((e) => (
                  <li key={e.surface} className="text-[13px]">
                    <span className="font-medium">{e.surface}:</span>{" "}
                    <span className="ident">{e.message}</span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile
            label="Ledger API"
            value={data?.ledgerVersion ?? dash}
            isLoading={isLoading}
            hint="Canton version"
          />
          <StatTile
            label="Validator"
            value={data?.validatorVersion ?? dash}
            isLoading={isLoading}
            hint={data?.node.validatorApiUrl ? "Splice version" : "Not configured"}
          />
          <StatTile
            label="Ledger offset"
            value={data?.ledgerEnd != null ? formatCount(data.ledgerEnd) : dash}
            isLoading={isLoading}
            hint="Current ledger end"
          />
          <StatTile
            label="Users"
            value={data ? formatCount(data.counts.users) : dash}
            isLoading={isLoading}
          />
          <StatTile
            label="Vetted packages"
            value={data ? formatCount(data.counts.packages) : dash}
            isLoading={isLoading}
          />
        </div>

        <DataPanel
          title="Identity"
          isLoading={isLoading}
          error={error as { message: string } | null}
        >
          {data ? (
            <DetailList>
              <DetailRow label="Participant ID">
                {data.participantId ? (
                  <PartyId value={data.participantId} full label="participant ID" />
                ) : (
                  <span className="text-muted-foreground">Unavailable</span>
                )}
              </DetailRow>
              <DetailRow label="Ledger API">
                <Copyable value={data.node.ledgerApiUrl} className="ident text-muted-foreground" />
              </DetailRow>
              <DetailRow label="Validator API">
                {data.node.validatorApiUrl ? (
                  <Copyable
                    value={data.node.validatorApiUrl}
                    className="ident text-muted-foreground"
                  />
                ) : (
                  <span className="text-muted-foreground">
                    Not configured — this node is participant only
                  </span>
                )}
              </DetailRow>
              <DetailRow label="Auth client">
                <span className="ident text-muted-foreground">{data.node.authClientId}</span>
              </DetailRow>
            </DetailList>
          ) : null}
        </DataPanel>

        <DataPanel
          title="Synchronizers"
          description="Global domains this participant is currently connected to."
          isLoading={isLoading}
          error={error as { message: string } | null}
          flush
        >
          {!data || data.synchronizers.length === 0 ? (
            <EmptyState
              title="Not connected to any synchronizer"
              hint="A participant must be connected to a synchronizer before it can transact."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[15%]">Alias</TableHead>
                    <TableHead className="w-[55%]">Synchronizer ID</TableHead>
                    <TableHead>Permission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.synchronizers.map((s) => (
                    <TableRow key={s.synchronizerId}>
                      <TableCell className="font-medium">{s.synchronizerAlias || dash}</TableCell>
                      <TableCell className="max-w-0">
                        <PartyId value={s.synchronizerId} label="synchronizer ID" />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[12px]">
                        {s.permission.replace("PARTICIPANT_PERMISSION_", "").toLowerCase()}
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
