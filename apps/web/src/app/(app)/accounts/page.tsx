import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { AccountsView } from "@/components/accounts-view"
import { getAuth } from "@/server/auth"

export const metadata = { title: "Accounts" }
export const dynamic = "force-dynamic"

/**
 * Gate, not boundary: the admin plugin re-checks the role on every endpoint.
 * notFound (not redirect) so non-admins learn nothing about the route.
 */
export default async function AccountsPage() {
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user.role !== "admin") notFound()
  return <AccountsView />
}
