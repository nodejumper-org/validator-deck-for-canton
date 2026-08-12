"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type Account, useRemoveAccount } from "@/lib/queries"

export function AccountDeleteDialog({
  account,
  onClose,
}: {
  account: Account | null
  onClose: () => void
}) {
  const remove = useRemoveAccount()

  return (
    <Dialog
      open={account !== null}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete account</DialogTitle>
          <DialogDescription>
            Deletes {account?.email}{" "}
            <strong>and every node registered under it, including their stored credentials</strong>
            . This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => {
              if (!account) return
              remove.mutate({ userId: account.id }, { onSuccess: onClose })
            }}
          >
            {remove.isPending ? "Deleting…" : "Delete account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
