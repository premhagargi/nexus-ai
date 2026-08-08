import { requireWorkspaceAccess } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { LogsClient } from './logs-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ToolLogsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const auth = await requireWorkspaceAccess(workspaceId)

  if (!auth) {
    redirect('/dashboard')
  }

  const logs = await prisma.toolExecution.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  })

  return <LogsClient logs={logs} />
}
