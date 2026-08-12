import { redirect } from 'next/navigation'
import { backendFetch } from '@/lib/auth'
import type { ToolExecution } from '@/types/models'
import { LogsClient } from './logs-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ToolLogsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params

  const logs = await backendFetch<ToolExecution[]>(`/api/logs?workspaceId=${workspaceId}`)
  if (logs === null) redirect('/login')

  return <LogsClient logs={logs} />
}
