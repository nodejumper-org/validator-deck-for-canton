"use client"

import Link from "next/link"
import { PageHeader } from "@/components/app-shell"
import { RankedBarChart } from "@/components/charts/ranked-bar-chart"
import { RewardMixChart } from "@/components/charts/reward-mix-chart"
import { WalletActivityChart } from "@/components/charts/wallet-activity-chart"
import { DataPanel, EmptyState } from "@/components/data-panel"
import { HealthMatrix } from "@/components/health-matrix"
import { StatTile } from "@/components/stat-tile"
import { Button } from "@/components/ui/button"
import { formatAmountShort, formatCount } from "@/lib/format"
import { useDashboard, useNodes } from "@/lib/queries"

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboard()
  const { data: nodes } = useNodes()

  const err = error as { message: string } | null
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

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Health and activity across every registered node."
      />

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatTile
            label="Nodes"
            value={data ? formatCount(data.totals.nodes) : dash}
            isLoading={isLoading}
          />
          <StatTile
            label="Healthy"
            value={data ? formatCount(data.totals.healthy) : dash}
            hint={data ? `of ${data.totals.nodes}` : undefined}
            isLoading={isLoading}
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
            label="Wallet balance"
            value={data ? formatAmountShort(data.totals.balanceCC) : dash}
            tone="value"
            hint="CC unlocked"
            isLoading={isLoading}
          />
          <StatTile
            label="Synchronizers"
            value={data ? formatCount(data.totals.synchronizers) : dash}
            hint="Connections"
            isLoading={isLoading}
          />
        </div>

        <HealthMatrix nodes={data?.nodes ?? []} isLoading={isLoading} error={err} />

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <WalletActivityChart data={data?.charts.walletActivity ?? []} isLoading={isLoading} />
          <RewardMixChart data={data?.charts.rewardMix ?? []} isLoading={isLoading} />
          <RankedBarChart
            title="Rights distribution"
            description="How many ledger users hold each kind of right."
            data={(data?.charts.rightsDistribution ?? []).map((r) => ({
              label: r.kind,
              value: r.users,
            }))}
            valueLabel="users"
            emptyTitle="No rights granted"
            emptyHint="Users with no rights cannot act on the ledger."
            isLoading={isLoading}
          />
          <RankedBarChart
            title="Package version sprawl"
            description="Packages ranked by how many distinct versions stay vetted."
            data={(data?.charts.versionSprawl ?? []).map((v) => ({
              label: v.name,
              value: v.versions,
            }))}
            valueLabel="versions"
            emptyTitle="No packages vetted"
            emptyHint="Upload a DAR to vet packages on a participant."
            isLoading={isLoading}
          />
        </div>
      </div>
    </>
  )
}
