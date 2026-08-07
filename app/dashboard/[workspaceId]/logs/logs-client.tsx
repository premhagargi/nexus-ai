'use client'

import { ToolExecution } from '@prisma/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Info, CheckCircle2, XCircle, Activity } from 'lucide-react'

export function LogsClient({ logs }: { logs: any[] }) {
  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tighter text-foreground">Tool Execution Logs</h2>
            <p className="text-sm text-muted-foreground mt-0.5 font-medium">
              Audit trail for AI tool usage in this workspace.
            </p>
          </div>
        </div>
        <div className="text-xs font-medium text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-lg border border-border">
          {logs.length} {logs.length === 1 ? 'execution' : 'executions'}
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Activity className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">No tool executions yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              When the AI assistant runs tools (like saving tasks or summarizing documents), audit logs will appear here.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border">
                <TableHead className="w-[180px] font-semibold text-xs uppercase tracking-wider text-muted-foreground py-3">Tool Name</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground py-3">Arguments Summary</TableHead>
                <TableHead className="w-[120px] font-semibold text-xs uppercase tracking-wider text-muted-foreground py-3">Status</TableHead>
                <TableHead className="w-[180px] font-semibold text-xs uppercase tracking-wider text-muted-foreground py-3">Timestamp</TableHead>
                <TableHead className="w-[70px] text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground py-3">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const isSuccess = (log.result as any)?.status === 'success' || !(log.result as any)?.error
                const date = new Date(log.createdAt)
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

                // Generate short summary of arguments
                const argsObj = log.arguments as Record<string, any> || {}
                const argsSummary = Object.entries(argsObj)
                  .map(([k, v]) => `${k}: "${String(v).slice(0, 35)}${String(v).length > 35 ? '...' : ''}"`)
                  .join(' · ') || 'No parameters'

                return (
                  <TableRow key={log.id} className="border-border hover:bg-muted/30 transition-colors">
                    {/* Tool Name */}
                    <TableCell className="py-3 font-medium">
                      <Badge
                        variant="outline"
                        className={`font-mono text-xs px-2 py-0.5 rounded-md border ${
                          log.toolName === 'save_task'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        }`}
                      >
                        {log.toolName}
                      </Badge>
                    </TableCell>

                    {/* Arguments Summary */}
                    <TableCell className="py-3 text-xs font-mono text-muted-foreground truncate max-w-[320px]">
                      {argsSummary}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      {isSuccess ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-500">
                          <XCircle className="h-3.5 w-3.5" />
                          Failed
                        </span>
                      )}
                    </TableCell>

                    {/* Timestamp */}
                    <TableCell className="py-3 text-xs text-muted-foreground font-mono">
                      <span>{dateStr}</span> <span className="text-muted-foreground/60">{timeStr}</span>
                    </TableCell>

                    {/* Info Popover */}
                    <TableCell className="py-3 text-right">
                      <Popover>
                        <PopoverTrigger>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                            aria-label="View execution details"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[420px] p-4 bg-popover border-border shadow-xl rounded-xl">
                          <PopoverHeader className="pb-3 border-b border-border/60">
                            <div className="flex items-center justify-between">
                              <PopoverTitle className="text-sm font-semibold font-mono flex items-center gap-2">
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {log.toolName}
                                </Badge>
                              </PopoverTitle>
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {timeStr}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Execution ID: <span className="font-mono text-foreground">{log.id.slice(0, 18)}...</span>
                            </p>
                          </PopoverHeader>

                          <div className="space-y-3.5 pt-3 text-xs">
                            {/* Arguments block */}
                            <div>
                              <span className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider block mb-1.5">
                                Arguments
                              </span>
                              <pre className="bg-muted/80 p-2.5 rounded-lg border border-border text-[11px] font-mono overflow-x-auto max-h-40 whitespace-pre-wrap break-all text-foreground">
                                {JSON.stringify(log.arguments, null, 2)}
                              </pre>
                            </div>

                            {/* Result block */}
                            <div>
                              <span className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider block mb-1.5">
                                Execution Result
                              </span>
                              <pre className="bg-muted/80 p-2.5 rounded-lg border border-border text-[11px] font-mono overflow-x-auto max-h-48 whitespace-pre-wrap break-all text-foreground">
                                {JSON.stringify(log.result, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
