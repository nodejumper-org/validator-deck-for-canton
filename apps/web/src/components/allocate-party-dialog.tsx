"use client"

import { useState, type ReactNode } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAllocateParty } from "@/lib/queries"

export function AllocatePartyDialog({ nodeId, trigger }: { nodeId: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState("")
  const allocate = useAllocateParty(nodeId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await allocate.mutateAsync(hint.trim())
      setOpen(false)
      setHint("")
    } catch {
      // The mutation already toasts the node's message.
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Allocate a party</DialogTitle>
          <DialogDescription>
            The participant appends its own namespace, so the final party ID will be your hint
            followed by <span className="ident">::</span> and the participant fingerprint.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hint" className="text-[13px]">
              Party ID hint
            </Label>
            <Input
              id="hint"
              required
              className="ident"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="trading-desk"
            />
            <p className="text-muted-foreground text-[12px]">
              Letters, digits, space, colon, minus, and underscore. Up to 255 characters.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={allocate.isPending || !hint.trim()}>
              {allocate.isPending ? "Allocating…" : "Allocate party"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
