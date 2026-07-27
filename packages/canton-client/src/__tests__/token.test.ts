import { beforeEach, expect, test } from "vitest"
import { clearTokenCache, createTokenProvider } from "../token.js"
import { asFetch, callAt, fetchSpy, jsonResponse, rejection } from "./helpers.js"

const cfg = {
  tokenUrl: "https://kc.example/realms/x/protocol/openid-connect/token",
  clientId: "svc",
  clientSecret: "sh",
  audience: "https://validator.example",
  scope: "daml_ledger_api",
}

const tokenResponse = (value: string, expiresIn = 300) =>
  jsonResponse({ access_token: value, expires_in: expiresIn, token_type: "Bearer" })

beforeEach(() => clearTokenCache())

test("posts client_credentials form and returns the access token", async () => {
  const spy = fetchSpy(async () => tokenResponse("abc"))
  const get = createTokenProvider("node-1", cfg, { fetchImpl: asFetch(spy) })
  expect(await get()).toBe("abc")

  const [url, init] = callAt(spy)
  expect(url).toBe(cfg.tokenUrl)
  expect(init.method).toBe("POST")
  const body = new URLSearchParams(init.body as string)
  expect(body.get("grant_type")).toBe("client_credentials")
  expect(body.get("client_id")).toBe("svc")
  expect(body.get("client_secret")).toBe("sh")
  expect(body.get("audience")).toBe("https://validator.example")
  expect(body.get("scope")).toBe("daml_ledger_api")
})

test("reuses a cached token instead of refetching", async () => {
  const spy = fetchSpy(async () => tokenResponse("abc"))
  const get = createTokenProvider("node-1", cfg, { fetchImpl: asFetch(spy) })
  await get()
  await get()
  expect(spy).toHaveBeenCalledTimes(1)
})

test("refetches once the token is within 60s of expiry", async () => {
  let now = 1_000_000
  const spy = fetchSpy(async () => tokenResponse("unused"))
  spy.mockResolvedValueOnce(tokenResponse("first", 300))
  spy.mockResolvedValueOnce(tokenResponse("second", 300))

  const get = createTokenProvider("node-1", cfg, {
    fetchImpl: asFetch(spy),
    now: () => now,
  })
  expect(await get()).toBe("first")
  now += 239_000 // still inside the 300-60 window
  expect(await get()).toBe("first")
  now += 2_000 // now past it
  expect(await get()).toBe("second")
  expect(spy).toHaveBeenCalledTimes(2)
})

test("collapses concurrent requests into a single fetch", async () => {
  const spy = fetchSpy(async () => tokenResponse("abc"))
  const get = createTokenProvider("node-1", cfg, { fetchImpl: asFetch(spy) })
  await Promise.all([get(), get(), get()])
  expect(spy).toHaveBeenCalledTimes(1)
})

test("caches per key so two nodes do not share a token", async () => {
  const spy = fetchSpy(async () => tokenResponse("unused"))
  spy.mockResolvedValueOnce(tokenResponse("a"))
  spy.mockResolvedValueOnce(tokenResponse("b"))
  const one = createTokenProvider("node-1", cfg, { fetchImpl: asFetch(spy) })
  const two = createTokenProvider("node-2", cfg, { fetchImpl: asFetch(spy) })
  expect(await one()).toBe("a")
  expect(await two()).toBe("b")
})

test("raises AUTH_FAILED when the provider rejects the credentials", async () => {
  const spy = fetchSpy(async () => jsonResponse({ error: "invalid_client" }, 401))
  const get = createTokenProvider("node-1", cfg, { fetchImpl: asFetch(spy) })
  const err = await rejection(get())
  expect(err.code).toBe("AUTH_FAILED")
  expect(err.message).toContain("invalid_client")
})

test("does not cache a failed attempt", async () => {
  const spy = fetchSpy(async () => tokenResponse("unused"))
  spy.mockResolvedValueOnce(new Response("nope", { status: 500 }))
  spy.mockResolvedValueOnce(tokenResponse("ok"))
  const get = createTokenProvider("node-1", cfg, { fetchImpl: asFetch(spy) })
  await get().catch(() => {})
  expect(await get()).toBe("ok")
})

test("clearTokenCache(key) drops only that node's token", async () => {
  const spy = fetchSpy(async () => tokenResponse("unused"))
  spy.mockResolvedValueOnce(tokenResponse("a1"))
  spy.mockResolvedValueOnce(tokenResponse("b1"))
  spy.mockResolvedValueOnce(tokenResponse("a2"))

  const one = createTokenProvider("node-1", cfg, { fetchImpl: asFetch(spy) })
  const two = createTokenProvider("node-2", cfg, { fetchImpl: asFetch(spy) })
  expect(await one()).toBe("a1")
  expect(await two()).toBe("b1")

  clearTokenCache("node-1")
  expect(await one()).toBe("a2")
  expect(await two()).toBe("b1") // untouched
})
