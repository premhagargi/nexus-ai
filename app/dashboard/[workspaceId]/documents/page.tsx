import prisma from '@/lib/prisma'
import { DocumentsClient } from './documents-client'

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  
  const documents = await prisma.document.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <DocumentsClient initialDocuments={documents} workspaceId={workspaceId} />
  )
}
