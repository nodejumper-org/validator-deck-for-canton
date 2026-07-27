import type { ZodType } from "zod"
import { CantonApiError } from "./errors.js"

export type HttpOptions = {
  baseUrl: string
  getToken: () => Promise<string>
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export type Http = {
  json<T>(schema: ZodType<T>, path: string, init?: RequestInit): Promise<T>
  binary(path: string, body: Uint8Array, init?: RequestInit): Promise<unknown>
}

/** Canton returns this shape for application-level failures. */
type CantonErrorBody = { code?: string; cause?: string; correlationId?: string | null }

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`
}

async function readError(res: Response): Promise<CantonApiError> {
  const raw = await res.text().catch(() => "")
  let parsed: CantonErrorBody | undefined
  try {
    parsed = raw ? (JSON.parse(raw) as CantonErrorBody) : undefined
  } catch {
    parsed = undefined
  }

  if (res.status === 401 || res.status === 403) {
    return new CantonApiError("AUTH_FAILED", parsed?.cause ?? raw ?? res.statusText, {
      status: res.status,
      correlationId: parsed?.correlationId ?? undefined,
    })
  }

  const message = parsed?.cause ?? raw ?? res.statusText
  return new CantonApiError(
    "CANTON_ERROR",
    parsed?.code ? `${parsed.code}: ${message}` : message,
    { status: res.status, correlationId: parsed?.correlationId ?? undefined },
  )
}

function toTransportError(e: unknown): CantonApiError {
  if (e instanceof CantonApiError) return e
  // Node's AbortSignal.timeout raises TimeoutError; a manual abort raises AbortError.
  if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
    return new CantonApiError("TIMEOUT", "Request timed out", { cause: e })
  }
  return new CantonApiError("UNREACHABLE", e instanceof Error ? e.message : String(e), { cause: e })
}

export function createHttp(opts: HttpOptions): Http {
  const doFetch = opts.fetchImpl ?? globalThis.fetch
  const timeoutMs = opts.timeoutMs ?? 10_000

  async function send(path: string, init: RequestInit): Promise<Response> {
    const token = await opts.getToken()
    const headers = new Headers(init.headers)
    headers.set("authorization", `Bearer ${token}`)
    try {
      const res = await doFetch(joinUrl(opts.baseUrl, path), {
        ...init,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) throw await readError(res)
      return res
    } catch (e) {
      throw toTransportError(e)
    }
  }

  return {
    async json<T>(schema: ZodType<T>, path: string, init: RequestInit = {}): Promise<T> {
      const res = await send(path, init)
      const text = await res.text()
      let payload: unknown
      try {
        payload = text ? JSON.parse(text) : {}
      } catch (e) {
        throw new CantonApiError("BAD_RESPONSE", "Response was not valid JSON", { cause: e })
      }
      const parsed = schema.safeParse(payload)
      if (!parsed.success) {
        throw new CantonApiError(
          "BAD_RESPONSE",
          `Unexpected response shape for ${path}: ${parsed.error.issues
            .map((i) => `${i.path.join(".")} ${i.message}`)
            .join("; ")}`,
          { cause: parsed.error },
        )
      }
      return parsed.data
    },

    async binary(path: string, body: Uint8Array, init: RequestInit = {}): Promise<unknown> {
      const headers = new Headers(init.headers)
      headers.set("content-type", "application/octet-stream")
      const res = await send(path, {
        ...init,
        method: init.method ?? "POST",
        body: body as unknown as BodyInit,
        headers,
      })
      const text = await res.text()
      return text ? JSON.parse(text) : {}
    },
  }
}
