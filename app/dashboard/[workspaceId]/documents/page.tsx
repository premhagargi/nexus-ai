import prisma from '@/lib/prisma'
import { UploadDocumentButton } from './upload-button'
import { DataTable } from './data-table'
import { columns } from './columns'

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
    <div className="flex flex-col w-full mt-6 space-y-8 px-4 md:px-8 pb-10">
      <div className="flex items-center justify-between space-y-5 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-tighter text-foreground">Documents</h2>
          <p className="text-muted-foreground mt-1.5 font-medium">
            Manage your workspace knowledge base.
          </p>
        </div>
        <UploadDocumentButton workspaceId={workspaceId} />
      </div>

      <div className="w-full">
        <DataTable columns={columns} data={documents} />
      </div>
    </div>
  )
}
