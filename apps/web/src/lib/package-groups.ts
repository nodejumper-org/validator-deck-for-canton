import type { VettedPackage } from "./types"

/** One package name: the newest vetted version on the row, every other one behind it. */
export type PackageGroup = { name: string; latest: VettedPackage; older: VettedPackage[] }

/**
 * Orders Daml package versions segment by segment, numerically where both
 * segments are numbers, so 3.4.11 is newer than 3.4.8 and a snapshot such as
 * 3.4.0.20251020.14338.0 sits below 3.4.8. A version that extends another is
 * the newer of the two.
 */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".")
  const right = b.split(".")
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const x = left[i]
    const y = right[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const order =
      /^\d+$/.test(x) && /^\d+$/.test(y)
        ? Number(x) - Number(y)
        : x.localeCompare(y, undefined, { numeric: true })
    if (order !== 0) return Math.sign(order)
  }
  return 0
}

/**
 * Groups vetted packages by name, sorted by name, newest version first inside
 * each group. A version vetted under several package IDs keeps every ID: the
 * first by ID goes on the row, the rest stay behind it, so each ID appears once.
 *
 * A package without a name is its own group — the schema defaults a missing
 * name to "", and grouping on that would pass unrelated packages off as
 * versions of one.
 */
export function groupPackages(packages: VettedPackage[]): PackageGroup[] {
  const byName = new Map<string, VettedPackage[]>()
  for (const p of packages) {
    const key = p.packageName ? `name:${p.packageName}` : `id:${p.packageId}`
    byName.set(key, [...(byName.get(key) ?? []), p])
  }

  return [...byName.values()]
    .map((list) => {
      const [latest, ...older] = [...list].sort(
        (a, b) =>
          compareVersions(b.packageVersion, a.packageVersion) ||
          a.packageId.localeCompare(b.packageId),
      )
      return { name: latest!.packageName, latest: latest!, older }
    })
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) || a.latest.packageId.localeCompare(b.latest.packageId),
    )
}

/**
 * Keeps the groups whose name or any package ID contains the query. `reveal` is
 * set when the only hit is an earlier version's ID, so the page opens that row
 * instead of showing a match whose visible ID does not contain the query.
 */
export function filterGroups(
  groups: PackageGroup[],
  query: string,
): { group: PackageGroup; reveal: boolean }[] {
  const q = query.trim().toLowerCase()
  if (!q) return groups.map((group) => ({ group, reveal: false }))

  return groups.flatMap((group) => {
    const nameHit = group.name.toLowerCase().includes(q)
    const latestHit = group.latest.packageId.toLowerCase().includes(q)
    const olderHit = group.older.some((p) => p.packageId.toLowerCase().includes(q))
    if (!nameHit && !latestHit && !olderHit) return []
    return [{ group, reveal: olderHit && !nameHit && !latestHit }]
  })
}
