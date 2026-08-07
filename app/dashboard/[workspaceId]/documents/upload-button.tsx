'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, X, FileText, CheckCircle2, Files } from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'

export function UploadButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (selectedFiles.length === 0 || uploading) return
    
    setUploading(true)
    setUploadProgress({ current: 0, total: selectedFiles.length })

    let successCount = 0
    let failCount = 0

    try {
      // Dispatch all selected files in parallel to /api/documents/upload
      // Each file triggers its own Inngest background worker event!
      await Promise.all(
        selectedFiles.map(async (file, idx) => {
          try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('workspaceId', workspaceId)

            const res = await fetch(`/api/documents/upload`, {
              method: 'POST',
              body: formData,
            })

            if (!res.ok) {
              const err = await res.json()
              throw new Error(err.error || `Failed to upload ${file.name}`)
            }

            successCount++
            setUploadProgress((prev) => prev ? { ...prev, current: prev.current + 1 } : null)
          } catch (err: any) {
            failCount++
            toast.error(err.message || `Failed to upload ${file.name}`)
          }
        })
      )

      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} document(s)! Background ingestion started.`)
        router.refresh()
      }

      setSelectedFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      setOpen(false)
    } catch (error: any) {
      toast.error(error.message || 'Error during batch upload')
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files))
    } else {
      setSelectedFiles([])
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    if (selectedFiles.length <= 1 && fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const totalSizeMB = (selectedFiles.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (uploading) return
        setOpen(val)
        if (!val) setSelectedFiles([])
      }}
    >
      <DialogTrigger>
        <Button disabled={uploading}>
          {uploading ? (
            <>
              <Spinner className="mr-2 h-4 w-4 inline animate-spin" />
              Uploading ({uploadProgress?.current}/{uploadProgress?.total})...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Documents
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Files className="h-5 w-5 text-indigo-400" />
            Batch Upload Documents
          </DialogTitle>
          <DialogDescription>
            Select one or multiple files (PDF, DOCX, TXT, MD, CSV) to upload to your workspace in parallel.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="file-upload" className="sr-only">Choose Files</Label>
              <Input
                id="file-upload"
                name="files"
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,.csv"
                onChange={handleFileChange}
                ref={fileInputRef}
                disabled={uploading}
                className="cursor-pointer"
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1 font-medium">
                  <span>{selectedFiles.length} file(s) selected</span>
                  <span>Total: {totalSizeMB} MB</span>
                </div>
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/60 bg-muted/30 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                      <span className="truncate font-medium text-foreground">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground font-mono">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      {!uploading && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" disabled={uploading || selectedFiles.length === 0} className="w-full">
            {uploading ? (
              <>
                <Spinner className="mr-2 h-4 w-4 inline animate-spin" />
                Uploading ({uploadProgress?.current}/{uploadProgress?.total})...
              </>
            ) : (
              `Upload & Process (${selectedFiles.length} File${selectedFiles.length === 1 ? '' : 's'})`
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { UploadButton as UploadDocumentButton }

