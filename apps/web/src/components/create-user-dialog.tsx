"use client"

import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { useCreateUser } from "@/lib/queries"
import type { UserRight } from "@/lib/types"

export function CreateUserDialog({ nodeId, trigger }: { nodeId: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState("")
  const [primaryParty, setPrimaryParty] = useState("")
  // Creating a user with no rights produces one that cannot do anything, which is
  // almost never the intent — so this starts on.
  const [grantPartyRights, setGrantPartyRights] = useState(true)

  const create = useCreateUser(nodeId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const party = primaryParty.trim()
    const rights: UserRight[] =
      grantPartyRights && party
        ? [
            { kind: "CanActAs", party },
            { kind: "CanReadAs", party },
          ]
        : []

    try {
      await create.mutateAsync({
        userId: userId.trim(),
        primaryParty: party || undefined,
        rights,
      })
      setOpen(false)
      setUserId("")
      setPrimaryParty("")
    } catch {
      // The mutation already toasts the node's message.
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a ledger user</DialogTitle>
          <DialogDescription>
            Ledger users authenticate against the Ledger API and act on behalf of parties.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="userId" className="text-[13px]">
              User ID
            </Label>
            <Input
              id="userId"
              required
              className="ident"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="my-service-user"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="primaryParty" className="text-[13px]">
              Primary party
            </Label>
            <Input
              id="primaryParty"
              className="ident"
              value={primaryParty}
              onChange={(e) => setPrimaryParty(e.target.value)}
              placeholder="alice::1220…"
            />
            <p className="text-muted-foreground text-[12px]">
              Optional. Use the full party ID, which you can copy from the Parties page.
            </p>
          </div>

          <label className="flex items-start gap-2.5">
            <Checkbox
              checked={grantPartyRights}
              onCheckedChange={(v) => setGrantPartyRights(v === true)}
              disabled={!primaryParty.trim()}
              className="mt-0.5"
            />
            <span className="text-[13px]">
              Grant act-as and read-as for the primary party
              <span className="text-muted-foreground block text-[12px]">
                Without these the user exists but cannot submit or read anything.
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
