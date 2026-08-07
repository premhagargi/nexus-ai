import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { inngest } from '@/lib/inngest/client'
import { createDocumentChunks, embedTexts, generateFallbackEmbedding } from '@/lib/rag'
import { createClient } from '@/lib/supabase/server'
// @ts-ignore
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import mammoth from 'mammoth'

export async function POST(
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
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify workspace membership
    const membership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: document.workspaceId, userId: session.userId } },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING', errorMessage: null },
    })

    const ext = (document.filename.split('.').pop() || '').toLowerCase()
    let storagePath = ''
    if (document.storageUrl) {
      const parts = document.storageUrl.split('/documents/')
      if (parts.length > 1) {
        storagePath = parts[1].split('?')[0]
      }
    }
    if (!storagePath) {
      storagePath = `${document.workspaceId}/${document.filename}`
    }

    try {
      await inngest.send({
        name: 'document/process',
        data: {
          documentId: document.id,
          workspaceId: document.workspaceId,
          storagePath: decodeURIComponent(storagePath),
          storageUrl: document.storageUrl,
          filename: document.filename,
          sourceType: ext,
        },
      })
    } catch (inngestErr) {
      console.warn('[ReprocessRoute] Inngest queue send warning:', inngestErr)
    }

    // Execute reprocessing synchronously so serverless containers complete execution reliably
    await reprocessDocument(document.id, storagePath, document.workspaceId, document.filename)

    const finalDoc = await prisma.document.findUnique({ where: { id: documentId } })

    return NextResponse.json({ success: true, documentId, status: finalDoc?.status || 'COMPLETED' })
  } catch (error: any) {
    console.error('[ReprocessRoute] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}

async function reprocessDocument(documentId: string, storagePath: string, workspaceId: string, filename: string) {
  try {
    await prisma.documentChunk.deleteMany({ where: { documentId } })
    const supabase = await createClient()
    const cleanPath = decodeURIComponent(storagePath)

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(cleanPath)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download storage file: ${downloadError?.message || 'Empty payload'}`)
    }

    const buffer = Buffer.from(await fileData.arrayBuffer())
    const ext = filename.split('.').pop()?.toLowerCase() || ''

    let text = ''
    if (ext === 'pdf') {
      const parseFn = typeof pdfParse === 'function' ? pdfParse : (pdfParse as any).default || (pdfParse as any).parse
      if (typeof parseFn !== 'function') {
        throw new Error('PDF parser engine initialization failed')
      }
      const parsed = await parseFn(buffer)
      text = parsed.text || ''
    } else if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value || ''
    } else {
      text = buffer.toString('utf-8')
    }

    text = text.replace(/\u0000/g, '').trim()
    if (!text) {
      throw new Error('Document contains no extractable text.')
    }

    const chunks = await createDocumentChunks(text, filename, documentId, ext)
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
    const texts = chunks.map((c) => c.content)
    const vectors = await embedTexts(texts, apiKey)

    const BATCH_SIZE = 20
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE)
      const batchVectors = vectors.slice(i, i + BATCH_SIZE)

      await prisma.$transaction(
        batchChunks.map((chunk, j) => {
          let vector = batchVectors[j]
          if (!vector || !Array.isArray(vector) || vector.length !== 768) {
            vector = generateFallbackEmbedding(chunk.content)
          }
          const vectorStr = `[${vector.join(',')}]`
          return prisma.$executeRawUnsafe(
            `INSERT INTO "DocumentChunk" (id, "workspaceId", "documentId", content, embedding, metadata, "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, $5::jsonb, NOW())`,
            workspaceId,
            documentId,
            chunk.content,
            vectorStr,
            JSON.stringify(chunk.metadata),
          )
        }),
      )
    }

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'COMPLETED',
        chunkCount: chunks.length,
        errorMessage: null,
      },
    })
  } catch (error: any) {
    console.error(`[Reprocess] Failed for documentId=${documentId}:`, error)
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        errorMessage: error?.message || 'Processing failed',
      },
    })
  }
}
