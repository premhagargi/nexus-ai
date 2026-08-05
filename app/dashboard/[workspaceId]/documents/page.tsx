import prisma from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { UploadDocumentButton } from './upload-button'
import { Badge } from '@/components/ui/badge'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { FileText, Trash } from "lucide-react"

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tighter">Documents</h2>
          <p className="text-muted-foreground">
            Manage your workspace knowledge base.
          </p>
        </div>
        <UploadDocumentButton workspaceId={workspaceId} />
      </div>

      <div className="grid gap-4 max-w-4xl">
        {documents.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <CardTitle className="mb-2">No documents yet</CardTitle>
            <CardDescription>
              Upload PDFs, DOCX, or TXT files to start chatting with them.
            </CardDescription>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {documents.map(doc => {
              let state: "idle" | "uploading" | "processing" | "error" | "done" = "done"
              if (doc.status === 'PENDING') state = "uploading"
              if (doc.status === 'PROCESSING') state = "processing"
              if (doc.status === 'FAILED') state = "error"

              return (
                <Attachment key={doc.id} state={state} className="w-full max-w-full">
                  <AttachmentMedia>
                    <FileText className="h-5 w-5" />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{doc.filename}</AttachmentTitle>
                    <AttachmentDescription>
                      {state === 'error' ? 'Failed to process' : new Date(doc.createdAt).toLocaleDateString()}
                    </AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction aria-label={`Delete ${doc.filename}`}>
                      <Trash className="h-4 w-4" />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
