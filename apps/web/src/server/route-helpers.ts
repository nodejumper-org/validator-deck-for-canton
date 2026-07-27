import { CantonApiError } from "@canton/client"
import { ZodError } from "zod"

/** A failure this app decided on, as opposed to one the node reported. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "HttpError"
  }
}

/**
 * Upstream failures become 5xx on our side, never 4xx: a bad client secret is our
 * problem to fix, and returning 401 would make the browser think the operator's
 * own session expired.
 */
const CANTON_STATUS: Record<string, number> = {
  AUTH_FAILED: 502,
  TIMEOUT: 504,
  UNREACHABLE: 502,
  BAD_RESPONSE: 502,
}

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status })
}

function toResponse(e: unknown): Response {
  if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status)

  if (e instanceof CantonApiError) {
    const status =
      CANTON_STATUS[e.code] ?? (e.status && e.status >= 400 && e.status < 600 ? e.status : 502)
    return errorResponse(e.code, e.message, status)
  }

  if (e instanceof ZodError) {
    const message = e.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; ")
    return errorResponse("INVALID_INPUT", message, 400)
  }

  // Unexpected: log the detail server-side, return nothing that leaks paths.
  console.error("Unhandled route error:", e)
  return errorResponse("INTERNAL", "Something went wrong on the server", 500)
}

/**
 * Wraps a route handler so every response shares one shape: the payload on
 * success, `{ error: { code, message } }` on failure, 204 when there is nothing
 * to return. `Ctx` is supplied by the caller as Next 16's `RouteContext<'...'>`.
 */
export function handler<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      const result = await fn(req, ctx)
      if (result === undefined) return new Response(null, { status: 204 })
      return Response.json(result)
    } catch (e) {
      return toResponse(e)
    }
  }
}
