"use client"

import { CheckCircle2, FileUp, XCircle } from "lucide-react"
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
import type { ApiError } from "@/lib/api"
import { formatBytes } from "@/lib/format"
import { useUploadDar } from "@/lib/queries"
import { cn } from "@/lib/utils"

type Outcome = { ok: true; message: string } | { ok: false; message: string }

export function DarUploadDialog({ nodeId, trigger }: { nodeId: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [vetAll, setVetAll] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useUploadDar(nodeId)

  function pick(next: File | null) {
    setFile(next)
    setOutcome(null)
  }

  async function run(validateOnly: boolean) {
    if (!file) return
    setOutcome(null)
    try {
      const result = await upload.mutateAsync({ file, vetAllPackages: vetAll, validateOnly })
      setOutcome({
        ok: true,
        message: result.validated
          ? `Validated ${result.fileName} (${formatBytes(result.bytes)}) — no upgrade conflicts`
          : `Uploaded ${result.fileName} (${formatBytes(result.bytes)})`,
      })
    } catch (e) {
      // Canton's own message, verbatim: "INVALID_DAR: Dar file is corrupt".
      setOutcome({ ok: false, message: (e as ApiError).message })
    }
  }

  function reset(next: boolean) {
    setOpen(next)
    if (!next) {
      setFile(null)
      setOutcome(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload a DAR</DialogTitle>
          <DialogDescription>
            A DAR bundles Daml packages. Validate first to check it parses and upgrades cleanly
            without changing anything on the node.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              pick(e.dataTransfer.files[0] ?? null)
            }}
            className={cn(
              "rounded-md border border-dashed px-4 py-8 text-center transition-colors",
              dragging ? "border-primary bg-accent/40" : "border-input",
            )}
          >
            <FileUp className="text-muted-foreground mx-auto size-6" aria-hidden />
            {file ? (
              <p className="ident mt-2">
                {file.name}{" "}
                <span className="text-muted-foreground">({formatBytes(file.size)})</span>
              </p>
            ) : (
              <p className="text-muted-foreground mt-2 text-[13px]">
                Drop a .dar file here, or choose one
              </p>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".dar"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => inputRef.current?.click()}
            >
              {file ? "Choose a different file" : "Choose file"}
            </Button>
          </div>

          <label className="flex items-start justify-between gap-4 rounded-md border p-3">
            <span className="text-[13px]">
              Vet all packages
              <span className="text-muted-foreground block text-[12px]">
                Makes the packages usable immediately on the connected synchronizer.
              </span>
            </span>
            <Switch checked={vetAll} onCheckedChange={setVetAll} aria-label="Vet all packages" />
          </label>

          {outcome ? (
            <div
              className={cn(
                "flex items-start gap-2 rounded-md border px-3 py-2.5 text-[13px]",
                outcome.ok ? "border-ok/30 bg-ok/5" : "border-bad/30 bg-bad/5",
              )}
            >
              {outcome.ok ? (
                <CheckCircle2 className="text-ok mt-px size-4 shrink-0" aria-hidden />
              ) : (
                <XCircle className="text-bad mt-px size-4 shrink-0" aria-hidden />
              )}
              <span className={outcome.ok ? "" : "ident break-words"}>{outcome.message}</span>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={!file || upload.isPending}
            onClick={() => run(true)}
          >
            Validate
          </Button>
          <Button disabled={!file || upload.isPending} onClick={() => run(false)}>
            {upload.isPending ? "Working…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
