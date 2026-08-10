"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/app-shell"
import { AttentionPanel } from "@/components/attention-panel"
import { CcFlowChart } from "@/components/charts/cc-flow-chart"
import { RewardMixChart } from "@/components/charts/reward-mix-chart"
import { DataPanel, EmptyState } from "@/components/data-panel"
import { HealthMatrix } from "@/components/health-matrix"
import { NetworkSwitcher } from "@/components/network-switcher"
import { StatTile } from "@/components/stat-tile"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { attentionItems } from "@/lib/attention"
import { formatAmountShort, formatCount } from "@/lib/format"
import { pickNetwork } from "@/lib/networks"
import { useDashboard, useFleetHealth, useNodes } from "@/lib/queries"

export function DashboardView() {
  const searchParams = useSearchParams()
  const { data: nodes } = useNodes()
  const { data: health, isLoading: healthLoading, error: healthError } = useFleetHealth()

  const available = [...new Set((nodes ?? []).map((n) => n.network))]
  const network = pickNetwork(searchParams.get("network"), available)
  const { data, isLoading, error, dataUpdatedAt } = useDashboard(network)

  const statsError = error as { message: string } | null
  const dash = "—"

  // A fresh install has nothing to show; point at the one action that matters.
  if (nodes && nodes.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="p-5">
          <DataPanel title="Welcome">
            <EmptyState
              title="No nodes registered yet"
              hint="Register a Canton participant to see its health, users, parties, packages, and wallet activity here."
              action={
                <Button asChild size="sm">
                  <Link href="/nodes">Register a node</Link>
                </Button>
              }
            />
          </DataPanel>
        </div>
      </>
    )
  }

  const inNetwork = (health ?? []).filter((n) => n.network === network)
  const healthy = inNetwork.filter((n) => n.ledgerOk).length

  const attention = attentionItems({
    health: inNetwork,
    stats: data?.nodes ?? [],
    // The fetch time of the same query `stats` came from, not the render clock:
    // `lastActivityAt` is read from that query too, so this asks "was this
    // validator silent as of the last read?" rather than drifting with every
    // unrelated re-render. Also keeps the component pure.
    now: dataUpdatedAt,
  })

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Fleet health, and everything else for one network at a time."
        actions={<NetworkSwitcher available={available} selected={network} health={health} />}
      />

      <div className="space-y-5 p-5">
        <HealthMatrix
          nodes={health ?? []}
          selectedNetwork={network}
          isLoading={healthLoading}
          error={healthError as { message: string } | null}
        />

        {/* A first-load failure has no `data`, so this alert stands alone. A failed
            refetch keeps the last good `data`, so both alerts can stack — that is
            the honest rendering, and neither block gates the other. */}
        {statsError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load statistics</AlertTitle>
            {/* Canton's own message, verbatim — operators need the real text. */}
            <AlertDescription className="ident break-words">
              {statsError.message}
            </AlertDescription>
          </Alert>
        ) : null}

        {data && data.errors.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>Some node data could not be loaded</AlertTitle>
            <AlertDescription>
              <ul className="space-y-1">
                {data.errors.map((e, i) => (
                  <li key={`${e.surface}-${i}`} className="text-[13px]">
                    <span className="font-medium">{e.surface}:</span>{" "}
                    <span className="ident">{e.message}</span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatTile
            label="Nodes"
            value={health ? formatCount(healthy) : dash}
            hint={health ? `of ${inNetwork.length} healthy` : undefined}
            isLoading={healthLoading}
          />
          <StatTile
            label="Ledger users"
            value={data ? formatCount(data.totals.users) : dash}
            isLoading={isLoading}
          />
          <StatTile
            label="Vetted packages"
            value={data ? formatCount(data.totals.packages) : dash}
            isLoading={isLoading}
          />
          <StatTile
            label="Unlocked"
            value={data ? formatAmountShort(data.totals.unlockedCC) : dash}
            tone="value"
            hint="CC"
            isLoading={isLoading}
          />
          <StatTile
            label="Locked"
            value={data ? formatAmountShort(data.totals.lockedCC) : dash}
            tone="value"
            hint="CC"
            isLoading={isLoading}
          />
          <StatTile
            label="Holding fees"
            value={data ? formatAmountShort(data.totals.holdingFees) : dash}
            tone="value"
            hint="CC, cumulative"
            isLoading={isLoading}
          />
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <CcFlowChart data={data?.charts.ccFlow ?? []} isLoading={isLoading} />
          <RewardMixChart data={data?.charts.rewardMix ?? []} isLoading={isLoading} />
        </div>

        {/* Gated on every input, not just health. Health lands first by design, so
            gating on it alone let the panel render "Nothing needs attention" before
            a single package, user, or wallet figure had arrived — an all-clear it
            had no basis for, with warnings popping in behind it. Same for `network`:
            until `useNodes()` resolves there is no selection and `inNetwork` is
            empty, which reads identically. */}
        <AttentionPanel items={attention} isLoading={healthLoading || isLoading || !network} />
      </div>
    </>
  )
}
