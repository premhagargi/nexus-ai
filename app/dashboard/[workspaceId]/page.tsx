import { requireWorkspaceAccess } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { AnalyticsDashboard } from './analytics-client'

export default async function WorkspaceOverview({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const auth = await requireWorkspaceAccess(workspaceId)

  if (!auth) {
    redirect('/dashboard')
  }

  const [
    docCount,
    chunkCount,
    taskCount,
    completedTaskCount,
    convCount,
    toolExecutionCount,
    recentLogs,
  ] = await Promise.all([
    prisma.document.count({ where: { workspaceId } }),
    prisma.documentChunk.count({ where: { workspaceId } }),
    prisma.task.count({ where: { workspaceId } }),
    prisma.task.count({ where: { workspaceId, completed: true } }),
    prisma.conversation.count({ where: { workspaceId } }),
    prisma.toolExecution.count({ where: { workspaceId } }),
    prisma.toolExecution.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        toolName: true,
        createdAt: true,
        result: true,
      },
    }),
  ])

  // Mock historical trend data for Recharts area graph
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
      recentLogs={recentLogs.map((l) => ({
        id: l.id,
        toolName: l.toolName,
        createdAt: l.createdAt.toISOString(),
        status: (l.result as any)?.status || 'success',
      }))}
      chartData={chartData}
    />
  )
}
