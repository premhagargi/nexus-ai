import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
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
      include: {
        chunks: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            metadata: true,
            createdAt: true,
          },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const membership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: document.workspaceId, userId: session.userId } },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const fullContent = document.chunks.map((c) => c.content).join('\n\n---\n\n')

    return NextResponse.json({
      documentId: document.id,
      filename: document.filename,
      status: document.status,
      storageUrl: document.storageUrl,
      chunkCount: document.chunks.length,
      fullContent,
      chunks: document.chunks,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
