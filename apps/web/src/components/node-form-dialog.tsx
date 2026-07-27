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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCreateNode, useUpdateNode } from "@/lib/queries"
import type { Network, NodeSummary } from "@/lib/types"

type Fields = {
  name: string
  network: Network
  ledgerApiUrl: string
  validatorApiUrl: string
  authTokenUrl: string
  authClientId: string
  authClientSecret: string
  authAudience: string
  authScope: string
}

const EMPTY: Fields = {
  name: "",
  network: "devnet",
  ledgerApiUrl: "",
  validatorApiUrl: "",
  authTokenUrl: "",
  authClientId: "",
  authClientSecret: "",
  authAudience: "",
  authScope: "daml_ledger_api",
}

function fromNode(node: NodeSummary): Fields {
  return {
    name: node.name,
    network: node.network,
    ledgerApiUrl: node.ledgerApiUrl,
    validatorApiUrl: node.validatorApiUrl ?? "",
    authTokenUrl: node.authTokenUrl,
    authClientId: node.authClientId,
    authClientSecret: "",
    authAudience: node.authAudience ?? "",
    authScope: node.authScope ?? "",
  }
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px]">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-muted-foreground text-[12px]">{hint}</p> : null}
    </div>
  )
}

type Props = {
  mode: "create" | "edit"
  node?: NodeSummary
  trigger: ReactNode
}

export function NodeFormDialog({ mode, node, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState<Fields>(node ? fromNode(node) : EMPTY)

  const create = useCreateNode()
  const update = useUpdateNode(node?.id ?? "")
  const mutation = mode === "create" ? create : update
  const set = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setFields((f) => ({ ...f, [key]: value }))

  function reset(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) setFields(node ? fromNode(node) : EMPTY)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload: Record<string, unknown> = { ...fields }
    // An untouched secret field means "keep the stored one".
    if (mode === "edit" && !fields.authClientSecret) delete payload.authClientSecret
    try {
      await mutation.mutateAsync(payload)
      setOpen(false)
    } catch {
      // useNodeMutation already toasts the server's message.
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Register a node" : `Edit ${node?.name}`}</DialogTitle>
          <DialogDescription>
            The console reaches the node over its JSON APIs and authenticates with OIDC client
            credentials. Nothing is stored on the node itself.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label="Name">
              <Input
                id="name"
                required
                value={fields.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="devnet participant"
              />
            </Field>

            <Field id="network" label="Network">
              <Select
                value={fields.network}
                onValueChange={(v) => set("network", v as Network)}
              >
                <SelectTrigger id="network" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="devnet">devnet</SelectItem>
                  <SelectItem value="testnet">testnet</SelectItem>
                  <SelectItem value="mainnet">mainnet</SelectItem>
                  <SelectItem value="local">local</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field id="ledgerApiUrl" label="Ledger API URL" hint="The JSON Ledger API v2 base URL.">
            <Input
              id="ledgerApiUrl"
              required
              className="ident"
              value={fields.ledgerApiUrl}
              onChange={(e) => set("ledgerApiUrl", e.target.value)}
              placeholder="https://ledger-api.example.com"
            />
          </Field>

          <Field
            id="validatorApiUrl"
            label="Validator API URL"
            hint="Leave empty for a participant-only node — the validator pages stay hidden."
          >
            <Input
              id="validatorApiUrl"
              className="ident"
              value={fields.validatorApiUrl}
              onChange={(e) => set("validatorApiUrl", e.target.value)}
              placeholder="https://validator-api.example.com"
            />
          </Field>

          <div className="space-y-4 rounded-md border p-3">
            <p className="eyebrow">Authentication</p>

            <Field
              id="authTokenUrl"
              label="Token endpoint"
              hint="The OIDC token URL, usually ending in /protocol/openid-connect/token."
            >
              <Input
                id="authTokenUrl"
                required
                className="ident"
                value={fields.authTokenUrl}
                onChange={(e) => set("authTokenUrl", e.target.value)}
                placeholder="https://auth.example.com/realms/canton/protocol/openid-connect/token"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="authClientId" label="Client ID">
                <Input
                  id="authClientId"
                  required
                  className="ident"
                  value={fields.authClientId}
                  onChange={(e) => set("authClientId", e.target.value)}
                />
              </Field>

              <Field
                id="authClientSecret"
                label="Client secret"
                hint={mode === "edit" ? "Leave blank to keep the stored secret." : undefined}
              >
                <Input
                  id="authClientSecret"
                  type="password"
                  required={mode === "create"}
                  className="ident"
                  value={fields.authClientSecret}
                  onChange={(e) => set("authClientSecret", e.target.value)}
                  placeholder={mode === "edit" ? "••••••••" : ""}
                />
              </Field>

              <Field id="authAudience" label="Audience">
                <Input
                  id="authAudience"
                  className="ident"
                  value={fields.authAudience}
                  onChange={(e) => set("authAudience", e.target.value)}
                  placeholder="https://validator.example.com"
                />
              </Field>

              <Field id="authScope" label="Scope">
                <Input
                  id="authScope"
                  className="ident"
                  value={fields.authScope}
                  onChange={(e) => set("authScope", e.target.value)}
                  placeholder="daml_ledger_api"
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Saving…"
                : mode === "create"
                  ? "Register node"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
