import { beforeAll, expect, test } from "vitest"

beforeAll(() => {
  process.env.APP_SECRET = "a".repeat(64)
})

test("round-trips a secret", async () => {
  const { open, seal } = await import("./crypto.js")
  const sealed = seal("super-secret-value")
  expect(sealed).not.toContain("super-secret-value")
  expect(open(sealed)).toBe("super-secret-value")
})

test("produces a different ciphertext each time", async () => {
  const { seal } = await import("./crypto.js")
  expect(seal("same")).not.toBe(seal("same"))
})

test("rejects a tampered ciphertext", async () => {
  const { open, seal } = await import("./crypto.js")
  const sealed = seal("value")
  const [iv, tag, data] = sealed.split(":")
  const flipped = `${iv}:${tag}:${data!.replace(/.$/, (c) => (c === "0" ? "1" : "0"))}`
  expect(() => open(flipped)).toThrow()
})

test("rejects a malformed sealed value", async () => {
  const { open } = await import("./crypto.js")
  expect(() => open("nonsense")).toThrow(/malformed/i)
})

test("explains what to do when APP_SECRET is missing", async () => {
  const { seal } = await import("./crypto.js")
  const saved = process.env.APP_SECRET
  delete process.env.APP_SECRET
  try {
    expect(() => seal("x")).toThrow(/APP_SECRET/)
  } finally {
    process.env.APP_SECRET = saved
  }
})
