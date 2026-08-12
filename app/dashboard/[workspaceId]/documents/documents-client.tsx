'use client'

import { useEffect, useState } from 'react'
import type { Document } from '@/types/models'
import { DataTable } from './data-table'
import { columns } from './columns'
import { UploadDocumentButton } from './upload-button'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { FileText, Eye, Layers, ExternalLink, EyeIcon, Search, Sparkles } from 'lucide-react'

export function DocumentsClient({ initialDocuments, workspaceId }: { initialDocuments: Document[], workspaceId: string }) {
  const router = useRouter()
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [docDetail, setDocDetail] = useState<any | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Auto poll while any document is in PROCESSING state
  const isProcessing = initialDocuments.some(d => d.status === 'PROCESSING')

  useEffect(() => {
    if (!isProcessing) return

    const interval = setInterval(() => {
      router.refresh()
    }, 3000)

    return () => clearInterval(interval)
  }, [isProcessing, router])

  const openDocumentViewer = async (documentId: string) => {
    setSelectedDocId(documentId)
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/content`)
      const data = await res.json()
      if (res.ok) {
        setDocDetail(data)
      }
    } catch (e) {
      console.error('Failed to load document detail:', e)
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <div className="flex flex-col w-full space-y-8 pb-10">
      <div className="flex items-center justify-between space-y-5 border-b border-border/50 pb-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-tighter text-foreground">Knowledge Base</h2>
          <p className="text-muted-foreground mt-1.5 font-medium">
            Manage your workspace documents and vector chunks.
          </p>
        </div>
        <UploadDocumentButton workspaceId={workspaceId} />
      </div>

      <div className="w-full">
        <DataTable columns={columns} data={initialDocuments} />
      </div>

      {/* Document Viewer Modal */}
      <Dialog open={!!selectedDocId} onOpenChange={(val) => { if (!val) setSelectedDocId(null) }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                {docDetail?.filename || 'Document Preview'}
              </DialogTitle>
              {docDetail?.chunkCount ? (
                <Badge variant="secondary" className="font-mono text-xs">
                  {docDetail.chunkCount} Vector Chunks
                </Badge>
              ) : null}
            </div>
          </DialogHeader>

          {loadingDetail ? (
            <div className="flex flex-col items-center justify-center p-12 text-center gap-2">
              <Spinner className="h-6 w-6 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Loading document chunks...</p>
            </div>
          ) : docDetail ? (
            <div className="flex-1 overflow-y-auto space-y-4 pt-4 pr-1">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border text-xs">
                <span className="text-muted-foreground font-medium">Storage Location:</span>
                <a
                  href={docDetail.storageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                >
                  View File <ExternalLink className="h-3 w-3 inline" />
                </a>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Vector Chunk Explorer
                </h4>
                <div className="space-y-3">
                  {docDetail.chunks?.map((chunk: any, index: number) => (
                    <div key={chunk.id} className="p-3.5 rounded-xl bg-card border border-border/80 text-xs space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                        <span className="font-semibold text-indigo-400">Chunk #{index + 1}</span>
                        <span>{chunk.content.length} chars</span>
                      </div>
                      <p className="text-foreground leading-relaxed font-mono text-[11.5px] whitespace-pre-wrap bg-muted/30 p-2.5 rounded-lg border border-border/40">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
