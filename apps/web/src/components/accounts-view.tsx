"use client"

import { MoreHorizontal, UserPlus } from "lucide-react"
import { useState } from "react"
import { AccountCreateDialog } from "@/components/account-create-dialog"
import { AccountDeleteDialog } from "@/components/account-delete-dialog"
import { AccountPasswordDialog } from "@/components/account-password-dialog"
import { PageHeader } from "@/components/app-shell"
import { NetworkBadge } from "@/components/network-badge"
import { NodeAccessDialog } from "@/components/node-access-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSession } from "@/lib/auth-client"
import {
  type Account,
  useAccounts,
  useBanAccount,
  useNodeAccess,
  useSetAccountRole,
  useUnbanAccount,
} from "@/lib/queries"
import type { NodeAccessRow } from "@/lib/types"

export function AccountsView() {
  const { data: accounts, isPending } = useAccounts()
  const { data: session } = useSession()
  const ban = useBanAccount()
  const unban = useUnbanAccount()
  const setRole = useSetAccountRole()
  const { data: nodeAccess, isPending: nodeAccessPending } = useNodeAccess()
  const [createOpen, setCreateOpen] = useState(false)
  const [passwordFor, setPasswordFor] = useState<Account | null>(null)
  const [deleteFor, setDeleteFor] = useState<Account | null>(null)
  const [accessFor, setAccessFor] = useState<NodeAccessRow | null>(null)

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Who can sign in, who is an admin, and which nodes each account can reach."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="size-4" aria-hidden />
            Add account
          </Button>
        }
      />

      <div className="p-5">
        {isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(accounts ?? []).map((account) => {
                const self = account.id === session?.user.id
                const isAdmin = account.role === "admin"
                return (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      {account.name}
                      {account.role === "admin" ? (
                        <Badge variant="secondary" className="ml-2">
                          admin
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{account.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(account.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {account.banned ? (
                        <Badge variant="destructive">banned</Badge>
                      ) : (
                        <Badge variant="outline">active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {self ? null : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Account actions">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() =>
                                setRole.mutate({
                                  userId: account.id,
                                  role: isAdmin ? "user" : "admin",
                                })
                              }
                            >
                              {isAdmin ? "Revoke admin" : "Make admin"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setPasswordFor(account)}>
                              Set password
                            </DropdownMenuItem>
                            {account.banned ? (
                              <DropdownMenuItem
                                onSelect={() => unban.mutate({ userId: account.id })}
                              >
                                Unban
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => ban.mutate({ userId: account.id })}>
                                Ban
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeleteFor(account)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        <h2 className="mt-8 mb-3 font-medium text-[13px]">Node access</h2>
        {nodeAccessPending ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Node</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>With access</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(nodeAccess ?? []).map((node) => (
                <TableRow key={node.id}>
                  <TableCell className="font-medium">{node.name}</TableCell>
                  <TableCell>
                    <NetworkBadge network={node.network} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{node.owner.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {node.grantees.length === 0
                      ? "Owner only"
                      : node.grantees.map((g) => g.name).join(", ")}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => setAccessFor(node)}>
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AccountCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AccountPasswordDialog account={passwordFor} onClose={() => setPasswordFor(null)} />
      <AccountDeleteDialog account={deleteFor} onClose={() => setDeleteFor(null)} />
      <NodeAccessDialog node={accessFor} onClose={() => setAccessFor(null)} />
    </div>
  )
}
