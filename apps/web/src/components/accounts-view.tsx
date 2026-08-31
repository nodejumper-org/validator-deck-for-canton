"use client"

import { MoreHorizontal, UserPlus } from "lucide-react"
import { useState } from "react"
import { AccountCreateDialog } from "@/components/account-create-dialog"
import { AccountDeleteDialog } from "@/components/account-delete-dialog"
import { AccountPasswordDialog } from "@/components/account-password-dialog"
import { PageHeader } from "@/components/app-shell"
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
  useSetAccountRole,
  useUnbanAccount,
} from "@/lib/queries"

export function AccountsView() {
  const { data: accounts, isPending } = useAccounts()
  const { data: session } = useSession()
  const ban = useBanAccount()
  const unban = useUnbanAccount()
  const setRole = useSetAccountRole()
  const [createOpen, setCreateOpen] = useState(false)
  const [passwordFor, setPasswordFor] = useState<Account | null>(null)
  const [deleteFor, setDeleteFor] = useState<Account | null>(null)

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
                // The role of an account that signs in through the provider is
                // decided by its Keycloak group and re-decided at every
                // sign-in, so offering the action here would be offering one
                // that silently reverts. The route refuses it too; this is the
                // half the operator can see.
                const roleIsUpstream = account.providers.includes("oidc")
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
                            {roleIsUpstream ? (
                              <DropdownMenuItem disabled>
                                Role set by identity provider
                              </DropdownMenuItem>
                            ) : (
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
                            )}
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
      </div>

      <AccountCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AccountPasswordDialog account={passwordFor} onClose={() => setPasswordFor(null)} />
      <AccountDeleteDialog account={deleteFor} onClose={() => setDeleteFor(null)} />
    </div>
  )
}
