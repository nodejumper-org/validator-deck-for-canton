"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartFrame, compactCC, shortDay } from "@/components/charts/chart-frame"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { formatAmount } from "@/lib/format"

const config = {
  net: { label: "Received", color: "var(--chart-3)" },
}

/**
 * One series, so no legend — the panel title names it. Amber matches the CC
 * figures elsewhere in the app.
 */
export function WalletActivityChart({
  data,
  isLoading,
}: {
  data: { date: string; net: number }[]
  isLoading?: boolean
}) {
  return (
    <ChartFrame
      title="Wallet activity"
      description="CC received per day across all validators."
      isEmpty={data.length === 0}
      emptyTitle="No wallet activity"
      emptyHint="Register a node with a validator API to see its wallet flow."
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
                formatter={(value) => [`${formatAmount(Number(value), 2)} CC`, " Received"]}
              />
            }
          />
          <Bar isAnimationActive={false} dataKey="net" fill="var(--color-net)" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ChartContainer>
    </ChartFrame>
  )
}
