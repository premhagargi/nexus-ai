'use client'

import { useOptimistic, startTransition } from 'react'
import { Document } from '@prisma/client'
import { DataTable } from './data-table'
import { columns } from './columns'
import { UploadDocumentButton } from './upload-button'

export function DocumentsClient({ initialDocuments, workspaceId }: { initialDocuments: Document[], workspaceId: string }) {
  const [optimisticDocs, addOptimisticDoc] = useOptimistic(
    initialDocuments,
    (state, newDoc: Document) => [newDoc, ...state]
  )

  return (
    <div className="flex flex-col w-full mt-6 space-y-8 px-4 md:px-8 pb-10">
      <div className="flex items-center justify-between space-y-5 border-b border-border/50 pb-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-tighter text-foreground">Documents</h2>
          <p className="text-muted-foreground mt-1.5 font-medium">
            Manage your workspace knowledge base.
          </p>
        </div>
        <UploadDocumentButton 
          workspaceId={workspaceId} 
          onUploadStart={(doc) => startTransition(() => addOptimisticDoc(doc))} 
        />
      </div>

      <div className="w-full">
        <DataTable columns={columns} data={optimisticDocs} />
      </div>
    </div>
  )
}
