import { expect, test } from "vitest"
import { PACKAGE_NAME } from "../index.js"

test("workspace package resolves", () => {
  expect(PACKAGE_NAME).toBe("@canton/client")
})
