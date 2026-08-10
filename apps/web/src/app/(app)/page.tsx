import { Suspense } from "react"
import { DashboardView } from "@/components/dashboard-view"

/**
 * The view reads `?network=` with `useSearchParams`, which needs a Suspense
 * boundary above it. Keeping the page itself a server component is what provides
 * one without opting the whole route out of static rendering.
 */
export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardView />
    </Suspense>
  )
}
