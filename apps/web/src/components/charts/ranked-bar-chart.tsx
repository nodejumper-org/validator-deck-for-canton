"use client"

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { ChartFrame } from "@/components/charts/chart-frame"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

/**
 * Horizontal bars for ranked categories with long labels — right-to-left reading
 * of a category name is what vertical bars get wrong. One series, so no legend;
 * values are direct-labelled at the bar end instead of needing an axis lookup.
 */
export function RankedBarChart({
  title,
  description,
  data,
  valueLabel,
  emptyTitle,
  emptyHint,
  isLoading,
}: {
  title: string
  description?: string
  /** Pre-sorted, highest first. */
  data: { label: string; value: number }[]
  valueLabel: string
  emptyTitle: string
  emptyHint?: string
  isLoading?: boolean
}) {
  const config = { value: { label: valueLabel, color: "var(--chart-1)" } }

  // Category labels are mono at 11px; too narrow an axis silently clips them
  // (e.g. "ParticipantAdmin" losing its P), so size to the longest label.
  const axisWidth = Math.min(
    210,
    Math.max(96, ...data.map((d) => Math.round(d.label.length * 7.2) + 12)),
  )

  return (
    <ChartFrame
      title={title}
      description={description}
      isEmpty={data.length === 0}
      emptyTitle={emptyTitle}
      emptyHint={emptyHint}
      isLoading={isLoading}
    >
      <ChartContainer
        config={config}
        className="w-full"
        style={{ height: `${Math.max(160, data.length * 26 + 24)}px` }}
      >
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 28, top: 4 }}>
          <CartesianGrid horizontal={false} strokeOpacity={0.25} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={axisWidth}
            tickMargin={6}
            className="ident"
          />
          <ChartTooltip
            content={<ChartTooltipContent formatter={(v) => [` ${v}`, ` ${valueLabel}`]} />}
          />
          <Bar isAnimationActive={false} dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} barSize={14}>
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              className="fill-muted-foreground"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartFrame>
  )
}
