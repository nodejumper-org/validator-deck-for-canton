export type DarStatus = "ready" | "working" | "validated" | "uploaded" | "failed"

export type DarRow = { file: File; status: DarStatus; message?: string }

export type DarUpdate = (fileName: string, status: DarStatus, message?: string) => void

/**
 * Adds picked files to the list. Rows are keyed by file name: picking a name
 * again replaces that row and clears its outcome, because the usual reason is a
 * rebuilt DAR, and two rows under one name would not say which is the new one.
 */
export function addDars(rows: DarRow[], files: Iterable<File>): DarRow[] {
  const next = [...rows]
  for (const file of files) {
    const row: DarRow = { file, status: "ready" }
    const at = next.findIndex((r) => r.file.name === file.name)
    if (at === -1) next.push(row)
    else next[at] = row
  }
  return next
}

/**
 * Sends each row that is not already uploaded through `send`, one at a time and
 * in list order, so a node never receives several 25 MB bodies at once and a
 * retry after a partial failure sends only what is left.
 *
 * A failure is recorded on its row and the batch carries on: every DAR carries
 * its own dependencies, so one bad file says nothing about the others.
 */
export async function runDarBatch(
  rows: DarRow[],
  validateOnly: boolean,
  send: (file: File) => Promise<unknown>,
  onUpdate: DarUpdate,
): Promise<{ uploaded: number; failed: number }> {
  let uploaded = 0
  let failed = 0
  for (const { file, status } of rows) {
    if (status === "uploaded") continue
    onUpdate(file.name, "working")
    try {
      await send(file)
      if (!validateOnly) uploaded++
      onUpdate(file.name, validateOnly ? "validated" : "uploaded")
    } catch (e) {
      failed++
      // Canton's own message, verbatim: "INVALID_DAR: Dar file is corrupt".
      onUpdate(file.name, "failed", e instanceof Error ? e.message : String(e))
    }
  }
  return { uploaded, failed }
}
