"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartFrame, compactCC, shortDay } from "@/components/charts/chart-frame"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { activeSeries } from "@/lib/chart-series"
import { formatAmount } from "@/lib/format"
import type { RewardMixPoint } from "@/lib/types"

/** All three stack in the same direction: a claimed reward is always income. */
const SERIES = [
  { key: "app", label: "App", color: "var(--chart-3)" },
  { key: "validator", label: "Validator", color: "var(--chart-1)" },
  { key: "sv", label: "SV", color: "var(--chart-2)" },
] as const

export function RewardMixChart({
  data,
  isLoading,
}: {
  data: RewardMixPoint[]
  isLoading?: boolean
}) {
  // Most validators only ever claim one of the three, so a fixed three-item
  // legend would be permanently two-thirds empty. The legend itself always
  // renders: it is the only thing on screen that says which of the three the
  // remaining bars are — the panel title does not.
  const active = activeSeries(SERIES, data)
  const config = Object.fromEntries(active.map((s) => [s.key, { label: s.label, color: s.color }]))
  const last = active.at(-1)?.key

  return (
    <ChartFrame
      title="Reward mix"
      description="Which reward types were claimed each day."
      isEmpty={data.length === 0}
      emptyTitle="No rewards claimed"
      emptyHint="Reward usage appears once the validator starts collecting."
      isLoading={isLoading}
    >
      <ChartContainer config={config} className="h-56 w-full">
        <BarChart data={data} margin={{ left: 4, right: 4, top: 4 }}>
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
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(label) => shortDay(String(label))}
                formatter={(value, name) => [
                  `${formatAmount(Number(value), 2)} CC`,
                  ` ${SERIES.find((s) => s.key === name)?.label ?? name}`,
                ]}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {active.map((s) => (
            <Bar
              key={s.key}
              isAnimationActive={false}
              dataKey={s.key}
              stackId="r"
              fill={`var(--color-${s.key})`}
              radius={s.key === last ? [4, 4, 0, 0] : undefined}
              maxBarSize={40}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </ChartFrame>
  )
}
