import type { LedgerClient } from "@canton/client"
import { beforeAll, beforeEach, expect, test, vi } from "vitest"
import { getDb, resetDbForTests } from "./db"
import { getLocalParties, invalidateLocalScan, isStale, startLocalScan } from "./local-parties"
import { createNode } from "./nodes"
import { localParties } from "./schema"
import { createTestUser } from "./test-support"

beforeAll(() => {
  process.env.APP_SECRET = "c".repeat(64)
  process.env.DATABASE_URL = "pglite://memory"
})

const nodeInput = {
  name: "devnet-1",
  network: "devnet" as const,
  ledgerApiUrl: "https://ledger.example",
  authTokenUrl: "https://kc.example/token",
  authClientId: "svc",
  authClientSecret: "shhh",
  validatorApiUrl: undefined,
}

let owner: string
let nodeId: string

beforeEach(async () => {
  resetDbForTests()
  owner = await createTestUser()
  const node = await createNode(nodeInput, owner)
  nodeId = node.id
})

/** The persisted row, which is what startLocalScan actually needs. */
async function nodeRow() {
  const { getNode } = await import("./nodes")
  return (await getNode(nodeId, owner))!
}

/** Fake ledger returning `pages` pages of 3 parties, exactly one local per page. */
function fakeLedger(pages: number, delayMs = 0) {
  const listParties = vi.fn(async ({ pageToken }: { pageToken?: string }) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
    const index = pageToken ? Number(pageToken) : 0
    return {
      parties: [
        { party: `local-${index}::ns`, isLocal: true, identityProviderId: "" },
        { party: `remote-${index}a::other`, isLocal: false, identityProviderId: "" },
        { party: `remote-${index}b::other`, isLocal: false, identityProviderId: "" },
      ],
      nextPageToken: index + 1 < pages ? String(index + 1) : "",
    }
  })
  return { client: { listParties } as unknown as LedgerClient, listParties }
}

async function waitForReady() {
  await vi.waitFor(async () => expect((await getLocalParties(nodeId, owner)).status).toBe("ready"), {
    timeout: 5000,
  })
}

test("reports idle before any scan has run", async () => {
  expect((await getLocalParties(nodeId, owner)).status).toBe("idle")
})

test("persists only the local parties across every page", async () => {
  const { client } = fakeLedger(3)
  await startLocalScan(await nodeRow(), client)
  await waitForReady()

  const state = await getLocalParties(nodeId, owner)
  if (state.status !== "ready") throw new Error("expected ready")
  expect(state.parties.map((p) => p.party)).toEqual([
    "local-0::ns",
    "local-1::ns",
    "local-2::ns",
  ])
  expect(state.total).toBe(9)
  expect(state.scannedAt).toBeGreaterThan(0)
})

test("survives a process restart because the result is in the database", async () => {
  const { client } = fakeLedger(2)
  await startLocalScan(await nodeRow(), client)
  await waitForReady()

  // A new module registry, as after a restart — the answer still comes back.
  vi.resetModules()
  const fresh = await import("./local-parties")
  const state = await fresh.getLocalParties(nodeId, owner)
  expect(state.status).toBe("ready")
})

test("reports progress while scanning", async () => {
  const { client } = fakeLedger(3, 30)
  await startLocalScan(await nodeRow(), client)
  expect((await getLocalParties(nodeId, owner)).status).toBe("scanning")
  await waitForReady()
})

test("collapses concurrent scan requests into one pass", async () => {
  const { client, listParties } = fakeLedger(2, 20)
  const row = await nodeRow()
  await Promise.all([startLocalScan(row, client), startLocalScan(row, client), startLocalScan(row, client)])
  await waitForReady()
  expect(listParties).toHaveBeenCalledTimes(2)
})

test("a rescan drops parties that are no longer local", async () => {
  const first = fakeLedger(2)
  await startLocalScan(await nodeRow(), first.client)
  await waitForReady()
  expect((await getLocalParties(nodeId, owner)).status).toBe("ready")

  // Second run reports only one page, so local-1 is gone.
  await invalidateLocalScan(nodeId)
  const second = fakeLedger(1)
  await startLocalScan(await nodeRow(), second.client)
  await waitForReady()

  const state = await getLocalParties(nodeId, owner)
  if (state.status !== "ready") throw new Error("expected ready")
  expect(state.parties.map((p) => p.party)).toEqual(["local-0::ns"])
})

test("a rescan keeps firstSeenAt for parties it already knew", async () => {
  const db = await getDb()

  await startLocalScan(await nodeRow(), fakeLedger(1).client)
  await waitForReady()
  const [before] = await db.select().from(localParties)

  await invalidateLocalScan(nodeId)
  await startLocalScan(await nodeRow(), fakeLedger(1).client)
  await waitForReady()
  const [after] = await db.select().from(localParties)

  expect(after!.firstSeenAt.getTime()).toBe(before!.firstSeenAt.getTime())
  expect(after!.lastSeenAt.getTime()).toBeGreaterThanOrEqual(before!.lastSeenAt.getTime())
})

test("surfaces a scan failure instead of hanging in scanning", async () => {
  const client = {
    listParties: vi.fn(async () => {
      throw new Error("ledger exploded")
    }),
  } as unknown as LedgerClient

  await startLocalScan(await nodeRow(), client)
  await vi.waitFor(async () =>
    expect((await getLocalParties(nodeId, owner)).status).toBe("error"),
  )

  const state = await getLocalParties(nodeId, owner)
  if (state.status !== "error") throw new Error("expected error")
  expect(state.message).toContain("ledger exploded")
})

test("a failed scan can be retried", async () => {
  const failing = {
    listParties: vi.fn(async () => {
      throw new Error("nope")
    }),
  } as unknown as LedgerClient

  await startLocalScan(await nodeRow(), failing)
  await vi.waitFor(async () =>
    expect((await getLocalParties(nodeId, owner)).status).toBe("error"),
  )

  await startLocalScan(await nodeRow(), fakeLedger(1).client)
  await waitForReady()
})

test("another user cannot read a node's local parties", async () => {
  await startLocalScan(await nodeRow(), fakeLedger(1).client)
  await waitForReady()

  const intruder = await createTestUser()
  expect((await getLocalParties(nodeId, intruder)).status).toBe("idle")
})

test("a fresh result is not stale, an old one is", () => {
  const now = Date.now()
  expect(isStale({ status: "ready", parties: [], total: 0, scannedAt: now })).toBe(false)
  expect(
    isStale({ status: "ready", parties: [], total: 0, scannedAt: now - 60 * 60_000 }),
  ).toBe(true)
  expect(isStale({ status: "idle" })).toBe(false)
})
