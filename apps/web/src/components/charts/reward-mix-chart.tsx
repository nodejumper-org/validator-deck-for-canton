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
import { formatAmount } from "@/lib/format"

/** Three series, so a legend is mandatory — identity is never colour alone. */
const config = {
  app: { label: "App", color: "var(--chart-3)" },
  validator: { label: "Validator", color: "var(--chart-1)" },
  sv: { label: "SV", color: "var(--chart-2)" },
}

export function RewardMixChart({
  data,
  isLoading,
}: {
  data: { date: string; app: number; validator: number; sv: number }[]
  isLoading?: boolean
}) {
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
                  ` ${config[name as keyof typeof config]?.label ?? name}`,
                ]}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {/* 2px surface gap between stacked segments, per the mark spec. */}
          <Bar isAnimationActive={false} dataKey="app" stackId="r" fill="var(--color-app)" maxBarSize={40} />
          <Bar isAnimationActive={false} dataKey="validator" stackId="r" fill="var(--color-validator)" maxBarSize={40} />
          <Bar isAnimationActive={false}
            dataKey="sv"
            stackId="r"
            fill="var(--color-sv)"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ChartContainer>
    </ChartFrame>
  )
}
