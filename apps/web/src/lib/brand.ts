/**
 * Product identity in one place.
 *
 * Two forms because the navigation rail is 224px wide: `fullName` is the product,
 * `name` is what fits next to a logo mark. Use `fullName` wherever there is room
 * — page titles, the sign-in card, documentation.
 */
export const BRAND = {
  name: "Validator Deck",
  fullName: "Validator Deck for Canton",
  tagline: "Operate Canton participant and validator nodes",

  /**
   * Prefix for better-auth's cookies.
   *
   * `proxy.ts` matches on this to decide whether a request looks signed in, and
   * it runs in a separate runtime from `server/auth.ts` — so both import the
   * value from here rather than repeating a literal that could drift.
   * Changing it signs everyone out.
   */
  cookiePrefix: "validator-deck",
} as const
