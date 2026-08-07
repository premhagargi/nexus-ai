import { requireWorkspaceAccess } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { TasksClient } from './tasks-client'

export default async function TasksPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const auth = await requireWorkspaceAccess(workspaceId)

  if (!auth) {
    redirect('/dashboard')
  }

  const tasks = await prisma.task.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  })

  return <TasksClient initialTasks={tasks} workspaceId={workspaceId} />
}
