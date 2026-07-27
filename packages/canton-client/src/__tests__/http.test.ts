import { expect, test } from "vitest"
import { z } from "zod"
import { CantonApiError } from "../errors"
import { createHttp } from "../http"
import { asFetch, callAt, fetchSpy, jsonResponse, rejection } from "./helpers"

const schema = z.object({ version: z.string() })
const token = async () => "tok-123"

function http(spy: ReturnType<typeof fetchSpy>, timeoutMs = 5000) {
  return createHttp({
    baseUrl: "https://ledger.example",
    getToken: token,
    fetchImpl: asFetch(spy),
    timeoutMs,
  })
}

test("sends bearer token and parses the response", async () => {
  const spy = fetchSpy(async () => jsonResponse({ version: "3.5.8" }))
  const result = await http(spy).json(schema, "/v2/version")
  expect(result).toEqual({ version: "3.5.8" })

  const [url, init] = callAt(spy)
  expect(url).toBe("https://ledger.example/v2/version")
  expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok-123")
})

test("joins base url and path without doubling slashes", async () => {
  const spy = fetchSpy(async () => jsonResponse({ version: "1" }))
  const h = createHttp({
    baseUrl: "https://ledger.example/",
    getToken: token,
    fetchImpl: asFetch(spy),
  })
  await h.json(schema, "/v2/version")
  expect(callAt(spy)[0]).toBe("https://ledger.example/v2/version")
})

test("maps a Canton error body to CANTON_ERROR preserving cause and correlationId", async () => {
  const spy = fetchSpy(async () =>
    jsonResponse(
      {
        code: "INVALID_DAR",
        cause: "Dar file is corrupt",
        correlationId: "c4149187ed16747bb72091207b86ce38",
      },
      400,
    ),
  )
  const err = await rejection(http(spy).json(schema, "/v2/dars"))

  expect(err).toBeInstanceOf(CantonApiError)
  expect(err.code).toBe("CANTON_ERROR")
  expect(err.status).toBe(400)
  expect(err.message).toContain("Dar file is corrupt")
  expect(err.correlationId).toBe("c4149187ed16747bb72091207b86ce38")
})

test("maps 401 to AUTH_FAILED", async () => {
  const spy = fetchSpy(async () => new Response("Unauthorized", { status: 401 }))
  const err = await rejection(http(spy).json(schema, "/v2/version"))
  expect(err.code).toBe("AUTH_FAILED")
})

test("maps an aborted request to TIMEOUT", async () => {
  const spy = fetchSpy(async () => {
    throw Object.assign(new Error("aborted"), { name: "AbortError" })
  })
  const err = await rejection(http(spy).json(schema, "/v2/version"))
  expect(err.code).toBe("TIMEOUT")
})

test("maps a network failure to UNREACHABLE", async () => {
  const spy = fetchSpy(async () => {
    throw new TypeError("fetch failed")
  })
  const err = await rejection(http(spy).json(schema, "/v2/version"))
  expect(err.code).toBe("UNREACHABLE")
})

test("maps a schema mismatch to BAD_RESPONSE", async () => {
  const spy = fetchSpy(async () => jsonResponse({ nope: 1 }))
  const err = await rejection(http(spy).json(schema, "/v2/version"))
  expect(err.code).toBe("BAD_RESPONSE")
})

test("posts binary bodies as octet-stream", async () => {
  const spy = fetchSpy(async () => jsonResponse({}))
  await http(spy).binary("/v2/dars", new Uint8Array([1, 2, 3]))
  const [, init] = callAt(spy)
  expect(init.method).toBe("POST")
  expect(new Headers(init.headers).get("content-type")).toBe("application/octet-stream")
})
