import cron from "node-cron"
import { SCAN_TTL_MS, startLocalScan } from "./local-parties"
import { listAllNodes } from "./nodes"
import { getDb } from "./db"
import { partyScans } from "./schema"
import { eq } from "drizzle-orm"

/**
 * How often to look for nodes whose local-party set has gone stale. The sweep
 * itself takes about a minute per node, so this only decides how promptly a
 * stale result gets refreshed, not how often nodes are hammered — SCAN_TTL_MS
 * does that.
 */
const DEFAULT_CRON = "*/10 * * * *"

let started = false

async function needsScan(nodeId: string): Promise<boolean> {
  const db = await getDb()
  const [scan] = await db.select().from(partyScans).where(eq(partyScans.nodeId, nodeId)).limit(1)

  if (!scan) return true
  // Leave a scan that another process (or an earlier tick) is already running.
  if (scan.status === "scanning") return false
  if (scan.status === "ready") {
    const at = scan.scannedAt ?? scan.finishedAt
    return !at || Date.now() - at.getTime() > SCAN_TTL_MS
  }
  // idle, or a previous failure worth retrying.
  return true
}

async function sweep(): Promise<void> {
  const nodes = await listAllNodes()

  // Sequential on purpose: each scan is a long series of large requests, and
  // running every node at once would spike load on all of them together.
  for (const node of nodes) {
    try {
      if (await needsScan(node.id)) {
        await startLocalScan(node)
      }
    } catch (e) {
      console.error(`[scheduler] local-party scan failed for ${node.name}:`, e)
    }
  }
}

/**
 * Started from instrumentation.ts, once per server process.
 *
 * Set `PARTY_SCAN_CRON=off` to disable, or to any cron expression to change the
 * cadence.
 */
export function startScheduler(): void {
  if (started) return

  const expression = process.env.PARTY_SCAN_CRON ?? DEFAULT_CRON
  if (expression === "off") {
    console.log("[scheduler] party scans disabled (PARTY_SCAN_CRON=off)")
    return
  }
  if (!cron.validate(expression)) {
    console.error(`[scheduler] invalid PARTY_SCAN_CRON "${expression}", scheduler not started`)
    return
  }

  started = true
  cron.schedule(expression, () => {
    void sweep().catch((e) => console.error("[scheduler] sweep failed:", e))
  })
  console.log(`[scheduler] local-party scans scheduled (${expression})`)

  // Catch up shortly after boot rather than waiting for the first tick, but not
  // immediately — the server should finish starting first.
  setTimeout(() => {
    void sweep().catch((e) => console.error("[scheduler] initial sweep failed:", e))
  }, 15_000).unref()
}
