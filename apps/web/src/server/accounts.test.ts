import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, expect, test, vi } from "vitest"
import { anyAccountExists, roleForNewUser } from "./accounts"
import { getAuth, resetAuthForTests } from "./auth"
import { getDb, resetDbForTests } from "./db"
import { account, user } from "./schema"
import { createTestUser } from "./test-support"

beforeAll(() => {
  process.env.APP_SECRET = "d".repeat(64)
  process.env.DATABASE_URL = "pglite://memory"
})

// better-auth hashes passwords with scrypt and each of these tests migrates its
// own in-process Postgres. Three such files run in parallel, so the first test
// in each routinely needs more than vitest's 5s default — a timeout here means
// the machine was busy, not that anything hung.
vi.setConfig({ testTimeout: 30000 })

// resetAuthForTests must join resetDbForTests — the auth instance memoises its
// Drizzle handle, so a stale instance would point at the previous test's
// database.
beforeEach(() => {
  resetDbForTests()
  resetAuthForTests()
})

test("anyAccountExists flips exactly at the first user", async () => {
  expect(await anyAccountExists()).toBe(false)
  await createTestUser("first@example.test")
  expect(await anyAccountExists()).toBe(true)
})

const operator = {
  name: "Operator",
  email: "operator@example.test",
  password: "operator-password",
}

async function roleOf(email: string): Promise<string> {
  const db = await getDb()
  const rows = await db.select({ role: user.role }).from(user).where(eq(user.email, email))
  return rows[0]!.role
}

test("the first sign-up becomes admin", async () => {
  const auth = await getAuth()
  await auth.api.signUpEmail({ body: operator })
  expect(await roleOf(operator.email)).toBe("admin")
})

test("sign-up is closed once any account exists", async () => {
  const auth = await getAuth()
  await auth.api.signUpEmail({ body: operator })
  await expect(
    auth.api.signUpEmail({
      body: { name: "Squatter", email: "squatter@example.test", password: "squatter-password" },
    }),
  ).rejects.toThrow(/Sign-up is closed/)
})

test("the admin creates plain users who can sign in", async () => {
  const auth = await getAuth()
  const { headers } = await auth.api.signUpEmail({ body: operator, returnHeaders: true })
  const cookie = headers.get("set-cookie") ?? ""

  await auth.api.createUser({
    body: { name: "Customer", email: "customer@example.test", password: "customer-password" },
    headers: new Headers({ cookie }),
  })

  expect(await roleOf("customer@example.test")).toBe("user")
  const session = await auth.api.signInEmail({
    body: { email: "customer@example.test", password: "customer-password" },
  })
  expect(session.user.email).toBe("customer@example.test")
})

test("a plain user cannot create accounts", async () => {
  const auth = await getAuth()
  const { headers } = await auth.api.signUpEmail({ body: operator, returnHeaders: true })
  const adminCookie = headers.get("set-cookie") ?? ""
  await auth.api.createUser({
    body: { name: "Customer", email: "customer@example.test", password: "customer-password" },
    headers: new Headers({ cookie: adminCookie }),
  })

  const { headers: customerHeaders } = await auth.api.signInEmail({
    body: { email: "customer@example.test", password: "customer-password" },
    returnHeaders: true,
  })
  const customerCookie = customerHeaders.get("set-cookie") ?? ""

  await expect(
    auth.api.createUser({
      body: { name: "Intruder", email: "intruder@example.test", password: "intruder-password" },
      headers: new Headers({ cookie: customerCookie }),
    }),
  ).rejects.toThrow()
})

test("the first password account is still the admin", async () => {
  expect(await roleForNewUser()).toBe("admin")
})

test("a later password account is still a plain user", async () => {
  await createTestUser("first@example.test")
  expect(await roleForNewUser()).toBe("user")
})

// ------------------------------------------------------------- role changes

/** Signs the bootstrap admin up and returns their id and session cookie. */
async function bootstrapAdmin(): Promise<{ id: string; cookie: string }> {
  const auth = await getAuth()
  const { response, headers } = await auth.api.signUpEmail({
    body: operator,
    returnHeaders: true,
  })
  return { id: response.user.id, cookie: headers.get("set-cookie") ?? "" }
}

test("an admin promotes another account", async () => {
  const auth = await getAuth()
  const { cookie } = await bootstrapAdmin()
  const created = await auth.api.createUser({
    body: { name: "Colleague", email: "colleague@example.test", password: "colleague-password" },
    headers: new Headers({ cookie }),
  })

  await auth.api.setRole({
    body: { userId: created.user.id, role: "admin" },
    headers: new Headers({ cookie }),
  })

  expect(await roleOf("colleague@example.test")).toBe("admin")
})

test("an admin demotes another admin back to a plain account", async () => {
  const auth = await getAuth()
  const { cookie } = await bootstrapAdmin()
  const created = await auth.api.createUser({
    body: { name: "Colleague", email: "colleague@example.test", password: "colleague-password" },
    headers: new Headers({ cookie }),
  })
  const headers = new Headers({ cookie })

  await auth.api.setRole({ body: { userId: created.user.id, role: "admin" }, headers })
  await auth.api.setRole({ body: { userId: created.user.id, role: "user" }, headers })

  expect(await roleOf("colleague@example.test")).toBe("user")
})

// The dropdown is absent on the admin's own row, but the endpoint is reachable
// without it. Left open, an admin could demote the deck's only admin.
test("an admin cannot change their own role", async () => {
  const auth = await getAuth()
  const { id, cookie } = await bootstrapAdmin()

  await expect(
    auth.api.setRole({ body: { userId: id, role: "user" }, headers: new Headers({ cookie }) }),
  ).rejects.toThrow(/own role/i)

  expect(await roleOf(operator.email)).toBe("admin")
})
