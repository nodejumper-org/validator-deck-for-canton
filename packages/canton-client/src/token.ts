import { CantonApiError } from "./errors"

export type OidcConfig = {
  tokenUrl: string
  clientId: string
  clientSecret: string
  audience?: string | undefined
  scope?: string | undefined
}

type CacheEntry = { token: string; expiresAt: number }

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<string>>()

/** Refresh this many ms before the provider's stated expiry. Devnet tokens live 300s. */
const EXPIRY_MARGIN_MS = 60_000

export function clearTokenCache(key?: string): void {
  if (key === undefined) {
    cache.clear()
    inflight.clear()
    return
  }
  cache.delete(key)
  inflight.delete(key)
}

async function fetchToken(
  cfg: OidcConfig,
  fetchImpl: typeof fetch,
  now: () => number,
): Promise<CacheEntry> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  })
  if (cfg.audience) body.set("audience", cfg.audience)
  if (cfg.scope) body.set("scope", cfg.scope)

  let res: Response
  try {
    res = await fetchImpl(cfg.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (e) {
    throw new CantonApiError("UNREACHABLE", `Token endpoint unreachable: ${String(e)}`, { cause: e })
  }

  const text = await res.text()
  if (!res.ok) {
    throw new CantonApiError("AUTH_FAILED", `Token request failed (${res.status}): ${text}`, {
      status: res.status,
    })
  }

  let payload: { access_token?: unknown; expires_in?: unknown }
  try {
    payload = JSON.parse(text) as typeof payload
  } catch (e) {
    throw new CantonApiError("BAD_RESPONSE", "Token endpoint returned invalid JSON", { cause: e })
  }
  if (typeof payload.access_token !== "string") {
    throw new CantonApiError("BAD_RESPONSE", "Token response had no access_token")
  }

  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 300
  return { token: payload.access_token, expiresAt: now() + expiresIn * 1000 - EXPIRY_MARGIN_MS }
}

export function createTokenProvider(
  key: string,
  cfg: OidcConfig,
  deps: { fetchImpl?: typeof fetch; now?: () => number } = {},
): () => Promise<string> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch
  const now = deps.now ?? Date.now

  return async function getToken(): Promise<string> {
    const hit = cache.get(key)
    if (hit && hit.expiresAt > now()) return hit.token

    const pending = inflight.get(key)
    if (pending) return pending

    const promise = fetchToken(cfg, fetchImpl, now)
      .then((entry) => {
        cache.set(key, entry)
        return entry.token
      })
      .finally(() => {
        inflight.delete(key)
      })

    inflight.set(key, promise)
    return promise
  }
}
