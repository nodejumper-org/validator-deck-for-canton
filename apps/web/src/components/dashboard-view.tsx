"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/app-shell"
import { CcFlowChart } from "@/components/charts/cc-flow-chart"
import { RewardMixChart } from "@/components/charts/reward-mix-chart"
import { DataPanel, EmptyState } from "@/components/data-panel"
import { HealthMatrix } from "@/components/health-matrix"
import { NetworkSwitcher } from "@/components/network-switcher"
import { StatTile } from "@/components/stat-tile"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { formatAmountShort, formatCount } from "@/lib/format"
import { pickNetwork } from "@/lib/networks"
import { useDashboard, useFleetHealth, useNodes } from "@/lib/queries"

export function DashboardView() {
  const searchParams = useSearchParams()
  const { data: nodes } = useNodes()
  const { data: health, isLoading: healthLoading, error: healthError } = useFleetHealth()

  const available = [...new Set((nodes ?? []).map((n) => n.network))]
  const network = pickNetwork(searchParams.get("network"), available)
  const { data, isLoading, error } = useDashboard(network)

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

        {/* The whole query failed, so there is no `data` and no per-node detail
            to show — only this. The two alerts cannot co-occur. */}
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
      </div>
    </>
  )
}
