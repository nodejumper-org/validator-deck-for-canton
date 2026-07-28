import { sql } from "drizzle-orm"
import { getDb } from "@/server/db"

/**
 * Liveness + readiness for compose healthchecks and reverse proxies.
 *
 * Deliberately unauthenticated and deliberately *not* wrapped in `authed()` — an
 * orchestrator has no session. It reports nothing an anonymous caller could not
 * already infer from the app being reachable.
 *
 * It does touch the database, because a web process that cannot reach Postgres
 * is not actually ready to serve.
 */
export async function GET(): Promise<Response> {
  try {
    const db = await getDb()
    await db.execute(sql`select 1`)
    return Response.json({ status: "ok" })
  } catch (e) {
    console.error("[health] database unreachable:", e)
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503 })
  }
}
