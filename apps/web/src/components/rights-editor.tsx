"use client"

import { AlertTriangle, Plus, X } from "lucide-react"
import { useState, type ReactNode } from "react"
import { PartyId } from "@/components/party-id"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useGrantRights, useRevokeRights, useUserRights } from "@/lib/queries"
import type { UserRight } from "@/lib/types"

const KINDS = [
  { value: "CanActAs", label: "Can act as", needsParty: true },
  { value: "CanReadAs", label: "Can read as", needsParty: true },
  { value: "ParticipantAdmin", label: "Participant admin", needsParty: false },
  { value: "IdentityProviderAdmin", label: "Identity provider admin", needsParty: false },
  { value: "CanReadAsAnyParty", label: "Can read as any party", needsParty: false },
] as const

type Kind = (typeof KINDS)[number]["value"]

/** Stable identity for a right, so React keys and comparisons behave. */
function rightKey(r: UserRight): string {
  return "party" in r ? `${r.kind}:${r.party}` : r.kind
}

export function RightsEditor({
  nodeId,
  userId,
  trigger,
}: {
  nodeId: string
  userId: string
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>("CanActAs")
  const [party, setParty] = useState("")

  const { data: rights, isLoading } = useUserRights(nodeId, userId, open)
  const grant = useGrantRights(nodeId, userId)
  const revoke = useRevokeRights(nodeId, userId)

  const needsParty = KINDS.find((k) => k.value === kind)?.needsParty ?? false
  const canAdd = needsParty ? party.trim().length > 0 : true

  async function add() {
    const right = (needsParty ? { kind, party: party.trim() } : { kind }) as UserRight
    await grant.mutateAsync([right]).catch(() => {})
    setParty("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rights</DialogTitle>
          <DialogDescription>
            <span className="ident">{userId}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="eyebrow mb-2">Current rights</p>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-2/3" />
                <Skeleton className="h-7 w-1/2" />
              </div>
            ) : !rights || rights.length === 0 ? (
              <p className="text-muted-foreground text-[13px]">
                This user has no rights and cannot act on the ledger.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {rights.map((r) => (
                  <li
                    key={rightKey(r)}
                    className="flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge variant="secondary" className="shrink-0">
                        {r.kind}
                      </Badge>
                      {"party" in r ? <PartyId value={r.party} /> : null}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Revoke ${r.kind}`}
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate([r])}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {rights?.some((r) => r.kind === "ParticipantAdmin") ? (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription>
                Revoking participant admin from the user this console authenticates as will lock the
                console out of this node.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2 rounded-md border p-3">
            <p className="eyebrow">Add a right</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1 space-y-1.5">
                <Label htmlFor="right-kind" className="text-[13px]">
                  Kind
                </Label>
                <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                  <SelectTrigger id="right-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {needsParty ? (
                <div className="min-w-64 flex-[2] space-y-1.5">
                  <Label htmlFor="right-party" className="text-[13px]">
                    Party
                  </Label>
                  <Input
                    id="right-party"
                    className="ident"
                    value={party}
                    onChange={(e) => setParty(e.target.value)}
                    placeholder="alice::1220…"
                  />
                </div>
              ) : null}

              <Button onClick={add} disabled={!canAdd || grant.isPending}>
                <Plus className="size-3.5" />
                Grant
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
