'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"

import { Document } from '@prisma/client'
import { Spinner } from '@/components/ui/spinner'

export function UploadDocumentButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const file = selectedFile
    if (!file || uploading) return
    
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('workspaceId', workspaceId)

      const res = await fetch(`/api/documents/upload`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to upload document')
      }

      toast.success('Document uploaded and processing started!')
      router.refresh()
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setOpen(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
    } else {
      setSelectedFile(null)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (uploading) return
      setOpen(val)
      if (!val) setSelectedFile(null)
    }}>
      <DialogTrigger render={
        <Button disabled={uploading}>
          {uploading ? (
            <>
              <Spinner className="mr-2 h-4 w-4 inline animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </>
          )}
        </Button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a PDF, DOCX, or TXT file to your workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className={selectedFile ? "hidden" : "block"}>
              <Label htmlFor="file" className="sr-only">File</Label>
              <Input 
                id="file" 
                name="file" 
                type="file" 
                accept=".pdf,.docx,.txt" 
                onChange={handleFileChange}
                ref={fileInputRef}
                disabled={uploading} 
              />
            </div>
            
            {selectedFile && (
              <Attachment state={uploading ? "uploading" : "idle"} className="w-full">
                <AttachmentMedia>
                  <FileText className="h-5 w-5" />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{selectedFile.name}</AttachmentTitle>
                  <AttachmentDescription>
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction 
                    type="button" 
                    aria-label="Remove file" 
                    onClick={handleRemoveFile}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            )}
          </div>
          <Button type="submit" disabled={uploading || !selectedFile} className="w-full">
            {uploading ? (
              <>
                <Spinner className="mr-2 h-4 w-4 inline animate-spin" />
                Uploading...
              </>
            ) : (
              'Upload & Process'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
