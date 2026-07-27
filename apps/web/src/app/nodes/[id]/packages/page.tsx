"use client"

import { use, useMemo, useState } from "react"
import { PageHeader } from "@/components/app-shell"
import { Copyable } from "@/components/copyable"
import { DarUploadDialog } from "@/components/dar-upload-dialog"
import { DataPanel, EmptyState } from "@/components/data-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCount } from "@/lib/format"
import { usePackages } from "@/lib/queries"

export default function PackagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [search, setSearch] = useState("")
  const { data, isLoading, error } = usePackages(id)

  const shown = useMemo(() => {
    const list = data?.packages ?? []
    const q = search.trim().toLowerCase()
    const filtered = q
      ? list.filter(
          (p) => p.packageName.toLowerCase().includes(q) || p.packageId.toLowerCase().includes(q),
        )
      : list
    return [...filtered].sort(
      (a, b) =>
        a.packageName.localeCompare(b.packageName) ||
        a.packageVersion.localeCompare(b.packageVersion),
    )
  }, [data, search])

  // Only names carrying more than one vetted version are interesting here.
  const sprawl = useMemo(
    () => (data?.versionsByName ?? []).filter((v) => v.versions.length > 1),
    [data],
  )

  const uploadButton = (
    <DarUploadDialog nodeId={id} trigger={<Button size="sm">Upload DAR</Button>} />
  )

  return (
    <>
      <PageHeader
        title="Packages"
        description="Daml packages vetted by this participant on its synchronizer."
        actions={uploadButton}
      />

      <div className="space-y-5 p-5">
        {sprawl.length > 0 ? (
          <DataPanel
            title="Version sprawl"
            description={`${sprawl.length} package ${
              sprawl.length === 1 ? "name has" : "names have"
            } more than one vetted version. Old versions stay vetted until they are explicitly unvetted.`}
          >
            <ul className="space-y-2.5">
              {sprawl.slice(0, 12).map((entry) => (
                <li key={entry.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                  <span className="ident w-56 shrink-0 font-medium">{entry.name}</span>
                  <span className="text-muted-foreground tabular text-[12px]">
                    {entry.versions.length} versions
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {entry.versions.map((v) => (
                      <Badge key={v} variant="secondary" className="ident font-normal">
                        {v}
                      </Badge>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </DataPanel>
        ) : null}

        <DataPanel
          title="Vetted packages"
          description={
            data
              ? `${formatCount(data.packages.length)} packages across ${formatCount(
                  data.versionsByName.length,
                )} names`
              : undefined
          }
          actions={
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or package ID"
              className="h-8 w-64"
              aria-label="Filter packages"
            />
          }
          isLoading={isLoading}
          error={error as { message: string } | null}
          flush
        >
          {shown.length === 0 ? (
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
            <div className="max-h-[32rem] overflow-auto">
              <Table>
                <TableHeader className="bg-card sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-[40%]">Name</TableHead>
                    <TableHead className="w-[18%]">Version</TableHead>
                    <TableHead>Package ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((p) => (
                    <TableRow key={p.packageId}>
                      <TableCell className="ident font-medium">{p.packageName || "—"}</TableCell>
                      <TableCell className="ident text-muted-foreground">
                        {p.packageVersion || "—"}
                      </TableCell>
                      <TableCell className="max-w-0">
                        <Copyable
                          value={p.packageId}
                          className="ident text-muted-foreground"
                          label="package ID"
                        >
                          {p.packageId.slice(0, 16)}…
                        </Copyable>
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
