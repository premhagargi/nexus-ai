import prisma from '@/lib/prisma'
import { LogsClient } from './logs-client'

export default async function ToolLogsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params

  const logs = await prisma.toolExecution.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  })

  return <LogsClient logs={logs} />
}
