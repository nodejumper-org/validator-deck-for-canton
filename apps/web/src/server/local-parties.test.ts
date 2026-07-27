import type { LedgerClient } from "@canton/client"
import { beforeEach, expect, test, vi } from "vitest"
import { getLocalParties, invalidateLocalScan, startLocalScan } from "./local-parties"

type PartyRow = { party: string; isLocal: boolean; identityProviderId: string }

/** Fake ledger returning `pages` pages of 3 parties, exactly one local per page. */
function fakeLedger(pages: number, delayMs = 0) {
  const listParties = vi.fn(async ({ pageToken }: { pageToken?: string }) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
    const index = pageToken ? Number(pageToken) : 0
    const parties: PartyRow[] = [
      { party: `local-${index}::ns`, isLocal: true, identityProviderId: "" },
      { party: `remote-${index}a::other`, isLocal: false, identityProviderId: "" },
      { party: `remote-${index}b::other`, isLocal: false, identityProviderId: "" },
    ]
    return { parties, nextPageToken: index + 1 < pages ? String(index + 1) : "" }
  })
  return { client: { listParties } as unknown as LedgerClient, listParties }
}

beforeEach(() => {
  invalidateLocalScan("n1")
  invalidateLocalScan("n2")
})

test("reports idle before any scan is requested", () => {
  expect(getLocalParties("n1").status).toBe("idle")
})

test("collects only local parties across every page", async () => {
  const { client } = fakeLedger(3)
  startLocalScan("n1", client)
  await vi.waitFor(() => expect(getLocalParties("n1").status).toBe("ready"))

  const state = getLocalParties("n1")
  if (state.status !== "ready") throw new Error("expected ready")
  expect(state.parties.map((p) => p.party)).toEqual([
    "local-0::ns",
    "local-1::ns",
    "local-2::ns",
  ])
  expect(state.total).toBe(9)
  expect(state.scannedAt).toBeGreaterThan(0)
})

test("reports progress while scanning", async () => {
  const { client } = fakeLedger(3, 20)
  startLocalScan("n1", client)
  expect(getLocalParties("n1").status).toBe("scanning")
  await vi.waitFor(() => expect(getLocalParties("n1").status).toBe("ready"))
})

test("collapses concurrent scan requests into one pass", async () => {
  const { client, listParties } = fakeLedger(2, 10)
  startLocalScan("n1", client)
  startLocalScan("n1", client)
  startLocalScan("n1", client)
  await vi.waitFor(() => expect(getLocalParties("n1").status).toBe("ready"))
  // Two pages, walked exactly once despite three requests.
  expect(listParties).toHaveBeenCalledTimes(2)
})

test("keeps separate state per node", async () => {
  const a = fakeLedger(1)
  const b = fakeLedger(2)
  startLocalScan("n1", a.client)
  startLocalScan("n2", b.client)
  await vi.waitFor(() => {
    expect(getLocalParties("n1").status).toBe("ready")
    expect(getLocalParties("n2").status).toBe("ready")
  })
  const n1 = getLocalParties("n1")
  const n2 = getLocalParties("n2")
  if (n1.status !== "ready" || n2.status !== "ready") throw new Error("expected both ready")
  expect(n1.total).toBe(3)
  expect(n2.total).toBe(6)
})

test("surfaces a scan failure instead of hanging in scanning", async () => {
  const client = {
    listParties: vi.fn(async () => {
      throw new Error("ledger exploded")
    }),
  } as unknown as LedgerClient

  startLocalScan("n1", client)
  await vi.waitFor(() => expect(getLocalParties("n1").status).toBe("error"))

  const state = getLocalParties("n1")
  if (state.status !== "error") throw new Error("expected error")
  expect(state.message).toContain("ledger exploded")
})

test("a failed scan can be retried", async () => {
  const failing = {
    listParties: vi.fn(async () => {
      throw new Error("nope")
    }),
  } as unknown as LedgerClient
  startLocalScan("n1", failing)
  await vi.waitFor(() => expect(getLocalParties("n1").status).toBe("error"))

  const { client } = fakeLedger(1)
  startLocalScan("n1", client)
  await vi.waitFor(() => expect(getLocalParties("n1").status).toBe("ready"))
})
