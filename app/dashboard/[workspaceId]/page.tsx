import { redirect } from 'next/navigation'
import { backendFetch } from '@/lib/auth'
import { AnalyticsDashboard } from './analytics-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface WorkspaceStats {
  docCount: number
  chunkCount: number
  taskCount: number
  completedTaskCount: number
  convCount: number
  toolExecutionCount: number
  recentLogs: Array<{ id: string; toolName: string; createdAt: string; status: string }>
}

export default async function WorkspaceOverview({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params

  const stats = await backendFetch<WorkspaceStats>(`/api/workspaces/${workspaceId}/stats`)
  if (stats === null) redirect('/login')

  const { docCount, chunkCount, taskCount, completedTaskCount, convCount, toolExecutionCount, recentLogs } = stats

  // Mock historical trend data for the Recharts area graph — the backend
  // only tracks current counts, not a time series, so this interpolates a
  // plausible-looking 5-day ramp toward today's real totals. Not real
  // history; kept from the original implementation for the UI sparkline.
  const chartData = [
    { name: 'Mon', documents: Math.max(0, docCount - 4), chunks: Math.max(0, chunkCount - 30), tasks: Math.max(0, taskCount - 4) },
    { name: 'Tue', documents: Math.max(0, docCount - 3), chunks: Math.max(0, chunkCount - 20), tasks: Math.max(0, taskCount - 3) },
    { name: 'Wed', documents: Math.max(0, docCount - 2), chunks: Math.max(0, chunkCount - 15), tasks: Math.max(0, taskCount - 2) },
    { name: 'Thu', documents: Math.max(0, docCount - 1), chunks: Math.max(0, chunkCount - 5), tasks: Math.max(0, taskCount - 1) },
    { name: 'Today', documents: docCount, chunks: chunkCount, tasks: taskCount },
  ]

  return (
    <AnalyticsDashboard
      docCount={docCount}
      chunkCount={chunkCount}
      taskCount={taskCount}
      completedTaskCount={completedTaskCount}
      convCount={convCount}
      toolExecutionCount={toolExecutionCount}
      recentLogs={recentLogs}
      chartData={chartData}
    />
  )
}
