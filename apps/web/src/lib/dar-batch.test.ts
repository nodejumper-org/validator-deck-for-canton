import { expect, test } from "vitest"
import { addDars, type DarRow, runDarBatch } from "./dar-batch"

const dar = (name: string, body = name) => new File([body], name)

const ready = (...names: string[]): DarRow[] =>
  names.map((n) => ({ file: dar(n), status: "ready" }))

test("adds every picked file, in the order picked", () => {
  const rows = addDars([], [dar("a.dar"), dar("b.dar"), dar("c.dar")])
  expect(rows.map((r) => r.file.name)).toEqual(["a.dar", "b.dar", "c.dar"])
  expect(rows.every((r) => r.status === "ready")).toBe(true)
})

test("appends to an earlier pick instead of replacing it", () => {
  const rows = addDars(ready("a.dar"), [dar("b.dar")])
  expect(rows.map((r) => r.file.name)).toEqual(["a.dar", "b.dar"])
})

// Rebuilding a DAR and picking it again is the common case; two rows with the
// same name would leave no way to tell which one is the fresh build.
test("a file picked again under the same name replaces the old row and its outcome", () => {
  const earlier: DarRow[] = [
    { file: dar("a.dar", "old"), status: "failed", message: "INVALID_DAR" },
    { file: dar("b.dar"), status: "uploaded" },
  ]
  const rows = addDars(earlier, [dar("a.dar", "rebuilt")])
  expect(rows.map((r) => r.file.name)).toEqual(["a.dar", "b.dar"])
  expect(rows[0]).toEqual({ file: expect.objectContaining({ size: 7 }), status: "ready" })
  expect(rows[1]!.status).toBe("uploaded")
})

test("sends files one at a time, in list order", async () => {
  const events: string[] = []
  await runDarBatch(
    ready("a.dar", "b.dar"),
    false,
    async (file) => {
      events.push(`start ${file.name}`)
      await new Promise((r) => setTimeout(r, 1))
      events.push(`end ${file.name}`)
    },
    () => {},
  )
  expect(events).toEqual(["start a.dar", "end a.dar", "start b.dar", "end b.dar"])
})

test("reports working, then the outcome, for each file", async () => {
  const updates: string[] = []
  await runDarBatch(
    ready("a.dar"),
    true,
    async () => {},
    (name, status) => updates.push(`${name} ${status}`),
  )
  expect(updates).toEqual(["a.dar working", "a.dar validated"])
})

// Every DAR carries its own dependencies, so one bad file says nothing about
// the rest of the batch.
test("a failure is recorded on its row and the batch carries on", async () => {
  const updates: [string, string, string?][] = []
  const result = await runDarBatch(
    ready("a.dar", "bad.dar", "c.dar"),
    false,
    async (file) => {
      if (file.name === "bad.dar") throw new Error("INVALID_DAR: Dar file is corrupt")
    },
    (name, status, message) => updates.push([name, status, message]),
  )
  expect(updates.filter(([, s]) => s !== "working")).toEqual([
    ["a.dar", "uploaded", undefined],
    ["bad.dar", "failed", "INVALID_DAR: Dar file is corrupt"],
    ["c.dar", "uploaded", undefined],
  ])
  expect(result).toEqual({ uploaded: 2, failed: 1 })
})

test("skips files already uploaded, so retrying a partial batch sends only the rest", async () => {
  const sent: string[] = []
  const rows: DarRow[] = [
    { file: dar("a.dar"), status: "uploaded" },
    { file: dar("b.dar"), status: "failed", message: "boom" },
    { file: dar("c.dar"), status: "validated" },
  ]
  await runDarBatch(rows, false, async (file) => void sent.push(file.name), () => {})
  expect(sent).toEqual(["b.dar", "c.dar"])
})

test("validating counts nothing as uploaded", async () => {
  const result = await runDarBatch(ready("a.dar"), true, async () => {}, () => {})
  expect(result).toEqual({ uploaded: 0, failed: 0 })
})
