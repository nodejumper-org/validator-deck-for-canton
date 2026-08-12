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
import { type Account, useAccounts, useBanAccount, useUnbanAccount } from "@/lib/queries"

export function AccountsView() {
  const { data: accounts, isPending } = useAccounts()
  const { data: session } = useSession()
  const ban = useBanAccount()
  const unban = useUnbanAccount()
  const [createOpen, setCreateOpen] = useState(false)
  const [passwordFor, setPasswordFor] = useState<Account | null>(null)
  const [deleteFor, setDeleteFor] = useState<Account | null>(null)

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Who can sign in. Each account sees only its own nodes."
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
