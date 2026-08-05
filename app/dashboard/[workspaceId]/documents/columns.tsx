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

      if (status === 'PROCESSING') {
        return (
          <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/10 shadow-none font-medium text-[11px] uppercase tracking-wider flex items-center gap-1.5 w-fit">
            <Spinner className="h-3 w-3 text-amber-500 animate-spin" />
            Processing
          </Badge>
        )
      }
      if (status === 'COMPLETED') {
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/10 shadow-none font-medium text-[11px] uppercase tracking-wider w-fit">
            Processed
          </Badge>
        )
      }
      if (status === 'FAILED') {
        return (
          <Badge className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/10 shadow-none font-medium text-[11px] uppercase tracking-wider w-fit">
            Failed
          </Badge>
        )
      }
      return (
        <Badge variant="secondary" className="shadow-none font-medium text-[11px] uppercase tracking-wider w-fit">
          {status}
        </Badge>
      )
    }
  },
  {
    accessorKey: "createdAt",
    header: "Uploaded",
    cell: ({ row }) => {
      const val = row.getValue("createdAt")
      let dateStr = "Just now"
      if (val) {
        try {
          const d = new Date(val as string | Date)
          if (!isNaN(d.getTime())) {
            dateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          }
        } catch (e) {}
      }
      return <div className="text-muted-foreground font-medium text-[13px]">{dateStr}</div>
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
