"use client"

import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import { activeSeries, ChartFrame, compactCC, shortDay } from "@/components/charts/chart-frame"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatAmount } from "@/lib/format"
import type { CcFlowPoint } from "@/lib/types"

/** `sign` puts money leaving the wallet below the axis, so net reads at a glance. */
const SERIES = [
  { key: "received", label: "Received", color: "var(--chart-3)", sign: 1, stack: "in" },
  { key: "sent", label: "Sent", color: "var(--chart-1)", sign: -1, stack: "out" },
  { key: "fees", label: "Holding fees", color: "var(--chart-2)", sign: -1, stack: "out" },
] as const

export function CcFlowChart({ data, isLoading }: { data: CcFlowPoint[]; isLoading?: boolean }) {
  // A plain collecting validator never sends and pays fees in one direction only.
  // Dropping series that are zero across the whole range is what keeps this from
  // being a three-item legend that is permanently two-thirds empty.
  const active = activeSeries(SERIES, data)
  const config = Object.fromEntries(active.map((s) => [s.key, { label: s.label, color: s.color }]))
  const rows = data.map((d) => ({
    date: d.date,
    ...Object.fromEntries(active.map((s) => [s.key, d[s.key] * s.sign])),
  }))

  const outbound = active.filter((s) => s.sign === -1)
  const lastOutbound = outbound.at(-1)?.key

  return (
    <ChartFrame
      title="CC flow"
      description="What the wallets received, sent, and paid to hold, per day."
      isEmpty={data.length === 0}
      emptyTitle="No wallet activity"
      emptyHint="Register a node with a validator API to see its wallet flow."
      isLoading={isLoading}
    >
      <ChartContainer config={config} className="h-56 w-full">
        <BarChart data={rows} margin={{ left: 4, right: 4, top: 4 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.25} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDay}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            tickFormatter={compactCC}
            tickLine={false}
            axisLine={false}
            width={44}
            tickMargin={4}
          />
          {outbound.length > 0 ? <ReferenceLine y={0} stroke="var(--border)" /> : null}
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(label) => shortDay(String(label))}
                formatter={(value, name) => [
                  `${formatAmount(Math.abs(Number(value)), 2)} CC`,
                  ` ${SERIES.find((s) => s.key === name)?.label ?? name}`,
                ]}
              />
            }
          />
          {active.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
          {active.map((s) => (
            <Bar
              key={s.key}
              isAnimationActive={false}
              dataKey={s.key}
              stackId={s.stack}
              fill={`var(--color-${s.key})`}
              radius={
                s.key === "received" ? [4, 4, 0, 0] : s.key === lastOutbound ? [0, 0, 4, 4] : undefined
              }
              maxBarSize={40}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </ChartFrame>
  )
}
