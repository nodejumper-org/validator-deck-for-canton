"use client"

import { Boxes, Gauge, Server, Users, Wallet, Landmark, Package } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { LogoMark } from "@/components/logo"
import { NetworkBadge } from "@/components/network-badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/user-menu"
import { BRAND } from "@/lib/brand"
import { useNodes } from "@/lib/queries"
import { cn } from "@/lib/utils"

const TOP_LEVEL = [
  // Gauge, not LayoutDashboard: the logo mark above it is already a 2×2 of
  // squares, and two grids stacked in the rail read as the same glyph twice.
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/nodes", label: "Nodes", icon: Server },
]

const NODE_TABS = [
  { segment: "", label: "Overview", icon: Landmark },
  { segment: "/users", label: "Users", icon: Users },
  { segment: "/parties", label: "Parties", icon: Boxes },
  { segment: "/packages", label: "Packages", icon: Package },
  { segment: "/validator", label: "Validator", icon: Wallet },
]

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  nested,
}: {
  href: string
  label: string
  icon: typeof Server
  active: boolean
  nested?: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        nested && "ml-3",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  )
}

/**
 * The node a command will run against is the highest-stakes piece of state here,
 * so it is structural rather than a breadcrumb: when you are inside a node, its
 * name, network, and sub-navigation are nested under Nodes in the rail.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { data: nodes } = useNodes()

  const match = /^\/nodes\/([^/]+)/.exec(pathname)
  const activeNodeId = match?.[1]
  const activeNode = activeNodeId ? nodes?.find((n) => n.id === activeNodeId) : undefined

  return (
    <div className="flex min-h-dvh">
      <aside className="bg-sidebar sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r md:flex">
        <div className="flex min-w-0 items-center gap-2 py-3 pr-3 pl-4">
          <LogoMark className="size-4" />
          <span className="font-heading truncate text-[15px] font-semibold tracking-tight">
            {BRAND.name}
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {TOP_LEVEL.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
            />
          ))}

          {activeNode ? (
            <div className="mt-1 space-y-0.5 border-l pl-2 ml-4">
              <div className="flex items-center gap-2 px-2.5 py-1.5">
                <span className="truncate text-[13px] font-medium">{activeNode.name}</span>
                <NetworkBadge network={activeNode.network} />
              </div>
              {NODE_TABS.filter(
                (tab) => tab.segment !== "/validator" || activeNode.validatorApiUrl,
              ).map((tab) => {
                const href = `/nodes/${activeNode.id}${tab.segment}`
                return (
                  <NavLink
                    key={tab.segment || "overview"}
                    href={href}
                    label={tab.label}
                    icon={tab.icon}
                    active={pathname === href}
                  />
                )
              })}
            </div>
          ) : null}
        </nav>

        {/* Next's dev indicator sits at the bottom *left*; the toggle lands at the
            right edge of a 224px rail, so the two do not overlap. */}
        <div className="flex items-center gap-1 border-t p-2">
          <div className="min-w-0 flex-1">
            <UserMenu />
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* Compact top bar stands in for the rail below md. */}
      <header className="bg-sidebar fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b px-4 py-2.5 md:hidden">
        <Link href="/" className="font-heading flex items-center gap-2 text-[15px] font-semibold">
          <LogoMark className="size-4" />
          {BRAND.name}
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/nodes" className="text-muted-foreground text-[13px]">
            Nodes
          </Link>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <main className="min-w-0 flex-1 pt-14 md:pt-0">{children}</main>
    </div>
  )
}

/** Page header used by every route below the shell. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
      <div className="min-w-0">
        <h1 className="font-heading text-[20px] leading-tight font-semibold">{title}</h1>
        {description ? (
          <div className="text-muted-foreground mt-1 text-[13px]">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
