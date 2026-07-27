import type { LedgerClient, PartyDetails } from "@canton/client"

export type LocalScanState =
  | { status: "idle" }
  | { status: "scanning"; progress: { pages: number; seen: number } }
  | { status: "ready"; parties: PartyDetails[]; total: number; scannedAt: number }
  | { status: "error"; message: string }

/** A completed scan stays fresh for this long before the route starts a new one. */
export const SCAN_TTL_MS = 5 * 60_000

/** The node caps pageSize at 10,000 (partyManagement.maxPartiesPageSize). */
const PAGE_SIZE = 10_000

type Entry = { state: LocalScanState; running: Promise<void> | null }

// Pinned to globalThis so Next's dev-mode module reloading does not lose a scan
// that is already in flight.
const globalForScan = globalThis as unknown as { __cantonScans?: Map<string, Entry> }
const scans = (globalForScan.__cantonScans ??= new Map<string, Entry>())

function entry(nodeId: string): Entry {
  let found = scans.get(nodeId)
  if (!found) {
    found = { state: { status: "idle" }, running: null }
    scans.set(nodeId, found)
  }
  return found
}

export function invalidateLocalScan(nodeId: string): void {
  scans.delete(nodeId)
}

export function getLocalParties(nodeId: string): LocalScanState {
  return entry(nodeId).state
}

export function isStale(state: LocalScanState): boolean {
  return state.status === "ready" && Date.now() - state.scannedAt > SCAN_TTL_MS
}

/**
 * Walks every page of the party list collecting the local ones.
 *
 * This is expensive by necessity: the devnet participant knows ~111,000 parties
 * of which 39 are local, and `filter-party` is a prefix match on the party ID
 * while local parties are identified by their namespace *suffix* — so the node
 * cannot filter them for us. That is 12 requests and roughly 70 seconds.
 *
 * So it runs detached and the caller polls `getLocalParties`. Concurrent callers
 * share the single in-flight pass rather than each starting their own.
 */
export function startLocalScan(nodeId: string, client: LedgerClient): void {
  const current = entry(nodeId)
  if (current.running) return

  current.state = { status: "scanning", progress: { pages: 0, seen: 0 } }

  current.running = (async () => {
    const parties: PartyDetails[] = []
    let pageToken = ""
    let pages = 0
    let seen = 0

    try {
      do {
        const page = await client.listParties({ pageSize: PAGE_SIZE, pageToken })
        pages += 1
        seen += page.parties.length
        for (const p of page.parties) if (p.isLocal) parties.push(p)
        pageToken = page.nextPageToken
        current.state = { status: "scanning", progress: { pages, seen } }
      } while (pageToken)

      current.state = { status: "ready", parties, total: seen, scannedAt: Date.now() }
    } catch (e) {
      current.state = { status: "error", message: e instanceof Error ? e.message : String(e) }
    } finally {
      current.running = null
    }
  })()
}
