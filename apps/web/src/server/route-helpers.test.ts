import { CantonApiError } from "@validator-deck/canton-client"
import { beforeAll, beforeEach, expect, test, vi } from "vitest"
import { z } from "zod"
import { getAuth, resetAuthForTests } from "./auth"
import { resetDbForTests } from "./db"
import { adminOnly, handler, HttpError } from "./route-helpers"

beforeAll(() => {
  process.env.APP_SECRET = "e".repeat(64)
  process.env.DATABASE_URL = "pglite://memory"
})

// better-auth hashes passwords with scrypt and each of these tests migrates its
// own in-process Postgres. Three such files run in parallel, so the first test
// in each routinely needs more than vitest's 5s default — a timeout here means
// the machine was busy, not that anything hung.
vi.setConfig({ testTimeout: 30000 })

// The auth instance memoises its Drizzle handle, so it must be reset with the
// database or it points at the previous test's.
beforeEach(() => {
  resetDbForTests()
  resetAuthForTests()
})

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

// --------------------------------------------------------------- adminOnly
// The admin boundary is tested against a real session rather than a stub: the
// wrapper's whole job is reading one, so stubbing it would test nothing.

/** Signs a fresh account up and returns its session cookie. */
async function cookieFor(email: string, role: "admin" | "plain"): Promise<string> {
  const auth = await getAuth()
  // The first password sign-up is always the admin, so a plain account is made
  // by that admin afterwards.
  const { headers } = await auth.api.signUpEmail({
    body: { name: "Operator", email: "operator@example.test", password: "operator-password" },
    returnHeaders: true,
  })
  const adminCookie = headers.get("set-cookie") ?? ""
  if (role === "admin") return adminCookie

  await auth.api.createUser({
    body: { name: "Plain", email, password: "plain-password-x" },
    headers: new Headers({ cookie: adminCookie }),
  })
  const { headers: plainHeaders } = await auth.api.signInEmail({
    body: { email, password: "plain-password-x" },
    returnHeaders: true,
  })
  return plainHeaders.get("set-cookie") ?? ""
}

const authedReq = (cookie: string) =>
  new Request("http://localhost/api/admin/x", { headers: { cookie } })

test("adminOnly runs the handler for an admin session and passes the account id", async () => {
  const cookie = await cookieFor("unused@example.test", "admin")
  const res = await adminOnly(async (_req, _ctx, ownerId) => ({ ownerId }))(authedReq(cookie), {})

  expect(res.status).toBe(200)
  expect(await body(res)).toHaveProperty("ownerId")
})

test("adminOnly refuses a plain account with 403", async () => {
  const cookie = await cookieFor("plain@example.test", "plain")
  const res = await adminOnly(async () => ({ reached: true }))(authedReq(cookie), {})

  expect(res.status).toBe(403)
  expect((await body(res)).error?.code).toBe("FORBIDDEN")
})

test("adminOnly refuses an anonymous caller with 401", async () => {
  const res = await adminOnly(async () => ({ reached: true }))(
    new Request("http://localhost/api/admin/x"),
    {},
  )

  expect(res.status).toBe(401)
  expect((await body(res)).error?.code).toBe("UNAUTHENTICATED")
})
