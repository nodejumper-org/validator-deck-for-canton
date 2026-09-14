import { expect, test } from "vitest"
import { compareVersions, filterGroups, groupPackages } from "./package-groups"
import type { VettedPackage } from "./types"

const pkg = (packageName: string, packageVersion: string, packageId: string): VettedPackage => ({
  packageId,
  packageName,
  packageVersion,
})

const newestFirst = (versions: string[]) => [...versions].sort((a, b) => compareVersions(b, a))

// Plain string order puts 3.4.11 before 3.4.8, which is what the old version
// list did.
test("compares version segments as numbers", () => {
  expect(newestFirst(["3.4.8", "3.4.11", "3.4.9"])).toEqual(["3.4.11", "3.4.9", "3.4.8"])
})

test("a snapshot-style version sorts by its leading segments", () => {
  expect(newestFirst(["3.4.0.20251020.14338.0", "3.4.8", "3.3.0.20250502.13767.0"])).toEqual([
    "3.4.8",
    "3.4.0.20251020.14338.0",
    "3.3.0.20250502.13767.0",
  ])
})

test("a version that extends another is newer", () => {
  expect(compareVersions("1.0.1", "1.0")).toBeGreaterThan(0)
  expect(compareVersions("1.0", "1.0")).toBe(0)
})

test("non-numeric segments still order deterministically", () => {
  expect(newestFirst(["1.0.0-rc1", "1.0.0-rc2"])).toEqual(["1.0.0-rc2", "1.0.0-rc1"])
})

test("one row per name, sorted by name, with the newest version on the row", () => {
  const groups = groupPackages([
    pkg("splice-util", "0.1.2", "u2"),
    pkg("daml-stdlib", "3.4.8", "s8"),
    pkg("splice-util", "0.1.10", "u10"),
    pkg("daml-stdlib", "3.4.11", "s11"),
    pkg("splice-util", "0.1.9", "u9"),
  ])
  expect(groups.map((g) => [g.name, g.latest.packageId, g.older.map((p) => p.packageId)])).toEqual([
    ["daml-stdlib", "s11", ["s8"]],
    ["splice-util", "u10", ["u9", "u2"]],
  ])
})

// devnet vets daml-prim 0.0.0 under seven package IDs. Each ID stays visible
// exactly once: one on the row, the rest behind it.
test("several package IDs under one version keep every ID", () => {
  const groups = groupPackages([
    pkg("daml-prim", "0.0.0", "b"),
    pkg("daml-prim", "0.0.0", "a"),
    pkg("daml-prim", "0.0.0", "c"),
  ])
  expect(groups).toHaveLength(1)
  expect(groups[0]!.latest.packageId).toBe("a")
  expect(groups[0]!.older.map((p) => p.packageId)).toEqual(["b", "c"])
})

// The schema defaults a missing name to "". Grouping those together would
// present unrelated packages as versions of one.
test("packages without a name are never grouped together", () => {
  const groups = groupPackages([pkg("", "", "x"), pkg("", "", "y")])
  expect(groups.map((g) => g.older.length)).toEqual([0, 0])
})

const groups = groupPackages([
  pkg("daml-stdlib", "3.4.11", "aaaa11"),
  pkg("daml-stdlib", "3.4.8", "bbbb08"),
  pkg("splice-util", "0.1.7", "cccc07"),
])

test("an empty filter keeps every row collapsed", () => {
  expect(filterGroups(groups, "  ")).toEqual(groups.map((group) => ({ group, reveal: false })))
})

test("filters by name, case-insensitively", () => {
  expect(filterGroups(groups, "STDLIB").map((m) => [m.group.name, m.reveal])).toEqual([
    ["daml-stdlib", false],
  ])
})

// A package ID that only an earlier version carries would otherwise match a
// row whose visible ID is different, with the hit hidden behind the chevron.
test("a filter matching only an earlier version's ID opens that row", () => {
  expect(filterGroups(groups, "bbbb").map((m) => [m.group.name, m.reveal])).toEqual([
    ["daml-stdlib", true],
  ])
})

test("a filter matching the newest version's ID leaves the row closed", () => {
  expect(filterGroups(groups, "aaaa").map((m) => [m.group.name, m.reveal])).toEqual([
    ["daml-stdlib", false],
  ])
})
