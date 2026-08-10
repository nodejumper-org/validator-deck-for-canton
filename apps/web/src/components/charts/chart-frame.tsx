"use client"

import type { ReactNode } from "react"
import { DataPanel, EmptyState } from "@/components/data-panel"

/**
 * Every dashboard chart sits in this frame, which owns the one thing charts get
 * wrong most often: what to draw when there is no data. An empty axis pair reads
 * as "broken"; a sentence reads as "nothing happened yet".
 */
export function ChartFrame({
  title,
  description,
  isEmpty,
  emptyTitle,
  emptyHint,
  isLoading,
  error,
  children,
}: {
  title: string
  description?: string
  isEmpty: boolean
  emptyTitle: string
  emptyHint?: string
  isLoading?: boolean
  error?: { message: string } | null
  children: ReactNode
}) {
  return (
    <DataPanel title={title} description={description} isLoading={isLoading} error={error}>
      {isEmpty ? <EmptyState title={emptyTitle} hint={emptyHint} /> : children}
    </DataPanel>
  )
}

/** Shortens an ISO day to "Jul 24" for axis ticks. */
export function shortDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

/** Compact CC figures for axis ticks: 8.5k rather than 8,472.3319. */
export function compactCC(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toFixed(0)
}

/**
 * Series that actually have a value somewhere in the range.
 *
 * A plain collecting validator never sends CC and never earns app or SV rewards,
 * so without this both charts render a three-item legend that is permanently
 * two-thirds empty. Dropping the dead series is what lets them degrade to one
 * clean bar instead.
 */
export function activeSeries<T, S extends { key: keyof T & string }>(
  series: readonly S[],
  data: T[],
): S[] {
  return series.filter((s) => data.some((d) => Number(d[s.key]) > 0))
}
