import prisma from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { UploadDocumentButton } from './upload-button'
import { Badge } from '@/components/ui/badge'

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
          <h2 className="text-3xl font-bold tracking-tight">Documents</h2>
          <p className="text-muted-foreground">
            Manage your workspace knowledge base.
          </p>
        </div>
        <UploadDocumentButton workspaceId={workspaceId} />
      </div>

      <div className="grid gap-4">
        {documents.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <CardTitle className="mb-2">No documents yet</CardTitle>
            <CardDescription>
              Upload PDFs, DOCX, or TXT files to start chatting with them.
            </CardDescription>
          </Card>
        ) : (
          documents.map(doc => (
            <Card key={doc.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium">{doc.filename}</p>
                    <p className="text-sm text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div>
                  <Badge variant={
                    doc.status === 'COMPLETED' ? 'default' :
                    doc.status === 'FAILED' ? 'destructive' : 'secondary'
                  }>
                    {doc.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
