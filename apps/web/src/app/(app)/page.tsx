import { Suspense } from "react"
import { PageHeader } from "@/components/app-shell"
import { DashboardView } from "@/components/dashboard-view"
import { DataPanel } from "@/components/data-panel"

/**
 * The frame the prerendered HTML ships with. Without it the statically rendered
 * page is an empty content region — no header, no panel — until hydration, while
 * every other panel in the app has a skeleton. Title and description match the
 * view's own header exactly, so nothing shifts when it takes over.
 */
function DashboardFrame() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Fleet health, and everything else for one network at a time."
      />
      <div className="space-y-5 p-5">
        <DataPanel
          title="Node health"
          description="Every registered node, in every network. Checked when this page loaded."
          isLoading
          loadingRows={3}
          flush
        >
          {null}
        </DataPanel>
      </div>
    </>
  )
}

/**
 * The view reads `?network=` with `useSearchParams`, which needs a Suspense
 * boundary above it. Keeping the page itself a server component is what provides
 * one without opting the whole route out of static rendering.
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFrame />}>
      <DashboardView />
    </Suspense>
  )
}
