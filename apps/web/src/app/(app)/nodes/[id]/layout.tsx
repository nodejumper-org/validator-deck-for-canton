import type { ReactNode } from "react"

/**
 * Node sub-navigation lives in the sidebar (see AppShell) rather than as tabs
 * here, so the node you are operating on is always visible alongside the rest of
 * the app rather than only once you have scrolled to the page header.
 */
export default function NodeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
