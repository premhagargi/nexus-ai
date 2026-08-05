"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, MoreHorizontal, FileText } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Document } from "@prisma/client"
import { Spinner } from "@/components/ui/spinner"
import { useEffect, useState } from "react"

const STAGES = [
  { label: 'Parsing',  color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'Chunking', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { label: 'Indexing', color: 'bg-violet-50 text-violet-700 border-violet-200' },
]

function ProcessingStatus() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStage(s => (s + 1) % STAGES.length)
    }, 1200)
    return () => clearInterval(interval)
  }, [])

  const current = STAGES[stage]

  return (
    <div className="flex items-center gap-2">
      <Spinner className="h-3 w-3 shrink-0" />
      <div className="flex items-center gap-1.5">
        {STAGES.map((s, i) => (
          <span
            key={s.label}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border transition-all duration-500 ${
              i === stage
                ? `${s.color} opacity-100 scale-100`
                : 'bg-muted/50 text-muted-foreground/40 border-muted opacity-50 scale-95'
            }`}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export const columns: ColumnDef<Document>[] = [
  {
    accessorKey: "filename",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="hover:bg-muted"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          File Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20">
          <FileText className="h-4 w-4 text-indigo-400" />
        </div>
        <span className="font-semibold text-[15px]">{row.getValue("filename")}</span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status: string = row.getValue("status")
      const isOptimistic = row.original.id.startsWith('optimistic-')

      if (status === 'PROCESSING' || isOptimistic) {
        return <ProcessingStatus />
      }
      if (status === 'COMPLETED') {
        return <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 shadow-none font-medium text-[11px] uppercase tracking-wider">Processed</Badge>
      }
      if (status === 'FAILED') {
        return <Badge className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-50 shadow-none font-medium text-[11px] uppercase tracking-wider">Failed</Badge>
      }
      return <Badge variant="secondary" className="shadow-none font-medium text-[11px] uppercase tracking-wider">{status}</Badge>
    }
  },
  {
    accessorKey: "createdAt",
    header: "Uploaded",
    cell: ({ row }) => {
      return <div className="text-muted-foreground font-medium text-[13px]">{new Date(row.getValue("createdAt")).toLocaleDateString()}</div>
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const doc = row.original
      return (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            } />
            <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-xl border-border rounded-xl">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(doc.id)} className="cursor-pointer hover:bg-muted focus:bg-muted">
                Copy ID
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-muted" />
              <DropdownMenuItem className="text-red-400 focus:text-red-300 cursor-pointer hover:bg-red-500/10 focus:bg-red-500/10">Delete document</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  }
]
