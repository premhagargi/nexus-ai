import { redirect } from 'next/navigation'
import { backendFetch } from '@/lib/auth'
import { RAGEvalClient } from './eval-client'

export const dynamic = 'force-dynamic'

export default async function RAGEvalPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params

  // Confirms membership before rendering, same as the other dashboard pages.
  const workspace = await backendFetch(`/api/workspaces/${workspaceId}`)
  if (workspace === null) redirect('/login')

  return <RAGEvalClient workspaceId={workspaceId} />
}
