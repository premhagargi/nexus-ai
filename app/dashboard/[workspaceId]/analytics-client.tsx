'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Files, MessageSquare, CheckSquare, Activity, Cpu, ShieldCheck, ArrowUpRight, Database } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export interface AnalyticsProps {
  docCount: number
  chunkCount: number
  taskCount: number
  completedTaskCount: number
  convCount: number
  toolExecutionCount: number
  recentLogs: Array<{
    id: string
    toolName: string
    createdAt: string
    status: string
  }>
  chartData: Array<{
    name: string
    documents: number
    chunks: number
    tasks: number
  }>
}

export function AnalyticsDashboard({
  docCount,
  chunkCount,
  taskCount,
  completedTaskCount,
  convCount,
  toolExecutionCount,
  recentLogs,
  chartData,
}: AnalyticsProps) {
  const taskCompletionPct = taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 100

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 w-full pb-10">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900/20 via-purple-900/10 to-background p-6 border border-border/60 shadow-xl">
        <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
          <div className="w-64 h-64 bg-indigo-500 rounded-full blur-[90px] animate-pulse"></div>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Cpu className="h-3.5 w-3.5" /> Workspace Intelligence Hub
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Command Center
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              Real-time analytics for vector storage, RAG query performance, and autonomous AI tool executions.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-card/60 backdrop-blur-xl border border-border/80 p-3 rounded-xl">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Tenant Isolation</span>
              <span className="text-xs font-bold text-emerald-400">pgvector Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border/60 shadow-sm hover:border-indigo-500/40 transition-all group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Knowledge Base</CardTitle>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
              <Files className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold tracking-tight text-foreground">{docCount} Docs</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-mono">
              <Database className="h-3 w-3 text-indigo-400" /> {chunkCount} total vector chunks
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/60 shadow-sm hover:border-purple-500/40 transition-all group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Sessions</CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
              <MessageSquare className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold tracking-tight text-foreground">{convCount} Chats</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              Hybrid RAG & SSE Streaming
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/60 shadow-sm hover:border-pink-500/40 transition-all group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tasks Progress</CardTitle>
            <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 group-hover:scale-110 transition-transform">
              <CheckSquare className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold tracking-tight text-foreground">{completedTaskCount} / {taskCount}</div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-gradient-to-r from-pink-500 to-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${taskCompletionPct}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/60 shadow-sm hover:border-emerald-500/40 transition-all group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tool Audit Logs</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold tracking-tight text-foreground">{toolExecutionCount} Runs</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              100% Audit Logging
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart & Activity Row */}
      <div className="grid gap-6 md:grid-cols-7">
        {/* Activity Area Chart */}
        <Card className="md:col-span-4 border-border/60 shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Workspace Ingestion & Activity</CardTitle>
            <CardDescription className="text-xs">Document vector chunks vs tasks over time</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorChunks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="chunks" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorChunks)" name="Vector Chunks" />
                  <Area type="monotone" dataKey="tasks" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#colorTasks)" name="Tasks" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Audit Feed */}
        <Card className="md:col-span-3 border-border/60 shadow-sm bg-card flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Recent Tool Activity</span>
              <Activity className="h-4 w-4 text-indigo-400" />
            </CardTitle>
            <CardDescription className="text-xs">Live execution audit feed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 overflow-y-auto max-h-[260px] pr-1">
            {recentLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No tool executions recorded yet.</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/40 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                      {log.toolName}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
