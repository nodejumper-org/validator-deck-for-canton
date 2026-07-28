import { expect, test } from "vitest"
import { BRAND } from "./brand"
import { hasSessionCookie } from "./session-cookie"

const bare = `${BRAND.cookiePrefix}.session_token`
const secure = `__Secure-${BRAND.cookiePrefix}.session_token`

test("recognises the plain cookie used over http", () => {
  expect(hasSessionCookie([{ name: bare, value: "abc" }])).toBe(true)
})

test("recognises the __Secure- prefixed cookie used over https", () => {
  // Regression: matching only the bare name made every signed-in request in
  // production redirect back to /sign-in.
  expect(hasSessionCookie([{ name: secure, value: "abc" }])).toBe(true)
})

test("ignores an empty session cookie", () => {
  expect(hasSessionCookie([{ name: secure, value: "" }])).toBe(false)
})

test("ignores unrelated cookies", () => {
  expect(
    hasSessionCookie([
      { name: "theme", value: "dark" },
      { name: `${BRAND.cookiePrefix}.other`, value: "x" },
    ]),
  ).toBe(false)
})

test("does not match a cookie that merely starts with the session name", () => {
  // `.session_token_extra` is a different cookie, not a session.
  expect(hasSessionCookie([{ name: `${bare}_extra`, value: "x" }])).toBe(false)
})

test("finds the session among other cookies", () => {
  expect(
    hasSessionCookie([
      { name: "theme", value: "dark" },
      { name: secure, value: "abc" },
    ]),
  ).toBe(true)
})
