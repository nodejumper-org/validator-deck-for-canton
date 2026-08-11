import { CantonApiError } from "@validator-deck/canton-client"
import { expect, test } from "vitest"
import { z } from "zod"
import { handler, HttpError } from "./route-helpers"

const req = () => new Request("http://localhost/api/x")
const ctx = {}

async function body(res: Response) {
  return JSON.parse(await res.text()) as { error?: { code: string; message: string } }
}

test("wraps a successful result as JSON", async () => {
  const res = await handler(async () => ({ ok: true }))(req(), ctx)
  expect(res.status).toBe(200)
  expect(await body(res)).toEqual({ ok: true })
})

test("returns 204 for an undefined result", async () => {
  const res = await handler(async () => undefined)(req(), ctx)
  expect(res.status).toBe(204)
})

test("maps HttpError to its own status and code", async () => {
  const res = await handler(async () => {
    throw new HttpError(404, "NOT_FOUND", "Node not found")
  })(req(), ctx)
  expect(res.status).toBe(404)
  expect(await body(res)).toEqual({ error: { code: "NOT_FOUND", message: "Node not found" } })
})

test("maps a Canton timeout to 504", async () => {
  const res = await handler(async () => {
    throw new CantonApiError("TIMEOUT", "Request timed out")
  })(req(), ctx)
  expect(res.status).toBe(504)
  expect((await body(res)).error?.code).toBe("TIMEOUT")
})

test("maps a Canton auth failure to 502 so it is not mistaken for our own 401", async () => {
  const res = await handler(async () => {
    throw new CantonApiError("AUTH_FAILED", "invalid_client", { status: 401 })
  })(req(), ctx)
  expect(res.status).toBe(502)
  expect((await body(res)).error?.message).toContain("invalid_client")
})

test("preserves the upstream status for a Canton application error", async () => {
  const res = await handler(async () => {
    throw new CantonApiError("CANTON_ERROR", "INVALID_DAR: Dar file is corrupt", { status: 400 })
  })(req(), ctx)
  expect(res.status).toBe(400)
  expect((await body(res)).error?.message).toContain("Dar file is corrupt")
})

test("falls back to 502 when a Canton error carries no usable status", async () => {
  const res = await handler(async () => {
    throw new CantonApiError("CANTON_ERROR", "something upstream")
  })(req(), ctx)
  expect(res.status).toBe(502)
})

test("maps a Zod failure to 400 with readable field errors", async () => {
  const res = await handler(async () => {
    z.object({ name: z.string() }).parse({})
  })(req(), ctx)
  expect(res.status).toBe(400)
  const payload = await body(res)
  expect(payload.error?.code).toBe("INVALID_INPUT")
  expect(payload.error?.message).toContain("name")
})

test("maps an unknown error to 500 without leaking a stack trace", async () => {
  const res = await handler(async () => {
    throw new Error("boom at /Users/secret/path")
  })(req(), ctx)
  expect(res.status).toBe(500)
  const payload = await body(res)
  expect(payload.error?.code).toBe("INTERNAL")
  expect(payload.error?.message).not.toContain("/Users/secret")
})
