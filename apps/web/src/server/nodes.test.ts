import { beforeAll, beforeEach, expect, test } from "vitest"
import { open } from "./crypto"
import { resetDbForTests } from "./db"
import { HttpError } from "./route-helpers"
import { createTestUser } from "./test-support"
import {
  createNode,
  deleteNode,
  getNode,
  getPublicNode,
  listNodes,
  nodeInputSchema,
  updateNode,
} from "./nodes"

beforeAll(() => {
  process.env.APP_SECRET = "b".repeat(64)
  process.env.DATABASE_URL = "pglite://memory"
})

// Each test gets a fresh in-process Postgres, so ordering never matters. Nodes
// are owned, so every test needs a user to own them.
let owner: string
let other: string

beforeEach(async () => {
  resetDbForTests()
  owner = await createTestUser("owner@example.test")
  other = await createTestUser("other@example.test")
})

const input = {
  name: "devnet-1",
  network: "devnet" as const,
  ledgerApiUrl: "https://ledger.example",
  validatorApiUrl: "https://validator.example",
  authTokenUrl: "https://kc.example/token",
  authClientId: "svc",
  authClientSecret: "shhh",
  authAudience: "https://validator.example",
  authScope: "daml_ledger_api",
}

test("creates a node and never exposes the secret", async () => {
  const node = await createNode(input, owner)
  expect(node.name).toBe("devnet-1")
  expect(node.hasSecret).toBe(true)
  expect(JSON.stringify(node)).not.toContain("shhh")
  expect(node).not.toHaveProperty("authClientSecretEnc")
})

test("stores the secret encrypted but returns it decrypted server-side", async () => {
  const created = await createNode(input, owner)
  const row = (await getNode(created.id, owner))!
  expect(row.authClientSecretEnc).not.toContain("shhh")
  expect(open(row.authClientSecretEnc)).toBe("shhh")
})

test("persists the network enum", async () => {
  const node = await createNode({ ...input, network: "mainnet" }, owner)
  expect(node.network).toBe("mainnet")
})

test("lists created nodes", async () => {
  await createNode(input, owner)
  await createNode({ ...input, name: "devnet-2" }, owner)
  const names = (await listNodes(owner)).map((n) => n.name).sort()
  expect(names).toEqual(["devnet-1", "devnet-2"])
})

test("getPublicNode strips the secret too", async () => {
  const created = await createNode(input, owner)
  const publicNode = await getPublicNode(created.id, owner)
  expect(publicNode?.hasSecret).toBe(true)
  expect(publicNode).not.toHaveProperty("authClientSecretEnc")
})

test("updates fields and leaves the secret alone when it is omitted", async () => {
  const created = await createNode(input, owner)
  const updated = await updateNode(created.id, { name: "renamed" }, owner)
  expect(updated.name).toBe("renamed")
  expect(open((await getNode(created.id, owner))!.authClientSecretEnc)).toBe("shhh")
})

test("treats a blank secret as 'keep the stored one'", async () => {
  const created = await createNode(input, owner)
  await updateNode(created.id, { name: "x", authClientSecret: "" }, owner)
  expect(open((await getNode(created.id, owner))!.authClientSecretEnc)).toBe("shhh")
})

test("replaces the secret when a new one is supplied", async () => {
  const created = await createNode(input, owner)
  await updateNode(created.id, { authClientSecret: "rotated" }, owner)
  expect(open((await getNode(created.id, owner))!.authClientSecretEnc)).toBe("rotated")
})

test("clears the validator url when set to empty", async () => {
  const created = await createNode(input, owner)
  const updated = await updateNode(created.id, { validatorApiUrl: "" }, owner)
  expect(updated.validatorApiUrl).toBeNull()
})

test("deletes a node", async () => {
  const created = await createNode(input, owner)
  await deleteNode(created.id, owner)
  expect(await getNode(created.id, owner)).toBeUndefined()
})

test("treats a node without a validator url as participant-only", async () => {
  const node = await createNode({ ...input, validatorApiUrl: undefined }, owner)
  expect(node.validatorApiUrl).toBeNull()
})

test("rejects a non-URL ledger endpoint", () => {
  expect(nodeInputSchema.safeParse({ ...input, ledgerApiUrl: "not a url" }).success).toBe(false)
})

test("rejects an empty name", () => {
  expect(nodeInputSchema.safeParse({ ...input, name: "" }).success).toBe(false)
})

test("requires a secret when creating", () => {
  const { authClientSecret: _omitted, ...withoutSecret } = input
  expect(nodeInputSchema.safeParse(withoutSecret).success).toBe(false)
})

test("updating an unknown node reports not found", async () => {
  const err = await updateNode("nope", { name: "x" }, owner).then(
    () => null,
    (e: HttpError) => e,
  )
  expect(err).toBeInstanceOf(HttpError)
  expect(err!.status).toBe(404)
  expect(err!.code).toBe("NODE_NOT_FOUND")
  expect(err!.message).toContain("nope")
})

test("a node is invisible to another user", async () => {
  const created = await createNode(input, owner)

  expect(await getNode(created.id, other)).toBeUndefined()
  expect(await getPublicNode(created.id, other)).toBeUndefined()
  expect(await listNodes(other)).toEqual([])
})

test("another user cannot update or delete someone else's node", async () => {
  const created = await createNode(input, owner)

  await expect(updateNode(created.id, { name: "stolen" }, other)).rejects.toThrow(HttpError)

  // Delete silently affects nothing rather than erroring — the row is simply
  // not in that user's scope.
  await deleteNode(created.id, other)
  expect(await getNode(created.id, owner)).toBeDefined()
})

test("listNodes returns only the caller's nodes", async () => {
  await createNode(input, owner)
  await createNode({ ...input, name: "theirs" }, other)

  expect((await listNodes(owner)).map((n) => n.name)).toEqual(["devnet-1"])
  expect((await listNodes(other)).map((n) => n.name)).toEqual(["theirs"])
})

test("the owner id never reaches the wire type", async () => {
  const node = await createNode(input, owner)
  expect(node).not.toHaveProperty("userId")
  expect(JSON.stringify(node)).not.toContain(owner)
})
