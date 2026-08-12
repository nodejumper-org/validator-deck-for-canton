"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type Account, useSetAccountPassword } from "@/lib/queries"

const MIN_PASSWORD = 10

export function AccountPasswordDialog({
  account,
  onClose,
}: {
  account: Account | null
  onClose: () => void
}) {
  const setPasswordMutation = useSetAccountPassword()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setPassword("")
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!account) return
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`)
      return
    }
    setPasswordMutation.mutate(
      { userId: account.id, newPassword: password },
      {
        onSuccess: () => {
          reset()
          onClose()
        },
      },
    )
  }

  return (
    <Dialog
      open={account !== null}
      onOpenChange={(o) => {
        if (!o) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set password</DialogTitle>
          <DialogDescription>
            New password for {account?.email}. Their sessions stay signed in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-new-password">New password</Label>
            <Input
              id="account-new-password"
              type="text"
              required
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-muted-foreground text-[12px]">
              At least {MIN_PASSWORD} characters. Shown in clear so you can copy it.
            </p>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={setPasswordMutation.isPending}>
              {setPasswordMutation.isPending ? "Saving…" : "Set password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
