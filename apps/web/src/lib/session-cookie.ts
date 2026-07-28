import { BRAND } from "./brand"

/**
 * Names better-auth may use for the session cookie.
 *
 * Over HTTPS it sets the `Secure` attribute and adopts the `__Secure-` cookie
 * name prefix, which browsers only accept on secure origins. Over plain HTTP —
 * local development — it uses the bare name. Matching only the bare name means
 * the proxy sees no session in production, bounces every signed-in request back
 * to /sign-in, and looks exactly like "I registered but cannot log in".
 */
export const SESSION_COOKIE_NAMES = [
  `${BRAND.cookiePrefix}.session_token`,
  `__Secure-${BRAND.cookiePrefix}.session_token`,
] as const

/**
 * Whether a request carries something that looks like a session.
 *
 * Presence only — the proxy runs before render, potentially at the edge, where
 * the database is unreachable. Every API route separately verifies the session
 * for real.
 */
export function hasSessionCookie(cookies: { name: string; value: string }[]): boolean {
  return cookies.some(
    (c) => (SESSION_COOKIE_NAMES as readonly string[]).includes(c.name) && c.value.length > 0,
  )
}
