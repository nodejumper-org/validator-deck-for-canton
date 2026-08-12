import { beforeAll, beforeEach, expect, test } from "vitest"
import { anyAccountExists } from "./accounts"
import { resetDbForTests } from "./db"
import { createTestUser } from "./test-support"

beforeAll(() => {
  process.env.APP_SECRET = "d".repeat(64)
  process.env.DATABASE_URL = "pglite://memory"
})

beforeEach(() => {
  resetDbForTests()
})

test("anyAccountExists flips exactly at the first user", async () => {
  expect(await anyAccountExists()).toBe(false)
  await createTestUser("first@example.test")
  expect(await anyAccountExists()).toBe(true)
})
