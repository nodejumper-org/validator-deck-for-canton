"use client"

import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut, useSession } from "@/lib/auth-client"

export function UserMenu() {
  const router = useRouter()
  const { data: session, isPending } = useSession()

  if (isPending || !session?.user) return null

  const { name, email } = session.user
  const initial = (name || email || "?").charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-2.5 px-2.5 py-1.5"
          aria-label="Account"
        >
          <span className="bg-sidebar-accent text-sidebar-accent-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium">
            {initial}
          </span>
          <span className="min-w-0 truncate text-[13px] font-normal">{name || email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-[13px] font-medium">{name}</span>
          <span className="text-muted-foreground block truncate text-[12px]">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut()
            router.push("/sign-in")
            router.refresh()
          }}
        >
          <LogOut className="size-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
