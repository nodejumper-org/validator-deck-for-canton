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
import { useDeleteNode } from "@/lib/queries"
import type { NodeSummary } from "@/lib/types"

export function DeleteNodeDialog({ node, trigger }: { node: NodeSummary; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const remove = useDeleteNode()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {node.name}?</DialogTitle>
          <DialogDescription>
            This removes the node from the console and deletes its stored credentials. The node
            itself keeps running and nothing on the ledger changes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={async () => {
              await remove.mutateAsync(node.id).catch(() => {})
              setOpen(false)
            }}
          >
            {remove.isPending ? "Removing…" : "Remove node"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
