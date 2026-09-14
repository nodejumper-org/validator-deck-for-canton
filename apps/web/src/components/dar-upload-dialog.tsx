"use client"

import { CheckCircle2, FileUp, Loader2, X, XCircle } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { addDars, type DarRow, type DarUpdate } from "@/lib/dar-batch"
import { formatBytes } from "@/lib/format"
import { useUploadDars } from "@/lib/queries"
import { cn } from "@/lib/utils"

export function DarUploadDialog({ nodeId, trigger }: { nodeId: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<DarRow[]>([])
  const [vetAll, setVetAll] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [validating, setValidating] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useUploadDars(nodeId)
  const busy = upload.isPending
  const pending = rows.filter((r) => r.status !== "uploaded")

  function pick(files: FileList | null) {
    if (files?.length) setRows((prev) => addDars(prev, Array.from(files)))
  }

  const update: DarUpdate = (fileName, status, message) => {
    setRows((prev) =>
      prev.map((r) => (r.file.name === fileName ? { file: r.file, status, message } : r)),
    )
    if (status !== "working") setProgress((p) => ({ ...p, done: p.done + 1 }))
  }

  async function run(validateOnly: boolean) {
    setValidating(validateOnly)
    setProgress({ done: 0, total: pending.length })
    await upload.mutateAsync({ rows, vetAllPackages: vetAll, validateOnly, onUpdate: update })
  }

  function reset(next: boolean) {
    // Closing would not stop the requests already on their way to the node.
    if (!next && busy) return
    setOpen(next)
    if (!next) setRows([])
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload DARs</DialogTitle>
          <DialogDescription>
            A DAR bundles Daml packages. Validate first to check each one parses and upgrades
            cleanly without changing anything on the node.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              if (!busy) setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              if (!busy) pick(e.dataTransfer.files)
            }}
            className={cn(
              "rounded-md border border-dashed px-4 py-6 text-center transition-colors",
              dragging ? "border-primary bg-accent/40" : "border-input",
            )}
          >
            <FileUp className="text-muted-foreground mx-auto size-6" aria-hidden />
            <p className="text-muted-foreground mt-2 text-[13px]">
              Drop .dar files here, or choose them
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".dar"
              multiple
              className="sr-only"
              onChange={(e) => {
                pick(e.target.files)
                // Otherwise picking the same file again, say after a rebuild, fires no change.
                e.target.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {rows.length ? "Add files" : "Choose files"}
            </Button>
          </div>

          {rows.length ? (
            <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
              {rows.map((row) => (
                <li key={row.file.name} className="flex items-start gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="ident truncate" title={row.file.name}>
                      {row.file.name}{" "}
                      <span className="text-muted-foreground">({formatBytes(row.file.size)})</span>
                    </p>
                    <RowStatus row={row} validating={validating} />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${row.file.name}`}
                    disabled={busy}
                    onClick={() => setRows((prev) => prev.filter((r) => r !== row))}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          <label className="flex items-start justify-between gap-4 rounded-md border p-3">
            <span className="text-[13px]">
              Vet all packages
              <span className="text-muted-foreground block text-[12px]">
                Makes the packages usable immediately on the connected synchronizer.
              </span>
            </span>
            <Switch checked={vetAll} onCheckedChange={setVetAll} aria-label="Vet all packages" />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={!pending.length || busy} onClick={() => run(true)}>
            Validate
          </Button>
          <Button disabled={!pending.length || busy} onClick={() => run(false)}>
            {busy
              ? `Working… ${progress.done}/${progress.total}`
              : pending.length > 1
                ? `Upload ${pending.length} DARs`
                : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RowStatus({ row, validating }: { row: DarRow; validating: boolean }) {
  switch (row.status) {
    case "ready":
      return <p className="text-muted-foreground text-[12px]">Ready</p>
    case "working":
      return (
        <p className="text-muted-foreground flex items-center gap-1.5 text-[12px]">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {validating ? "Validating…" : "Uploading…"}
        </p>
      )
    case "validated":
    case "uploaded":
      return (
        <p className="flex items-center gap-1.5 text-[12px]">
          <CheckCircle2 className="text-ok size-3.5 shrink-0" aria-hidden />
          {row.status === "validated" ? "Validated — no upgrade conflicts" : "Uploaded"}
        </p>
      )
    case "failed":
      return (
        <p className="flex items-start gap-1.5 text-[12px]">
          <XCircle className="text-bad mt-px size-3.5 shrink-0" aria-hidden />
          <span className="ident break-words">{row.message}</span>
        </p>
      )
  }
}
