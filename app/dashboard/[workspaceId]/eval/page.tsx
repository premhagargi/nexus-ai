import { requireWorkspaceAccess } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { RAGEvalClient } from './eval-client'

export const dynamic = 'force-dynamic'

export default async function RAGEvalPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const auth = await requireWorkspaceAccess(workspaceId)

  if (!auth) {
    redirect('/dashboard')
  }

  return <RAGEvalClient workspaceId={workspaceId} />
}
