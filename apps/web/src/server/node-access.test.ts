import { beforeAll, beforeEach, expect, test } from "vitest"
import { getDb, resetDbForTests } from "./db"
import { listNodeAccess, setNodeAccess } from "./node-access"
import { createNode } from "./nodes"
import { HttpError } from "./route-helpers"
import { nodeAccess } from "./schema"
import { createTestUser, grantTestAccess } from "./test-support"

beforeAll(() => {
  process.env.APP_SECRET = "f".repeat(64)
  process.env.DATABASE_URL = "pglite://memory"
})

let owner: string
let alice: string
let bob: string

beforeEach(async () => {
  resetDbForTests()
  owner = await createTestUser("owner@example.test")
  alice = await createTestUser("alice@example.test")
  bob = await createTestUser("bob@example.test")
})

const input = {
  name: "devnet-1",
  network: "devnet" as const,
  ledgerApiUrl: "https://ledger.example",
  validatorApiUrl: "https://validator.example",
  authTokenUrl: "https://kc.example/token",
  authClientId: "svc",
  authClientSecret: "shhh",
}

test("lists every node in the deck with its owner and no grantees", async () => {
  await createNode(input, owner)
  const rows = await listNodeAccess()

  expect(rows).toHaveLength(1)
  expect(rows[0]!.owner.email).toBe("owner@example.test")
  expect(rows[0]!.grantees).toEqual([])
})

test("lists nodes owned by different accounts", async () => {
  await createNode(input, owner)
  await createNode({ ...input, name: "theirs" }, alice)

  expect((await listNodeAccess()).map((r) => r.name).sort()).toEqual(["devnet-1", "theirs"])
})

test("lists grantees against their node", async () => {
  const node = await createNode(input, owner)
  await grantTestAccess(node.id, alice)
  await grantTestAccess(node.id, bob)

  const [row] = await listNodeAccess()
  expect(row!.grantees.map((g) => g.email).sort()).toEqual([
    "alice@example.test",
    "bob@example.test",
  ])
})

test("setNodeAccess replaces the set rather than merging into it", async () => {
  const node = await createNode(input, owner)
  await setNodeAccess(node.id, [alice, bob])
  const row = await setNodeAccess(node.id, [bob])

  expect(row.grantees.map((g) => g.email)).toEqual(["bob@example.test"])
})

test("setNodeAccess with an empty list revokes everything", async () => {
  const node = await createNode(input, owner)
  await setNodeAccess(node.id, [alice])
  const row = await setNodeAccess(node.id, [])

  expect(row.grantees).toEqual([])
  const db = await getDb()
  expect(await db.select().from(nodeAccess)).toEqual([])
})

// A row for the owner would be redundant and would make the owner look like a
// grantee everywhere the table is read.
test("setNodeAccess drops the owner from the input", async () => {
  const node = await createNode(input, owner)
  const row = await setNodeAccess(node.id, [owner, alice])

  expect(row.grantees.map((g) => g.email)).toEqual(["alice@example.test"])
})

test("setNodeAccess ignores a repeated id", async () => {
  const node = await createNode(input, owner)
  const row = await setNodeAccess(node.id, [alice, alice])

  expect(row.grantees).toHaveLength(1)
})

test("setNodeAccess reports an unknown node as not found", async () => {
  const err = await setNodeAccess("nope", [alice]).then(
    () => null,
    (e: HttpError) => e,
  )
  expect(err).toBeInstanceOf(HttpError)
  expect(err!.status).toBe(404)
  expect(err!.code).toBe("NODE_NOT_FOUND")
})

// The foreign key would catch this, but as a 500 that reads like our bug.
test("setNodeAccess rejects an unknown account before writing anything", async () => {
  const node = await createNode(input, owner)
  await setNodeAccess(node.id, [alice])

  const err = await setNodeAccess(node.id, [alice, "ghost"]).then(
    () => null,
    (e: HttpError) => e,
  )
  expect(err!.status).toBe(400)
  expect(err!.code).toBe("UNKNOWN_ACCOUNT")

  // The earlier grant survived — nothing was written.
  const [row] = await listNodeAccess()
  expect(row!.grantees.map((g) => g.email)).toEqual(["alice@example.test"])
})
