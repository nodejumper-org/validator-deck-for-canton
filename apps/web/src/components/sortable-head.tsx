"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { TableHead } from "@/components/ui/table"
import type { NodeSort, NodeSortKey } from "@/lib/node-sort"
import { cn } from "@/lib/utils"

/**
 * A column header that sorts, shared by the two tables that list nodes.
 *
 * It renders the cell as well as the button because `aria-sort` belongs on the
 * cell while the click target has to be the button for keyboard users — a
 * caller wiring those up separately gets one of them wrong sooner or later.
 *
 * The arrow keeps its space when inactive, so switching columns does not shift
 * the header text sideways.
 */
export function SortableHead({
  column,
  sort,
  onSort,
  className,
  children,
}: {
  column: NodeSortKey
  sort: NodeSort
  onSort: (key: NodeSortKey) => void
  className?: string
  children: string
}) {
  const active = sort.key === column
  const Arrow = active && sort.direction === "desc" ? ChevronDown : ChevronUp

  return (
    <TableHead
      className={className}
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="hover:text-foreground -m-1 flex items-center gap-1 p-1"
      >
        {children}
        <Arrow className={cn("size-3", active ? "opacity-100" : "opacity-0")} aria-hidden />
      </button>
    </TableHead>
  )
}
