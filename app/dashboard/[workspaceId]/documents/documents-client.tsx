'use client'

import { useEffect } from 'react'
import { Document } from '@prisma/client'
import { DataTable } from './data-table'
import { columns } from './columns'
import { UploadDocumentButton } from './upload-button'
import { useRouter } from 'next/navigation'

export function DocumentsClient({ initialDocuments, workspaceId }: { initialDocuments: Document[], workspaceId: string }) {
  const router = useRouter()

  // Auto poll while any document is in PROCESSING state
  const isProcessing = initialDocuments.some(d => d.status === 'PROCESSING')

  useEffect(() => {
    if (!isProcessing) return

    const interval = setInterval(() => {
      router.refresh()
    }, 3000)

    return () => clearInterval(interval)
  }, [isProcessing, router])

  return (
    <div className="flex flex-col w-full mt-6 space-y-8 px-4 md:px-8 pb-10">
      <div className="flex items-center justify-between space-y-5 border-b border-border/50 pb-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-tighter text-foreground">Documents</h2>
          <p className="text-muted-foreground mt-1.5 font-medium">
            Manage your workspace knowledge base.
          </p>
        </div>
        <UploadDocumentButton workspaceId={workspaceId} />
      </div>

      <div className="w-full">
        <DataTable columns={columns} data={initialDocuments} />
      </div>
    </div>
  )
}
