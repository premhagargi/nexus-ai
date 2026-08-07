import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const session = await getSession()

    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { workspace: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify workspace membership
    const membership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: document.workspaceId, userId: session.userId } },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: You do not have access to this document' }, { status: 403 })
    }

    // Delete chunks and document from database
    await prisma.$transaction([
      prisma.documentChunk.deleteMany({ where: { documentId } }),
      prisma.document.delete({ where: { id: documentId } }),
    ])

    // Attempt to delete storage file from Supabase
    try {
      const supabase = await createClient()
      const storagePath = document.storageUrl.split('/documents/')[1]
      if (storagePath) {
        await supabase.storage.from('documents').remove([storagePath])
      }
    } catch (storageErr) {
      console.warn(`[DocumentDelete] Storage cleanup warning for doc ${documentId}:`, storageErr)
    }

    return NextResponse.json({ success: true, deletedId: documentId })
  } catch (error: any) {
    console.error('[DocumentDelete] Route Error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete document' }, { status: 500 })
  }
}
