"use client"

import { KeyRound, MoreHorizontal, Power, Trash2 } from "lucide-react"
import { use, useMemo, useState } from "react"
import { PageHeader } from "@/components/app-shell"
import { Copyable } from "@/components/copyable"
import { CreateUserDialog } from "@/components/create-user-dialog"
import { DataPanel, EmptyState } from "@/components/data-panel"
import { PartyId } from "@/components/party-id"
import { RightsEditor } from "@/components/rights-editor"
import { StatusDot } from "@/components/status-dot"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDeleteUser, useUpdateUser, useUsers } from "@/lib/queries"

export default function UsersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [search, setSearch] = useState("")

  const { data: users, isLoading, error } = useUsers(id)
  const update = useUpdateUser(id)
  const remove = useDeleteUser(id)

  // The list is small enough that filtering client-side beats a round trip.
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q || !users) return users ?? []
    return users.filter(
      (u) => u.id.toLowerCase().includes(q) || u.primaryParty.toLowerCase().includes(q),
    )
  }, [users, search])

  const addButton = (
    <CreateUserDialog nodeId={id} trigger={<Button size="sm">Create user</Button>} />
  )

  return (
    <>
      <PageHeader
        title="Users"
        description="Ledger users that authenticate against this participant's Ledger API."
        actions={addButton}
      />

      <div className="p-5">
        <DataPanel
          title="Ledger users"
          description={users ? `${users.length} total` : undefined}
          actions={
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by user or party"
              className="h-8 w-64"
              aria-label="Filter users"
            />
          }
          isLoading={isLoading}
          error={error as { message: string } | null}
          flush
        >
          {shown.length === 0 ? (
            <EmptyState
              title={users?.length ? "No users match that filter" : "No ledger users yet"}
              hint={
                users?.length
                  ? undefined
                  : "Create a user to let an application authenticate and act on behalf of a party."
              }
              action={users?.length ? undefined : addButton}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">User ID</TableHead>
                    <TableHead className="w-[40%]">Primary party</TableHead>
                    <TableHead className="w-[14%]">Status</TableHead>
                    <TableHead className="w-[12%]">Rights</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="max-w-0">
                        <Copyable value={user.id} className="ident" label="user ID" />
                      </TableCell>
                      <TableCell className="max-w-0">
                        {user.primaryParty ? (
                          <PartyId value={user.primaryParty} />
                        ) : (
                          <span className="text-muted-foreground text-[13px]">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusDot ok={!user.isDeactivated} className="text-[13px]">
                          {user.isDeactivated ? "Deactivated" : "Active"}
                        </StatusDot>
                      </TableCell>
                      <TableCell>
                        <RightsEditor
                          nodeId={id}
                          userId={user.id}
                          trigger={
                            <Button variant="outline" size="sm">
                              <KeyRound className="size-3.5" />
                              Manage
                            </Button>
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Actions for ${user.id}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() =>
                                update.mutate({
                                  userId: user.id,
                                  isDeactivated: !user.isDeactivated,
                                })
                              }
                            >
                              <Power className="size-3.5" />
                              {user.isDeactivated ? "Activate" : "Deactivate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => remove.mutate(user.id)}
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DataPanel>
      </div>
    </>
  )
}
