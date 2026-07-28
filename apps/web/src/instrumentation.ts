/**
 * Runs once per server process, before the first request is served.
 *
 * The runtime check matters: this file is also evaluated for the edge runtime,
 * where node-cron and the pg driver do not exist.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { startScheduler } = await import("./server/scheduler")
  startScheduler()
}
