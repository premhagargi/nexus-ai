'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function UploadDocumentButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploading(true)
    
    try {
      const formData = new FormData(e.currentTarget)
      const file = formData.get('file') as File
      
      if (!file || file.size === 0) {
        throw new Error('Please select a file')
      }

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
      setOpen(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a PDF, DOCX, or TXT file to your workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input id="file" name="file" type="file" accept=".pdf,.docx,.txt" required disabled={uploading} />
          </div>
          <Button type="submit" disabled={uploading} className="w-full">
            {uploading ? 'Uploading...' : 'Upload & Process'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
