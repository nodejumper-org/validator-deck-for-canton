import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, expect, test } from "vitest"
import { anyAccountExists } from "./accounts"
import { getAuth, resetAuthForTests } from "./auth"
import { getDb, resetDbForTests } from "./db"
import { user } from "./schema"
import { createTestUser } from "./test-support"

beforeAll(() => {
  process.env.APP_SECRET = "d".repeat(64)
  process.env.DATABASE_URL = "pglite://memory"
})

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
