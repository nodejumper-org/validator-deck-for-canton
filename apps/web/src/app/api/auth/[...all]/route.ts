import { getAuth } from "@/server/auth"

// The auth instance is built lazily (the database handle is async), so the
// handler is resolved per request rather than at module load.
async function handle(req: Request): Promise<Response> {
  const auth = await getAuth()
  return auth.handler(req)
}

export const GET = handle
export const POST = handle
