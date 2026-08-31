import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { getAuth, resetAuthForTests } from "./auth"
import { resetDbForTests } from "./db"

beforeAll(() => {
  process.env.APP_SECRET = "d".repeat(64)
  process.env.DATABASE_URL = "pglite://memory"
})

// better-auth hashes passwords with scrypt and each of these tests migrates its
// own in-process Postgres. Three such files run in parallel, so the first test
// in each routinely needs more than vitest's 5s default — a timeout here means
// the machine was busy, not that anything hung.
vi.setConfig({ testTimeout: 30000 })

beforeEach(() => {
  resetDbForTests()
  resetAuthForTests()
})

afterEach(() => {
  delete process.env.OIDC_ISSUER
  delete process.env.OIDC_CLIENT_ID
  delete process.env.OIDC_CLIENT_SECRET
})

test("without an issuer the deck is v0.2.0: no oauth endpoint, password login intact", async () => {
  const api = (await getAuth()).api as Record<string, unknown>
  expect(api.signInWithOAuth2).toBeUndefined()
  expect(typeof api.signInEmail).toBe("function")
})

test("with an issuer the oauth endpoint appears and password login stays", async () => {
  process.env.OIDC_ISSUER = "https://keycloak.example.test/realms/ftp"
  process.env.OIDC_CLIENT_ID = "deck"
  process.env.OIDC_CLIENT_SECRET = "s3cret"
  resetAuthForTests()

  const auth = await getAuth()
  expect(typeof auth.api.signInWithOAuth2).toBe("function")
  expect(typeof auth.api.signInEmail).toBe("function")
})
