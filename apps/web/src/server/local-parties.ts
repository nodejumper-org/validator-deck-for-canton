import type { LedgerClient } from "@canton/client"
import { and, eq, lt, sql } from "drizzle-orm"
import type { LocalScanState } from "@/lib/types"
import { ledgerForNode } from "./client"
import { getDb } from "./db"
import { getNode } from "./nodes"
import { localParties, partyScans, type NodeRecord } from "./schema"

/** A completed scan is considered fresh for this long. */
export const SCAN_TTL_MS = 30 * 60_000

/** The node caps pageSize at 10,000 (partyManagement.maxPartiesPageSize). */
const PAGE_SIZE = 10_000

/**
 * In-flight scans for this process. The database records *that* a scan is
 * running; this map stops the same process starting a second one. A second
 * process would see `status = 'scanning'` and leave it alone.
 */
const running = new Map<string, Promise<void>>()

async function readScan(nodeId: string) {
  const db = await getDb()
  const [row] = await db.select().from(partyScans).where(eq(partyScans.nodeId, nodeId)).limit(1)
  return row
}

/**
 * The persisted view of a node's local parties.
 *
 * Reads come from the database, so a restart, a second server instance, or the
 * scheduler all see the same answer, and the page is instant even though
 * producing that answer takes about a minute.
 */
export async function getLocalParties(nodeId: string, ownerId: string): Promise<LocalScanState> {
  const node = await getNode(nodeId, ownerId)
  if (!node) return { status: "idle" }

  const scan = await readScan(nodeId)
  if (!scan || scan.status === "idle") return { status: "idle" }

  if (scan.status === "scanning") {
    return {
      status: "scanning",
      progress: { pages: scan.pagesScanned, seen: scan.partiesSeen },
    }
  }

  if (scan.status === "error") {
    return { status: "error", message: scan.error ?? "Scan failed" }
  }

  const db = await getDb()
  const rows = await db
    .select()
    .from(localParties)
    .where(eq(localParties.nodeId, nodeId))
    .orderBy(localParties.party)

  return {
    status: "ready",
    parties: rows.map((r) => ({
      party: r.party,
      isLocal: true,
      identityProviderId: r.identityProviderId,
    })),
    total: scan.partiesSeen,
    scannedAt: (scan.scannedAt ?? scan.finishedAt ?? new Date()).getTime(),
  }
}

export function isStale(state: LocalScanState): boolean {
  return state.status === "ready" && Date.now() - state.scannedAt > SCAN_TTL_MS
}

/** Drops the stored result so the next read starts a fresh scan. */
export async function invalidateLocalScan(nodeId: string): Promise<void> {
  const db = await getDb()
  await db
    .insert(partyScans)
    .values({ nodeId, status: "idle" })
    .onConflictDoUpdate({
      target: partyScans.nodeId,
      set: { status: "idle", scannedAt: null, error: null },
    })
}

/**
 * Walks every page of the party list, storing the local ones.
 *
 * Expensive by necessity: the devnet participant knows ~111,000 parties of which
 * 39 are local, and `filter-party` is a prefix match on the party ID while local
 * parties are identified by their namespace *suffix* — so the node cannot filter
 * them for us. That is 12 requests and roughly 70 seconds.
 *
 * Runs detached; callers poll `getLocalParties`. Concurrent callers in this
 * process share the single in-flight pass.
 */
export function startLocalScan(node: NodeRecord, client?: LedgerClient): Promise<void> {
  // Reserving the slot must happen with no await in between, or concurrent
  // callers all pass this check before any of them registers.
  if (running.has(node.id)) return Promise.resolve()

  let marked: () => void = () => {}
  // Resolves once the scan is *recorded* as running, not when it finishes — the
  // caller needs to return promptly while the sweep continues in the background.
  const markedRunning = new Promise<void>((resolve) => {
    marked = resolve
  })

  const ledger = client ?? ledgerForNode(node)

  const task = (async () => {
    const db = await getDb()
    const startedAt = new Date()

    await db
      .insert(partyScans)
      .values({
        nodeId: node.id,
        status: "scanning",
        pagesScanned: 0,
        partiesSeen: 0,
        error: null,
        startedAt,
      })
      .onConflictDoUpdate({
        target: partyScans.nodeId,
        set: { status: "scanning", pagesScanned: 0, partiesSeen: 0, error: null, startedAt },
      })
    marked()

    let pageToken = ""
    let pages = 0
    let seen = 0
    const found: { party: string; identityProviderId: string }[] = []

    try {
      do {
        const page = await ledger.listParties({ pageSize: PAGE_SIZE, pageToken })
        pages += 1
        seen += page.parties.length
        for (const p of page.parties) {
          if (p.isLocal) found.push({ party: p.party, identityProviderId: p.identityProviderId })
        }
        pageToken = page.nextPageToken

        await db
          .update(partyScans)
          .set({ pagesScanned: pages, partiesSeen: seen })
          .where(eq(partyScans.nodeId, node.id))
      } while (pageToken)

      const finishedAt = new Date()

      // Upsert keeps firstSeenAt for parties we already knew, then anything not
      // touched by this run is no longer local and gets removed.
      if (found.length > 0) {
        await db
          .insert(localParties)
          .values(
            found.map((f) => ({
              nodeId: node.id,
              party: f.party,
              identityProviderId: f.identityProviderId,
              firstSeenAt: finishedAt,
              lastSeenAt: finishedAt,
            })),
          )
          .onConflictDoUpdate({
            target: [localParties.nodeId, localParties.party],
            set: {
              identityProviderId: sql`excluded.identity_provider_id`,
              lastSeenAt: finishedAt,
            },
          })
      }

      await db
        .delete(localParties)
        .where(and(eq(localParties.nodeId, node.id), lt(localParties.lastSeenAt, finishedAt)))

      await db
        .update(partyScans)
        .set({
          status: "ready",
          pagesScanned: pages,
          partiesSeen: seen,
          localCount: found.length,
          error: null,
          finishedAt,
          scannedAt: finishedAt,
        })
        .where(eq(partyScans.nodeId, node.id))
    } catch (e) {
      await db
        .update(partyScans)
        .set({
          status: "error",
          error: e instanceof Error ? e.message : String(e),
          finishedAt: new Date(),
        })
        .where(eq(partyScans.nodeId, node.id))
    } finally {
      marked()
      running.delete(node.id)
    }
  })()

  running.set(node.id, task)
  // Never let an unobserved rejection take the process down.
  void task.catch(() => {})
  return markedRunning
}

/** Convenience for routes, which hold an id and a session rather than a row. */
export async function startLocalScanFor(nodeId: string, ownerId: string): Promise<void> {
  const node = await getNode(nodeId, ownerId)
  if (node) await startLocalScan(node)
}
