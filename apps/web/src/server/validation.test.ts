import { expect, test } from "vitest"
import { ZodError } from "zod"
import { networkParamSchema } from "./validation"

test("accepts a known network", () => {
  expect(networkParamSchema.parse("mainnet")).toBe("mainnet")
})

test("rejects an unknown network so the route answers 400", () => {
  expect(() => networkParamSchema.parse("wat")).toThrow(ZodError)
})

test("rejects a missing network", () => {
  expect(() => networkParamSchema.parse(null)).toThrow(ZodError)
})
