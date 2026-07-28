"use client"

import Link from "next/link"
import { use } from "react"
import { PageHeader } from "@/components/app-shell"
import { Copyable } from "@/components/copyable"
import { DataPanel, EmptyState } from "@/components/data-panel"
import { DetailList, DetailRow } from "@/components/detail-row"
import { PartyId } from "@/components/party-id"
import { StatTile } from "@/components/stat-tile"
import { StatusDot } from "@/components/status-dot"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ApiError } from "@/lib/api"
import { formatAmount, formatAmountShort, formatCount, formatRelativeTime, formatTimestamp } from "@/lib/format"
import { useValidator } from "@/lib/queries"

export default function ValidatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, error } = useValidator(id)

  const apiError = error as ApiError | null
  const dash = "—"

  // A participant-only node is a configuration fact, not a failure.
  if (apiError?.code === "NO_VALIDATOR") {
    return (
      <>
        <PageHeader title="Validator" />
        <div className="p-5">
          <DataPanel title="No validator configured">
            <EmptyState
              title="This node is participant only"
              hint="Add a validator API URL to the node to see wallet balance, rewards, and DSO details."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/nodes">Edit node</Link>
                </Button>
              }
            />
          </DataPanel>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Validator"
        description="Splice validator state: wallet, rewards, and DSO membership."
      />

      <div className="space-y-5 p-5">
        {data && data.errors.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>Some validator data could not be loaded</AlertTitle>
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
          <StatTile label="Splice" value={data?.version ?? dash} isLoading={isLoading} />
          <StatTile
            label="Unlocked"
            value={data?.balance ? formatAmountShort(data.balance.effective_unlocked_qty) : dash}
            tone="value"
            hint="CC"
            isLoading={isLoading}
          />
          <StatTile
            label="Locked"
            value={data?.balance ? formatAmountShort(data.balance.effective_locked_qty) : dash}
            tone="value"
            hint="CC"
            isLoading={isLoading}
          />
          <StatTile
            label="Round"
            value={data?.balance ? formatCount(data.balance.round) : dash}
            isLoading={isLoading}
            hint="Current mining round"
          />
          <StatTile
            label="Onboarded users"
            value={data ? formatCount(data.onboardedUsers.length) : dash}
            isLoading={isLoading}
          />
        </div>

        <DataPanel
          title="Identity"
          isLoading={isLoading}
          error={apiError}
          actions={
            data ? (
              <StatusDot ok={data.ready} className="text-[13px]">
                {data.ready ? "Ready" : "Not ready"}
              </StatusDot>
            ) : null
          }
        >
          {data ? (
            <DetailList>
              <DetailRow label="Validator party">
                {data.validatorUser ? (
                  <PartyId value={data.validatorUser.party_id} full label="validator party" />
                ) : (
                  <span className="text-muted-foreground">Unavailable</span>
                )}
              </DetailRow>
              <DetailRow label="Validator user">
                {data.validatorUser ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Copyable value={data.validatorUser.user_name} className="ident" />
                    {data.validatorUser.featured ? <Badge variant="secondary">Featured</Badge> : null}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Unavailable</span>
                )}
              </DetailRow>
              <DetailRow label="DSO party">
                {data.dsoPartyId ? (
                  <PartyId value={data.dsoPartyId} full label="DSO party" />
                ) : (
                  <span className="text-muted-foreground">Unavailable</span>
                )}
              </DetailRow>
              <DetailRow label="Holding fees">
                <span className="tabular font-mono text-[13px]">
                  {data.balance ? `${formatAmount(data.balance.total_holding_fees)} CC` : dash}
                </span>
              </DetailRow>
            </DetailList>
          ) : null}
        </DataPanel>

        <DataPanel
          title="Onboarded users"
          description="Wallet users onboarded through this validator."
          isLoading={isLoading}
          error={apiError}
        >
          {!data || data.onboardedUsers.length === 0 ? (
            <EmptyState title="No users onboarded yet" />
          ) : (
            <ul className="space-y-1">
              {data.onboardedUsers.map((u) => (
                <li key={u}>
                  <Copyable value={u} className="ident text-muted-foreground" />
                </li>
              ))}
            </ul>
          )}
        </DataPanel>

        <DataPanel
          title="Wallet activity"
          description="The 50 most recent transactions on this validator's wallet."
          isLoading={isLoading}
          error={apiError}
          flush
        >
          {!data || data.transactions.length === 0 ? (
            <EmptyState title="No wallet activity yet" />
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <Table>
                <TableHeader className="bg-card sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-[14%]">When</TableHead>
                    <TableHead className="w-[12%]">Type</TableHead>
                    <TableHead className="w-[30%]">Sender</TableHead>
                    <TableHead className="w-[14%] text-right">Amount</TableHead>
                    <TableHead className="text-right">Rewards used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((tx) => {
                    const rewards = [
                      ["app", tx.app_rewards_used],
                      ["validator", tx.validator_rewards_used],
                      ["SV", tx.sv_rewards_used],
                    ].filter(([, v]) => Number(v) > 0)

                    return (
                      <TableRow key={tx.event_id}>
                        <TableCell className="text-muted-foreground text-[12px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{formatRelativeTime(tx.date)}</span>
                            </TooltipTrigger>
                            <TooltipContent>{formatTimestamp(tx.date)}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {tx.transaction_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-0">
                          {tx.sender ? (
                            <PartyId value={tx.sender.party} />
                          ) : (
                            <span className="text-muted-foreground text-[12px]">{dash}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-value tabular text-right font-mono text-[13px]">
                          {tx.sender ? formatAmount(tx.sender.amount) : dash}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right text-[12px]">
                          {rewards.length === 0
                            ? dash
                            : rewards
                                .map(([label, v]) => `${label} ${formatAmount(v ?? "0", 2)}`)
                                .join(" · ")}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DataPanel>
      </div>
    </>
  )
}
