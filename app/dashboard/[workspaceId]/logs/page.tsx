import prisma from '@/lib/prisma'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle2, XCircle, Terminal } from 'lucide-react'

export default async function ToolLogsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params

  const logs = await prisma.toolExecution.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="flex flex-col h-full gap-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800">
          <Terminal className="h-4 w-4 text-zinc-400" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Tool Execution Logs</h2>
          <p className="text-[12px] text-muted-foreground">Audit trail for AI tool calls in this workspace</p>
        </div>
        <div className="ml-auto text-[11px] font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border">
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>

      {/* Log terminal */}
      <div className="flex-1 min-h-0 rounded-xl border border-border bg-zinc-950 overflow-hidden shadow-inner">
        {/* Terminal top bar */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          <span className="ml-3 text-[11px] text-zinc-500 font-mono">tool-execution-log</span>
        </div>

        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Terminal className="h-6 w-6 text-zinc-700" />
            <p className="text-[12px] text-zinc-600 font-mono">
              No tool calls yet — ask the AI to create a task or summarize the workspace.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 font-mono text-[12px] space-y-0">
              {logs.map((log, i) => {
                const isSuccess = (log.result as any)?.status === 'success'
                const ts = new Date(log.createdAt)
                const timeStr = ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                const dateStr = ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

                return (
                  <div
                    key={log.id}
                    className={`group flex flex-col gap-1.5 py-3 ${i !== logs.length - 1 ? 'border-b border-zinc-800/60' : ''}`}
                  >
                    {/* Log line header */}
                    <div className="flex items-center gap-3">
                      {/* Status dot */}
                      {isSuccess ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      )}

                      {/* Timestamp */}
                      <span className="text-zinc-600 shrink-0 tabular-nums">
                        {dateStr} {timeStr}
                      </span>

                      {/* Tool name badge */}
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold tracking-wide shrink-0 ${
                        log.toolName === 'save_task'
                          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                          : 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                      }`}>
                        {log.toolName}
                      </span>

                      {/* Args inline preview */}
                      <span className="text-zinc-500 truncate">
                        {Object.entries(log.arguments as Record<string, any>)
                          .map(([k, v]) => `${k}="${String(v).slice(0, 40)}"`)
                          .join(' ')}
                      </span>

                      {/* Status text */}
                      <span className={`ml-auto shrink-0 text-[11px] ${isSuccess ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isSuccess ? '✓ success' : '✗ failed'}
                      </span>
                    </div>

                    {/* Expandable result */}
                    <div className="ml-6 pl-3 border-l border-zinc-800 text-zinc-500 text-[11px] leading-relaxed">
                      <span className="text-zinc-600">result → </span>
                      <span className="text-zinc-400">
                        {JSON.stringify(log.result).slice(0, 200)}
                        {JSON.stringify(log.result).length > 200 ? '…' : ''}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
