import type { ReactNode } from "react"
import { AppShell } from "@/components/app-shell"

/**
 * Everything behind a session. The auth route group deliberately sits outside
 * this, so sign-in renders without navigation.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
