import { redirect } from 'next/navigation'
import { backendFetch } from '@/lib/auth'
import type { Task } from '@/types/models'
import { TasksClient } from './tasks-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TasksPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params

  const tasks = await backendFetch<Task[]>(`/api/tasks?workspaceId=${workspaceId}`)
  if (tasks === null) redirect('/login')

  return <TasksClient initialTasks={tasks} workspaceId={workspaceId} />
}
