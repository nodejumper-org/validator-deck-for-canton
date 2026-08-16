import { afterEach, beforeAll, beforeEach, expect, test } from "vitest"
import { getAuth, resetAuthForTests } from "./auth"
import { resetDbForTests } from "./db"

beforeAll(() => {
  process.env.APP_SECRET = "d".repeat(64)
  process.env.DATABASE_URL = "pglite://memory"
})

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
