import { expect, test } from "vitest"
import { activeSeries } from "./chart-series"

type Row = { received: number; sent: number; fees: number }

const SERIES = [
  { key: "received", label: "Received" },
  { key: "sent", label: "Sent" },
  { key: "fees", label: "Holding fees" },
] as const

const keys = (rows: Row[]) => activeSeries(SERIES, rows).map((s) => s.key)

test("drops a series that is zero across the whole range", () => {
  const rows = [
    { received: 5, sent: 0, fees: 0.1 },
    { received: 3, sent: 0, fees: 0.2 },
  ]
  expect(keys(rows)).toEqual(["received", "fees"])
})

test("keeps a series with a single non-zero point", () => {
  const rows = [
    { received: 0, sent: 0, fees: 0 },
    { received: 0, sent: 1, fees: 0 },
  ]
  expect(keys(rows)).toEqual(["sent"])
})

test("no data means no active series", () => {
  expect(keys([])).toEqual([])
})

test("preserves the declared series order", () => {
  expect(keys([{ received: 1, sent: 2, fees: 3 }])).toEqual(["received", "sent", "fees"])
})
