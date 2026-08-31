"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useAccounts, useSetNodeAccess } from "@/lib/queries"
import type { NodeAccessRow } from "@/lib/types"

/**
 * Which accounts may reach one node.
 *
 * The owner is listed checked and disabled: they are not a grant row and cannot
 * be revoked here — removing their access means deleting the node or the
 * account.
 */
export function NodeAccessDialog({
  node,
  onClose,
}: {
  node: NodeAccessRow | null
  onClose: () => void
}) {
  const { data: accounts } = useAccounts()
  const save = useSetNodeAccess()
  const [selected, setSelected] = useState<string[]>([])

  // Reopening on a different node must not carry the previous node's set.
  useEffect(() => {
    setSelected(node ? node.grantees.map((g) => g.id) : [])
  }, [node])

  function toggle(id: string, on: boolean) {
    setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)))
  }

  return (
    <Dialog open={Boolean(node)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Access to {node?.name}</DialogTitle>
          <DialogDescription>
            An account with access is a co-owner: it can operate the node, change its
            credentials, and delete it for everyone, including {node?.owner.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-3 overflow-y-auto">
          {(accounts ?? []).map((account) => {
            const isOwner = account.id === node?.owner.id
            return (
              <div key={account.id} className="flex items-center gap-2.5">
                <Checkbox
                  id={`access-${account.id}`}
                  checked={isOwner || selected.includes(account.id)}
                  disabled={isOwner}
                  onCheckedChange={(v) => toggle(account.id, v === true)}
                />
                <Label htmlFor={`access-${account.id}`} className="font-normal">
                  {account.name}
                  <span className="text-muted-foreground ml-1.5">{account.email}</span>
                  {isOwner ? <span className="text-muted-foreground ml-1.5">— owner</span> : null}
                </Label>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            disabled={save.isPending}
            onClick={() =>
              node && save.mutate({ nodeId: node.id, userIds: selected }, { onSuccess: onClose })
            }
          >
            {save.isPending ? "Saving…" : "Save access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
