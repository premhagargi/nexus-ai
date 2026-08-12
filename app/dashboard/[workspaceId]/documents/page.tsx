import { redirect } from 'next/navigation'
import { backendFetch } from '@/lib/auth'
import type { Document } from '@/types/models'
import { DocumentsClient } from './documents-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params

  const documents = await backendFetch<Document[]>(`/api/documents?workspaceId=${workspaceId}`)
  if (documents === null) redirect('/login')

  return (
    <DocumentsClient initialDocuments={documents} workspaceId={workspaceId} />
  )
}
