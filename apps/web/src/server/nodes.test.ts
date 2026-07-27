import { beforeAll, beforeEach, expect, test } from "vitest"
import { open } from "./crypto.js"
import { resetDbForTests } from "./db.js"
import { HttpError } from "./route-helpers.js"
import {
  createNode,
  deleteNode,
  getNode,
  getPublicNode,
  listNodes,
  nodeInputSchema,
  updateNode,
} from "./nodes.js"

beforeAll(() => {
  process.env.APP_SECRET = "b".repeat(64)
  process.env.DATABASE_URL = "pglite://memory"
})

// Each test gets a fresh in-process Postgres, so ordering never matters.
beforeEach(() => {
  resetDbForTests()
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
  const node = await createNode(input)
  expect(node.name).toBe("devnet-1")
  expect(node.hasSecret).toBe(true)
  expect(JSON.stringify(node)).not.toContain("shhh")
  expect(node).not.toHaveProperty("authClientSecretEnc")
})

test("stores the secret encrypted but returns it decrypted server-side", async () => {
  const created = await createNode(input)
  const row = (await getNode(created.id))!
  expect(row.authClientSecretEnc).not.toContain("shhh")
  expect(open(row.authClientSecretEnc)).toBe("shhh")
})

test("persists the network enum", async () => {
  const node = await createNode({ ...input, network: "mainnet" })
  expect(node.network).toBe("mainnet")
})

test("lists created nodes", async () => {
  await createNode(input)
  await createNode({ ...input, name: "devnet-2" })
  const names = (await listNodes()).map((n) => n.name).sort()
  expect(names).toEqual(["devnet-1", "devnet-2"])
})

test("getPublicNode strips the secret too", async () => {
  const created = await createNode(input)
  const publicNode = await getPublicNode(created.id)
  expect(publicNode?.hasSecret).toBe(true)
  expect(publicNode).not.toHaveProperty("authClientSecretEnc")
})

test("updates fields and leaves the secret alone when it is omitted", async () => {
  const created = await createNode(input)
  const updated = await updateNode(created.id, { name: "renamed" })
  expect(updated.name).toBe("renamed")
  expect(open((await getNode(created.id))!.authClientSecretEnc)).toBe("shhh")
})

test("treats a blank secret as 'keep the stored one'", async () => {
  const created = await createNode(input)
  await updateNode(created.id, { name: "x", authClientSecret: "" })
  expect(open((await getNode(created.id))!.authClientSecretEnc)).toBe("shhh")
})

test("replaces the secret when a new one is supplied", async () => {
  const created = await createNode(input)
  await updateNode(created.id, { authClientSecret: "rotated" })
  expect(open((await getNode(created.id))!.authClientSecretEnc)).toBe("rotated")
})

test("clears the validator url when set to empty", async () => {
  const created = await createNode(input)
  const updated = await updateNode(created.id, { validatorApiUrl: "" })
  expect(updated.validatorApiUrl).toBeNull()
})

test("deletes a node", async () => {
  const created = await createNode(input)
  await deleteNode(created.id)
  expect(await getNode(created.id)).toBeUndefined()
})

test("treats a node without a validator url as participant-only", async () => {
  const node = await createNode({ ...input, validatorApiUrl: undefined })
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
  const err = await updateNode("nope", { name: "x" }).then(
    () => null,
    (e: HttpError) => e,
  )
  expect(err).toBeInstanceOf(HttpError)
  expect(err!.status).toBe(404)
  expect(err!.code).toBe("NODE_NOT_FOUND")
  expect(err!.message).toContain("nope")
})
