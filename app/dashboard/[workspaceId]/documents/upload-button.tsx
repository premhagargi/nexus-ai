'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, X, FileText, CheckCircle2, AlertCircle, Files, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

export interface UploadFileItem {
  file: File
  id: string
  status: 'idle' | 'uploading' | 'completed' | 'error'
  errorMessage?: string
}

export function UploadButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [filesList, setFilesList] = useState<UploadFileItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [currentIndex, setCurrentIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const addFiles = (newFiles: FileList | File[]) => {
    const validExtensions = ['pdf', 'docx', 'txt', 'md', 'csv']
    const added: UploadFileItem[] = []

    Array.from(newFiles).forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      if (!validExtensions.includes(ext)) {
        toast.error(`"${f.name}" has unsupported format .${ext}`)
        return
      }
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`"${f.name}" exceeds 20MB size limit`)
        return
      }
      // avoid duplicates by filename + size
      if (!filesList.some((existing) => existing.file.name === f.name && existing.file.size === f.size)) {
        added.push({
          file: f,
          id: `${f.name}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          status: 'idle',
        })
      }
    })

    if (added.length > 0) {
      setFilesList((prev) => [...prev, ...added])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  const handleRemoveFile = (id: string) => {
    if (uploading) return
    setFilesList((prev) => prev.filter((item) => item.id !== id))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClearAll = () => {
    if (uploading) return
    setFilesList([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function startSequentialUpload() {
    if (filesList.length === 0 || uploading) return

    setUploading(true)
    let successCount = 0
    let failCount = 0

    // Sequential Upload loop
    for (let i = 0; i < filesList.length; i++) {
      const item = filesList[i]

      // Skip already completed files if re-triggered
      if (item.status === 'completed') {
        successCount++
        continue
      }

      setCurrentIndex(i)
      setFilesList((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: 'uploading' } : f))
      )

      try {
        const formData = new FormData()
        formData.append('file', item.file)
        formData.append('workspaceId', workspaceId)

        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || `Upload failed for ${item.file.name}`)
        }

        successCount++
        setFilesList((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: 'completed' } : f))
        )
      } catch (err: any) {
        failCount++
        setFilesList((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'error', errorMessage: err.message } : f
          )
        )
      }
    }

    setCurrentIndex(null)
    setUploading(false)

    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} document(s)! Background processing started.`)
      router.refresh()
    }
    if (failCount > 0) {
      toast.error(`${failCount} document(s) failed to upload.`)
    }

    if (failCount === 0) {
      setTimeout(() => {
        setFilesList([])
        if (fileInputRef.current) fileInputRef.current.value = ''
        setOpen(false)
      }, 900)
    }
  }

  const getFileBadgeColor = (ext: string) => {
    switch (ext) {
      case 'pdf':
        return 'text-red-400 bg-red-500/10 border-red-500/20'
      case 'docx':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
      case 'txt':
      case 'md':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      case 'csv':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      default:
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
    }
  }

  const totalSizeMB = (
    filesList.reduce((acc, item) => acc + item.file.size, 0) /
    1024 /
    1024
  ).toFixed(2)

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (uploading) return
        setOpen(val)
        if (!val) {
          setFilesList([])
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      }}
    >
      <DialogTrigger>
        <Button disabled={uploading} className="shadow-lg hover:shadow-indigo-500/10 transition-all">
          <Upload className="mr-2 h-4 w-4" />
          Upload Documents
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg p-6 bg-card border-border shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-1.5 pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
            <Files className="h-5 w-5 text-indigo-400" />
            Upload Documents
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Add multiple items (PDF, DOCX, TXT, MD, CSV) up to 20MB each. Documents will process sequentially.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Drag & Drop File Select Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-500/10 scale-[0.99]'
                : 'border-border/80 bg-muted/20 hover:bg-muted/40 hover:border-indigo-500/50'
            } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.csv"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-2">
              <Upload className="h-5 w-5 text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Click to select or drag & drop files
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports PDF, DOCX, TXT, MD, CSV (Max 20MB)
            </p>
          </div>

          {/* Cards List for Selected Files */}
          {filesList.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1 text-xs text-muted-foreground font-medium">
                <span>
                  {filesList.length} File{filesList.length === 1 ? '' : 's'} ({totalSizeMB} MB)
                </span>
                {!uploading && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3 inline" /> Clear All
                  </button>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto space-y-2 pr-1 scrollbar-none">
                {filesList.map((item, idx) => {
                  const ext = (item.file.name.split('.').pop() || '').toLowerCase()
                  const isUploadingThis = item.status === 'uploading'
                  const isDone = item.status === 'completed'
                  const isError = item.status === 'error'

                  return (
                    <div
                      key={item.id}
                      className={`relative flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                        isUploadingThis
                          ? 'shimmer border-indigo-500/40 bg-indigo-500/5'
                          : isDone
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : isError
                          ? 'border-red-500/30 bg-red-500/5'
                          : 'border-border/70 bg-card hover:bg-muted/30'
                      }`}
                    >
                      {/* Left side: Icon & File Name */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-mono text-[10px] font-bold uppercase tracking-wider ${getFileBadgeColor(
                            ext
                          )}`}
                        >
                          {ext}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs font-semibold truncate ${
                              isUploadingThis ? 'shimmer text-indigo-400' : 'text-foreground'
                            }`}
                            title={item.file.name}
                          >
                            {item.file.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            {(item.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>

                      {/* Right side: Status indicator & Remove button */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isUploadingThis && (
                          <Badge
                            variant="secondary"
                            className="shimmer font-mono text-[10px] uppercase tracking-wider text-indigo-400 border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5"
                          >
                            Uploading...
                          </Badge>
                        )}
                        {isDone && (
                          <Badge
                            variant="secondary"
                            className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3 inline text-emerald-400" />
                            Uploaded
                          </Badge>
                        )}
                        {isError && (
                          <Badge
                            variant="destructive"
                            className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 flex items-center gap-1"
                            title={item.errorMessage}
                          >
                            <AlertCircle className="h-3 w-3 inline" />
                            Failed
                          </Badge>
                        )}
                        {item.status === 'idle' && (
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground border-border px-2 py-0.5"
                          >
                            Queued
                          </Badge>
                        )}

                        {!uploading && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(item.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                            aria-label={`Remove ${item.file.name}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Dialog Action Footer */}
          <div className="pt-2">
            <Button
              type="button"
              onClick={startSequentialUpload}
              disabled={uploading || filesList.length === 0}
              className="w-full font-medium shadow-md"
            >
              {uploading ? (
                <span className="shimmer text-indigo-200">
                  Uploading ({currentIndex !== null ? currentIndex + 1 : 0}/{filesList.length})...
                </span>
              ) : (
                `Start Upload (${filesList.length} Item${filesList.length === 1 ? '' : 's'})`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { UploadButton as UploadDocumentButton }


