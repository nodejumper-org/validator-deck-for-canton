/**
 * Series that actually have a value somewhere in the range.
 *
 * A plain collecting validator never sends CC and never earns app or SV rewards,
 * so without this both dashboard charts render a three-item legend that is
 * permanently two-thirds empty. Dropping the dead series is what lets them
 * degrade to one clean bar instead.
 *
 * Pure and client-free on purpose: the decision of which series survive is worth
 * testing, and `.tsx` files sit outside vitest's collection.
 */
export function activeSeries<T, S extends { key: keyof T & string }>(
  series: readonly S[],
  data: T[],
): S[] {
  return series.filter((s) => data.some((d) => Number(d[s.key]) > 0))
}
