"use client"

import { ChevronRight } from "lucide-react"
import { Fragment, use, useMemo, useState } from "react"
import { PageHeader } from "@/components/app-shell"
import { Copyable } from "@/components/copyable"
import { DarUploadDialog } from "@/components/dar-upload-dialog"
import { DataPanel, EmptyState } from "@/components/data-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCount } from "@/lib/format"
import { filterGroups, groupPackages } from "@/lib/package-groups"
import { usePackages } from "@/lib/queries"
import type { VettedPackage } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function PackagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [search, setSearch] = useState("")
  // Only rows the operator toggled. A row absent here follows the filter, which
  // opens it when the only match is an earlier version's package ID. Editing the
  // filter clears these, or a row closed by hand earlier would hide that match.
  const [toggled, setToggled] = useState<Map<string, boolean>>(new Map())
  const { data, isLoading, error } = usePackages(id)

  const groups = useMemo(() => groupPackages(data?.packages ?? []), [data])
  const matches = useMemo(() => filterGroups(groups, search), [groups, search])
  const withEarlier = groups.filter((g) =>
    g.older.some((p) => p.packageVersion !== g.latest.packageVersion),
  ).length

  function toggle(key: string, expanded: boolean) {
    setToggled((prev) => new Map(prev).set(key, !expanded))
  }

  const uploadButton = (
    <DarUploadDialog nodeId={id} trigger={<Button size="sm">Upload DARs</Button>} />
  )

  // The page is exactly one window tall, less the mobile top bar, so the table
  // ends at the bottom edge and scrolls inside with its header pinned. A short
  // list keeps its own height; min-h stops a tiny window squeezing it to nothing.
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[28rem] flex-col md:h-dvh">
      <PageHeader
        title="Packages"
        description="Daml packages vetted by this participant on its synchronizer."
        actions={uploadButton}
      />

      <div className="flex min-h-0 flex-col p-5">
        <DataPanel
          fill
          title="Vetted packages"
          description={
            data
              ? `${formatCount(data.packages.length)} packages across ${formatCount(
                  groups.length,
                )} names` +
                (withEarlier
                  ? `, ${formatCount(withEarlier)} with earlier versions still vetted`
                  : "")
              : undefined
          }
          actions={
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setToggled(new Map())
              }}
              placeholder="Filter by name or package ID"
              className="h-8 w-64"
              aria-label="Filter packages"
            />
          }
          isLoading={isLoading}
          error={error as { message: string } | null}
          flush
        >
          {matches.length === 0 ? (
            <EmptyState
              title={data?.packages.length ? "No packages match that filter" : "No vetted packages"}
              hint={
                data?.packages.length
                  ? undefined
                  : "Upload a DAR to make its packages available on this participant."
              }
              action={data?.packages.length ? undefined : uploadButton}
            />
          ) : (
            <Table containerClassName="min-h-0 overflow-auto">
              {/* Sticky and background sit on the cells, the form every engine pins. The
                  inset shadow stands in for the row border, which a collapsed-border
                  table leaves behind once the header is pinned. */}
              <TableHeader className="[&_th]:bg-card [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:shadow-[inset_0_-1px_0_var(--color-border)]">
                <TableRow>
                  <TableHead className="w-[38%]">Name</TableHead>
                  <TableHead className="w-[26%]">Version</TableHead>
                  <TableHead>Package ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map(({ group, reveal }) => {
                  const key = group.name || group.latest.packageId
                  const expanded = toggled.get(key) ?? reveal
                  const more = group.older.length
                  const label = group.name || "—"
                  return (
                    <Fragment key={key}>
                      <TableRow>
                        <TableCell className="ident font-medium">
                          {more ? (
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-label={`${expanded ? "Hide" : "Show"} ${more} more ${
                                more === 1 ? "package" : "packages"
                              } named ${label}`}
                              onClick={() => toggle(key, expanded)}
                              className="focus-visible:ring-ring -mx-1 inline-flex w-full items-center gap-1.5 rounded-sm px-1 text-left focus-visible:ring-2 focus-visible:outline-none"
                            >
                              <ChevronRight
                                className={cn(
                                  "text-muted-foreground size-3.5 shrink-0 transition-transform",
                                  expanded && "rotate-90",
                                )}
                                aria-hidden
                              />
                              <span className="truncate">{label}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="size-3.5 shrink-0" aria-hidden />
                              {label}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="ident text-muted-foreground">
                          {group.latest.packageVersion || "—"}
                          {more ? (
                            <span className="tabular ml-2 font-sans text-[12px]">
                              +{more} more
                            </span>
                          ) : null}
                        </TableCell>
                        <PackageIdCell pkg={group.latest} />
                      </TableRow>
                      {expanded
                        ? group.older.map((p) => (
                            <TableRow key={p.packageId} className="bg-muted/40">
                              <TableCell className="ident text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="size-3.5 shrink-0" aria-hidden />
                                  {label}
                                </span>
                              </TableCell>
                              <TableCell className="ident text-muted-foreground">
                                {p.packageVersion || "—"}
                              </TableCell>
                              <PackageIdCell pkg={p} />
                            </TableRow>
                          ))
                        : null}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </DataPanel>
      </div>
    </div>
  )
}

function PackageIdCell({ pkg }: { pkg: VettedPackage }) {
  return (
    <TableCell className="max-w-0">
      <Copyable value={pkg.packageId} className="ident text-muted-foreground" label="package ID">
        {pkg.packageId.slice(0, 16)}…
      </Copyable>
    </TableCell>
  )
}
